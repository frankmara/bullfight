import { db } from "../db";
import { users, wallets, tokenTransactions, competitionEntries, pvpChallenges, positions, chatMessages, chatChannels, bets, betMarkets, competitions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { executeMarketOrder } from "./ExecutionService";
import { storage } from "../storage";

const BOT_NAMES = [
  "AlphaTrader", "BetaBull", "GammaShorter", "DeltaHedge", "EpsilonScalp",
  "ZetaSwing", "EtaFlow", "ThetaGrind", "IotaPips", "KappaKing",
  "LambdaLong", "MuMomentum", "NuNinja", "XiXpert", "OmicronOp",
  "PiPivot", "RhoRisk", "SigmaSnipe", "TauTrend", "UpsilonUltra",
  "PhiFlip", "ChiChart", "PsiProfit", "OmegaOG", "CryptoKid",
  "ForexFury", "PipMaster", "TrendRider", "SwingKing", "ScalpQueen",
  "BullRunner", "BearHunter", "GoldDigger", "OilBaron", "TechTrader",
  "ValueVet", "GrowthGuru", "DividendDuke", "OptionsOracle", "FuturesFan",
  "SpotSniper", "MarginMaster", "LeverageLord", "RiskRanger", "SafetyFirst",
  "VolatilityVic", "MomentumMax", "BreakoutBob", "SupportSam", "ResistanceRex",
  "FiboFrank", "MACDMike", "RSIRita", "BollingerBen", "IchimokuIke",
  "CandleCarl", "PatternPat", "VolumeVince", "TrendTina", "RangeyRay",
  "NewsNancy", "FundyFred", "TechTom", "SentiSue", "FlowFiona",
  "DarkPoolDan", "SmartMoneyMike", "RetailRita", "InstitutionalIan", "HedgieHank",
  "AlgoAlex", "BottyBetty", "QuandQuan", "MLMary", "AIAndy",
  "FastFingers", "SlowSteady", "PatientPete", "AggressiveAmy", "BalancedBill",
  "DayTradeDave", "SwingSteve", "PositionPaul", "ScalpingSally", "HODLHelen",
  "LongLarry", "ShortSheila", "NeutralNate", "BullishBeth", "BearishBart",
  "GreenGreg", "RedRobert", "FlatFiona", "TrendyTrev", "ChoppyChris",
  "BreakEvenBen", "ProfitPenny", "LossyLou", "WinningWalt", "DrawdownDrew"
];

const CHAT_MESSAGES = [
  "Let's go! This trade is looking good",
  "Anyone else seeing this breakout?",
  "Risky move but I'm in",
  "Just closed for profit, nice!",
  "Ouch, that stop loss hit hard",
  "The market is wild today",
  "Who's long on this pair?",
  "Short squeeze incoming?",
  "Diamond hands!",
  "This volatility is insane",
  "Time to scale in",
  "Taking profits here",
  "News just dropped, watch out",
  "Technical setup looks clean",
  "Support holding strong",
  "Resistance broken!",
  "Volume picking up",
  "Waiting for confirmation",
  "This is the way",
  "Good luck everyone!",
  "Anyone seeing this pattern?",
  "Classic head and shoulders",
  "Double bottom forming",
  "RSI oversold, looking to buy",
  "MACD crossing bullish",
  "Trend line broken",
  "Key level right here",
  "Patience is key",
  "Risk management first",
  "Small position, big conviction"
];

const CURRENCY_PAIRS = ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"];

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface SimulationState {
  isRunning: boolean;
  botUserIds: string[];
  activeCompetitionIds: string[];
  activePvpMatchIds: string[];
  tradeIntervalId?: ReturnType<typeof setInterval>;
  chatIntervalId?: ReturnType<typeof setInterval>;
  betIntervalId?: ReturnType<typeof setInterval>;
  positionCloseIntervalId?: ReturnType<typeof setInterval>;
  stats: {
    tradesExecuted: number;
    chatMessagesSent: number;
    betsPlaced: number;
    positionsClosed: number;
  };
}

class SimulationService {
  private state: SimulationState = {
    isRunning: false,
    botUserIds: [],
    activeCompetitionIds: [],
    activePvpMatchIds: [],
    stats: {
      tradesExecuted: 0,
      chatMessagesSent: 0,
      betsPlaced: 0,
      positionsClosed: 0,
    },
  };

  async getStatus() {
    return {
      isRunning: this.state.isRunning,
      botCount: this.state.botUserIds.length,
      activeCompetitions: this.state.activeCompetitionIds.length,
      activePvpMatches: this.state.activePvpMatchIds.length,
      stats: this.state.stats,
    };
  }

  async start() {
    if (this.state.isRunning) {
      return { success: false, error: "Simulation already running" };
    }

    console.log("[SimulationService] Starting simulation...");

    await this.createBotUsers();
    await this.setupCompetitions();
    await this.setupPvpMatches();
    this.startTradeLoop();
    this.startChatLoop();
    this.startBetLoop();
    this.startPositionCloseLoop();

    this.state.isRunning = true;
    console.log("[SimulationService] Simulation started with", this.state.botUserIds.length, "bots");

    return { success: true, status: await this.getStatus() };
  }

  async stop() {
    if (!this.state.isRunning) {
      return { success: false, error: "Simulation not running" };
    }

    console.log("[SimulationService] Stopping simulation...");

    if (this.state.tradeIntervalId) clearInterval(this.state.tradeIntervalId);
    if (this.state.chatIntervalId) clearInterval(this.state.chatIntervalId);
    if (this.state.betIntervalId) clearInterval(this.state.betIntervalId);
    if (this.state.positionCloseIntervalId) clearInterval(this.state.positionCloseIntervalId);

    this.state.isRunning = false;
    console.log("[SimulationService] Simulation stopped");

    return { success: true, status: await this.getStatus() };
  }

  private async createBotUsers() {
    console.log("[SimulationService] Creating bot users...");
    const botIds: string[] = [];
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash("bot_password_123", 10);

    for (let i = 0; i < 100; i++) {
      const botName = BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? `_${Math.floor(i / BOT_NAMES.length)}` : "");
      const email = `bot_${botName.toLowerCase()}@simulation.local`;

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (existing.length > 0) {
        botIds.push(existing[0].id);
        
        const existingWallet = await db.select().from(wallets).where(eq(wallets.userId, existing[0].id)).limit(1);
        if (existingWallet.length === 0) {
          await db.insert(wallets).values({
            userId: existing[0].id,
            balanceTokens: 10000,
            lockedTokens: 0,
            updatedAt: new Date(),
          });
        }
      } else {
        const botId = generateUUID();
        await db.insert(users).values({
          email,
          username: botName,
          passwordHash: hashedPassword,
          role: "user",
          createdAt: new Date(),
        }).returning().then(rows => {
          if (rows.length > 0) {
            botIds.push(rows[0].id);
          }
        });

        const insertedUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (insertedUser.length > 0) {
          const userId = insertedUser[0].id;
          if (!botIds.includes(userId)) {
            botIds.push(userId);
          }

          await db.insert(wallets).values({
            userId,
            balanceTokens: 10000,
            lockedTokens: 0,
            updatedAt: new Date(),
          }).onConflictDoNothing();

          await db.insert(tokenTransactions).values({
            userId,
            kind: "ADJUSTMENT",
            amountTokens: 10000,
            createdAt: new Date(),
          });
        }
      }
    }

    this.state.botUserIds = botIds;
    console.log("[SimulationService] Created/found", botIds.length, "bot users");
  }

  private async setupCompetitions() {
    console.log("[SimulationService] Setting up competitions...");
    
    const activeCompetitions = await db.select()
      .from(competitions)
      .where(eq(competitions.status, "active"))
      .limit(5);

    if (activeCompetitions.length === 0) {
      const [newComp] = await db.insert(competitions).values({
        title: "Simulation Tournament",
        description: "Automated simulation tournament",
        buyInCents: 0,
        buyInTokens: 0,
        startAt: new Date(Date.now() - 1000 * 60 * 30),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        status: "active",
        allowedPairsJson: CURRENCY_PAIRS,
        entryCap: 200,
        startingBalanceCents: 10000000,
      }).returning();
      
      this.state.activeCompetitionIds = [newComp.id];

      for (let i = 0; i < Math.min(50, this.state.botUserIds.length); i++) {
        await db.insert(competitionEntries).values({
          competitionId: newComp.id,
          userId: this.state.botUserIds[i],
          cashCents: 10000000,
          equityCents: 10000000,
          maxEquityCents: 10000000,
          paymentStatus: "completed",
          joinedAt: new Date(),
        }).onConflictDoNothing();
      }
    } else {
      this.state.activeCompetitionIds = activeCompetitions.map(c => c.id);
      
      for (const comp of activeCompetitions) {
        const entries = await storage.getCompetitionEntries(comp.id);
        const existingUserIds = new Set(entries.map(e => e.userId));
        
        let addedCount = 0;
        for (const botId of this.state.botUserIds) {
          if (!existingUserIds.has(botId) && addedCount < 20) {
            await db.insert(competitionEntries).values({
              competitionId: comp.id,
              userId: botId,
              cashCents: comp.startingBalanceCents,
              equityCents: comp.startingBalanceCents,
              maxEquityCents: comp.startingBalanceCents,
              paymentStatus: "completed",
              joinedAt: new Date(),
            }).onConflictDoNothing();
            addedCount++;
          }
        }
      }
    }

    console.log("[SimulationService] Active competitions:", this.state.activeCompetitionIds.length);
  }

  private async setupPvpMatches() {
    console.log("[SimulationService] Setting up PvP matches...");

    const livePvpMatches = await db.select()
      .from(pvpChallenges)
      .where(and(
        eq(pvpChallenges.liveStatus, "live"),
        eq(pvpChallenges.visibility, "public"),
        eq(pvpChallenges.arenaListed, true)
      ))
      .limit(10);

    if (livePvpMatches.length === 0) {
      for (let i = 0; i < 3; i++) {
        const challengerId = this.state.botUserIds[i * 2];
        const inviteeId = this.state.botUserIds[i * 2 + 1];
        const matchId = `sim-pvp-${generateUUID().slice(0, 8)}`;
        const pair = CURRENCY_PAIRS[i % CURRENCY_PAIRS.length];

        await db.insert(pvpChallenges).values({
          id: matchId,
          challengerId,
          inviteeId,
          inviteeEmail: `bot@sim.local`,
          status: "accepted",
          stakeCents: 5000,
          stakeTokens: 50,
          startingBalanceCents: 10000000,
          allowedPairsJson: [pair],
          startAt: new Date(Date.now() - 1000 * 60 * 10),
          endAt: new Date(Date.now() + 1000 * 60 * 50),
          visibility: "public",
          arenaListed: true,
          chatEnabled: true,
          bettingEnabled: true,
          liveStatus: "live",
          challengerAccepted: true,
          inviteeAccepted: true,
          challengerPaid: true,
          inviteePaid: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();

        this.state.activePvpMatchIds.push(matchId);

        const channelId = `pvp-${matchId}`;
        await db.insert(chatChannels).values({
          kind: "PVP_MATCH",
          refId: matchId,
          createdAt: new Date(),
        }).onConflictDoNothing();

        const marketId = `market-${matchId}`;
        await db.insert(betMarkets).values({
          matchId,
          status: "OPEN",
          createdAt: new Date(),
        }).onConflictDoNothing();
      }
    } else {
      this.state.activePvpMatchIds = livePvpMatches.map(m => m.id);
    }

    console.log("[SimulationService] Active PvP matches:", this.state.activePvpMatchIds.length);
  }

  private startTradeLoop() {
    this.state.tradeIntervalId = setInterval(async () => {
      try {
        await this.executeBotTrades();
      } catch (error) {
        console.error("[SimulationService] Trade loop error:", error);
      }
    }, 5000);
  }

  private startChatLoop() {
    this.state.chatIntervalId = setInterval(async () => {
      try {
        await this.sendBotChatMessages();
      } catch (error) {
        console.error("[SimulationService] Chat loop error:", error);
      }
    }, 3000);
  }

  private startBetLoop() {
    this.state.betIntervalId = setInterval(async () => {
      try {
        await this.placeBotBets();
      } catch (error) {
        console.error("[SimulationService] Bet loop error:", error);
      }
    }, 10000);
  }

  private startPositionCloseLoop() {
    this.state.positionCloseIntervalId = setInterval(async () => {
      try {
        await this.closeBotPositions();
      } catch (error) {
        console.error("[SimulationService] Position close loop error:", error);
      }
    }, 15000);
  }

  private async executeBotTrades() {
    if (this.state.activeCompetitionIds.length === 0 && this.state.activePvpMatchIds.length === 0) {
      return;
    }

    const numTrades = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < numTrades; i++) {
      const botId = this.state.botUserIds[Math.floor(Math.random() * this.state.botUserIds.length)];
      const pair = CURRENCY_PAIRS[Math.floor(Math.random() * CURRENCY_PAIRS.length)];
      const side = Math.random() > 0.5 ? "buy" : "sell";
      const lots = Math.round((Math.random() * 0.5 + 0.01) * 100) / 100;

      if (this.state.activeCompetitionIds.length > 0) {
        const compId = this.state.activeCompetitionIds[Math.floor(Math.random() * this.state.activeCompetitionIds.length)];
        
        const entry = await storage.getCompetitionEntry(compId, botId);
        if (entry) {
          const result = await executeMarketOrder({
            competitionId: compId,
            userId: botId,
            pair,
            side,
            lots,
          });

          if (result.success) {
            this.state.stats.tradesExecuted++;
          }
        }
      }

      if (this.state.activePvpMatchIds.length > 0 && Math.random() > 0.5) {
        const matchId = this.state.activePvpMatchIds[Math.floor(Math.random() * this.state.activePvpMatchIds.length)];
        const match = await storage.getPvpChallenge(matchId);
        
        if (match && match.competitionId) {
          const isChallenger = match.challengerId === botId;
          const isInvitee = match.inviteeId === botId;
          
          if (isChallenger || isInvitee) {
            const pvpSide = isChallenger ? "buy" : "sell";
            
            const result = await executeMarketOrder({
              competitionId: match.competitionId,
              userId: botId,
              pair: match.allowedPairsJson?.[0] || "EUR-USD",
              side: pvpSide,
              lots,
            });

            if (result.success) {
              this.state.stats.tradesExecuted++;
            }
          }
        }
      }
    }
  }

  private async closeBotPositions() {
    if (this.state.activeCompetitionIds.length === 0) return;

    const numCloses = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numCloses; i++) {
      const botId = this.state.botUserIds[Math.floor(Math.random() * this.state.botUserIds.length)];
      const compId = this.state.activeCompetitionIds[Math.floor(Math.random() * this.state.activeCompetitionIds.length)];

      const botPositions = await storage.getPositions(compId, botId);
      
      if (botPositions.length > 0 && Math.random() > 0.5) {
        const position = botPositions[Math.floor(Math.random() * botPositions.length)];
        
        try {
          const closeSide = position.side === "buy" ? "sell" : "buy";
          const lots = position.quantityUnits / 100000;
          
          await executeMarketOrder({
            competitionId: compId,
            userId: botId,
            pair: position.pair,
            side: closeSide as "buy" | "sell",
            lots,
          });
          
          this.state.stats.positionsClosed++;
        } catch (error) {
          // Ignore close errors
        }
      }
    }
  }

  private async sendBotChatMessages() {
    if (this.state.activePvpMatchIds.length === 0) return;

    const numMessages = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numMessages; i++) {
      const matchId = this.state.activePvpMatchIds[Math.floor(Math.random() * this.state.activePvpMatchIds.length)];
      const botId = this.state.botUserIds[Math.floor(Math.random() * this.state.botUserIds.length)];
      const message = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];

      const channels = await db.select()
        .from(chatChannels)
        .where(and(
          eq(chatChannels.kind, "PVP_MATCH"),
          eq(chatChannels.refId, matchId)
        ))
        .limit(1);

      if (channels.length > 0) {
        await db.insert(chatMessages).values({
          channelId: channels[0].id,
          userId: botId,
          body: message,
          createdAt: new Date(),
        });

        this.state.stats.chatMessagesSent++;
      }
    }
  }

  private async placeBotBets() {
    if (this.state.activePvpMatchIds.length === 0) return;

    const numBets = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < numBets; i++) {
      const matchId = this.state.activePvpMatchIds[Math.floor(Math.random() * this.state.activePvpMatchIds.length)];
      const botId = this.state.botUserIds[Math.floor(Math.random() * this.state.botUserIds.length)];
      const amount = Math.floor(Math.random() * 50) + 5;

      const markets = await db.select()
        .from(betMarkets)
        .where(and(
          eq(betMarkets.matchId, matchId),
          eq(betMarkets.status, "OPEN")
        ))
        .limit(1);

      if (markets.length === 0) continue;
      const market = markets[0];

      const wallet = await db.select().from(wallets).where(eq(wallets.userId, botId)).limit(1);
      if (wallet.length === 0 || wallet[0].balanceTokens < amount) continue;

      const existingBets = await db.select().from(bets).where(and(
        eq(bets.marketId, market.id),
        eq(bets.bettorId, botId)
      ));

      if (existingBets.length >= 5) continue;

      const match = await storage.getPvpChallenge(matchId);
      if (!match) continue;

      const pickUserId = Math.random() > 0.5 ? match.challengerId : (match.inviteeId || match.challengerId);

      await db.update(wallets)
        .set({ 
          balanceTokens: wallet[0].balanceTokens - amount,
          lockedTokens: wallet[0].lockedTokens + amount,
          updatedAt: new Date()
        })
        .where(eq(wallets.userId, botId));

      await db.insert(tokenTransactions).values({
        userId: botId,
        kind: "BET_PLACE",
        amountTokens: -amount,
        referenceType: "bet_market",
        referenceId: market.id,
        createdAt: new Date(),
      });

      await db.insert(bets).values({
        marketId: market.id,
        bettorId: botId,
        pickUserId,
        amountTokens: amount,
        status: "PLACED",
        placedAt: new Date(),
      });

      this.state.stats.betsPlaced++;
    }
  }

  async reset() {
    await this.stop();

    this.state = {
      isRunning: false,
      botUserIds: [],
      activeCompetitionIds: [],
      activePvpMatchIds: [],
      stats: {
        tradesExecuted: 0,
        chatMessagesSent: 0,
        betsPlaced: 0,
        positionsClosed: 0,
      },
    };

    return { success: true, message: "Simulation reset" };
  }
}

export const simulationService = new SimulationService();
