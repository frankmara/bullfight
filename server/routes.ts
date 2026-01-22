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

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = await storage.createUser(email, password);
      
      EmailService.sendWelcomeEmail(user.id, user.email).catch(err => {
        console.error("Failed to send welcome email:", err);
      });

      res.json({
        user: { id: user.id, email: user.email, role: user.role },
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
        user: { id: user.id, email: user.email, role: user.role },
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
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch (error: any) {
      console.error("Get me error:", error);
      res.status(500).json({ error: error.message || "Failed to get user" });
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
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: comp.buyInCents,
            product_data: {
              name: `Competition Entry: ${comp.name}`,
              description: `Buy-in for ${comp.name} trading competition`,
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
          userId: userId,
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
          comp.name,
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
          comp.name,
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
                  comp.name,
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
                  comp.name,
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
        startingBalanceCents,
        allowedPairsJson,
        startAt,
        endAt,
        spreadMarkupPips,
        maxSlippagePips,
        minOrderIntervalMs,
        maxDrawdownPct,
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
        startingBalanceCents: startingBalanceCents || 10000000,
        allowedPairsJson: allowedPairsJson || ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"],
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        spreadMarkupPips: spreadMarkupPips || 0.5,
        maxSlippagePips: maxSlippagePips || 1.0,
        minOrderIntervalMs: minOrderIntervalMs || 1000,
        maxDrawdownPct: maxDrawdownPct || null,
        challengerAccepted: true,
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

      const updated = await storage.updatePvpChallenge(id, {
        status: "cancelled",
      });

      await storage.createAuditLog(userId, "pvp_challenge_cancelled", "pvp_challenge", id, {});

      res.json(updated);
    } catch (error: any) {
      console.error("Cancel PvP challenge error:", error);
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
