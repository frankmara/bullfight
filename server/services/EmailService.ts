import { Resend } from 'resend';
import { db } from '../db';
import { emailTemplates, emailLogs, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail || 'noreply@bullfight.app'
  };
}

export type EmailType = 
  | 'welcome'
  | 'challenge_entry_confirmed'
  | 'challenge_started'
  | 'challenge_concluded'
  | 'pvp_invitation'
  | 'daily_standings';

interface EmailVariables {
  [key: string]: string | number | undefined;
}

const DEFAULT_TEMPLATES: Record<EmailType, { name: string; subject: string; htmlBody: string; variables: string[] }> = {
  welcome: {
    name: 'Welcome Email',
    subject: 'Welcome to Bullfight!',
    htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #121212; border-radius: 8px; padding: 32px; border: 1px solid #252525;">
    <h1 style="color: #FF3B3B; margin-bottom: 24px;">Welcome to Bullfight!</h1>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Hi {{userName}},</p>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Welcome to the arena. You're now ready to compete in paper trading tournaments and prove your skills.</p>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Get started by joining a competition or challenging another trader to a PvP match.</p>
    <div style="margin-top: 32px; text-align: center;">
      <a href="{{appUrl}}" style="display: inline-block; background-color: #FF3B3B; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: bold;">Enter the Arena</a>
    </div>
  </div>
</body>
</html>
    `,
    variables: ['userName', 'userEmail', 'appUrl']
  },
  challenge_entry_confirmed: {
    name: 'Challenge Entry Confirmed',
    subject: 'You\'ve joined {{competitionName}}!',
    htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #121212; border-radius: 8px; padding: 32px; border: 1px solid #252525;">
    <h1 style="color: #FF3B3B; margin-bottom: 24px;">Entry Confirmed</h1>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Hi {{userName}},</p>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Your payment of <span style="color: #00C853; font-weight: bold;">{{buyInAmount}}</span> has been confirmed. You're now registered for:</p>
    <div style="background-color: #1A1A1A; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #FF3B3B;">
      <h2 style="color: #FFFFFF; margin: 0 0 8px 0;">{{competitionName}}</h2>
      <p style="color: #B0B0B0; margin: 0;">Prize Pool: <span style="color: #00C853;">{{prizePool}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Starts: {{startDate}}</p>
    </div>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Starting Balance: <span style="color: #FFFFFF;">{{startingBalance}}</span></p>
    <div style="margin-top: 32px; text-align: center;">
      <a href="{{arenaUrl}}" style="display: inline-block; background-color: #FF3B3B; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: bold;">Go to Arena</a>
    </div>
  </div>
</body>
</html>
    `,
    variables: ['userName', 'competitionName', 'buyInAmount', 'prizePool', 'startDate', 'startingBalance', 'arenaUrl']
  },
  challenge_started: {
    name: 'Challenge Started',
    subject: '{{competitionName}} has begun!',
    htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #121212; border-radius: 8px; padding: 32px; border: 1px solid #252525;">
    <h1 style="color: #FF3B3B; margin-bottom: 24px;">The Competition Has Begun!</h1>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Hi {{userName}},</p>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;"><strong style="color: #FFFFFF;">{{competitionName}}</strong> is now live. Trading is open!</p>
    <div style="background-color: #1A1A1A; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <p style="color: #B0B0B0; margin: 0;">Duration: <span style="color: #FFFFFF;">{{duration}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Ends: <span style="color: #FFFFFF;">{{endDate}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Participants: <span style="color: #FFFFFF;">{{participantCount}}</span></p>
    </div>
    <div style="margin-top: 32px; text-align: center;">
      <a href="{{arenaUrl}}" style="display: inline-block; background-color: #FF3B3B; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: bold;">Start Trading</a>
    </div>
  </div>
</body>
</html>
    `,
    variables: ['userName', 'competitionName', 'duration', 'endDate', 'participantCount', 'arenaUrl']
  },
  challenge_concluded: {
    name: 'Challenge Concluded',
    subject: '{{competitionName}} has ended - Final Results',
    htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #121212; border-radius: 8px; padding: 32px; border: 1px solid #252525;">
    <h1 style="color: #FF3B3B; margin-bottom: 24px;">Competition Complete!</h1>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Hi {{userName}},</p>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;"><strong style="color: #FFFFFF;">{{competitionName}}</strong> has concluded.</p>
    <div style="background-color: #1A1A1A; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center;">
      <p style="color: #B0B0B0; margin: 0;">Your Final Rank</p>
      <h2 style="color: #FF3B3B; font-size: 48px; margin: 8px 0;">#{{finalRank}}</h2>
      <p style="color: #B0B0B0; margin: 0;">out of {{totalParticipants}} traders</p>
    </div>
    <div style="background-color: #1A1A1A; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <p style="color: #B0B0B0; margin: 0;">Final Return: <span style="color: {{returnColor}}; font-weight: bold;">{{finalReturn}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Final Equity: <span style="color: #FFFFFF;">{{finalEquity}}</span></p>
      {{#if winnings}}<p style="color: #00C853; margin: 8px 0 0 0; font-weight: bold;">Winnings: {{winnings}}</p>{{/if}}
    </div>
  </div>
</body>
</html>
    `,
    variables: ['userName', 'competitionName', 'finalRank', 'totalParticipants', 'finalReturn', 'returnColor', 'finalEquity', 'winnings']
  },
  pvp_invitation: {
    name: 'PvP Challenge Invitation',
    subject: '{{challengerName}} has challenged you to a trading duel!',
    htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #121212; border-radius: 8px; padding: 32px; border: 1px solid #252525;">
    <h1 style="color: #FF3B3B; margin-bottom: 24px;">You've Been Challenged!</h1>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;"><strong style="color: #FFFFFF;">{{challengerName}}</strong> is challenging you to a 1v1 trading competition on Bullfight.</p>
    <div style="background-color: #1A1A1A; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #FF3B3B;">
      <h3 style="color: #FFFFFF; margin: 0 0 12px 0;">Challenge Terms</h3>
      <p style="color: #B0B0B0; margin: 0;">Stake: <span style="color: #00C853; font-weight: bold;">{{stakeAmount}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Prize Pool: <span style="color: #00C853;">{{prizePool}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Duration: <span style="color: #FFFFFF;">{{duration}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Starting Balance: <span style="color: #FFFFFF;">{{startingBalance}}</span></p>
    </div>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Think you can beat them? Accept the challenge and prove your trading skills.</p>
    <div style="margin-top: 32px; text-align: center;">
      <a href="{{challengeUrl}}" style="display: inline-block; background-color: #FF3B3B; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: bold;">View Challenge</a>
    </div>
    <p style="color: #666666; font-size: 12px; margin-top: 32px; text-align: center;">Don't have an account? Click the link above to sign up and accept the challenge.</p>
  </div>
</body>
</html>
    `,
    variables: ['challengerName', 'stakeAmount', 'prizePool', 'duration', 'startingBalance', 'challengeUrl']
  },
  daily_standings: {
    name: 'Daily Standings Update',
    subject: 'Your standings in {{competitionName}}',
    htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #121212; border-radius: 8px; padding: 32px; border: 1px solid #252525;">
    <h1 style="color: #FF3B3B; margin-bottom: 24px;">Daily Standings Update</h1>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Hi {{userName}},</p>
    <p style="color: #B0B0B0; font-size: 16px; line-height: 1.6;">Here's your daily update for <strong style="color: #FFFFFF;">{{competitionName}}</strong>:</p>
    <div style="background-color: #1A1A1A; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center;">
      <p style="color: #B0B0B0; margin: 0;">Your Current Rank</p>
      <h2 style="color: #FF3B3B; font-size: 48px; margin: 8px 0;">#{{currentRank}}</h2>
      <p style="color: #B0B0B0; margin: 0;">out of {{totalParticipants}} traders</p>
    </div>
    <div style="background-color: #1A1A1A; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <p style="color: #B0B0B0; margin: 0;">Current Return: <span style="color: {{returnColor}}; font-weight: bold;">{{currentReturn}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Equity: <span style="color: #FFFFFF;">{{currentEquity}}</span></p>
      <p style="color: #B0B0B0; margin: 8px 0 0 0;">Time Remaining: <span style="color: #FFFFFF;">{{timeRemaining}}</span></p>
    </div>
    <h3 style="color: #FFFFFF; margin-top: 32px;">Top 5 Leaderboard</h3>
    {{leaderboardHtml}}
    <div style="margin-top: 32px; text-align: center;">
      <a href="{{arenaUrl}}" style="display: inline-block; background-color: #FF3B3B; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: bold;">Continue Trading</a>
    </div>
  </div>
</body>
</html>
    `,
    variables: ['userName', 'competitionName', 'currentRank', 'totalParticipants', 'currentReturn', 'returnColor', 'currentEquity', 'timeRemaining', 'leaderboardHtml', 'arenaUrl']
  }
};

function replaceVariables(template: string, variables: EmailVariables): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }
  result = result.replace(/{{#if\s+\w+}}[\s\S]*?{{\/if}}/g, '');
  return result;
}

export class EmailService {
  static async ensureDefaultTemplates(): Promise<void> {
    for (const [type, template] of Object.entries(DEFAULT_TEMPLATES)) {
      const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.type, type)).limit(1);
      if (existing.length === 0) {
        await db.insert(emailTemplates).values({
          type,
          name: template.name,
          subject: template.subject,
          htmlBody: template.htmlBody,
          variables: template.variables,
          enabled: true,
        });
      }
    }
  }

  static async getTemplate(type: EmailType): Promise<typeof emailTemplates.$inferSelect | null> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.type, type)).limit(1);
    return template || null;
  }

  static async getAllTemplates(): Promise<(typeof emailTemplates.$inferSelect)[]> {
    return db.select().from(emailTemplates);
  }

  static async updateTemplate(type: string, updates: { subject?: string; htmlBody?: string; enabled?: boolean }): Promise<void> {
    await db.update(emailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailTemplates.type, type));
  }

  static async sendEmail(
    type: EmailType,
    recipientEmail: string,
    variables: EmailVariables,
    recipientUserId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = await this.getTemplate(type);
    if (!template) {
      console.error(`Email template not found: ${type}`);
      return { success: false, error: 'Template not found' };
    }

    if (!template.enabled) {
      console.log(`Email template disabled: ${type}`);
      return { success: false, error: 'Template disabled' };
    }

    const subject = replaceVariables(template.subject, variables);
    const htmlBody = replaceVariables(template.htmlBody, variables);

    const [logEntry] = await db.insert(emailLogs).values({
      templateType: type,
      recipientEmail,
      recipientUserId,
      subject,
      status: 'pending',
      variablesJson: variables,
    }).returning();

    try {
      const { client, fromEmail } = await getResendClient();
      
      const result = await client.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject,
        html: htmlBody,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      await db.update(emailLogs)
        .set({
          status: 'sent',
          resendMessageId: result.data?.id,
          sentAt: new Date(),
        })
        .where(eq(emailLogs.id, logEntry.id));

      console.log(`Email sent: ${type} to ${recipientEmail}`);
      return { success: true, messageId: result.data?.id };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`Failed to send email ${type} to ${recipientEmail}:`, errorMessage);

      await db.update(emailLogs)
        .set({
          status: 'failed',
          errorMessage,
        })
        .where(eq(emailLogs.id, logEntry.id));

      return { success: false, error: errorMessage };
    }
  }

  static async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    const appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'https://bullfight.app';

    await this.sendEmail('welcome', email, {
      userName: email.split('@')[0],
      userEmail: email,
      appUrl,
    }, userId);
  }

  static async sendChallengeEntryConfirmedEmail(
    userId: string,
    email: string,
    competitionName: string,
    buyInCents: number,
    prizePoolCents: number,
    startDate: Date,
    startingBalanceCents: number,
    competitionId: string
  ): Promise<void> {
    const appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'https://bullfight.app';

    await this.sendEmail('challenge_entry_confirmed', email, {
      userName: email.split('@')[0],
      competitionName,
      buyInAmount: `$${(buyInCents / 100).toFixed(2)}`,
      prizePool: `$${(prizePoolCents / 100).toFixed(2)}`,
      startDate: startDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      startingBalance: `$${(startingBalanceCents / 100).toLocaleString()}`,
      arenaUrl: `${appUrl}/arena/${competitionId}`,
    }, userId);
  }

  static async sendChallengeStartedEmail(
    userId: string,
    email: string,
    competitionName: string,
    endDate: Date,
    participantCount: number,
    competitionId: string
  ): Promise<void> {
    const appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'https://bullfight.app';

    const now = new Date();
    const durationMs = endDate.getTime() - now.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const duration = hours > 24 
      ? `${Math.floor(hours / 24)} days` 
      : `${hours} hours`;

    await this.sendEmail('challenge_started', email, {
      userName: email.split('@')[0],
      competitionName,
      duration,
      endDate: endDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      participantCount: participantCount.toString(),
      arenaUrl: `${appUrl}/arena/${competitionId}`,
    }, userId);
  }

  static async sendChallengeConcludedEmail(
    userId: string,
    email: string,
    competitionName: string,
    finalRank: number,
    totalParticipants: number,
    returnPct: number,
    finalEquityCents: number,
    winningsCents?: number
  ): Promise<void> {
    await this.sendEmail('challenge_concluded', email, {
      userName: email.split('@')[0],
      competitionName,
      finalRank: finalRank.toString(),
      totalParticipants: totalParticipants.toString(),
      finalReturn: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`,
      returnColor: returnPct >= 0 ? '#00C853' : '#FF3B3B',
      finalEquity: `$${(finalEquityCents / 100).toLocaleString()}`,
      winnings: winningsCents ? `$${(winningsCents / 100).toFixed(2)}` : undefined,
    }, userId);
  }

  static async sendPvPInvitationEmail(
    inviteeEmail: string,
    challengerName: string,
    stakeCents: number,
    durationHours: number,
    startingBalanceCents: number,
    challengeId: string
  ): Promise<void> {
    const appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'https://bullfight.app';

    const prizePoolCents = stakeCents * 2;
    const rakeBps = 300;
    const winnerTakesCents = prizePoolCents - (prizePoolCents * rakeBps / 10000);

    await this.sendEmail('pvp_invitation', inviteeEmail, {
      challengerName,
      stakeAmount: `$${(stakeCents / 100).toFixed(2)}`,
      prizePool: `$${(prizePoolCents / 100).toFixed(2)} (winner takes $${(winnerTakesCents / 100).toFixed(2)})`,
      duration: durationHours > 24 ? `${Math.floor(durationHours / 24)} days` : `${durationHours} hours`,
      startingBalance: `$${(startingBalanceCents / 100).toLocaleString()}`,
      challengeUrl: `${appUrl}/pvp/${challengeId}`,
    });
  }

  static async sendDailyStandingsEmail(
    userId: string,
    email: string,
    competitionName: string,
    currentRank: number,
    totalParticipants: number,
    returnPct: number,
    equityCents: number,
    endDate: Date,
    leaderboard: Array<{ rank: number; name: string; returnPct: number }>,
    competitionId: string
  ): Promise<void> {
    const appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'https://bullfight.app';

    const now = new Date();
    const timeRemainingMs = endDate.getTime() - now.getTime();
    const hoursRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60));
    const timeRemaining = hoursRemaining > 24 
      ? `${Math.floor(hoursRemaining / 24)}d ${hoursRemaining % 24}h`
      : `${hoursRemaining}h`;

    const leaderboardHtml = leaderboard.slice(0, 5).map(entry => `
      <div style="display: flex; justify-content: space-between; padding: 8px 12px; background-color: #1A1A1A; margin: 4px 0; border-radius: 4px;">
        <span style="color: #B0B0B0;">#${entry.rank} ${entry.name}</span>
        <span style="color: ${entry.returnPct >= 0 ? '#00C853' : '#FF3B3B'};">${entry.returnPct >= 0 ? '+' : ''}${entry.returnPct.toFixed(2)}%</span>
      </div>
    `).join('');

    await this.sendEmail('daily_standings', email, {
      userName: email.split('@')[0],
      competitionName,
      currentRank: currentRank.toString(),
      totalParticipants: totalParticipants.toString(),
      currentReturn: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`,
      returnColor: returnPct >= 0 ? '#00C853' : '#FF3B3B',
      currentEquity: `$${(equityCents / 100).toLocaleString()}`,
      timeRemaining,
      leaderboardHtml,
      arenaUrl: `${appUrl}/arena/${competitionId}`,
    }, userId);
  }

  static async getEmailLogs(limit: number = 50, offset: number = 0): Promise<(typeof emailLogs.$inferSelect)[]> {
    return db.select().from(emailLogs).orderBy(emailLogs.createdAt).limit(limit).offset(offset);
  }

  static async getEmailLogsByUser(userId: string): Promise<(typeof emailLogs.$inferSelect)[]> {
    return db.select().from(emailLogs).where(eq(emailLogs.recipientUserId, userId)).orderBy(emailLogs.createdAt);
  }
}
