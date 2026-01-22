import { eq, and, sql, desc } from "drizzle-orm";
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
} from "@shared/schema";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(email: string, password: string, role?: string): Promise<User>;
  verifyPassword(user: User, password: string): Promise<boolean>;

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

  async createUser(
    email: string,
    password: string,
    role: string = "user"
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        role,
      })
      .returning();
    return user;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
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

  async getPvpChallenges(userId: string): Promise<PvpChallenge[]> {
    const results = await db
      .select()
      .from(pvpChallenges)
      .where(
        sql`${pvpChallenges.challengerId} = ${userId} OR ${pvpChallenges.inviteeId} = ${userId}`
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
}

export const storage = new DatabaseStorage();
