import { Server, Namespace } from "socket.io";
import { bettingService, isBettingEnabled } from "./BettingService";
import { db } from "../db";
import { pvpChallenges, competitionEntries, competitions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface TraderPerformance {
  returnPct: number;
  recentReturns: number[];
}

interface OddsUpdate {
  matchId: string;
  poolA: number;
  poolB: number;
  projMultA: number | null;
  projMultB: number | null;
  pWinA: number;
  pWinB: number;
  challengerId: string;
  inviteeId: string;
  timeRemainingPct: number;
}

const EPSILON = 0.0001;
const MIN_SIGMA = 0.001;

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

class OddsService {
  private io: Server | null = null;
  private bettingNamespace: Namespace | null = null;
  private performanceHistory: Map<string, Map<string, number[]>> = new Map();
  private tickIntervals: Map<string, NodeJS.Timeout> = new Map();

  initialize(io: Server): void {
    this.io = io;
    this.bettingNamespace = this.io.of("/betting");
    this.setupEventHandlers();
    console.log("OddsService initialized with Socket.io /betting namespace");
  }

  private setupEventHandlers(): void {
    if (!this.bettingNamespace) return;

    this.bettingNamespace.on("connection", (socket) => {
      socket.on("joinMarket", (data: { matchId: string }) => {
        const { matchId } = data;
        if (!matchId) return;
        socket.join(`market:${matchId}`);
        this.sendCurrentOdds(matchId);
      });

      socket.on("leaveMarket", (data: { matchId: string }) => {
        const { matchId } = data;
        if (!matchId) return;
        socket.leave(`market:${matchId}`);
      });
    });
  }

  async startTickingForMatch(matchId: string): Promise<void> {
    if (this.tickIntervals.has(matchId)) {
      return;
    }

    const interval = setInterval(async () => {
      await this.broadcastOddsUpdate(matchId);
    }, 1000);

    this.tickIntervals.set(matchId, interval);
    console.log(`[OddsService] Started ticking for match ${matchId}`);
  }

  stopTickingForMatch(matchId: string): void {
    const interval = this.tickIntervals.get(matchId);
    if (interval) {
      clearInterval(interval);
      this.tickIntervals.delete(matchId);
      console.log(`[OddsService] Stopped ticking for match ${matchId}`);
    }
  }

  private async sendCurrentOdds(matchId: string): Promise<void> {
    const update = await this.computeOddsUpdate(matchId);
    if (update && this.bettingNamespace) {
      this.bettingNamespace.to(`market:${matchId}`).emit("betting:update", update);
    }
  }

  async broadcastOddsUpdate(matchId: string): Promise<void> {
    if (!isBettingEnabled()) return;

    const update = await this.computeOddsUpdate(matchId);
    if (update && this.bettingNamespace) {
      this.bettingNamespace.to(`market:${matchId}`).emit("betting:update", update);
    }
  }

  async onBetPlaced(matchId: string): Promise<void> {
    await this.broadcastOddsUpdate(matchId);
  }

  private async computeOddsUpdate(matchId: string): Promise<OddsUpdate | null> {
    const oddsData = await bettingService.getOddsData(matchId);
    if (!oddsData) {
      return null;
    }

    const [match] = await db
      .select()
      .from(pvpChallenges)
      .where(eq(pvpChallenges.id, matchId))
      .limit(1);

    if (!match || !match.competitionId) {
      return null;
    }

    const [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, match.competitionId))
      .limit(1);

    if (!comp) {
      return null;
    }

    const entries = await db
      .select()
      .from(competitionEntries)
      .where(eq(competitionEntries.competitionId, match.competitionId));

    const challengerEntry = entries.find((e) => e.userId === match.challengerId);
    const inviteeEntry = entries.find((e) => e.userId === match.inviteeId);

    const startingBalance = comp.startingBalanceCents;
    const returnA = challengerEntry && startingBalance > 0
      ? ((challengerEntry.equityCents - startingBalance) / startingBalance)
      : 0;
    const returnB = inviteeEntry && startingBalance > 0
      ? ((inviteeEntry.equityCents - startingBalance) / startingBalance)
      : 0;

    const now = Date.now();
    const startTime = comp.startAt?.getTime() || now;
    const endTime = comp.endAt?.getTime() || (now + 3600000);
    const totalDuration = endTime - startTime;
    const elapsed = now - startTime;
    const remaining = Math.max(0, endTime - now);
    const timeRemainingPct = totalDuration > 0 ? remaining / totalDuration : 0;

    this.recordPerformance(matchId, oddsData.challengerId, returnA);
    this.recordPerformance(matchId, oddsData.inviteeId, returnB);

    const { pWinA, pWinB } = this.computeWinProbability(
      matchId,
      oddsData.challengerId,
      oddsData.inviteeId,
      returnA,
      returnB,
      timeRemainingPct
    );

    return {
      matchId,
      poolA: oddsData.poolA,
      poolB: oddsData.poolB,
      projMultA: oddsData.projMultA,
      projMultB: oddsData.projMultB,
      pWinA,
      pWinB,
      challengerId: oddsData.challengerId,
      inviteeId: oddsData.inviteeId,
      timeRemainingPct,
    };
  }

  private recordPerformance(matchId: string, traderId: string, returnPct: number): void {
    if (!this.performanceHistory.has(matchId)) {
      this.performanceHistory.set(matchId, new Map());
    }

    const matchHistory = this.performanceHistory.get(matchId)!;
    if (!matchHistory.has(traderId)) {
      matchHistory.set(traderId, []);
    }

    const traderHistory = matchHistory.get(traderId)!;
    traderHistory.push(returnPct);

    if (traderHistory.length > 60) {
      traderHistory.shift();
    }
  }

  private computeVolatility(returns: number[]): number {
    if (returns.length < 2) return MIN_SIGMA;

    const diffs: number[] = [];
    for (let i = 1; i < returns.length; i++) {
      diffs.push(returns[i] - returns[i - 1]);
    }

    if (diffs.length === 0) return MIN_SIGMA;

    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const variance = diffs.reduce((sum, d) => sum + (d - mean) ** 2, 0) / diffs.length;
    const sigma = Math.sqrt(variance);

    return Math.max(sigma, MIN_SIGMA);
  }

  private computeWinProbability(
    matchId: string,
    challengerId: string,
    inviteeId: string,
    returnA: number,
    returnB: number,
    timeRemainingPct: number
  ): { pWinA: number; pWinB: number } {
    if (timeRemainingPct <= 0) {
      return returnA > returnB ? { pWinA: 1, pWinB: 0 } : { pWinA: 0, pWinB: 1 };
    }

    const matchHistory = this.performanceHistory.get(matchId);
    const historyA = matchHistory?.get(challengerId) || [];
    const historyB = matchHistory?.get(inviteeId) || [];

    const sigmaA = this.computeVolatility(historyA);
    const sigmaB = this.computeVolatility(historyB);
    const sigmaDiff = Math.sqrt(sigmaA ** 2 + sigmaB ** 2) + EPSILON;

    const lead = returnA - returnB;
    const timeScale = Math.sqrt(timeRemainingPct) + EPSILON;

    const z = lead / (sigmaDiff * timeScale);
    const pWinA = normalCDF(z);
    const pWinB = 1 - pWinA;

    return { pWinA: Math.max(0.01, Math.min(0.99, pWinA)), pWinB: Math.max(0.01, Math.min(0.99, pWinB)) };
  }

  clearMatchHistory(matchId: string): void {
    this.performanceHistory.delete(matchId);
    this.stopTickingForMatch(matchId);
  }
}

export const oddsService = new OddsService();
