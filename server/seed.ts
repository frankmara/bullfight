import { db } from "./db";
import { users, competitions, competitionEntries } from "@shared/schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  try {
    const adminHash = await bcrypt.hash("admin123!", 10);
    const userHash = await bcrypt.hash("user123!", 10);

    const [admin] = await db
      .insert(users)
      .values({
        email: "admin@bullfight.local",
        passwordHash: adminHash,
        role: "admin",
      })
      .onConflictDoNothing()
      .returning();

    console.log("Created admin user:", admin?.email || "already exists");

    const [testUser] = await db
      .insert(users)
      .values({
        email: "user@bullfight.local",
        passwordHash: userHash,
        role: "user",
      })
      .onConflictDoNothing()
      .returning();

    console.log("Created test user:", testUser?.email || "already exists");

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [comp1] = await db
      .insert(competitions)
      .values({
        title: "Weekly FX Championship",
        theme: "Major Pairs Challenge",
        description:
          "Compete against the best traders in this weekly forex tournament. Trade major currency pairs and climb the leaderboard!",
        type: "public",
        status: "open",
        buyInCents: 10000,
        entryCap: 500,
        rakeBps: 3000,
        startAt: tomorrow,
        endAt: nextWeek,
        startingBalanceCents: 10000000,
        allowedPairsJson: ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"],
        prizeSplitsJson: [50, 25, 15, 10],
        spreadMarkupPips: 0.5,
        maxSlippagePips: 1.0,
        minOrderIntervalMs: 1000,
        createdBy: admin?.id,
      })
      .returning();

    console.log("Created competition:", comp1?.title);

    const [comp2] = await db
      .insert(competitions)
      .values({
        title: "Dollar Pairs Sprint",
        theme: "USD Focus",
        description:
          "A fast-paced trading competition focused on USD currency pairs. Quick profits, big rewards!",
        type: "public",
        status: "running",
        buyInCents: 5000,
        entryCap: 200,
        rakeBps: 2500,
        startAt: oneHourAgo,
        endAt: tomorrow,
        startingBalanceCents: 5000000,
        allowedPairsJson: ["EUR-USD", "GBP-USD", "USD-JPY"],
        prizeSplitsJson: [60, 30, 10],
        spreadMarkupPips: 0.3,
        maxSlippagePips: 0.8,
        minOrderIntervalMs: 500,
        createdBy: admin?.id,
      })
      .returning();

    console.log("Created competition:", comp2?.title);

    const [comp3] = await db
      .insert(competitions)
      .values({
        title: "Mega Tournament",
        theme: "High Stakes",
        description:
          "The ultimate trading competition with a massive prize pool. Only for serious traders!",
        type: "public",
        status: "open",
        buyInCents: 50000,
        entryCap: 1000,
        rakeBps: 2000,
        startAt: nextWeek,
        endAt: twoWeeks,
        startingBalanceCents: 25000000,
        allowedPairsJson: ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"],
        prizeSplitsJson: [40, 20, 15, 10, 5, 5, 3, 2],
        spreadMarkupPips: 0.2,
        maxSlippagePips: 0.5,
        minOrderIntervalMs: 2000,
        createdBy: admin?.id,
      })
      .returning();

    console.log("Created competition:", comp3?.title);

    if (comp2 && testUser) {
      await db
        .insert(competitionEntries)
        .values({
          competitionId: comp2.id,
          userId: testUser.id,
          paidCents: 5000,
          paymentStatus: "succeeded",
          cashCents: 5000000,
          equityCents: 5000000,
          maxEquityCents: 5000000,
          maxDrawdownPct: 0,
          dq: false,
        })
        .onConflictDoNothing();

      console.log("Created entry for test user in Dollar Pairs Sprint");
    }

    console.log("\nSeed completed successfully!");
    console.log("\nTest credentials:");
    console.log("  Admin: admin@bullfight.local / admin123!");
    console.log("  User: user@bullfight.local / user123!");
  } catch (error) {
    console.error("Seed error:", error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
