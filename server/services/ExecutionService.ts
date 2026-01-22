import { db } from "../db";
import { positions, trades, deals, orders, competitionEntries } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { marketDataService } from "./MarketDataService";

const UNITS_PER_LOT = 100000;

export function lotsToUnits(lots: number): number {
  return Math.round(lots * UNITS_PER_LOT);
}

export function unitsToLots(units: number): number {
  return Math.round((units / UNITS_PER_LOT) * 100) / 100;
}

function getPipSize(pair: string): number {
  return pair.includes("JPY") ? 0.01 : 0.0001;
}

function calculatePnlCents(
  pair: string,
  side: string,
  units: number,
  entryPrice: number,
  exitPrice: number
): number {
  const isLong = side === "buy";
  const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
  
  if (pair.endsWith("-USD")) {
    return Math.round(priceDiff * units * 100);
  } else if (pair.startsWith("USD-")) {
    const pnlInQuote = priceDiff * units;
    const pnlInUsd = pnlInQuote / exitPrice;
    return Math.round(pnlInUsd * 100);
  }
  
  return Math.round(priceDiff * units * 100);
}

export interface ExecuteOrderParams {
  competitionId: string;
  userId: string;
  pair: string;
  side: "buy" | "sell";
  lots: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  spreadMarkupPips?: number;
  maxSlippagePips?: number;
}

export interface ExecuteOrderResult {
  success: boolean;
  error?: string;
  deal?: {
    id: string;
    tradeId: string;
    pair: string;
    side: string;
    lots: number;
    units: number;
    price: number;
    kind: string;
  };
  position?: {
    id: string;
    pair: string;
    side: string;
    quantityUnits: number;
    avgEntryPrice: number;
  };
}

export async function executeMarketOrder(params: ExecuteOrderParams): Promise<ExecuteOrderResult> {
  const {
    competitionId,
    userId,
    pair,
    side,
    lots,
    stopLossPrice,
    takeProfitPrice,
    spreadMarkupPips = 0.5,
    maxSlippagePips = 1.0,
  } = params;

  const units = lotsToUnits(lots);
  if (units <= 0) {
    return { success: false, error: "Invalid lot size" };
  }

  const quote = marketDataService.getQuote(pair);
  if (!quote) {
    return { success: false, error: "No quote available for " + pair };
  }

  const pipSize = getPipSize(pair);
  const markup = spreadMarkupPips * pipSize;
  const slippage = (Math.random() * maxSlippagePips) * pipSize;
  
  const fillPrice = side === "buy"
    ? quote.ask + markup + slippage
    : quote.bid - markup - slippage;

  const existingPositions = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.competitionId, competitionId),
        eq(positions.userId, userId),
        eq(positions.pair, pair)
      )
    );

  const existingPosition = existingPositions[0];

  let tradeId: string;
  let positionId: string;
  let newPositionUnits: number;
  let newAvgEntry: number;
  let newSide: string;
  let dealKind: "in" | "out";
  let realizedPnlCents = 0;

  if (!existingPosition) {
    const [newTrade] = await db
      .insert(trades)
      .values({
        competitionId,
        userId,
        pair,
        sideInitial: side,
        totalInUnits: units,
        avgEntryPrice: fillPrice,
        status: "open",
      })
      .returning();

    tradeId = newTrade.id;

    const [newPosition] = await db
      .insert(positions)
      .values({
        competitionId,
        userId,
        pair,
        side,
        quantityUnits: units,
        avgEntryPrice: fillPrice,
        stopLossPrice,
        takeProfitPrice,
      })
      .returning();

    positionId = newPosition.id;
    newPositionUnits = units;
    newAvgEntry = fillPrice;
    newSide = side;
    dealKind = "in";
  } else {
    const openTrades = await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.competitionId, competitionId),
          eq(trades.userId, userId),
          eq(trades.pair, pair),
          eq(trades.status, "open")
        )
      );

    const currentTrade = openTrades[0];
    if (!currentTrade) {
      return { success: false, error: "No open trade found for position" };
    }

    tradeId = currentTrade.id;
    positionId = existingPosition.id;

    if (existingPosition.side === side) {
      const totalUnits = existingPosition.quantityUnits + units;
      const weightedEntry =
        (existingPosition.avgEntryPrice * existingPosition.quantityUnits +
          fillPrice * units) /
        totalUnits;

      await db
        .update(positions)
        .set({
          quantityUnits: totalUnits,
          avgEntryPrice: weightedEntry,
          stopLossPrice: stopLossPrice ?? existingPosition.stopLossPrice,
          takeProfitPrice: takeProfitPrice ?? existingPosition.takeProfitPrice,
          updatedAt: new Date(),
        })
        .where(eq(positions.id, positionId));

      await db
        .update(trades)
        .set({
          totalInUnits: currentTrade.totalInUnits + units,
          avgEntryPrice: weightedEntry,
        })
        .where(eq(trades.id, tradeId));

      newPositionUnits = totalUnits;
      newAvgEntry = weightedEntry;
      newSide = side;
      dealKind = "in";
    } else {
      if (units >= existingPosition.quantityUnits) {
        realizedPnlCents = calculatePnlCents(
          pair,
          existingPosition.side,
          existingPosition.quantityUnits,
          existingPosition.avgEntryPrice,
          fillPrice
        );

        await db.delete(positions).where(eq(positions.id, positionId));

        await db
          .update(trades)
          .set({
            totalOutUnits: currentTrade.totalOutUnits + existingPosition.quantityUnits,
            avgExitPrice: fillPrice,
            realizedPnlCents: currentTrade.realizedPnlCents + realizedPnlCents,
            status: "closed",
            closedAt: new Date(),
          })
          .where(eq(trades.id, tradeId));

        const remainingUnits = units - existingPosition.quantityUnits;
        if (remainingUnits > 0) {
          const [newTrade] = await db
            .insert(trades)
            .values({
              competitionId,
              userId,
              pair,
              sideInitial: side,
              totalInUnits: remainingUnits,
              avgEntryPrice: fillPrice,
              status: "open",
            })
            .returning();

          const [newPosition] = await db
            .insert(positions)
            .values({
              competitionId,
              userId,
              pair,
              side,
              quantityUnits: remainingUnits,
              avgEntryPrice: fillPrice,
              stopLossPrice,
              takeProfitPrice,
            })
            .returning();

          newPositionUnits = remainingUnits;
          newAvgEntry = fillPrice;
          newSide = side;
          positionId = newPosition.id;
          tradeId = newTrade.id;
          dealKind = "in";
        } else {
          newPositionUnits = 0;
          newAvgEntry = fillPrice;
          newSide = side;
          dealKind = "out";
        }
      } else {
        realizedPnlCents = calculatePnlCents(
          pair,
          existingPosition.side,
          units,
          existingPosition.avgEntryPrice,
          fillPrice
        );

        const newUnits = existingPosition.quantityUnits - units;

        await db
          .update(positions)
          .set({
            quantityUnits: newUnits,
            realizedPnlCents: existingPosition.realizedPnlCents + realizedPnlCents,
            updatedAt: new Date(),
          })
          .where(eq(positions.id, positionId));

        await db
          .update(trades)
          .set({
            totalOutUnits: currentTrade.totalOutUnits + units,
            realizedPnlCents: currentTrade.realizedPnlCents + realizedPnlCents,
          })
          .where(eq(trades.id, tradeId));

        newPositionUnits = newUnits;
        newAvgEntry = existingPosition.avgEntryPrice;
        newSide = existingPosition.side;
        dealKind = "out";
      }
    }

    await updateEntryEquity(competitionId, userId, realizedPnlCents);
  }

  const [deal] = await db
    .insert(deals)
    .values({
      tradeId,
      competitionId,
      userId,
      pair,
      side,
      units,
      lots,
      price: fillPrice,
      kind: dealKind,
      realizedPnlCents,
    })
    .returning();

  return {
    success: true,
    deal: {
      id: deal.id,
      tradeId: deal.tradeId,
      pair: deal.pair,
      side: deal.side,
      lots: deal.lots,
      units: deal.units,
      price: deal.price,
      kind: deal.kind,
    },
    position:
      newPositionUnits > 0
        ? {
            id: positionId,
            pair,
            side: newSide,
            quantityUnits: newPositionUnits,
            avgEntryPrice: newAvgEntry,
          }
        : undefined,
  };
}

export interface PartialCloseParams {
  competitionId: string;
  userId: string;
  positionId: string;
  closeLots?: number;
  closePercentage?: number;
}

export async function partialClosePosition(params: PartialCloseParams): Promise<ExecuteOrderResult> {
  const { competitionId, userId, positionId, closeLots, closePercentage } = params;

  const positionRows = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.id, positionId),
        eq(positions.competitionId, competitionId),
        eq(positions.userId, userId)
      )
    );

  const position = positionRows[0];
  if (!position) {
    return { success: false, error: "Position not found" };
  }

  let unitsToClose: number;
  if (closeLots !== undefined) {
    unitsToClose = lotsToUnits(closeLots);
  } else if (closePercentage !== undefined) {
    unitsToClose = Math.round(position.quantityUnits * (closePercentage / 100));
  } else {
    return { success: false, error: "Specify closeLots or closePercentage" };
  }

  unitsToClose = Math.min(unitsToClose, position.quantityUnits);
  const lotsToClose = unitsToLots(unitsToClose);

  const closeSide = position.side === "buy" ? "sell" : "buy";

  return executeMarketOrder({
    competitionId,
    userId,
    pair: position.pair,
    side: closeSide as "buy" | "sell",
    lots: lotsToClose,
  });
}

export interface UpdatePositionSLTPParams {
  competitionId: string;
  userId: string;
  positionId: string;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
}

export async function updatePositionSLTP(params: UpdatePositionSLTPParams): Promise<{ success: boolean; error?: string }> {
  const { competitionId, userId, positionId, stopLossPrice, takeProfitPrice } = params;

  const positionRows = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.id, positionId),
        eq(positions.competitionId, competitionId),
        eq(positions.userId, userId)
      )
    );

  const position = positionRows[0];
  if (!position) {
    return { success: false, error: "Position not found" };
  }

  await db
    .update(positions)
    .set({
      stopLossPrice: stopLossPrice === null ? null : (stopLossPrice ?? position.stopLossPrice),
      takeProfitPrice: takeProfitPrice === null ? null : (takeProfitPrice ?? position.takeProfitPrice),
      updatedAt: new Date(),
    })
    .where(eq(positions.id, positionId));

  return { success: true };
}

async function updateEntryEquity(competitionId: string, userId: string, realizedPnlCents: number): Promise<void> {
  const entries = await db
    .select()
    .from(competitionEntries)
    .where(
      and(
        eq(competitionEntries.competitionId, competitionId),
        eq(competitionEntries.userId, userId)
      )
    );

  const entry = entries[0];
  if (!entry) return;

  const newCash = entry.cashCents + realizedPnlCents;
  const newEquity = entry.equityCents + realizedPnlCents;

  await db
    .update(competitionEntries)
    .set({
      cashCents: newCash,
      equityCents: newEquity,
      maxEquityCents: Math.max(entry.maxEquityCents, newEquity),
    })
    .where(eq(competitionEntries.id, entry.id));
}

export async function getDeals(competitionId: string, userId: string) {
  return db
    .select()
    .from(deals)
    .where(
      and(eq(deals.competitionId, competitionId), eq(deals.userId, userId))
    )
    .orderBy(deals.createdAt);
}

export async function getTrades(competitionId: string, userId: string) {
  return db
    .select()
    .from(trades)
    .where(
      and(eq(trades.competitionId, competitionId), eq(trades.userId, userId))
    )
    .orderBy(trades.openedAt);
}
