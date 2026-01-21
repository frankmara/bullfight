import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";

const quotes: Record<string, { bid: number; ask: number; timestamp: number }> = {
  "EUR-USD": { bid: 1.0873, ask: 1.0875, timestamp: Date.now() },
  "GBP-USD": { bid: 1.2648, ask: 1.2652, timestamp: Date.now() },
  "USD-JPY": { bid: 149.48, ask: 149.52, timestamp: Date.now() },
  "AUD-USD": { bid: 0.6518, ask: 0.6522, timestamp: Date.now() },
  "USD-CAD": { bid: 1.3578, ask: 1.3582, timestamp: Date.now() },
};

setInterval(() => {
  Object.keys(quotes).forEach((pair) => {
    const q = quotes[pair];
    const change = (Math.random() - 0.5) * 0.0010;
    const mid = (q.bid + q.ask) / 2 + change;
    const spread = pair.includes("JPY") ? 0.04 : 0.0002;
    quotes[pair] = {
      bid: mid - spread / 2,
      ask: mid + spread / 2,
      timestamp: Date.now(),
    };
  });
}, 1000);

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
        paidCents: comp.buyInCents,
        paymentStatus: "succeeded",
        cashCents: comp.startingBalanceCents,
        equityCents: comp.startingBalanceCents,
        maxEquityCents: comp.startingBalanceCents,
        maxDrawdownPct: 0,
        dq: false,
      });

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
        const quote = quotes[pos.pair];
        if (quote) {
          const currentPrice = pos.side === "buy" ? quote.bid : quote.ask;
          const pipsPerUnit = pos.pair.includes("JPY") ? 0.01 : 0.0001;
          const priceDiff = pos.side === "buy" 
            ? currentPrice - pos.avgEntryPrice 
            : pos.avgEntryPrice - currentPrice;
          const pnlCents = Math.round(priceDiff / pipsPerUnit * pos.quantityUnits * 0.1);
          unrealizedPnl += pnlCents;
          return { ...pos, unrealizedPnlCents: pnlCents };
        }
        return { ...pos, unrealizedPnlCents: 0 };
      });

      const equityCents = entry.cashCents + unrealizedPnl;
      if (equityCents !== entry.equityCents) {
        await storage.updateCompetitionEntry(entry.id, { equityCents });
      }

      const leaderboard = await storage.getLeaderboard(id, comp.startingBalanceCents);
      const rank = leaderboard.find((l) => l.userId === userId)?.rank;

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
        limitPrice,
        stopPrice,
        stopLossPrice,
        takeProfitPrice,
      } = req.body;

      if (!pair || !side || !type || !quantityUnits) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!comp.allowedPairsJson?.includes(pair)) {
        return res.status(400).json({ error: "Pair not allowed in this competition" });
      }

      const order = await storage.createOrder({
        competitionId: id,
        userId,
        pair,
        side,
        type,
        quantityUnits,
        limitPrice,
        stopPrice,
        stopLossPrice,
        takeProfitPrice,
        status: type === "market" ? "filled" : "pending",
      });

      if (type === "market") {
        const quote = quotes[pair];
        if (!quote) {
          return res.status(400).json({ error: "No quote available for pair" });
        }

        const fillPrice = side === "buy" 
          ? quote.ask + comp.spreadMarkupPips * (pair.includes("JPY") ? 0.01 : 0.0001)
          : quote.bid - comp.spreadMarkupPips * (pair.includes("JPY") ? 0.01 : 0.0001);

        const existingPositions = await storage.getPositions(id, userId);
        const existingPos = existingPositions.find(
          (p) => p.pair === pair && p.side === side
        );

        if (existingPos) {
          const totalQty = existingPos.quantityUnits + quantityUnits;
          const avgPrice =
            (existingPos.avgEntryPrice * existingPos.quantityUnits +
              fillPrice * quantityUnits) /
            totalQty;

          await storage.updatePosition(existingPos.id, {
            quantityUnits: totalQty,
            avgEntryPrice: avgPrice,
          });
        } else {
          await storage.createPosition({
            competitionId: id,
            userId,
            pair,
            side,
            quantityUnits,
            avgEntryPrice: fillPrice,
            realizedPnlCents: 0,
          });
        }
      }

      res.json({ success: true, order });
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

        const positions = await storage.getPositions(id, userId);
        const position = positions.find((p) => p.id === positionId);

        if (!position) {
          return res.status(404).json({ error: "Position not found" });
        }

        const quote = quotes[position.pair];
        if (!quote) {
          return res.status(400).json({ error: "No quote available" });
        }

        const closePrice = position.side === "buy" ? quote.bid : quote.ask;
        const pipsPerUnit = position.pair.includes("JPY") ? 0.01 : 0.0001;
        const priceDiff = position.side === "buy" 
          ? closePrice - position.avgEntryPrice 
          : position.avgEntryPrice - closePrice;
        const pnlCents = Math.round(priceDiff / pipsPerUnit * position.quantityUnits * 0.1);

        const entry = await storage.getCompetitionEntry(id, userId);
        if (entry) {
          await storage.updateCompetitionEntry(entry.id, {
            cashCents: entry.cashCents + pnlCents,
            equityCents: entry.equityCents + pnlCents,
          });
        }

        await storage.deletePosition(positionId);

        res.json({ success: true, pnlCents });
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

        const positions = await storage.getPositions(id, userId);
        const position = positions.find((p) => p.id === positionId);

        if (!position) {
          return res.status(404).json({ error: "Position not found" });
        }

        const updates: any = {};
        if (stopLossPrice !== undefined) {
          updates.stopLossPrice = stopLossPrice ? parseFloat(stopLossPrice) : null;
        }
        if (takeProfitPrice !== undefined) {
          updates.takeProfitPrice = takeProfitPrice ? parseFloat(takeProfitPrice) : null;
        }

        await storage.updatePosition(positionId, updates);
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
        const { quantity } = req.body;

        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (!quantity || quantity <= 0) {
          return res.status(400).json({ error: "Invalid quantity" });
        }

        const comp = await storage.getCompetition(id);
        if (!comp || comp.status !== "running") {
          return res.status(400).json({ error: "Trading is not active" });
        }

        const positions = await storage.getPositions(id, userId);
        const position = positions.find((p) => p.id === positionId);

        if (!position) {
          return res.status(404).json({ error: "Position not found" });
        }

        if (quantity >= position.quantityUnits) {
          return res.status(400).json({ error: "Quantity exceeds position size. Use full close instead." });
        }

        const quote = quotes[position.pair];
        if (!quote) {
          return res.status(400).json({ error: "No quote available" });
        }

        const closePrice = position.side === "buy" ? quote.bid : quote.ask;
        const pipsPerUnit = position.pair.includes("JPY") ? 0.01 : 0.0001;
        const priceDiff = position.side === "buy" 
          ? closePrice - position.avgEntryPrice 
          : position.avgEntryPrice - closePrice;
        const pnlCents = Math.round(priceDiff / pipsPerUnit * quantity * 0.1);

        const entry = await storage.getCompetitionEntry(id, userId);
        if (entry) {
          await storage.updateCompetitionEntry(entry.id, {
            cashCents: entry.cashCents + pnlCents,
            equityCents: entry.equityCents + pnlCents,
          });
        }

        await storage.updatePosition(positionId, {
          quantityUnits: position.quantityUnits - quantity,
        });

        res.json({ success: true, pnlCents, remainingQuantity: position.quantityUnits - quantity });
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

        const comp = await storage.updateCompetitionStatus(id, status);
        res.json(comp);
      } catch (error: any) {
        console.error("Admin update status error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.get("/api/quotes", (_req: Request, res: Response) => {
    res.json(quotes);
  });

  app.get("/api/pvp/challenges", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const challenges = await storage.getPvpChallenges(userId);
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

      if (challenge.challengerId !== userId && challenge.inviteeId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this challenge" });
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

      if (challenge.challengerId !== userId && challenge.inviteeId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
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

      const isChallenger = challenge.challengerId === userId;

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

      if (challenge.challengerId !== userId && challenge.inviteeId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (challenge.status !== "pending" && challenge.status !== "negotiating") {
        return res.status(400).json({ error: "Challenge cannot be accepted in current state" });
      }

      const isChallenger = challenge.challengerId === userId;

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

      if (challenge.challengerId !== userId && challenge.inviteeId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (challenge.status !== "accepted" && challenge.status !== "payment_pending") {
        return res.status(400).json({ error: "Challenge not ready for payment" });
      }

      const isChallenger = challenge.challengerId === userId;

      const challengerPaid = isChallenger ? true : challenge.challengerPaid;
      const inviteePaid = !isChallenger ? true : challenge.inviteePaid;
      const bothPaid = challengerPaid && inviteePaid;

      let competitionId = challenge.competitionId;

      if (bothPaid && !competitionId) {
        const comp = await storage.createCompetition({
          type: "pvp",
          status: "open",
          title: `PvP Challenge`,
          buyInCents: challenge.stakeCents,
          entryCap: 2,
          rakeBps: challenge.rakeBps,
          startAt: challenge.startAt,
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

        const now = new Date();
        if (challenge.startAt && new Date(challenge.startAt) <= now) {
          await storage.updateCompetitionStatus(comp.id, "running");
        }
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

      if (challenge.challengerId !== userId && challenge.inviteeId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
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

  const httpServer = createServer(app);

  return httpServer;
}
