import { db } from "../db";
import { betMarkets, bets, wallets, tokenTransactions, pvpChallenges } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export function isBettingEnabled(): boolean {
  return process.env.ENABLE_BET_BEHIND === "true";
}

export class BettingService {
  async createMarketForMatch(matchId: string): Promise<{ id: string } | null> {
    if (!isBettingEnabled()) {
      console.log("[BettingService] Betting is disabled, skipping market creation");
      return null;
    }

    const existingMarket = await db
      .select()
      .from(betMarkets)
      .where(eq(betMarkets.matchId, matchId))
      .limit(1);

    if (existingMarket.length > 0) {
      console.log("[BettingService] Market already exists for match", matchId);
      return { id: existingMarket[0].id };
    }

    const [market] = await db
      .insert(betMarkets)
      .values({
        matchId,
        status: "OPEN",
        openAt: new Date(),
      })
      .returning();

    console.log("[BettingService] Created market", market.id, "for match", matchId);
    return { id: market.id };
  }

  async getMarketByMatchId(matchId: string) {
    const [market] = await db
      .select()
      .from(betMarkets)
      .where(eq(betMarkets.matchId, matchId))
      .limit(1);

    return market || null;
  }

  async placeBet(
    marketId: string,
    bettorId: string,
    pickUserId: string,
    amountTokens: number
  ): Promise<{ success: boolean; error?: string; betId?: string }> {
    if (!isBettingEnabled()) {
      return { success: false, error: "Betting is disabled" };
    }

    const [market] = await db
      .select()
      .from(betMarkets)
      .where(eq(betMarkets.id, marketId))
      .limit(1);

    if (!market) {
      return { success: false, error: "Market not found" };
    }

    if (market.status !== "OPEN") {
      return { success: false, error: "Market is not open for betting" };
    }

    if (amountTokens < market.minBetTokens) {
      return { success: false, error: `Minimum bet is ${market.minBetTokens} tokens` };
    }

    const existingBets = await db
      .select({ total: sql<number>`SUM(${bets.amountTokens})` })
      .from(bets)
      .where(and(eq(bets.marketId, marketId), eq(bets.bettorId, bettorId), eq(bets.status, "PLACED")));

    const totalBetByUser = Number(existingBets[0]?.total || 0);
    if (totalBetByUser + amountTokens > market.maxBetTokensPerUser) {
      return {
        success: false,
        error: `Maximum bet per user is ${market.maxBetTokensPerUser} tokens`,
      };
    }

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, bettorId))
      .limit(1);

    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    const availableTokens = wallet.balanceTokens - wallet.lockedTokens;
    if (availableTokens < amountTokens) {
      return { success: false, error: "Insufficient tokens" };
    }

    await db
      .update(wallets)
      .set({ lockedTokens: wallet.lockedTokens + amountTokens })
      .where(eq(wallets.userId, bettorId));

    await db.insert(tokenTransactions).values({
      userId: bettorId,
      kind: "BET_PLACE",
      amountTokens: -amountTokens,
      referenceType: "bet_market",
      referenceId: marketId,
    });

    const [bet] = await db
      .insert(bets)
      .values({
        marketId,
        bettorId,
        pickUserId,
        amountTokens,
        status: "PLACED",
      })
      .returning();

    console.log("[BettingService] Placed bet", bet.id, "for", amountTokens, "tokens on", pickUserId);
    return { success: true, betId: bet.id };
  }

  async closeMarket(marketId: string): Promise<void> {
    await db
      .update(betMarkets)
      .set({ status: "CLOSED", closeAt: new Date() })
      .where(eq(betMarkets.id, marketId));

    console.log("[BettingService] Closed market", marketId);
  }

  async settleMarket(
    marketId: string,
    winnerUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const [market] = await db
      .select()
      .from(betMarkets)
      .where(eq(betMarkets.id, marketId))
      .limit(1);

    if (!market) {
      return { success: false, error: "Market not found" };
    }

    if (market.status === "SETTLED") {
      return { success: false, error: "Market already settled" };
    }

    const allBets = await db
      .select()
      .from(bets)
      .where(and(eq(bets.marketId, marketId), eq(bets.status, "PLACED")));

    const winningBets = allBets.filter((b) => b.pickUserId === winnerUserId);
    const losingBets = allBets.filter((b) => b.pickUserId !== winnerUserId);

    const totalPool = allBets.reduce((sum, b) => sum + b.amountTokens, 0);
    const winningPool = winningBets.reduce((sum, b) => sum + b.amountTokens, 0);

    const rakeAmount = Math.floor((totalPool * market.rakeBps) / 10000);
    const payoutPool = totalPool - rakeAmount;

    for (const bet of winningBets) {
      const share = winningPool > 0 ? bet.amountTokens / winningPool : 0;
      const payout = Math.floor(payoutPool * share);

      await db
        .update(wallets)
        .set({
          lockedTokens: sql`${wallets.lockedTokens} - ${bet.amountTokens}`,
          balanceTokens: sql`${wallets.balanceTokens} + ${payout - bet.amountTokens}`,
        })
        .where(eq(wallets.userId, bet.bettorId));

      await db.insert(tokenTransactions).values({
        userId: bet.bettorId,
        kind: "BET_PAYOUT",
        amountTokens: payout,
        referenceType: "bet",
        referenceId: bet.id,
      });

      await db.update(bets).set({ status: "SETTLED" }).where(eq(bets.id, bet.id));
    }

    for (const bet of losingBets) {
      await db
        .update(wallets)
        .set({
          lockedTokens: sql`${wallets.lockedTokens} - ${bet.amountTokens}`,
          balanceTokens: sql`${wallets.balanceTokens} - ${bet.amountTokens}`,
        })
        .where(eq(wallets.userId, bet.bettorId));

      await db.update(bets).set({ status: "SETTLED" }).where(eq(bets.id, bet.id));
    }

    await db
      .update(betMarkets)
      .set({
        status: "SETTLED",
        settledAt: new Date(),
        winnerUserId,
      })
      .where(eq(betMarkets.id, marketId));

    console.log("[BettingService] Settled market", marketId, "winner:", winnerUserId);
    return { success: true };
  }

  async voidMarket(marketId: string): Promise<void> {
    const allBets = await db
      .select()
      .from(bets)
      .where(and(eq(bets.marketId, marketId), eq(bets.status, "PLACED")));

    for (const bet of allBets) {
      await db
        .update(wallets)
        .set({ lockedTokens: sql`${wallets.lockedTokens} - ${bet.amountTokens}` })
        .where(eq(wallets.userId, bet.bettorId));

      await db.insert(tokenTransactions).values({
        userId: bet.bettorId,
        kind: "BET_REFUND",
        amountTokens: bet.amountTokens,
        referenceType: "bet",
        referenceId: bet.id,
      });

      await db.update(bets).set({ status: "REFUNDED" }).where(eq(bets.id, bet.id));
    }

    await db.update(betMarkets).set({ status: "VOID" }).where(eq(betMarkets.id, marketId));

    console.log("[BettingService] Voided market", marketId);
  }

  async getBetsByMarket(marketId: string) {
    return db.select().from(bets).where(eq(bets.marketId, marketId));
  }

  async getPoolStats(marketId: string) {
    const allBets = await db
      .select()
      .from(bets)
      .where(and(eq(bets.marketId, marketId), eq(bets.status, "PLACED")));

    const [market] = await db
      .select()
      .from(betMarkets)
      .where(eq(betMarkets.id, marketId))
      .limit(1);

    if (!market) {
      return null;
    }

    const [match] = await db
      .select()
      .from(pvpChallenges)
      .where(eq(pvpChallenges.id, market.matchId))
      .limit(1);

    if (!match) {
      return null;
    }

    const challengerPool = allBets
      .filter((b) => b.pickUserId === match.challengerId)
      .reduce((sum, b) => sum + b.amountTokens, 0);

    const inviteePool = allBets
      .filter((b) => b.pickUserId === match.inviteeId)
      .reduce((sum, b) => sum + b.amountTokens, 0);

    const totalPool = challengerPool + inviteePool;

    return {
      totalPool,
      challengerPool,
      inviteePool,
      challengerOdds: totalPool > 0 && challengerPool > 0 ? totalPool / challengerPool : 0,
      inviteeOdds: totalPool > 0 && inviteePool > 0 ? totalPool / inviteePool : 0,
      betCount: allBets.length,
    };
  }
}

export const bettingService = new BettingService();
