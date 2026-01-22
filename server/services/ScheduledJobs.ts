import { db } from '../db';
import { competitions, competitionEntries, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { EmailService } from './EmailService';

const DAILY_STANDINGS_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface LeaderboardEntry {
  rank: number;
  name: string;
  returnPct: number;
}

async function sendDailyStandingsEmails(): Promise<void> {
  console.log('[ScheduledJobs] Running daily standings email job...');
  
  try {
    const runningCompetitions = await db.select()
      .from(competitions)
      .where(eq(competitions.status, 'running'));

    console.log(`[ScheduledJobs] Found ${runningCompetitions.length} running competitions`);

    for (const comp of runningCompetitions) {
      const entries = await db.select({
        userId: competitionEntries.userId,
        equityCents: competitionEntries.equityCents,
        userEmail: users.email,
      })
        .from(competitionEntries)
        .leftJoin(users, eq(competitionEntries.userId, users.id))
        .where(eq(competitionEntries.competitionId, comp.id))
        .orderBy(competitionEntries.equityCents);

      const sortedEntries = entries.sort((a, b) => b.equityCents - a.equityCents);

      const leaderboard: LeaderboardEntry[] = sortedEntries.slice(0, 5).map((entry, idx) => ({
        rank: idx + 1,
        name: entry.userEmail?.split('@')[0] || 'Trader',
        returnPct: ((entry.equityCents - comp.startingBalanceCents) / comp.startingBalanceCents) * 100,
      }));

      for (let i = 0; i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        if (!entry.userEmail) continue;

        const rank = i + 1;
        const returnPct = ((entry.equityCents - comp.startingBalanceCents) / comp.startingBalanceCents) * 100;
        const endDate = comp.endAt || new Date(Date.now() + 24 * 60 * 60 * 1000);

        await EmailService.sendDailyStandingsEmail(
          entry.userId,
          entry.userEmail,
          comp.title,
          rank,
          sortedEntries.length,
          returnPct,
          entry.equityCents,
          endDate,
          leaderboard,
          comp.id
        ).catch(err => {
          console.error(`[ScheduledJobs] Failed to send standings email to ${entry.userEmail}:`, err);
        });
      }

      console.log(`[ScheduledJobs] Sent standings emails for ${comp.title} to ${sortedEntries.length} participants`);
    }
  } catch (error) {
    console.error('[ScheduledJobs] Error in daily standings job:', error);
  }
}

let dailyStandingsInterval: NodeJS.Timeout | null = null;

export function startScheduledJobs(): void {
  console.log('[ScheduledJobs] Starting scheduled jobs...');
  
  if (dailyStandingsInterval) {
    clearInterval(dailyStandingsInterval);
  }

  dailyStandingsInterval = setInterval(() => {
    sendDailyStandingsEmails();
  }, DAILY_STANDINGS_INTERVAL_MS);

  console.log('[ScheduledJobs] Daily standings job scheduled (runs every 24 hours)');
}

export function stopScheduledJobs(): void {
  if (dailyStandingsInterval) {
    clearInterval(dailyStandingsInterval);
    dailyStandingsInterval = null;
  }
  console.log('[ScheduledJobs] Scheduled jobs stopped');
}

export async function triggerDailyStandingsNow(): Promise<void> {
  await sendDailyStandingsEmails();
}
