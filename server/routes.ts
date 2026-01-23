import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { marketDataService } from "./services/MarketDataService";
import { EmailService } from "./services/EmailService";
import { startScheduledJobs, triggerDailyStandingsNow } from "./services/ScheduledJobs";
import {
  executeMarketOrder,
  partialClosePosition,
  updatePositionSLTP,
  getDeals,
  getTrades,
  lotsToUnits,
  unitsToLots,
} from "./services/ExecutionService";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { usernameSchema, tokenPurchases } from "@shared/schema";
import { getOrCreateWallet, getWallet, applyTokenTransaction, getTransactionHistory, lockTokens, unlockTokens, unlockAndDeductTokens } from "./lib/wallet";
import { db } from "./db";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, username } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      const usernameValidation = usernameSchema.safeParse(username);
      if (!usernameValidation.success) {
        return res.status(400).json({ error: usernameValidation.error.errors[0]?.message || "Invalid username" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const user = await storage.createUser(email, password, username);
      
      await getOrCreateWallet(user.id);
      
      EmailService.sendWelcomeEmail(user.id, user.email).catch(err => {
        console.error("Failed to send welcome email:", err);
      });

      res.json({
        user: { id: user.id, email: user.email, username: user.username, role: user.role },
      });
    } catch (error: any) {
      console.error("Register error:", error);
      res.status(500).json({ error: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await storage.verifyPassword(user, password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json({
        user: { id: user.id, email: user.email, username: user.username, role: user.role, needsUsername: !user.username },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If an account exists, a reset email has been sent" });
      }

      const resetToken = crypto.randomUUID();
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.setResetToken(user.id, resetToken, resetTokenExpiresAt);
      await EmailService.sendPasswordResetEmail(email, resetToken);

      res.json({ message: "If an account exists, a reset email has been sent" });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: error.message || "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      await storage.updatePassword(user.id, password);
      await storage.clearResetToken(user.id);

      res.json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: error.message || "Failed to reset password" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        user: { id: user.id, email: user.email, username: user.username, role: user.role, needsUsername: !user.username },
      });
    } catch (error: any) {
      console.error("Get me error:", error);
      res.status(500).json({ error: error.message || "Failed to get user" });
    }
  });

  app.post("/api/auth/set-username", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      const usernameValidation = usernameSchema.safeParse(username);
      if (!usernameValidation.success) {
        return res.status(400).json({ error: usernameValidation.error.errors[0]?.message || "Invalid username" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.usernameChangedAt) {
        const daysSinceChange = (Date.now() - new Date(user.usernameChangedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceChange < 7) {
          const daysRemaining = Math.ceil(7 - daysSinceChange);
          return res.status(400).json({ error: `Username can only be changed once every 7 days. Please wait ${daysRemaining} more day(s).` });
        }
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername && existingUsername.id !== userId) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const updatedUser = await storage.updateUsername(userId, username);
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update username" });
      }

      res.json({
        user: { id: updatedUser.id, email: updatedUser.email, username: updatedUser.username, role: updatedUser.role },
      });
    } catch (error: any) {
      console.error("Set username error:", error);
      res.status(500).json({ error: error.message || "Failed to set username" });
    }
  });

  app.get("/api/wallet", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const wallet = await getOrCreateWallet(userId);
      res.json({
        balanceTokens: wallet.balanceTokens,
        lockedTokens: wallet.lockedTokens,
        availableTokens: wallet.availableTokens,
        updatedAt: wallet.updatedAt,
      });
    } catch (error: any) {
      console.error("Get wallet error:", error);
      res.status(500).json({ error: error.message || "Failed to get wallet" });
    }
  });

  app.get("/api/wallet/transactions", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const transactions = await getTransactionHistory(userId, limit);
      res.json({ transactions });
    } catch (error: any) {
      console.error("Get transactions error:", error);
      res.status(500).json({ error: error.message || "Failed to get transactions" });
    }
  });

  app.post("/api/wallet/dev-adjust", async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Not available in production" });
      }

      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { amountTokens, reason } = req.body;
      if (typeof amountTokens !== "number" || !Number.isInteger(amountTokens)) {
        return res.status(400).json({ error: "amountTokens must be an integer" });
      }

      await getOrCreateWallet(userId);

      const result = await applyTokenTransaction({
        userId,
        kind: "ADJUSTMENT",
        amountTokens,
        referenceType: "dev_adjustment",
        referenceId: null,
        metadata: { reason: reason || "Dev adjustment", adjustedBy: "dev-endpoint" },
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const wallet = await getWallet(userId);
      res.json({
        success: true,
        newBalance: result.newBalance,
        wallet: wallet ? {
          balanceTokens: wallet.balanceTokens,
          lockedTokens: wallet.lockedTokens,
          availableTokens: wallet.availableTokens,
        } : null,
      });
    } catch (error: any) {
      console.error("Dev adjust error:", error);
      res.status(500).json({ error: error.message || "Failed to adjust tokens" });
    }
  });

  const TOKEN_PACKAGES = [
    { tokens: 25, amountCents: 2500 },
    { tokens: 50, amountCents: 5000 },
    { tokens: 100, amountCents: 10000 },
    { tokens: 250, amountCents: 25000 },
    { tokens: 500, amountCents: 50000 },
    { tokens: 1000, amountCents: 100000 },
  ];

  app.get("/api/tokens/packages", async (_req: Request, res: Response) => {
    res.json({ packages: TOKEN_PACKAGES });
  });

  app.post("/api/tokens/purchase-intent", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { tokens } = req.body;
      const pkg = TOKEN_PACKAGES.find((p) => p.tokens === tokens);
      if (!pkg) {
        return res.status(400).json({ error: "Invalid token package" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let stripeAvailable = false;

      try {
        const stripe = await getUncachableStripeClient();
        const publishableKey = await getStripePublishableKey();
        stripeAvailable = !!publishableKey;

        if (stripeAvailable) {
          const [purchaseResult] = await db
            .insert(tokenPurchases)
            .values({
              userId,
              tokens: pkg.tokens,
              amountCents: pkg.amountCents,
              provider: "stripe",
              status: "pending",
            })
            .returning();
          const purchaseId = purchaseResult.id;

          const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0]}`;
          
          const session = await stripe.checkout.sessions.create({
            line_items: [{
              price_data: {
                currency: 'usd',
                unit_amount: pkg.amountCents,
                product_data: {
                  name: `${pkg.tokens} Tokens`,
                  description: `Purchase ${pkg.tokens} tokens for Bullfight`,
                },
              },
              quantity: 1,
            }],
            mode: 'payment',
            success_url: `${baseUrl}/payment/success?type=tokens&id=${purchaseId}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/payment/cancel?type=tokens&id=${purchaseId}`,
            customer_email: user.email,
            metadata: {
              type: 'token_purchase',
              purchaseId,
              userId,
              tokens: pkg.tokens.toString(),
            },
          });

          await db
            .update(tokenPurchases)
            .set({ providerRef: session.id })
            .where(eq(tokenPurchases.id, purchaseId));

          return res.json({
            mode: "stripe",
            url: session.url,
            sessionId: session.id,
            purchaseId,
            tokens: pkg.tokens,
            amountCents: pkg.amountCents,
          });
        }
      } catch (stripeError) {
        console.log("Stripe not available, using simulation mode");
        stripeAvailable = false;
      }

      if (!stripeAvailable) {
        if (process.env.NODE_ENV === "production") {
          return res.status(503).json({ error: "Payment processing unavailable" });
        }

        const [purchaseResult] = await db
          .insert(tokenPurchases)
          .values({
            userId,
            tokens: pkg.tokens,
            amountCents: pkg.amountCents,
            provider: "simulate",
            status: "pending",
          })
          .returning();

        return res.json({
          mode: "simulate",
          purchaseId: purchaseResult.id,
          tokens: pkg.tokens,
          amountCents: pkg.amountCents,
        });
      }
    } catch (error: any) {
      console.error("Purchase intent error:", error);
      res.status(500).json({ error: error.message || "Failed to create purchase intent" });
    }
  });

  app.post("/api/tokens/purchase-confirm", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { purchaseId, sessionId } = req.body;
      if (!purchaseId) {
        return res.status(400).json({ error: "Purchase ID required" });
      }

      const [purchase] = await db
        .select()
        .from(tokenPurchases)
        .where(eq(tokenPurchases.id, purchaseId));

      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      if (purchase.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (purchase.status === "completed") {
        const wallet = await getWallet(userId);
        return res.json({
          success: true,
          alreadyCompleted: true,
          tokens: purchase.tokens,
          wallet: wallet ? {
            balanceTokens: wallet.balanceTokens,
            availableTokens: wallet.availableTokens,
          } : null,
        });
      }

      if (purchase.provider === "stripe") {
        if (!sessionId) {
          return res.status(400).json({ error: "Session ID required for Stripe" });
        }

        const stripe = await getUncachableStripeClient();
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
          return res.status(400).json({ error: "Payment not completed", status: session.payment_status });
        }

        if (session.metadata?.purchaseId !== purchaseId) {
          return res.status(400).json({ error: "Session mismatch" });
        }
      }

      await getOrCreateWallet(userId);
      const result = await applyTokenTransaction({
        userId,
        kind: "PURCHASE",
        amountTokens: purchase.tokens,
        referenceType: "token_purchase",
        referenceId: purchaseId,
        metadata: {
          provider: purchase.provider,
          amountCents: purchase.amountCents,
        },
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to credit tokens" });
      }

      await db
        .update(tokenPurchases)
        .set({ status: "completed" })
        .where(eq(tokenPurchases.id, purchaseId));

      const wallet = await getWallet(userId);
      res.json({
        success: true,
        tokens: purchase.tokens,
        newBalance: result.newBalance,
        wallet: wallet ? {
          balanceTokens: wallet.balanceTokens,
          availableTokens: wallet.availableTokens,
        } : null,
      });
    } catch (error: any) {
      console.error("Purchase confirm error:", error);
      res.status(500).json({ error: error.message || "Failed to confirm purchase" });
    }
  });

  app.get("/api/me/dashboard", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userCompetitions = await storage.getUserCompetitions(userId);
      const userStats = await storage.getUserStats(userId);

      const activeCompetitions = [];
      let totalEquityCents = 0;
      let totalStartingBalanceCents = 0;
      let totalWins = 0;
      let totalTrades = 0;

      for (const comp of userCompetitions) {
        if (comp.status === "open" || comp.status === "running") {
          const trades = await getTrades(comp.competitionId, userId);
          const closedTrades = trades.filter(t => t.status === "closed");
          const wins = closedTrades.filter(t => t.realizedPnlCents > 0).length;
          
          activeCompetitions.push({
            ...comp,
            tradesCount: trades.length,
            closedTradesCount: closedTrades.length,
            winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
          });

          totalEquityCents += comp.equityCents;
          totalStartingBalanceCents += comp.startingBalanceCents;
          totalWins += wins;
          totalTrades += closedTrades.length;
        }
      }

      const overallReturnPct = totalStartingBalanceCents > 0 
        ? ((totalEquityCents - totalStartingBalanceCents) / totalStartingBalanceCents) * 100 
        : 0;

      const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          needsUsername: !user.username,
        },
        stats: {
          totalEquityCents,
          totalStartingBalanceCents,
          returnPct: overallReturnPct,
          winRate: overallWinRate,
          tradesCount: totalTrades,
          ...userStats,
        },
        activeCompetitions,
        allCompetitions: userCompetitions,
      });
    } catch (error: any) {
      console.error("Get dashboard error:", error);
      res.status(500).json({ error: error.message || "Failed to get dashboard data" });
    }
  });

  app.get("/api/competitions", async (_req: Request, res: Response) => {
    try {
      const comps = await storage.getCompetitions();
      res.json(comps);
    } catch (error: any) {
      console.error("Get competitions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/competitions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string | undefined;

      const comp = await storage.getCompetition(id);
      if (!comp) {
        return res.status(404).json({ error: "Competition not found" });
      }

      let isJoined = false;
      if (userId) {
        const entry = await storage.getCompetitionEntry(id, userId);
        isJoined = !!entry && entry.paymentStatus === "succeeded";
      }

      res.json({ ...comp, isJoined });
    } catch (error: any) {
      console.error("Get competition error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get(
    "/api/competitions/:id/leaderboard",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const comp = await storage.getCompetition(id);
        if (!comp) {
          return res.status(404).json({ error: "Competition not found" });
        }

        const leaderboard = await storage.getLeaderboard(
          id,
          comp.startingBalanceCents
        );
        res.json(leaderboard);
      } catch (error: any) {
        console.error("Get leaderboard error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Stripe config endpoint for frontend
  app.get("/api/stripe/config", async (_req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      console.error("Stripe config error:", error);
      res.status(500).json({ error: "Failed to get Stripe config" });
    }
  });

  // Create Stripe checkout session for competition buy-in
  app.post("/api/competitions/:id/checkout", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const comp = await storage.getCompetition(id);
      if (!comp) {
        return res.status(404).json({ error: "Competition not found" });
      }

      if (comp.status !== "open" && comp.status !== "running") {
        return res.status(400).json({ error: "Competition is not accepting entries" });
      }

      if (comp.entryCount >= comp.entryCap) {
        return res.status(400).json({ error: "Competition is full" });
      }

      const existing = await storage.getCompetitionEntry(id, userId);
      if (existing && existing.paymentStatus === "succeeded") {
        return res.status(400).json({ error: "Already joined this competition" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: comp.buyInCents,
            product_data: {
              name: `Competition Entry: ${comp.title}`,
              description: `Buy-in for ${comp.title} trading competition`,
            },
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/payment/success?type=competition&id=${id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/payment/cancel?type=competition&id=${id}`,
        customer_email: user.email,
        metadata: {
          type: 'competition_entry',
          competitionId: id,
          userId: userId as string,
        },
      });

      // Create pending entry
      if (!existing) {
        await storage.createCompetitionEntry({
          competitionId: id,
          userId,
          paidCents: 0,
          paymentStatus: "pending",
          cashCents: 0,
          equityCents: 0,
          maxEquityCents: 0,
          maxDrawdownPct: 0,
          dq: false,
          stripeSessionId: session.id,
        });
      } else {
        await storage.updateCompetitionEntry(existing.id, {
          stripeSessionId: session.id,
          paymentStatus: "pending",
        });
      }

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("Competition checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Confirm competition payment (called after successful Stripe checkout)
  app.post("/api/competitions/:id/confirm-payment", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { sessionId } = req.body;
      const userId = req.headers["x-user-id"] as string;

      if (!userId || !sessionId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      if (session.metadata?.competitionId !== id || session.metadata?.userId !== userId) {
        return res.status(403).json({ error: "Payment session mismatch" });
      }

      const comp = await storage.getCompetition(id);
      if (!comp) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const entry = await storage.getCompetitionEntry(id, userId);
      if (!entry) {
        return res.status(404).json({ error: "Entry not found" });
      }

      if (entry.paymentStatus === "succeeded") {
        return res.json({ success: true, entry });
      }

      // Update entry with successful payment
      const updatedEntry = await storage.updateCompetitionEntry(entry.id, {
        paidCents: comp.buyInCents,
        paymentStatus: "succeeded",
        cashCents: comp.startingBalanceCents,
        equityCents: comp.startingBalanceCents,
        maxEquityCents: comp.startingBalanceCents,
        stripePaymentId: session.payment_intent as string,
      });

      const user = await storage.getUser(userId);
      if (user?.email) {
        const entries = await storage.getCompetitionEntries(id);
        const prizePool = entries.reduce((sum, e) => sum + e.paidCents, 0) - (entries.length * Math.round(comp.buyInCents * (comp.rakeBps / 10000)));

        EmailService.sendChallengeEntryConfirmedEmail(
          user.id,
          user.email,
          comp.title,
          comp.buyInCents,
          prizePool,
          comp.startAt || new Date(),
          comp.startingBalanceCents,
          id
        ).catch(err => {
          console.error("Failed to send challenge entry email:", err);
        });
      }

      res.json({ success: true, entry: updatedEntry });
    } catch (error: any) {
      console.error("Confirm payment error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Legacy join endpoint (for free competitions or testing)
  app.post("/api/competitions/:id/join", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const comp = await storage.getCompetition(id);
      if (!comp) {
        return res.status(404).json({ error: "Competition not found" });
      }

      // If competition has a buy-in, redirect to checkout
      if (comp.buyInCents > 0) {
        return res.status(400).json({ 
          error: "This competition requires payment",
          requiresPayment: true,
          checkoutUrl: `/api/competitions/${id}/checkout`
        });
      }

      if (comp.status !== "open" && comp.status !== "running") {
        return res.status(400).json({ error: "Competition is not accepting entries" });
      }

      if (comp.entryCount >= comp.entryCap) {
        return res.status(400).json({ error: "Competition is full" });
      }

      const existing = await storage.getCompetitionEntry(id, userId);
      if (existing) {
        return res.status(400).json({ error: "Already joined this competition" });
      }

      const entry = await storage.createCompetitionEntry({
        competitionId: id,
        userId,
        paidCents: 0,
        paymentStatus: "succeeded",
        cashCents: comp.startingBalanceCents,
        equityCents: comp.startingBalanceCents,
        maxEquityCents: comp.startingBalanceCents,
        maxDrawdownPct: 0,
        dq: false,
      });

      const user = await storage.getUser(userId);
      if (user?.email) {
        EmailService.sendChallengeEntryConfirmedEmail(
          user.id,
          user.email,
          comp.title,
          0,
          0,
          comp.startAt || new Date(),
          comp.startingBalanceCents,
          id
        ).catch(err => {
          console.error("Failed to send challenge entry email:", err);
        });
      }

      res.json({ success: true, entry });
    } catch (error: any) {
      console.error("Join competition error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Token-based competition join (new primary flow)
  app.post("/api/competitions/:id/join-with-tokens", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const comp = await storage.getCompetition(id);
      if (!comp) {
        return res.status(404).json({ error: "Competition not found" });
      }

      if (comp.status !== "open" && comp.status !== "running") {
        return res.status(400).json({ error: "Competition is not accepting entries" });
      }

      if (comp.entryCount >= comp.entryCap) {
        return res.status(400).json({ error: "Competition is full" });
      }

      const existing = await storage.getCompetitionEntry(id, userId);
      if (existing && existing.paymentStatus === "succeeded") {
        return res.status(400).json({ error: "Already joined this competition" });
      }

      // Get buy-in tokens (derive from buyInCents if buyInTokens is 0/default)
      const buyInTokens = comp.buyInTokens > 0 ? comp.buyInTokens : Math.floor(comp.buyInCents / 100);

      // For free competitions, join directly
      if (buyInTokens === 0) {
        const entry = await storage.createCompetitionEntry({
          competitionId: id,
          userId,
          paidCents: 0,
          paidTokens: 0,
          paymentStatus: "succeeded",
          cashCents: comp.startingBalanceCents,
          equityCents: comp.startingBalanceCents,
          maxEquityCents: comp.startingBalanceCents,
          maxDrawdownPct: 0,
          dq: false,
        });
        return res.json({ success: true, entry });
      }

      // Check wallet balance
      const wallet = await getOrCreateWallet(userId);
      if (wallet.availableTokens < buyInTokens) {
        return res.status(400).json({ 
          error: "Insufficient tokens",
          required: buyInTokens,
          available: wallet.availableTokens,
          insufficientTokens: true
        });
      }

      // Deduct tokens atomically
      const txResult = await applyTokenTransaction({
        userId,
        kind: "COMPETITION_ENTRY",
        amountTokens: -buyInTokens,
        referenceType: "competition",
        referenceId: id,
        metadata: { competitionTitle: comp.title },
      });

      if (!txResult.success) {
        return res.status(400).json({ error: txResult.error || "Token deduction failed" });
      }

      // Create or update entry
      let entry;
      if (existing) {
        entry = await storage.updateCompetitionEntry(existing.id, {
          paidTokens: buyInTokens,
          paidCents: 0,
          paymentStatus: "succeeded",
          cashCents: comp.startingBalanceCents,
          equityCents: comp.startingBalanceCents,
          maxEquityCents: comp.startingBalanceCents,
        });
      } else {
        entry = await storage.createCompetitionEntry({
          competitionId: id,
          userId,
          paidCents: 0,
          paidTokens: buyInTokens,
          paymentStatus: "succeeded",
          cashCents: comp.startingBalanceCents,
          equityCents: comp.startingBalanceCents,
          maxEquityCents: comp.startingBalanceCents,
          maxDrawdownPct: 0,
          dq: false,
        });
      }

      // Send confirmation email
      const user = await storage.getUser(userId);
      if (user?.email) {
        const entries = await storage.getCompetitionEntries(id);
        const totalTokens = entries.reduce((sum, e) => sum + (e.paidTokens || 0), 0);
        const rakeTokens = Math.floor(totalTokens * (comp.rakeBps / 10000));
        const prizePoolTokens = totalTokens - rakeTokens;

        EmailService.sendChallengeEntryConfirmedEmail(
          user.id,
          user.email,
          comp.title,
          buyInTokens * 100, // Convert to cents for email compatibility
          prizePoolTokens * 100,
          comp.startAt || new Date(),
          comp.startingBalanceCents,
          id
        ).catch(err => {
          console.error("Failed to send challenge entry email:", err);
        });
      }

      await storage.createAuditLog(userId, "competition_entry_tokens", "competition", id, {
        buyInTokens,
        newBalance: txResult.newBalance,
      });

      res.json({ success: true, entry, tokensSpent: buyInTokens });
    } catch (error: any) {
      console.error("Join competition with tokens error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/stats", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error: any) {
      console.error("Get user stats error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/competitions", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const comps = await storage.getUserCompetitions(userId);
      res.json(comps);
    } catch (error: any) {
      console.error("Get user competitions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User equity history for dashboard chart
  app.get("/api/user/equity", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const range = (req.query.range as string) || "1W";
      const competitionId = req.query.competitionId as string | undefined;

      // Get user's active competition entries
      const comps = await storage.getUserCompetitions(userId);
      const activeComps = comps.filter(
        (c) => c.status === "open" || c.status === "running"
      );

      if (activeComps.length === 0) {
        return res.json({ points: [], balance: 0, equity: 0, returnPct: 0 });
      }

      // If specific competition requested, filter to it
      const targetComps = competitionId
        ? activeComps.filter((c) => c.competitionId === competitionId)
        : activeComps;

      // Calculate aggregated metrics
      let totalEquity = 0;
      let totalStarting = 0;

      for (const comp of targetComps) {
        totalEquity += comp.equityCents;
        totalStarting += comp.startingBalanceCents;
      }

      const returnPct = totalStarting > 0
        ? ((totalEquity - totalStarting) / totalStarting) * 100
        : 0;

      // Generate simulated equity curve based on current data
      // In a real implementation, this would come from historical snapshots
      const now = Date.now();
      const rangeMs = {
        "1D": 24 * 60 * 60 * 1000,
        "1W": 7 * 24 * 60 * 60 * 1000,
        "1M": 30 * 24 * 60 * 60 * 1000,
        "All": 90 * 24 * 60 * 60 * 1000,
      }[range] || 7 * 24 * 60 * 60 * 1000;

      const points: { time: number; value: number }[] = [];
      const numPoints = range === "1D" ? 24 : range === "1W" ? 7 : 30;
      const interval = rangeMs / numPoints;

      for (let i = 0; i <= numPoints; i++) {
        const time = now - rangeMs + i * interval;
        // Interpolate from starting balance to current equity
        const progress = i / numPoints;
        const value = totalStarting + (totalEquity - totalStarting) * progress;
        points.push({ time, value: Math.round(value) });
      }

      res.json({
        points,
        balance: totalEquity,
        equity: totalEquity,
        returnPct,
        drawdownPct: 0, // Would need historical data to calculate
      });
    } catch (error: any) {
      console.error("Get user equity error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Top 25 competitors for a competition
  app.get("/api/competitions/:id/top", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 25;

      const comp = await storage.getCompetition(id);
      if (!comp) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const leaderboard = await storage.getLeaderboard(id, comp.startingBalanceCents);
      const topCompetitors = leaderboard.slice(0, limit).map((entry) => ({
        rank: entry.rank,
        userId: entry.userId,
        username: entry.username,
        returnPct: entry.returnPct,
        equityCents: entry.equityCents,
        drawdownPct: 0, // Would need historical data
        winRate: 0, // Would need trade data to calculate
        tradesCount: 0,
      }));

      res.json(topCompetitors);
    } catch (error: any) {
      console.error("Get top competitors error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Competitor equity for drilldown
  app.get(
    "/api/competitions/:id/competitors/:userId/equity",
    async (req: Request, res: Response) => {
      try {
        const { id, userId } = req.params;
        const range = (req.query.range as string) || "1W";

        const comp = await storage.getCompetition(id);
        if (!comp) {
          return res.status(404).json({ error: "Competition not found" });
        }

        const entry = await storage.getCompetitionEntry(id, userId);
        if (!entry) {
          return res.status(404).json({ error: "Competitor not found" });
        }

        // Generate equity curve (would be from historical snapshots in production)
        const now = Date.now();
        const rangeMs = {
          "1D": 24 * 60 * 60 * 1000,
          "1W": 7 * 24 * 60 * 60 * 1000,
          "1M": 30 * 24 * 60 * 60 * 1000,
          "All": 90 * 24 * 60 * 60 * 1000,
        }[range] || 7 * 24 * 60 * 60 * 1000;

        const points: { time: number; value: number }[] = [];
        const numPoints = range === "1D" ? 24 : range === "1W" ? 7 : 30;
        const interval = rangeMs / numPoints;

        for (let i = 0; i <= numPoints; i++) {
          const time = now - rangeMs + i * interval;
          const progress = i / numPoints;
          const value =
            comp.startingBalanceCents +
            (entry.equityCents - comp.startingBalanceCents) * progress;
          points.push({ time, value: Math.round(value) });
        }

        res.json({ points });
      } catch (error: any) {
        console.error("Get competitor equity error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Competitor trades
  app.get(
    "/api/competitions/:id/competitors/:userId/trades",
    async (req: Request, res: Response) => {
      try {
        const { id, userId } = req.params;

        const trades = await getTrades(id, userId);
        res.json(trades);
      } catch (error: any) {
        console.error("Get competitor trades error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Competitor deals
  app.get(
    "/api/competitions/:id/competitors/:userId/deals",
    async (req: Request, res: Response) => {
      try {
        const { id, userId } = req.params;

        const deals = await getDeals(id, userId);
        res.json(deals);
      } catch (error: any) {
        console.error("Get competitor deals error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Competitor orders
  app.get(
    "/api/competitions/:id/competitors/:userId/orders",
    async (req: Request, res: Response) => {
      try {
        const { id, userId } = req.params;

        const orders = await storage.getOrders(id, userId);
        res.json(orders);
      } catch (error: any) {
        console.error("Get competitor orders error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.get("/api/arena/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const comp = await storage.getCompetition(id);
      if (!comp) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const entry = await storage.getCompetitionEntry(id, userId);
      if (!entry || entry.paymentStatus !== "succeeded") {
        return res.status(403).json({ error: "Not entered in this competition" });
      }

      const positions = await storage.getPositions(id, userId);
      const pendingOrders = await storage.getPendingOrders(id, userId);

      let unrealizedPnl = 0;
      const positionsWithPnl = positions.map((pos) => {
        const quote = marketDataService.getQuote(pos.pair);
        if (quote) {
          const currentPrice = pos.side === "buy" ? quote.bid : quote.ask;
          const pipsPerUnit = pos.pair.includes("JPY") ? 0.01 : 0.0001;
          const priceDiff = pos.side === "buy" 
            ? currentPrice - pos.avgEntryPrice 
            : pos.avgEntryPrice - currentPrice;
          const pnlCents = Math.round(priceDiff / pipsPerUnit * pos.quantityUnits * 0.1);
          unrealizedPnl += pnlCents;
          return {
            ...pos,
            unrealizedPnlCents: pnlCents,
            lots: unitsToLots(pos.quantityUnits),
            stopLossPrice: pos.stopLossPrice,
            takeProfitPrice: pos.takeProfitPrice,
          };
        }
        return {
          ...pos,
          unrealizedPnlCents: 0,
          lots: unitsToLots(pos.quantityUnits),
        };
      });

      const equityCents = entry.cashCents + unrealizedPnl;
      if (equityCents !== entry.equityCents) {
        await storage.updateCompetitionEntry(entry.id, { equityCents });
      }

      const leaderboard = await storage.getLeaderboard(id, comp.startingBalanceCents);
      const rank = leaderboard.find((l) => l.userId === userId)?.rank;

      const quotes: Record<string, any> = {};
      for (const q of marketDataService.getAllQuotes()) {
        quotes[q.pair] = {
          bid: q.bid,
          ask: q.ask,
          timestamp: q.timestamp,
          spreadPips: q.spreadPips,
          status: q.status,
        };
      }

      res.json({
        competition: {
          id: comp.id,
          title: comp.title,
          status: comp.status,
          startingBalanceCents: comp.startingBalanceCents,
          allowedPairsJson: comp.allowedPairsJson,
          endAt: comp.endAt,
        },
        entry: {
          cashCents: entry.cashCents,
          equityCents,
          rank,
        },
        positions: positionsWithPnl,
        pendingOrders,
        quotes,
        isUsingMockData: marketDataService.isUsingMock(),
      });
    } catch (error: any) {
      console.error("Get arena error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/arena/:id/orders", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const comp = await storage.getCompetition(id);
      if (!comp) {
        return res.status(404).json({ error: "Competition not found" });
      }

      if (comp.status !== "running") {
        return res.status(400).json({ error: "Trading is not active" });
      }

      const entry = await storage.getCompetitionEntry(id, userId);
      if (!entry || entry.paymentStatus !== "succeeded") {
        return res.status(403).json({ error: "Not entered in this competition" });
      }

      const {
        pair,
        side,
        type,
        quantityUnits,
        lots,
        limitPrice,
        stopPrice,
        stopLossPrice,
        takeProfitPrice,
      } = req.body;

      const tradeLots = lots ?? unitsToLots(quantityUnits || 0);
      if (!pair || !side || !type || tradeLots <= 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!comp.allowedPairsJson?.includes(pair)) {
        return res.status(400).json({ error: "Pair not allowed in this competition" });
      }

      if (type === "market") {
        const result = await executeMarketOrder({
          competitionId: id,
          userId,
          pair,
          side,
          lots: tradeLots,
          stopLossPrice: stopLossPrice ? parseFloat(stopLossPrice) : undefined,
          takeProfitPrice: takeProfitPrice ? parseFloat(takeProfitPrice) : undefined,
          spreadMarkupPips: comp.spreadMarkupPips,
          maxSlippagePips: comp.maxSlippagePips,
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json({
          success: true,
          deal: result.deal,
          position: result.position,
        });
      } else {
        const order = await storage.createOrder({
          competitionId: id,
          userId,
          pair,
          side,
          type,
          quantityUnits: lotsToUnits(tradeLots),
          limitPrice: limitPrice ? parseFloat(limitPrice) : undefined,
          stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
          stopLossPrice: stopLossPrice ? parseFloat(stopLossPrice) : undefined,
          takeProfitPrice: takeProfitPrice ? parseFloat(takeProfitPrice) : undefined,
          status: "pending",
        });

        res.json({ success: true, order });
      }
    } catch (error: any) {
      console.error("Create order error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(
    "/api/arena/:id/positions/:positionId/close",
    async (req: Request, res: Response) => {
      try {
        const { id, positionId } = req.params;
        const userId = req.headers["x-user-id"] as string;

        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const comp = await storage.getCompetition(id);
        if (!comp || comp.status !== "running") {
          return res.status(400).json({ error: "Trading is not active" });
        }

        const result = await partialClosePosition({
          competitionId: id,
          userId,
          positionId,
          closePercentage: 100,
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json({ success: true, deal: result.deal });
      } catch (error: any) {
        console.error("Close position error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/arena/:id/orders/:orderId/cancel",
    async (req: Request, res: Response) => {
      try {
        const { id, orderId } = req.params;
        const userId = req.headers["x-user-id"] as string;

        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        await storage.updateOrder(orderId, { status: "cancelled" });
        res.json({ success: true });
      } catch (error: any) {
        console.error("Cancel order error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.put(
    "/api/arena/:id/positions/:positionId",
    async (req: Request, res: Response) => {
      try {
        const { id, positionId } = req.params;
        const userId = req.headers["x-user-id"] as string;
        const { stopLossPrice, takeProfitPrice } = req.body;

        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const comp = await storage.getCompetition(id);
        if (!comp || comp.status !== "running") {
          return res.status(400).json({ error: "Trading is not active" });
        }

        const result = await updatePositionSLTP({
          competitionId: id,
          userId,
          positionId,
          stopLossPrice: stopLossPrice !== undefined
            ? (stopLossPrice ? parseFloat(stopLossPrice) : null)
            : undefined,
          takeProfitPrice: takeProfitPrice !== undefined
            ? (takeProfitPrice ? parseFloat(takeProfitPrice) : null)
            : undefined,
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json({ success: true });
      } catch (error: any) {
        console.error("Modify position error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/arena/:id/positions/:positionId/partial-close",
    async (req: Request, res: Response) => {
      try {
        const { id, positionId } = req.params;
        const userId = req.headers["x-user-id"] as string;
        const { lots, percentage } = req.body;

        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!lots && !percentage) {
          return res.status(400).json({ error: "Specify lots or percentage to close" });
        }

        const comp = await storage.getCompetition(id);
        if (!comp || comp.status !== "running") {
          return res.status(400).json({ error: "Trading is not active" });
        }

        const result = await partialClosePosition({
          competitionId: id,
          userId,
          positionId,
          closeLots: lots ? parseFloat(lots) : undefined,
          closePercentage: percentage ? parseFloat(percentage) : undefined,
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        res.json({
          success: true,
          deal: result.deal,
          position: result.position,
        });
      } catch (error: any) {
        console.error("Partial close error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.put(
    "/api/arena/:id/orders/:orderId",
    async (req: Request, res: Response) => {
      try {
        const { id, orderId } = req.params;
        const userId = req.headers["x-user-id"] as string;
        const { limitPrice, stopPrice, stopLossPrice, takeProfitPrice } = req.body;

        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const comp = await storage.getCompetition(id);
        if (!comp || comp.status !== "running") {
          return res.status(400).json({ error: "Trading is not active" });
        }

        const updates: any = {};
        if (limitPrice !== undefined) {
          updates.limitPrice = limitPrice ? parseFloat(limitPrice) : null;
        }
        if (stopPrice !== undefined) {
          updates.stopPrice = stopPrice ? parseFloat(stopPrice) : null;
        }
        if (stopLossPrice !== undefined) {
          updates.stopLossPrice = stopLossPrice ? parseFloat(stopLossPrice) : null;
        }
        if (takeProfitPrice !== undefined) {
          updates.takeProfitPrice = takeProfitPrice ? parseFloat(takeProfitPrice) : null;
        }

        await storage.updateOrder(orderId, updates);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Modify order error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.get("/api/admin/competitions", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const comps = await storage.getCompetitions();
      res.json(comps);
    } catch (error: any) {
      console.error("Admin get competitions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/competitions", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const comp = await storage.createCompetition({
        ...req.body,
        createdBy: userId,
        status: "draft",
      });

      res.json(comp);
    } catch (error: any) {
      console.error("Admin create competition error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(
    "/api/admin/competitions/:id/status",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.headers["x-user-id"] as string;

        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Admin access required" });
        }

        const previousComp = await storage.getCompetition(id);
        const previousStatus = previousComp?.status;

        const comp = await storage.updateCompetitionStatus(id, status);

        if (comp && status !== previousStatus) {
          const entries = await storage.getCompetitionEntries(id);

          if (status === "running" && previousStatus !== "running") {
            for (const entry of entries) {
              if (entry.user?.email) {
                EmailService.sendChallengeStartedEmail(
                  entry.userId,
                  entry.user.email,
                  comp.title,
                  comp.endTime,
                  entries.length,
                  comp.id
                ).catch(err => console.error("Failed to send challenge started email:", err));
              }
            }
          }

          if (status === "completed" && previousStatus !== "completed") {
            const startingBalance = comp.startingBalanceCents;
            for (let i = 0; i < entries.length; i++) {
              const entry = entries[i];
              if (entry.user?.email) {
                const equity = entry.equityCents;
                const returnPct = ((equity - startingBalance) / startingBalance) * 100;
                const rank = i + 1;
                EmailService.sendChallengeConcludedEmail(
                  entry.userId,
                  entry.user.email,
                  comp.title,
                  rank,
                  entries.length,
                  returnPct,
                  equity
                ).catch(err => console.error("Failed to send challenge concluded email:", err));
              }
            }
          }
        }

        res.json(comp);
      } catch (error: any) {
        console.error("Admin update status error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.get("/api/quotes", (_req: Request, res: Response) => {
    const quotes: Record<string, any> = {};
    for (const q of marketDataService.getAllQuotes()) {
      quotes[q.pair] = {
        bid: q.bid,
        ask: q.ask,
        timestamp: q.timestamp,
        spreadPips: q.spreadPips,
        status: q.status,
      };
    }
    res.json(quotes);
  });

  app.get("/api/market/candles/:pair", async (req: Request, res: Response) => {
    try {
      const { pair } = req.params;
      const timeframe = (req.query.tf as string) || (req.query.timeframe as string) || "1m";
      const limit = Math.min(parseInt(req.query.limit as string) || 500, 1000);

      const result = await marketDataService.getCandlesWithMeta(pair, timeframe, limit);
      res.json({
        pair,
        timeframe,
        mock: result.mock,
        candles: result.candles,
      });
    } catch (error: any) {
      console.error("Get candles error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/market/candles", async (req: Request, res: Response) => {
    try {
      const pair = (req.query.pair as string) || "EUR-USD";
      const timeframe = (req.query.tf as string) || (req.query.timeframe as string) || "1m";
      const limit = Math.min(parseInt(req.query.limit as string) || 500, 1000);

      const result = await marketDataService.getCandlesWithMeta(pair, timeframe, limit);
      res.json({
        pair,
        timeframe,
        mock: result.mock,
        candles: result.candles,
      });
    } catch (error: any) {
      console.error("Get candles error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/market/status", (_req: Request, res: Response) => {
    res.json({
      isUsingMock: marketDataService.isUsingMock(),
      pairs: marketDataService.getAllQuotes().map((q) => ({
        pair: q.pair,
        status: q.status,
      })),
    });
  });

  app.get("/api/market/quotes", (_req: Request, res: Response) => {
    const quotes = marketDataService.getAllQuotes();
    const now = Date.now();
    res.json({
      isUsingMock: marketDataService.isUsingMock(),
      isConnected: marketDataService.isConnected(),
      serverTime: now,
      quotes: quotes.map((q) => ({
        pair: q.pair,
        bid: q.bid,
        ask: q.ask,
        spreadPips: q.spreadPips,
        timestamp: q.timestamp,
        ageMs: now - q.timestamp,
        status: q.status,
      })),
    });
  });

  app.get("/api/arena/:id/deals", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const dealsList = await getDeals(id, userId);
      res.json(dealsList);
    } catch (error: any) {
      console.error("Get deals error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/arena/:id/trades", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const tradesList = await getTrades(id, userId);
      res.json(tradesList);
    } catch (error: any) {
      console.error("Get trades error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/arena/:id/order-history", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const orderHistory = await storage.getOrders(id, userId);
      res.json(orderHistory);
    } catch (error: any) {
      console.error("Get order history error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Arena Mode - Public matches listing
  app.get("/api/arena-mode/matches", async (req: Request, res: Response) => {
    try {
      const { status = "ALL" } = req.query;
      
      // Get all public, arena-listed PvP challenges
      const allChallenges = await storage.getPublicArenaListedChallenges();
      
      // Enrich with user data
      const enrichedMatches = await Promise.all(
        allChallenges.map(async (challenge: any) => {
          const challenger = await storage.getUser(challenge.challengerId);
          const invitee = challenge.inviteeId ? await storage.getUser(challenge.inviteeId) : null;
          
          return {
            ...challenge,
            challengerUsername: challenger?.username || "Unknown",
            challengerAvatar: null, // Avatar support can be added later
            inviteeUsername: invitee?.username || challenge.inviteeEmail?.split("@")[0] || "TBD",
            inviteeAvatar: null,
            viewersCount: 0, // Real-time viewers can be added later
            chatMessageCount: 0, // Chat message count can be added later
          };
        })
      );
      
      // Filter by status
      let filtered = enrichedMatches;
      const now = new Date();
      
      if (status === "LIVE") {
        filtered = enrichedMatches.filter(m => m.liveStatus === "live" || m.status === "active");
      } else if (status === "UPCOMING") {
        filtered = enrichedMatches.filter(m => 
          m.liveStatus === "scheduled" || 
          (m.scheduledLiveAt && new Date(m.scheduledLiveAt) > now) ||
          (m.status === "pending" || m.status === "payment_pending")
        );
      }
      
      // Sort: LIVE first by viewers desc, then stake desc
      // UPCOMING by scheduledLiveAt soonest
      filtered.sort((a, b) => {
        const aIsLive = a.liveStatus === "live" || a.status === "active";
        const bIsLive = b.liveStatus === "live" || b.status === "active";
        
        if (aIsLive && !bIsLive) return -1;
        if (!aIsLive && bIsLive) return 1;
        
        if (aIsLive && bIsLive) {
          // Both live: sort by viewers desc, then stake desc
          if (b.viewersCount !== a.viewersCount) return b.viewersCount - a.viewersCount;
          return (b.stakeTokens || 0) - (a.stakeTokens || 0);
        }
        
        // Both not live: sort by scheduledLiveAt soonest
        const aScheduled = a.scheduledLiveAt ? new Date(a.scheduledLiveAt).getTime() : Infinity;
        const bScheduled = b.scheduledLiveAt ? new Date(b.scheduledLiveAt).getTime() : Infinity;
        if (aScheduled !== bScheduled) return aScheduled - bScheduled;
        
        // Fallback to stake desc
        return (b.stakeTokens || 0) - (a.stakeTokens || 0);
      });
      
      res.json(filtered);
    } catch (error: any) {
      console.error("Get arena mode matches error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pvp/challenges", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      const challenges = await storage.getPvpChallenges(userId, user?.email);
      res.json(challenges);
    } catch (error: any) {
      console.error("Get PvP challenges error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pvp/challenges/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      const challenge = await storage.getPvpChallenge(id);

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const user = await storage.getUser(userId);
      const isChallenger = challenge.challengerId === userId;
      const isInviteeById = challenge.inviteeId === userId;
      const isInviteeByEmail = user?.email && challenge.inviteeEmail === user.email;

      if (!isChallenger && !isInviteeById && !isInviteeByEmail) {
        return res.status(403).json({ error: "Not authorized to view this challenge" });
      }

      if (isInviteeByEmail && !challenge.inviteeId) {
        await storage.updatePvpChallenge(id, { inviteeId: userId });
        challenge.inviteeId = userId;
      }

      res.json(challenge);
    } catch (error: any) {
      console.error("Get PvP challenge error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pvp/challenges", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const {
        name,
        inviteeEmail,
        stakeCents,
        stakeTokens,
        startingBalanceCents,
        allowedPairsJson,
        startAt,
        endAt,
        spreadMarkupPips,
        maxSlippagePips,
        minOrderIntervalMs,
        maxDrawdownPct,
        // Visibility and streaming options
        visibility,
        arenaListed,
        chatEnabled,
        bettingEnabled,
        scheduledLiveAt,
        streamEmbedType,
        streamUrl,
      } = req.body;

      if (!inviteeEmail) {
        return res.status(400).json({ error: "Invitee email required" });
      }

      const invitee = await storage.getUserByEmail(inviteeEmail);

      const challenge = await storage.createPvpChallenge({
        name: name || null,
        challengerId: userId,
        inviteeId: invitee?.id || null,
        inviteeEmail,
        status: "pending",
        stakeCents: stakeCents || 1000,
        stakeTokens: stakeTokens || Math.floor((stakeCents || 1000) / 100),
        startingBalanceCents: startingBalanceCents || 10000000,
        allowedPairsJson: allowedPairsJson || ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"],
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        spreadMarkupPips: spreadMarkupPips || 0.5,
        maxSlippagePips: maxSlippagePips || 1.0,
        minOrderIntervalMs: minOrderIntervalMs || 1000,
        maxDrawdownPct: maxDrawdownPct || null,
        challengerAccepted: true,
        // Visibility and streaming options
        visibility: visibility || "private",
        arenaListed: arenaListed ?? false,
        chatEnabled: chatEnabled ?? true,
        bettingEnabled: bettingEnabled ?? false,
        scheduledLiveAt: scheduledLiveAt ? new Date(scheduledLiveAt) : null,
        liveStatus: scheduledLiveAt ? "scheduled" : "offline",
        streamEmbedType: streamEmbedType || "none",
        streamUrl: streamUrl || null,
      });

      await storage.createAuditLog(userId, "pvp_challenge_created", "pvp_challenge", challenge.id, {
        inviteeEmail,
        stakeCents: challenge.stakeCents,
      });

      const challenger = await storage.getUser(userId);
      const durationHours = challenge.startAt && challenge.endAt 
        ? Math.round((new Date(challenge.endAt).getTime() - new Date(challenge.startAt).getTime()) / (1000 * 60 * 60))
        : 24;

      EmailService.sendPvPInvitationEmail(
        inviteeEmail,
        challenger?.email?.split('@')[0] || 'A trader',
        challenge.stakeCents,
        durationHours,
        challenge.startingBalanceCents,
        challenge.id
      ).catch(err => {
        console.error("Failed to send PvP invitation email:", err);
      });

      res.json(challenge);
    } catch (error: any) {
      console.error("Create PvP challenge error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/pvp/challenges/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      const challenge = await storage.getPvpChallenge(id);

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const user = await storage.getUser(userId);
      const isChallenger = challenge.challengerId === userId;
      const isInviteeById = challenge.inviteeId === userId;
      const isInviteeByEmail = user?.email && challenge.inviteeEmail === user.email;

      if (!isChallenger && !isInviteeById && !isInviteeByEmail) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (isInviteeByEmail && !challenge.inviteeId) {
        await storage.updatePvpChallenge(id, { inviteeId: userId });
        challenge.inviteeId = userId;
      }

      if (challenge.status !== "pending" && challenge.status !== "negotiating") {
        return res.status(400).json({ error: "Challenge cannot be modified in current state" });
      }

      const {
        stakeCents,
        startingBalanceCents,
        allowedPairsJson,
        startAt,
        endAt,
        spreadMarkupPips,
        maxSlippagePips,
        minOrderIntervalMs,
        maxDrawdownPct,
      } = req.body;

      const proposedTerms = {
        stakeCents,
        startingBalanceCents,
        allowedPairsJson,
        startAt,
        endAt,
        spreadMarkupPips,
        maxSlippagePips,
        minOrderIntervalMs,
        maxDrawdownPct,
      };

      const updated = await storage.updatePvpChallenge(id, {
        proposedTermsJson: proposedTerms,
        proposedBy: userId,
        status: "negotiating",
        challengerAccepted: isChallenger,
        inviteeAccepted: !isChallenger,
      });

      await storage.createAuditLog(userId, "pvp_terms_proposed", "pvp_challenge", id, proposedTerms);

      res.json(updated);
    } catch (error: any) {
      console.error("Update PvP challenge error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pvp/challenges/:id/accept", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      const challenge = await storage.getPvpChallenge(id);

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const user = await storage.getUser(userId);
      const isChallenger = challenge.challengerId === userId;
      const isInviteeById = challenge.inviteeId === userId;
      const isInviteeByEmail = user?.email && challenge.inviteeEmail === user.email;

      if (!isChallenger && !isInviteeById && !isInviteeByEmail) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (isInviteeByEmail && !challenge.inviteeId) {
        await storage.updatePvpChallenge(id, { inviteeId: userId });
        challenge.inviteeId = userId;
      }

      if (challenge.status !== "pending" && challenge.status !== "negotiating") {
        return res.status(400).json({ error: "Challenge cannot be accepted in current state" });
      }

      if (challenge.proposedTermsJson && challenge.proposedBy !== userId) {
        const terms = challenge.proposedTermsJson as any;
        await storage.updatePvpChallenge(id, {
          stakeCents: terms.stakeCents || challenge.stakeCents,
          startingBalanceCents: terms.startingBalanceCents || challenge.startingBalanceCents,
          allowedPairsJson: terms.allowedPairsJson || challenge.allowedPairsJson,
          startAt: terms.startAt ? new Date(terms.startAt) : challenge.startAt,
          endAt: terms.endAt ? new Date(terms.endAt) : challenge.endAt,
          spreadMarkupPips: terms.spreadMarkupPips || challenge.spreadMarkupPips,
          maxSlippagePips: terms.maxSlippagePips || challenge.maxSlippagePips,
          minOrderIntervalMs: terms.minOrderIntervalMs || challenge.minOrderIntervalMs,
          maxDrawdownPct: terms.maxDrawdownPct || challenge.maxDrawdownPct,
          proposedTermsJson: null,
          proposedBy: null,
        });
      }

      const updatedChallenge = await storage.getPvpChallenge(id);
      const challengerAccepted = isChallenger ? true : updatedChallenge!.challengerAccepted;
      const inviteeAccepted = !isChallenger ? true : updatedChallenge!.inviteeAccepted;

      const bothAccepted = challengerAccepted && inviteeAccepted;

      const updated = await storage.updatePvpChallenge(id, {
        challengerAccepted,
        inviteeAccepted,
        status: bothAccepted ? "accepted" : "pending",
      });

      await storage.createAuditLog(userId, "pvp_terms_accepted", "pvp_challenge", id, {
        challengerAccepted,
        inviteeAccepted,
        bothAccepted,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Accept PvP challenge error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe checkout session for PvP challenge stake
  app.post("/api/pvp/challenges/:id/checkout", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const challenge = await storage.getPvpChallenge(id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isChallenger = challenge.challengerId === userId;
      const isInviteeById = challenge.inviteeId === userId;
      const isInviteeByEmail = user.email && challenge.inviteeEmail === user.email;

      if (!isChallenger && !isInviteeById && !isInviteeByEmail) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (challenge.status !== "accepted" && challenge.status !== "payment_pending") {
        return res.status(400).json({ error: "Challenge not ready for payment" });
      }

      const alreadyPaid = isChallenger ? challenge.challengerPaid : challenge.inviteePaid;
      if (alreadyPaid) {
        return res.status(400).json({ error: "Already paid for this challenge" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: challenge.stakeCents,
            product_data: {
              name: `PvP Challenge Stake: ${challenge.name || 'Challenge'}`,
              description: `Stake for PvP trading challenge`,
            },
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/payment/success?type=pvp&id=${id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/payment/cancel?type=pvp&id=${id}`,
        customer_email: user.email,
        metadata: {
          type: 'pvp_challenge_stake',
          challengeId: id,
          userId: userId as string,
          isChallenger: isChallenger ? 'true' : 'false',
        },
      });

      // Update challenge with session ID
      const updateData: any = {};
      if (isChallenger) {
        updateData.challengerStripeSessionId = session.id;
      } else {
        updateData.inviteeStripeSessionId = session.id;
      }
      await storage.updatePvpChallenge(id, updateData);

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("PvP checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Confirm PvP challenge payment (called after successful Stripe checkout)
  app.post("/api/pvp/challenges/:id/confirm-payment", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { sessionId } = req.body;
      const userId = req.headers["x-user-id"] as string;

      if (!userId || !sessionId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      if (session.metadata?.challengeId !== id || session.metadata?.userId !== userId) {
        return res.status(403).json({ error: "Payment session mismatch" });
      }

      const challenge = await storage.getPvpChallenge(id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const isChallenger = session.metadata.isChallenger === 'true';
      const alreadyPaid = isChallenger ? challenge.challengerPaid : challenge.inviteePaid;

      if (alreadyPaid) {
        return res.json({ success: true, challenge });
      }

      // Mark payment complete and check if both parties paid
      const challengerPaid = isChallenger ? true : challenge.challengerPaid;
      const inviteePaid = !isChallenger ? true : challenge.inviteePaid;
      const bothPaid = challengerPaid && inviteePaid;

      let competitionId = challenge.competitionId;

      if (bothPaid && !competitionId) {
        const now = new Date();
        let adjustedStartAt = challenge.startAt;

        if (challenge.startAt && new Date(challenge.startAt) <= now) {
          adjustedStartAt = now;
        }

        const comp = await storage.createCompetition({
          type: "pvp",
          status: "running",
          title: challenge.name || `PvP Challenge`,
          buyInCents: challenge.stakeCents,
          entryCap: 2,
          rakeBps: challenge.rakeBps,
          startAt: adjustedStartAt,
          endAt: challenge.endAt,
          startingBalanceCents: challenge.startingBalanceCents,
          allowedPairsJson: challenge.allowedPairsJson,
          spreadMarkupPips: challenge.spreadMarkupPips,
          maxSlippagePips: challenge.maxSlippagePips,
          minOrderIntervalMs: challenge.minOrderIntervalMs,
          maxDrawdownPct: challenge.maxDrawdownPct,
          createdBy: challenge.challengerId,
        });

        competitionId = comp.id;

        await storage.createCompetitionEntry({
          competitionId: comp.id,
          userId: challenge.challengerId,
          paidCents: challenge.stakeCents,
          paymentStatus: "succeeded",
          cashCents: challenge.startingBalanceCents,
          equityCents: challenge.startingBalanceCents,
          maxEquityCents: challenge.startingBalanceCents,
        });

        await storage.createCompetitionEntry({
          competitionId: comp.id,
          userId: challenge.inviteeId!,
          paidCents: challenge.stakeCents,
          paymentStatus: "succeeded",
          cashCents: challenge.startingBalanceCents,
          equityCents: challenge.startingBalanceCents,
          maxEquityCents: challenge.startingBalanceCents,
        });
      }

      const updateData: any = {
        challengerPaid,
        inviteePaid,
        competitionId,
        status: bothPaid ? "active" : "payment_pending",
      };

      if (isChallenger) {
        updateData.challengerStripePaymentId = session.payment_intent as string;
      } else {
        updateData.inviteeStripePaymentId = session.payment_intent as string;
      }

      const updated = await storage.updatePvpChallenge(id, updateData);

      await storage.createAuditLog(userId, "pvp_payment_made", "pvp_challenge", id, {
        challengerPaid,
        inviteePaid,
        bothPaid,
        competitionId,
        stripeSessionId: sessionId,
      });

      res.json({ success: true, challenge: updated, competitionId });
    } catch (error: any) {
      console.error("Confirm PvP payment error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Legacy pay endpoint (kept for backwards compatibility)
  app.post("/api/pvp/challenges/:id/pay", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      const challenge = await storage.getPvpChallenge(id);

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      // If stake amount > 0, redirect to checkout
      if (challenge.stakeCents > 0) {
        return res.status(400).json({
          error: "This challenge requires payment",
          requiresPayment: true,
          checkoutUrl: `/api/pvp/challenges/${id}/checkout`
        });
      }

      const user = await storage.getUser(userId);
      const isChallenger = challenge.challengerId === userId;
      const isInviteeById = challenge.inviteeId === userId;
      const isInviteeByEmail = user?.email && challenge.inviteeEmail === user.email;

      if (!isChallenger && !isInviteeById && !isInviteeByEmail) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (isInviteeByEmail && !challenge.inviteeId) {
        await storage.updatePvpChallenge(id, { inviteeId: userId });
        challenge.inviteeId = userId;
      }

      if (challenge.status !== "accepted" && challenge.status !== "payment_pending") {
        return res.status(400).json({ error: "Challenge not ready for payment" });
      }

      const challengerPaid = isChallenger ? true : challenge.challengerPaid;
      const inviteePaid = !isChallenger ? true : challenge.inviteePaid;
      const bothPaid = challengerPaid && inviteePaid;

      let competitionId = challenge.competitionId;

      if (bothPaid && !competitionId) {
        const now = new Date();
        let adjustedStartAt = challenge.startAt;
        
        if (challenge.startAt && new Date(challenge.startAt) <= now) {
          adjustedStartAt = now;
        }

        const comp = await storage.createCompetition({
          type: "pvp",
          status: "running",
          title: challenge.name || `PvP Challenge`,
          buyInCents: challenge.stakeCents,
          entryCap: 2,
          rakeBps: challenge.rakeBps,
          startAt: adjustedStartAt,
          endAt: challenge.endAt,
          startingBalanceCents: challenge.startingBalanceCents,
          allowedPairsJson: challenge.allowedPairsJson,
          spreadMarkupPips: challenge.spreadMarkupPips,
          maxSlippagePips: challenge.maxSlippagePips,
          minOrderIntervalMs: challenge.minOrderIntervalMs,
          maxDrawdownPct: challenge.maxDrawdownPct,
          createdBy: challenge.challengerId,
        });

        competitionId = comp.id;

        await storage.createCompetitionEntry({
          competitionId: comp.id,
          userId: challenge.challengerId,
          paidCents: challenge.stakeCents,
          paymentStatus: "succeeded",
          cashCents: challenge.startingBalanceCents,
          equityCents: challenge.startingBalanceCents,
          maxEquityCents: challenge.startingBalanceCents,
        });

        await storage.createCompetitionEntry({
          competitionId: comp.id,
          userId: challenge.inviteeId!,
          paidCents: challenge.stakeCents,
          paymentStatus: "succeeded",
          cashCents: challenge.startingBalanceCents,
          equityCents: challenge.startingBalanceCents,
          maxEquityCents: challenge.startingBalanceCents,
        });
      }

      const updated = await storage.updatePvpChallenge(id, {
        challengerPaid,
        inviteePaid,
        competitionId,
        status: bothPaid ? "active" : "payment_pending",
      });

      await storage.createAuditLog(userId, "pvp_payment_made", "pvp_challenge", id, {
        challengerPaid,
        inviteePaid,
        bothPaid,
        competitionId,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Pay PvP challenge error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Token-based PvP stake payment (new primary flow)
  app.post("/api/pvp/challenges/:id/pay-with-tokens", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      const challenge = await storage.getPvpChallenge(id);

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const user = await storage.getUser(userId);
      const isChallenger = challenge.challengerId === userId;
      const isInviteeById = challenge.inviteeId === userId;
      const isInviteeByEmail = user?.email && challenge.inviteeEmail === user.email;

      if (!isChallenger && !isInviteeById && !isInviteeByEmail) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (isInviteeByEmail && !challenge.inviteeId) {
        await storage.updatePvpChallenge(id, { inviteeId: userId });
        challenge.inviteeId = userId;
      }

      if (challenge.status !== "accepted" && challenge.status !== "payment_pending") {
        return res.status(400).json({ error: "Challenge not ready for payment" });
      }

      const alreadyPaid = isChallenger ? challenge.challengerPaid : challenge.inviteePaid;
      if (alreadyPaid) {
        return res.status(400).json({ error: "Already paid for this challenge" });
      }

      // Get stake tokens (derive from stakeCents if stakeTokens is 0/default)
      const stakeTokens = challenge.stakeTokens > 0 ? challenge.stakeTokens : Math.floor(challenge.stakeCents / 100);

      // For free challenges, proceed without tokens
      if (stakeTokens === 0) {
        const challengerPaid = isChallenger ? true : challenge.challengerPaid;
        const inviteePaid = !isChallenger ? true : challenge.inviteePaid;
        const bothPaid = challengerPaid && inviteePaid;

        let competitionId = challenge.competitionId;
        if (bothPaid && !competitionId) {
          competitionId = await createPvpCompetition(challenge, stakeTokens);
        }

        const updated = await storage.updatePvpChallenge(id, {
          challengerPaid,
          inviteePaid,
          competitionId,
          status: bothPaid ? "active" : "payment_pending",
        });

        return res.json({ success: true, challenge: updated, competitionId });
      }

      // Check wallet balance for locking
      const wallet = await getOrCreateWallet(userId);
      if (wallet.availableTokens < stakeTokens) {
        return res.status(400).json({
          error: "Insufficient tokens",
          required: stakeTokens,
          available: wallet.availableTokens,
          insufficientTokens: true
        });
      }

      // Lock tokens for the stake
      const lockResult = await lockTokens(
        userId,
        stakeTokens,
        "PVP_STAKE_LOCK",
        "pvp_challenge",
        id,
        { challengeName: challenge.name, role: isChallenger ? "challenger" : "invitee" }
      );

      if (!lockResult.success) {
        return res.status(400).json({ error: lockResult.error || "Token lock failed" });
      }

      const challengerPaid = isChallenger ? true : challenge.challengerPaid;
      const inviteePaid = !isChallenger ? true : challenge.inviteePaid;
      const bothPaid = challengerPaid && inviteePaid;

      let competitionId = challenge.competitionId;

      if (bothPaid && !competitionId) {
        competitionId = await createPvpCompetition(challenge, stakeTokens);
      }

      const updated = await storage.updatePvpChallenge(id, {
        challengerPaid,
        inviteePaid,
        competitionId,
        status: bothPaid ? "active" : "payment_pending",
      });

      await storage.createAuditLog(userId, "pvp_stake_locked", "pvp_challenge", id, {
        stakeTokens,
        isChallenger,
        challengerPaid,
        inviteePaid,
        bothPaid,
        competitionId,
      });

      res.json({ success: true, challenge: updated, competitionId, tokensLocked: stakeTokens });
    } catch (error: any) {
      console.error("Pay PvP with tokens error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to create PvP competition
  async function createPvpCompetition(challenge: any, stakeTokens: number): Promise<string> {
    const now = new Date();
    let adjustedStartAt = challenge.startAt;
    
    if (challenge.startAt && new Date(challenge.startAt) <= now) {
      adjustedStartAt = now;
    }

    const comp = await storage.createCompetition({
      type: "pvp",
      status: "running",
      title: challenge.name || `PvP Challenge`,
      buyInCents: challenge.stakeCents,
      buyInTokens: stakeTokens,
      entryCap: 2,
      rakeBps: challenge.rakeBps,
      startAt: adjustedStartAt,
      endAt: challenge.endAt,
      startingBalanceCents: challenge.startingBalanceCents,
      allowedPairsJson: challenge.allowedPairsJson,
      spreadMarkupPips: challenge.spreadMarkupPips,
      maxSlippagePips: challenge.maxSlippagePips,
      minOrderIntervalMs: challenge.minOrderIntervalMs,
      maxDrawdownPct: challenge.maxDrawdownPct,
      createdBy: challenge.challengerId,
    });

    await storage.createCompetitionEntry({
      competitionId: comp.id,
      userId: challenge.challengerId,
      paidCents: 0,
      paidTokens: stakeTokens,
      paymentStatus: "succeeded",
      cashCents: challenge.startingBalanceCents,
      equityCents: challenge.startingBalanceCents,
      maxEquityCents: challenge.startingBalanceCents,
    });

    await storage.createCompetitionEntry({
      competitionId: comp.id,
      userId: challenge.inviteeId!,
      paidCents: 0,
      paidTokens: stakeTokens,
      paymentStatus: "succeeded",
      cashCents: challenge.startingBalanceCents,
      equityCents: challenge.startingBalanceCents,
      maxEquityCents: challenge.startingBalanceCents,
    });

    return comp.id;
  }

  app.post("/api/pvp/challenges/:id/cancel", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      const challenge = await storage.getPvpChallenge(id);

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const user = await storage.getUser(userId);
      const isChallenger = challenge.challengerId === userId;
      const isInviteeById = challenge.inviteeId === userId;
      const isInviteeByEmail = user?.email && challenge.inviteeEmail === user.email;

      if (!isChallenger && !isInviteeById && !isInviteeByEmail) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (isInviteeByEmail && !challenge.inviteeId) {
        await storage.updatePvpChallenge(id, { inviteeId: userId });
        challenge.inviteeId = userId;
      }

      if (challenge.status === "active" || challenge.status === "completed") {
        return res.status(400).json({ error: "Cannot cancel challenge in current state" });
      }

      // Release any locked tokens back to participants
      const stakeTokens = challenge.stakeTokens > 0 ? challenge.stakeTokens : Math.floor(challenge.stakeCents / 100);
      if (stakeTokens > 0) {
        if (challenge.challengerPaid) {
          await unlockTokens(
            challenge.challengerId,
            stakeTokens,
            "PVP_STAKE_RELEASE",
            "pvp_challenge",
            id,
            { reason: "challenge_cancelled" }
          );
        }
        if (challenge.inviteePaid && challenge.inviteeId) {
          await unlockTokens(
            challenge.inviteeId,
            stakeTokens,
            "PVP_STAKE_RELEASE",
            "pvp_challenge",
            id,
            { reason: "challenge_cancelled" }
          );
        }
      }

      const updated = await storage.updatePvpChallenge(id, {
        status: "cancelled",
      });

      await storage.createAuditLog(userId, "pvp_challenge_cancelled", "pvp_challenge", id, {
        tokensReleased: stakeTokens,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Cancel PvP challenge error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PvP challenge settlement - called when competition ends to distribute winnings
  app.post("/api/pvp/challenges/:id/settle", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      const challenge = await storage.getPvpChallenge(id);

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      // Only allow admin or system to settle
      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (challenge.status !== "active") {
        return res.status(400).json({ error: "Challenge must be active to settle" });
      }

      if (!challenge.competitionId) {
        return res.status(400).json({ error: "No competition associated with challenge" });
      }

      // Get competition entries to determine winner
      const entries = await storage.getCompetitionEntries(challenge.competitionId);
      if (entries.length !== 2) {
        return res.status(400).json({ error: "Invalid number of entries for PvP" });
      }

      // Determine winner by equity
      const [entry1, entry2] = entries;
      const winnerId = entry1.equityCents >= entry2.equityCents ? entry1.userId : entry2.userId;
      const loserId = winnerId === entry1.userId ? entry2.userId : entry1.userId;

      const stakeTokens = challenge.stakeTokens > 0 ? challenge.stakeTokens : Math.floor(challenge.stakeCents / 100);
      const totalPool = stakeTokens * 2;
      const rakeTokens = Math.floor(totalPool * (challenge.rakeBps / 10000));
      const winnerPayout = totalPool - rakeTokens;

      // Unlock and deduct loser's stake (they lose it)
      await unlockAndDeductTokens(
        loserId,
        stakeTokens,
        "PVP_STAKE_RELEASE",
        "pvp_challenge",
        id,
        { reason: "lost", winnerId }
      );

      // Unlock and add winnings to winner
      await unlockTokens(
        winnerId,
        stakeTokens,
        "PVP_STAKE_RELEASE",
        "pvp_challenge",
        id,
        { reason: "won" }
      );

      // Credit winner with the winnings (loser's stake minus rake)
      await applyTokenTransaction({
        userId: winnerId,
        kind: "BET_PAYOUT",
        amountTokens: stakeTokens - rakeTokens,
        referenceType: "pvp_challenge",
        referenceId: id,
        metadata: { totalPool, rakeTokens, loserId },
      });

      // Record rake fee
      if (rakeTokens > 0) {
        await applyTokenTransaction({
          userId: winnerId,
          kind: "RAKE_FEE",
          amountTokens: 0, // Just for record, actual deduction is in payout calc
          referenceType: "pvp_challenge",
          referenceId: id,
          metadata: { rakeTokens, rakeBps: challenge.rakeBps },
        });
      }

      // Update challenge
      const updated = await storage.updatePvpChallenge(id, {
        status: "completed",
        winnerId,
      });

      // Update competition
      await storage.updateCompetition(challenge.competitionId, {
        status: "completed",
      });

      await storage.createAuditLog(userId, "pvp_challenge_settled", "pvp_challenge", id, {
        winnerId,
        loserId,
        stakeTokens,
        winnerPayout,
        rakeTokens,
      });

      res.json({
        success: true,
        challenge: updated,
        winnerId,
        loserId,
        payout: winnerPayout,
        rake: rakeTokens,
      });
    } catch (error: any) {
      console.error("Settle PvP challenge error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Watch PvP match endpoint - returns both traders' stats for spectators
  app.get("/api/watch/pvp/:matchId", async (req: Request, res: Response) => {
    try {
      const { matchId } = req.params;
      const challenge = await storage.getPvpChallenge(matchId);

      if (!challenge) {
        return res.status(404).json({ error: "Match not found" });
      }

      // Only allow watching public matches or matches that are arena-listed
      if (challenge.visibility !== "public" && !challenge.arenaListed) {
        return res.status(403).json({ error: "This match is private" });
      }

      // Get challenger info
      const challenger = await storage.getUser(challenge.challengerId);
      let challengerStats = {
        id: challenge.challengerId,
        username: challenger?.username || challenger?.email?.split("@")[0] || "Unknown",
        equityCents: challenge.startingBalanceCents,
        startingBalanceCents: challenge.startingBalanceCents,
        cashCents: challenge.startingBalanceCents,
        openPositionsCount: 0,
        pnlCents: 0,
        returnPct: 0,
      };

      // Get invitee info
      const invitee = challenge.inviteeId ? await storage.getUser(challenge.inviteeId) : null;
      let inviteeStats = {
        id: challenge.inviteeId || "",
        username: invitee?.username || invitee?.email?.split("@")[0] || "Pending",
        equityCents: challenge.startingBalanceCents,
        startingBalanceCents: challenge.startingBalanceCents,
        cashCents: challenge.startingBalanceCents,
        openPositionsCount: 0,
        pnlCents: 0,
        returnPct: 0,
      };

      // If competition exists, get real trading data
      if (challenge.competitionId) {
        const challengerEntry = await storage.getCompetitionEntry(
          challenge.competitionId,
          challenge.challengerId
        );
        if (challengerEntry) {
          const challengerPositions = await storage.getPositions(
            challenge.competitionId,
            challenge.challengerId
          );
          challengerStats = {
            ...challengerStats,
            equityCents: challengerEntry.equityCents,
            cashCents: challengerEntry.cashCents,
            openPositionsCount: challengerPositions.length,
            pnlCents: challengerEntry.equityCents - challenge.startingBalanceCents,
            returnPct:
              ((challengerEntry.equityCents - challenge.startingBalanceCents) /
                challenge.startingBalanceCents) *
              100,
          };
        }

        if (challenge.inviteeId) {
          const inviteeEntry = await storage.getCompetitionEntry(
            challenge.competitionId,
            challenge.inviteeId
          );
          if (inviteeEntry) {
            const inviteePositions = await storage.getPositions(
              challenge.competitionId,
              challenge.inviteeId
            );
            inviteeStats = {
              ...inviteeStats,
              equityCents: inviteeEntry.equityCents,
              cashCents: inviteeEntry.cashCents,
              openPositionsCount: inviteePositions.length,
              pnlCents: inviteeEntry.equityCents - challenge.startingBalanceCents,
              returnPct:
                ((inviteeEntry.equityCents - challenge.startingBalanceCents) /
                  challenge.startingBalanceCents) *
                100,
            };
          }
        }
      }

      res.json({
        id: challenge.id,
        name: challenge.name || "PvP Match",
        status: challenge.status,
        liveStatus: challenge.liveStatus,
        chatEnabled: challenge.chatEnabled,
        bettingEnabled: challenge.bettingEnabled,
        streamEmbedType: challenge.streamEmbedType,
        streamUrl: challenge.streamUrl,
        startAt: challenge.startAt,
        endAt: challenge.endAt,
        stakeTokens: challenge.stakeTokens,
        challenger: challengerStats,
        invitee: inviteeStats,
        lastUpdatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Watch PvP match error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Chat API Endpoints ============
  
  // Get or create chat channel
  app.get("/api/chat/channel", async (req: Request, res: Response) => {
    try {
      const { kind, refId } = req.query;
      
      if (!kind || !refId) {
        return res.status(400).json({ error: "kind and refId are required" });
      }

      const validKinds = ["PVP_MATCH", "COMPETITION"];
      if (!validKinds.includes(kind as string)) {
        return res.status(400).json({ error: "Invalid kind. Must be PVP_MATCH or COMPETITION" });
      }

      // Import chat service dynamically to avoid circular deps
      const { chatService } = await import("./services/ChatService");
      const channel = await chatService.getOrCreateChannel(kind as string, refId as string);
      
      res.json({ channelId: channel.id, kind: channel.kind, refId: channel.refId });
    } catch (error: any) {
      console.error("Get chat channel error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get chat messages with pagination
  app.get("/api/chat/messages", async (req: Request, res: Response) => {
    try {
      const { channelId, cursor } = req.query;
      
      if (!channelId) {
        return res.status(400).json({ error: "channelId is required" });
      }

      const { chatService } = await import("./services/ChatService");
      const result = await chatService.getMessages(
        channelId as string, 
        cursor as string | undefined,
        50
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Get chat messages error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get badges for chat users
  const badgeCache = new Map<string, { badges: Record<string, any[]>, expiresAt: number }>();
  const BADGE_CACHE_TTL = 30000; // 30 seconds

  app.get("/api/chat/badges", async (req: Request, res: Response) => {
    try {
      const { kind, refId } = req.query;
      
      if (!kind || !refId) {
        return res.status(400).json({ error: "kind and refId are required" });
      }

      const cacheKey = `${kind}:${refId}`;
      const cached = badgeCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json({ badges: cached.badges });
      }

      const badges: Record<string, any[]> = {};

      if (kind === "COMPETITION") {
        // Get competition leaderboard for rank badges
        const competition = await storage.getCompetition(refId as string);
        if (competition) {
          const leaderboard = await storage.getCompetitionLeaderboard(refId as string);
          
          // Assign rank badges for top 25
          leaderboard.slice(0, 25).forEach((entry, index) => {
            const rank = index + 1;
            if (!badges[entry.userId]) badges[entry.userId] = [];
            
            if (rank === 1 && competition.status === "completed") {
              badges[entry.userId].push({
                type: "winner",
                label: "WINNER",
                color: "#FFD700",
              });
            } else {
              badges[entry.userId].push({
                type: "rank",
                label: `#${rank}`,
                color: rank <= 3 ? "#FFD700" : rank <= 10 ? "#C0C0C0" : "#CD7F32",
              });
            }
          });
        }
      } else if (kind === "PVP_MATCH") {
        // Get PvP match participants
        const match = await storage.getPvpChallenge(refId as string);
        if (match) {
          // Both participants get TRADER badge
          if (match.challengerId) {
            badges[match.challengerId] = [{
              type: "trader",
              label: "TRADER",
              color: "#FF6B35",
            }];
          }
          if (match.inviteeId) {
            badges[match.inviteeId] = [{
              type: "trader",
              label: "TRADER",
              color: "#FF6B35",
            }];
          }
        }

        // Get channel members for MOD badges
        const { chatService } = await import("./services/ChatService");
        const channel = await chatService.getOrCreateChannel(kind as string, refId as string);
        const members = await chatService.getChannelMembers(channel.id);
        
        members.forEach((member) => {
          if (member.role === "MOD" || member.role === "OWNER") {
            if (!badges[member.userId]) badges[member.userId] = [];
            badges[member.userId].push({
              type: "mod",
              label: member.role === "OWNER" ? "OWNER" : "MOD",
              color: "#9B59B6",
            });
          }
        });
      }

      // Cache the result
      badgeCache.set(cacheKey, { badges, expiresAt: Date.now() + BADGE_CACHE_TTL });

      res.json({ badges });
    } catch (error: any) {
      console.error("Get chat badges error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  await EmailService.ensureDefaultTemplates();

  app.get("/api/admin/email-templates", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const templates = await EmailService.getAllTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Get email templates error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/email-templates/:type", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { type } = req.params;
      const template = await EmailService.getTemplate(type as any);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.json(template);
    } catch (error: any) {
      console.error("Get email template error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/email-templates/:type", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { type } = req.params;
      const { subject, htmlBody, enabled } = req.body;

      await EmailService.updateTemplate(type, { subject, htmlBody, enabled });
      
      await storage.createAuditLog(userId, "email_template_updated", "email_template", type, { subject, enabled });

      const updated = await EmailService.getTemplate(type as any);
      res.json(updated);
    } catch (error: any) {
      console.error("Update email template error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/email-logs", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await EmailService.getEmailLogs(limit, offset);
      res.json(logs);
    } catch (error: any) {
      console.error("Get email logs error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/email-templates/:type/test", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { type } = req.params;
      const { testEmail } = req.body;

      if (!testEmail) {
        return res.status(400).json({ error: "Test email address required" });
      }

      const testVariables: Record<string, string> = {
        userName: "Test User",
        userEmail: testEmail,
        appUrl: `https://${process.env.EXPO_PUBLIC_DOMAIN || 'bullfight.app'}`,
        competitionName: "Test Competition",
        buyInAmount: "$100.00",
        prizePool: "$10,000.00",
        startDate: new Date().toLocaleDateString(),
        startingBalance: "$100,000",
        arenaUrl: `https://${process.env.EXPO_PUBLIC_DOMAIN || 'bullfight.app'}/arena/test`,
        duration: "24 hours",
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString(),
        participantCount: "50",
        finalRank: "3",
        totalParticipants: "50",
        finalReturn: "+15.25%",
        returnColor: "#00C853",
        finalEquity: "$115,250",
        winnings: "$1,000.00",
        challengerName: "Test Challenger",
        stakeAmount: "$50.00",
        challengeUrl: `https://${process.env.EXPO_PUBLIC_DOMAIN || 'bullfight.app'}/pvp/test`,
        currentRank: "5",
        currentReturn: "+8.50%",
        currentEquity: "$108,500",
        timeRemaining: "12h 30m",
        leaderboardHtml: "<div style='color: #B0B0B0;'>Sample leaderboard...</div>",
      };

      const result = await EmailService.sendEmail(type as any, testEmail, testVariables);

      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Test email error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/email/trigger-standings", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      await triggerDailyStandingsNow();
      res.json({ success: true, message: "Daily standings emails triggered" });
    } catch (error: any) {
      console.error("Trigger standings error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  startScheduledJobs();

  const httpServer = createServer(app);

  return httpServer;
}
