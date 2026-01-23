import { eq, and, sql, desc, gt, isNull, or } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  competitions,
  competitionEntries,
  orders,
  fills,
  positions,
  payments,
  payouts,
  auditLog,
  pvpChallenges,
  platformSettings,
  chatMutes,
  chatBans,
  featuredMatches,
  betRateLimits,
  chatChannels,
  chatMessages,
  betMarkets,
  bets,
  type User,
  type InsertUser,
  type Competition,
  type InsertCompetition,
  type CompetitionEntry,
  type InsertCompetitionEntry,
  type Order,
  type InsertOrder,
  type Position,
  type InsertPosition,
  type PvpChallenge,
  type InsertPvpChallenge,
  type PlatformSetting,
  type ChatMute,
  type ChatBan,
  type FeaturedMatch,
  type BetRateLimit,
  type ChatChannel,
  type ChatMessage,
  type BetMarket,
  type Bet,
} from "@shared/schema";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(email: string, password: string, username?: string, role?: string): Promise<User>;
  updateUsername(userId: string, username: string): Promise<User | undefined>;
  verifyPassword(user: User, password: string): Promise<boolean>;
  setResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  clearResetToken(userId: string): Promise<void>;
  updatePassword(userId: string, password: string): Promise<void>;

  getCompetitions(): Promise<CompetitionWithStats[]>;
  getCompetition(id: string): Promise<CompetitionWithStats | undefined>;
  createCompetition(data: InsertCompetition): Promise<Competition>;
  updateCompetitionStatus(id: string, status: string): Promise<Competition | undefined>;

  getCompetitionEntries(competitionId: string): Promise<CompetitionEntryWithUser[]>;
  getCompetitionEntry(
    competitionId: string,
    userId: string
  ): Promise<CompetitionEntry | undefined>;
  createCompetitionEntry(data: InsertCompetitionEntry): Promise<CompetitionEntry>;
  updateCompetitionEntry(
    id: string,
    data: Partial<CompetitionEntry>
  ): Promise<CompetitionEntry | undefined>;

  getUserCompetitions(userId: string): Promise<UserCompetitionInfo[]>;
  getUserStats(userId: string): Promise<UserStats>;

  getLeaderboard(
    competitionId: string,
    startingBalanceCents: number
  ): Promise<LeaderboardEntry[]>;

  getOrders(competitionId: string, userId: string): Promise<Order[]>;
  getPendingOrders(competitionId: string, userId: string): Promise<Order[]>;
  createOrder(data: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<Order>): Promise<Order | undefined>;

  getPositions(competitionId: string, userId: string): Promise<Position[]>;
  createPosition(data: InsertPosition): Promise<Position>;
  updatePosition(id: string, data: Partial<Position>): Promise<Position | undefined>;
  deletePosition(id: string): Promise<void>;

  getPvpChallenges(userId: string): Promise<PvpChallenge[]>;
  getPvpChallenge(id: string): Promise<PvpChallenge | undefined>;
  createPvpChallenge(data: InsertPvpChallenge): Promise<PvpChallenge>;
  updatePvpChallenge(id: string, data: Partial<PvpChallenge>): Promise<PvpChallenge | undefined>;
  getPublicArenaListedChallenges(): Promise<PvpChallenge[]>;
  
  createAuditLog(actorUserId: string, action: string, entityType: string, entityId: string, payload?: any): Promise<void>;
}

export interface CompetitionWithStats extends Competition {
  entryCount: number;
  prizePoolCents: number;
}

export interface CompetitionEntryWithUser extends CompetitionEntry {
  userEmail: string;
}

export interface UserCompetitionInfo {
  id: string;
  competitionId: string;
  title: string;
  status: string;
  equityCents: number;
  startingBalanceCents: number;
  rank?: number;
  totalEntrants?: number;
  prizeWonCents?: number;
  endAt?: string;
}

export interface UserStats {
  totalSpentCents: number;
  totalWonCents: number;
  activeCompetitions: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  userEmail: string;
  equityCents: number;
  returnPct: number;
}

class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`);
    return user;
  }

  async createUser(
    email: string,
    password: string,
    username?: string,
    role: string = "user"
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        username: username || null,
        passwordHash,
        role,
      })
      .returning();
    return user;
  }

  async updateUsername(userId: string, username: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ username, usernameChangedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.resetToken, token),
        gt(users.resetTokenExpiresAt, new Date())
      ));
    return user;
  }

  async setResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
      .where(eq(users.id, userId));
  }

  async clearResetToken(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ resetToken: null, resetTokenExpiresAt: null })
      .where(eq(users.id, userId));
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
  }

  async getCompetitions(): Promise<CompetitionWithStats[]> {
    const comps = await db.select().from(competitions).orderBy(desc(competitions.createdAt));

    const result: CompetitionWithStats[] = [];
    for (const comp of comps) {
      const entries = await db
        .select()
        .from(competitionEntries)
        .where(
          and(
            eq(competitionEntries.competitionId, comp.id),
            eq(competitionEntries.paymentStatus, "succeeded")
          )
        );

      const entryCount = entries.length;
      const totalPaid = entries.reduce((sum, e) => sum + e.paidCents, 0);
      const prizePoolCents = Math.round(totalPaid * (1 - comp.rakeBps / 10000));

      result.push({
        ...comp,
        entryCount,
        prizePoolCents,
      });
    }

    return result;
  }

  async getCompetition(id: string): Promise<CompetitionWithStats | undefined> {
    const [comp] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.id, id));

    if (!comp) return undefined;

    const entries = await db
      .select()
      .from(competitionEntries)
      .where(
        and(
          eq(competitionEntries.competitionId, id),
          eq(competitionEntries.paymentStatus, "succeeded")
        )
      );

    const entryCount = entries.length;
    const totalPaid = entries.reduce((sum, e) => sum + e.paidCents, 0);
    const prizePoolCents = Math.round(totalPaid * (1 - comp.rakeBps / 10000));

    return {
      ...comp,
      entryCount,
      prizePoolCents,
    };
  }

  async createCompetition(data: InsertCompetition): Promise<Competition> {
    const [comp] = await db.insert(competitions).values(data).returning();
    return comp;
  }

  async updateCompetitionStatus(
    id: string,
    status: string
  ): Promise<Competition | undefined> {
    const [comp] = await db
      .update(competitions)
      .set({ status })
      .where(eq(competitions.id, id))
      .returning();
    return comp;
  }

  async getCompetitionEntries(
    competitionId: string
  ): Promise<CompetitionEntryWithUser[]> {
    const entries = await db
      .select()
      .from(competitionEntries)
      .where(eq(competitionEntries.competitionId, competitionId));

    const result: CompetitionEntryWithUser[] = [];
    for (const entry of entries) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, entry.userId));
      result.push({
        ...entry,
        userEmail: user?.email || "Unknown",
      });
    }

    return result;
  }

  async getCompetitionEntry(
    competitionId: string,
    userId: string
  ): Promise<CompetitionEntry | undefined> {
    const [entry] = await db
      .select()
      .from(competitionEntries)
      .where(
        and(
          eq(competitionEntries.competitionId, competitionId),
          eq(competitionEntries.userId, userId)
        )
      );
    return entry;
  }

  async createCompetitionEntry(
    data: InsertCompetitionEntry
  ): Promise<CompetitionEntry> {
    const [entry] = await db
      .insert(competitionEntries)
      .values(data)
      .returning();
    return entry;
  }

  async updateCompetitionEntry(
    id: string,
    data: Partial<CompetitionEntry>
  ): Promise<CompetitionEntry | undefined> {
    const [entry] = await db
      .update(competitionEntries)
      .set(data)
      .where(eq(competitionEntries.id, id))
      .returning();
    return entry;
  }

  async getUserCompetitions(userId: string): Promise<UserCompetitionInfo[]> {
    const entries = await db
      .select()
      .from(competitionEntries)
      .where(eq(competitionEntries.userId, userId));

    const result: UserCompetitionInfo[] = [];
    for (const entry of entries) {
      const [comp] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, entry.competitionId));

      if (comp) {
        const leaderboard = await this.getLeaderboard(
          comp.id,
          comp.startingBalanceCents
        );
        const userRank = leaderboard.find((l) => l.userId === userId)?.rank;

        const [payout] = await db
          .select()
          .from(payouts)
          .where(
            and(
              eq(payouts.competitionId, comp.id),
              eq(payouts.userId, userId)
            )
          );

        result.push({
          id: entry.id,
          competitionId: comp.id,
          title: comp.title,
          status: comp.status,
          equityCents: entry.equityCents,
          startingBalanceCents: comp.startingBalanceCents,
          rank: userRank,
          totalEntrants: leaderboard.length,
          prizeWonCents: payout?.amountCents,
          endAt: comp.endAt?.toISOString(),
        });
      }
    }

    return result;
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const entries = await db
      .select()
      .from(competitionEntries)
      .where(eq(competitionEntries.userId, userId));

    const userPayouts = await db
      .select()
      .from(payouts)
      .where(eq(payouts.userId, userId));

    const activeEntries = [];
    for (const entry of entries) {
      const [comp] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, entry.competitionId));
      if (comp && (comp.status === "open" || comp.status === "running")) {
        activeEntries.push(entry);
      }
    }

    return {
      totalSpentCents: entries.reduce((sum, e) => sum + e.paidCents, 0),
      totalWonCents: userPayouts.reduce((sum, p) => sum + p.amountCents, 0),
      activeCompetitions: activeEntries.length,
    };
  }

  async getLeaderboard(
    competitionId: string,
    startingBalanceCents: number
  ): Promise<LeaderboardEntry[]> {
    const entries = await db
      .select()
      .from(competitionEntries)
      .where(
        and(
          eq(competitionEntries.competitionId, competitionId),
          eq(competitionEntries.paymentStatus, "succeeded")
        )
      );

    const leaderboard: LeaderboardEntry[] = [];
    for (const entry of entries) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, entry.userId));

      const returnPct =
        ((entry.equityCents - startingBalanceCents) / startingBalanceCents) * 100;

      leaderboard.push({
        rank: 0,
        userId: entry.userId,
        username: user?.username || `trader_${entry.userId.slice(0, 6)}`,
        userEmail: user?.email || "Unknown",
        equityCents: entry.equityCents,
        returnPct,
      });
    }

    leaderboard.sort((a, b) => b.returnPct - a.returnPct);
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboard;
  }

  async getOrders(competitionId: string, userId: string): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(
        and(eq(orders.competitionId, competitionId), eq(orders.userId, userId))
      )
      .orderBy(desc(orders.createdAt));
  }

  async getPendingOrders(
    competitionId: string,
    userId: string
  ): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.competitionId, competitionId),
          eq(orders.userId, userId),
          eq(orders.status, "pending")
        )
      );
  }

  async createOrder(data: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(data).returning();
    return order;
  }

  async updateOrder(id: string, data: Partial<Order>): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getPositions(competitionId: string, userId: string): Promise<Position[]> {
    return db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.competitionId, competitionId),
          eq(positions.userId, userId)
        )
      );
  }

  async createPosition(data: InsertPosition): Promise<Position> {
    const [position] = await db.insert(positions).values(data).returning();
    return position;
  }

  async updatePosition(
    id: string,
    data: Partial<Position>
  ): Promise<Position | undefined> {
    const [position] = await db
      .update(positions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();
    return position;
  }

  async deletePosition(id: string): Promise<void> {
    await db.delete(positions).where(eq(positions.id, id));
  }

  async getPvpChallenges(userId: string, userEmail?: string): Promise<PvpChallenge[]> {
    const results = await db
      .select()
      .from(pvpChallenges)
      .where(
        sql`${pvpChallenges.challengerId} = ${userId} OR ${pvpChallenges.inviteeId} = ${userId} OR ${pvpChallenges.inviteeEmail} = ${userEmail || ''}`
      )
      .orderBy(desc(pvpChallenges.createdAt));
    return results;
  }

  async getPvpChallenge(id: string): Promise<PvpChallenge | undefined> {
    const [challenge] = await db
      .select()
      .from(pvpChallenges)
      .where(eq(pvpChallenges.id, id));
    return challenge;
  }

  async createPvpChallenge(data: InsertPvpChallenge): Promise<PvpChallenge> {
    const [challenge] = await db.insert(pvpChallenges).values(data).returning();
    return challenge;
  }

  async updatePvpChallenge(
    id: string,
    data: Partial<PvpChallenge>
  ): Promise<PvpChallenge | undefined> {
    const [challenge] = await db
      .update(pvpChallenges)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pvpChallenges.id, id))
      .returning();
    return challenge;
  }

  async getPublicArenaListedChallenges(): Promise<PvpChallenge[]> {
    const results = await db
      .select()
      .from(pvpChallenges)
      .where(
        sql`${pvpChallenges.visibility} = 'public' AND ${pvpChallenges.arenaListed} = true`
      )
      .orderBy(desc(pvpChallenges.createdAt));
    return results;
  }

  async createAuditLog(
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    payload?: any
  ): Promise<void> {
    await db.insert(auditLog).values({
      actorUserId,
      action,
      entityType,
      entityId,
      payloadJson: payload || null,
    });
  }

  // Platform Settings
  async getPlatformSetting(key: string): Promise<PlatformSetting | undefined> {
    const [setting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key));
    return setting;
  }

  async getAllPlatformSettings(): Promise<PlatformSetting[]> {
    return await db.select().from(platformSettings);
  }

  async updatePlatformSetting(
    key: string,
    value: string,
    updatedBy: string
  ): Promise<PlatformSetting | undefined> {
    const [setting] = await db
      .update(platformSettings)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(eq(platformSettings.key, key))
      .returning();
    return setting;
  }

  // Chat Moderation - Mutes
  async getChatMutes(channelId?: string): Promise<ChatMute[]> {
    if (channelId) {
      return await db
        .select()
        .from(chatMutes)
        .where(
          or(
            eq(chatMutes.channelId, channelId),
            isNull(chatMutes.channelId)
          )
        );
    }
    return await db.select().from(chatMutes);
  }

  async isUserMuted(userId: string, channelId?: string): Promise<boolean> {
    const now = new Date();
    const [mute] = await db
      .select()
      .from(chatMutes)
      .where(
        and(
          eq(chatMutes.userId, userId),
          or(
            channelId ? eq(chatMutes.channelId, channelId) : sql`true`,
            isNull(chatMutes.channelId)
          ),
          or(isNull(chatMutes.expiresAt), gt(chatMutes.expiresAt, now))
        )
      );
    return !!mute;
  }

  async muteUser(
    userId: string,
    mutedBy: string,
    channelId?: string,
    reason?: string,
    durationMinutes?: number
  ): Promise<ChatMute> {
    const expiresAt = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : null;
    const [mute] = await db
      .insert(chatMutes)
      .values({ userId, mutedBy, channelId, reason, expiresAt })
      .returning();
    return mute;
  }

  async unmuteUser(userId: string, channelId?: string): Promise<void> {
    if (channelId) {
      await db
        .delete(chatMutes)
        .where(
          and(
            eq(chatMutes.userId, userId),
            eq(chatMutes.channelId, channelId)
          )
        );
    } else {
      await db.delete(chatMutes).where(eq(chatMutes.userId, userId));
    }
  }

  // Chat Moderation - Bans
  async getChatBans(channelId?: string): Promise<ChatBan[]> {
    if (channelId) {
      return await db
        .select()
        .from(chatBans)
        .where(
          or(
            eq(chatBans.channelId, channelId),
            isNull(chatBans.channelId)
          )
        );
    }
    return await db.select().from(chatBans);
  }

  async isUserBanned(userId: string, channelId?: string): Promise<boolean> {
    const now = new Date();
    const [ban] = await db
      .select()
      .from(chatBans)
      .where(
        and(
          eq(chatBans.userId, userId),
          or(
            channelId ? eq(chatBans.channelId, channelId) : sql`true`,
            isNull(chatBans.channelId)
          ),
          or(isNull(chatBans.expiresAt), gt(chatBans.expiresAt, now))
        )
      );
    return !!ban;
  }

  async banUser(
    userId: string,
    bannedBy: string,
    channelId?: string,
    reason?: string,
    durationDays?: number
  ): Promise<ChatBan> {
    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
      : null;
    const [ban] = await db
      .insert(chatBans)
      .values({ userId, bannedBy, channelId, reason, expiresAt })
      .returning();
    return ban;
  }

  async unbanUser(userId: string, channelId?: string): Promise<void> {
    if (channelId) {
      await db
        .delete(chatBans)
        .where(
          and(
            eq(chatBans.userId, userId),
            eq(chatBans.channelId, channelId)
          )
        );
    } else {
      await db.delete(chatBans).where(eq(chatBans.userId, userId));
    }
  }

  // Featured Matches
  async getFeaturedMatches(): Promise<FeaturedMatch[]> {
    return await db
      .select()
      .from(featuredMatches)
      .orderBy(desc(featuredMatches.pinnedAt));
  }

  async isMatchFeatured(matchId: string): Promise<boolean> {
    const [featured] = await db
      .select()
      .from(featuredMatches)
      .where(eq(featuredMatches.matchId, matchId));
    return !!featured;
  }

  async featureMatch(
    matchId: string,
    pinnedBy: string,
    expiresAt?: Date
  ): Promise<FeaturedMatch> {
    const [featured] = await db
      .insert(featuredMatches)
      .values({ matchId, pinnedBy, expiresAt })
      .onConflictDoUpdate({
        target: featuredMatches.matchId,
        set: { pinnedBy, pinnedAt: new Date(), expiresAt },
      })
      .returning();
    return featured;
  }

  async unfeatureMatch(matchId: string): Promise<void> {
    await db
      .delete(featuredMatches)
      .where(eq(featuredMatches.matchId, matchId));
  }

  // Bet Rate Limiting
  async getBetRateLimit(
    userId: string,
    marketId: string
  ): Promise<BetRateLimit | undefined> {
    const [limit] = await db
      .select()
      .from(betRateLimits)
      .where(
        and(
          eq(betRateLimits.userId, userId),
          eq(betRateLimits.marketId, marketId)
        )
      );
    return limit;
  }

  async incrementBetRateLimit(
    userId: string,
    marketId: string
  ): Promise<BetRateLimit> {
    const existing = await this.getBetRateLimit(userId, marketId);
    if (existing) {
      const [updated] = await db
        .update(betRateLimits)
        .set({ betCount: existing.betCount + 1, lastBetAt: new Date() })
        .where(eq(betRateLimits.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(betRateLimits)
      .values({ userId, marketId })
      .returning();
    return created;
  }

  // Admin helpers
  async getAllChatChannels(): Promise<ChatChannel[]> {
    return await db.select().from(chatChannels).orderBy(desc(chatChannels.createdAt));
  }

  async getChatMessagesByChannel(channelId: string, limit = 100): Promise<any[]> {
    const messages = await db
      .select({
        id: chatMessages.id,
        channelId: chatMessages.channelId,
        userId: chatMessages.userId,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        deletedAt: chatMessages.deletedAt,
        senderUsername: users.username,
        senderEmail: users.email,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(eq(chatMessages.channelId, channelId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return messages;
  }

  async deleteChatMessage(messageId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
  }

  // Betting admin helpers
  async getAllBetMarkets(): Promise<BetMarket[]> {
    return await db.select().from(betMarkets).orderBy(desc(betMarkets.createdAt));
  }

  async getBetsByMarket(marketId: string): Promise<any[]> {
    const betsList = await db
      .select({
        id: bets.id,
        marketId: bets.marketId,
        bettorId: bets.bettorId,
        pickUserId: bets.pickUserId,
        amountTokens: bets.amountTokens,
        placedAt: bets.placedAt,
        status: bets.status,
        bettorUsername: users.username,
        bettorEmail: users.email,
      })
      .from(bets)
      .leftJoin(users, eq(bets.bettorId, users.id))
      .where(eq(bets.marketId, marketId))
      .orderBy(desc(bets.placedAt));
    return betsList;
  }

  async getUserBetCountForMarket(userId: string, marketId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bets)
      .where(and(eq(bets.bettorId, userId), eq(bets.marketId, marketId)));
    return result?.count || 0;
  }

  async getUserTotalBetsForMarket(userId: string, marketId: string): Promise<number> {
    const [result] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bets.amountTokens}), 0)::int` })
      .from(bets)
      .where(
        and(
          eq(bets.bettorId, userId),
          eq(bets.marketId, marketId),
          eq(bets.status, "PLACED")
        )
      );
    return result?.total || 0;
  }

  async getSuspiciousActivity(): Promise<any[]> {
    const suspiciousBettors = await db
      .select({
        bettorId: bets.bettorId,
        marketId: bets.marketId,
        betCount: sql<number>`count(*)::int`,
        totalTokens: sql<number>`SUM(${bets.amountTokens})::int`,
        bettorUsername: users.username,
        bettorEmail: users.email,
      })
      .from(bets)
      .leftJoin(users, eq(bets.bettorId, users.id))
      .groupBy(bets.bettorId, bets.marketId, users.username, users.email)
      .having(sql`count(*) > 3 OR SUM(${bets.amountTokens}) > 200`);
    return suspiciousBettors;
  }
}

export const storage = new DatabaseStorage();
