import WebSocket from "ws";
import { db } from "../db";
import { candleCache } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

const POLYGON_REST_BASE_URL = process.env.POLYGON_REST_BASE_URL || "https://api.polygon.io";
const POLYGON_WS_BASE_URL = process.env.POLYGON_WS_BASE_URL || "wss://socket.polygon.io";
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

// Cache duration - how long to consider database-cached candles fresh
const CANDLE_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour for historical candles

export interface Quote {
  pair: string;
  bid: number;
  ask: number;
  timestamp: number;
  spreadPips: number;
  status: "live" | "delayed" | "stale" | "disconnected";
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

type QuoteCallback = (quote: Quote) => void;
type CandleCallback = (pair: string, timeframe: string, candle: Candle) => void;

// Major pairs (USD with major currencies)
const FX_MAJORS = [
  "EUR-USD", "GBP-USD", "USD-JPY", "USD-CHF", "AUD-USD", "USD-CAD", "NZD-USD"
];

// Minor pairs (crosses without USD)
const FX_MINORS = [
  "EUR-GBP", "EUR-JPY", "EUR-CHF", "EUR-AUD", "EUR-CAD", "EUR-NZD",
  "GBP-JPY", "GBP-CHF", "GBP-AUD", "GBP-CAD", "GBP-NZD",
  "AUD-JPY", "AUD-CHF", "AUD-CAD", "AUD-NZD",
  "NZD-JPY", "NZD-CHF", "NZD-CAD",
  "CAD-JPY", "CAD-CHF",
  "CHF-JPY"
];

const FX_PAIRS = [...FX_MAJORS, ...FX_MINORS];

const TIMEFRAME_MAP: Record<string, { multiplier: number; timespan: string; seconds: number }> = {
  "1m": { multiplier: 1, timespan: "minute", seconds: 60 },
  "5m": { multiplier: 5, timespan: "minute", seconds: 300 },
  "15m": { multiplier: 15, timespan: "minute", seconds: 900 },
  "1h": { multiplier: 1, timespan: "hour", seconds: 3600 },
  "4h": { multiplier: 4, timespan: "hour", seconds: 14400 },
  "1d": { multiplier: 1, timespan: "day", seconds: 86400 },
};

function getPipSize(pair: string): number {
  return pair.includes("JPY") ? 0.01 : 0.0001;
}

function formatPolygonTicker(pair: string): string {
  return "C:" + pair.replace("-", "");
}

class MarketDataService {
  private quotes: Map<string, Quote> = new Map();
  private candleCache: Map<string, { candles: Candle[]; fetchedAt: number; mock?: boolean }> = new Map();
  private ws: WebSocket | null = null;
  private quoteCallbacks: Set<QuoteCallback> = new Set();
  private candleCallbacks: Set<CandleCallback> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private mockInterval: NodeJS.Timeout | null = null;
  private isUsingMockData: boolean = !POLYGON_API_KEY;
  private lastCandles: Map<string, Candle> = new Map();
  private wsConnected: boolean = false;

  constructor() {
    this.initializeQuotes();
    if (this.isUsingMockData) {
      console.log("[MarketDataService] No POLYGON_API_KEY found, using MOCK DATA");
      this.startMockDataGenerator();
    } else {
      console.log("[MarketDataService] Using Polygon.io for market data");
      this.connectWebSocket();
    }
  }

  private initializeQuotes(): void {
    const basePrices: Record<string, number> = {
      // Majors
      "EUR-USD": 1.0875,
      "GBP-USD": 1.2650,
      "USD-JPY": 149.50,
      "USD-CHF": 0.8850,
      "AUD-USD": 0.6520,
      "USD-CAD": 1.3580,
      "NZD-USD": 0.6120,
      // EUR crosses
      "EUR-GBP": 0.8600,
      "EUR-JPY": 162.50,
      "EUR-CHF": 0.9620,
      "EUR-AUD": 1.6680,
      "EUR-CAD": 1.4760,
      "EUR-NZD": 1.7780,
      // GBP crosses
      "GBP-JPY": 189.00,
      "GBP-CHF": 1.1180,
      "GBP-AUD": 1.9400,
      "GBP-CAD": 1.7160,
      "GBP-NZD": 2.0680,
      // AUD crosses
      "AUD-JPY": 97.40,
      "AUD-CHF": 0.5770,
      "AUD-CAD": 0.8840,
      "AUD-NZD": 1.0650,
      // NZD crosses
      "NZD-JPY": 91.50,
      "NZD-CHF": 0.5420,
      "NZD-CAD": 0.8310,
      // CAD crosses
      "CAD-JPY": 110.10,
      "CAD-CHF": 0.6510,
      // CHF cross
      "CHF-JPY": 169.00,
    };

    for (const pair of FX_PAIRS) {
      const mid = basePrices[pair] || 1.0;
      const pipSize = getPipSize(pair);
      const spread = pair.includes("JPY") ? 0.04 : 0.0002;
      this.quotes.set(pair, {
        pair,
        bid: mid - spread / 2,
        ask: mid + spread / 2,
        timestamp: Date.now(),
        spreadPips: spread / pipSize,
        status: "disconnected",
      });
    }
  }

  private startMockDataGenerator(): void {
    this.mockInterval = setInterval(() => {
      for (const pair of FX_PAIRS) {
        const current = this.quotes.get(pair)!;
        const pipSize = getPipSize(pair);
        const volatility = pair.includes("JPY") ? 0.05 : 0.0005;
        const change = (Math.random() - 0.5) * volatility;
        const mid = (current.bid + current.ask) / 2 + change;
        const spread = pair.includes("JPY") ? 0.04 : 0.0002;

        const newQuote: Quote = {
          pair,
          bid: mid - spread / 2,
          ask: mid + spread / 2,
          timestamp: Date.now(),
          spreadPips: Math.round((spread / pipSize) * 10) / 10,
          status: "live",
        };

        this.quotes.set(pair, newQuote);
        this.notifyQuoteUpdate(newQuote);
        this.updateLastCandle(pair, mid);
      }
    }, 1000);
  }

  private updateLastCandle(pair: string, price: number): void {
    const timeframe = "1m";
    const cacheKey = `${pair}:${timeframe}`;
    const cached = this.candleCache.get(cacheKey);
    
    if (!cached || cached.candles.length === 0) return;

    const now = Math.floor(Date.now() / 1000);
    const candleSeconds = TIMEFRAME_MAP[timeframe].seconds;
    const currentBucket = Math.floor(now / candleSeconds) * candleSeconds;
    
    const lastCandle = cached.candles[cached.candles.length - 1];
    
    if (lastCandle.time === currentBucket) {
      lastCandle.close = price;
      lastCandle.high = Math.max(lastCandle.high, price);
      lastCandle.low = Math.min(lastCandle.low, price);
    } else {
      const newCandle: Candle = {
        time: currentBucket,
        open: price,
        high: price,
        low: price,
        close: price,
      };
      cached.candles.push(newCandle);
      if (cached.candles.length > 1500) {
        cached.candles.shift();
      }
    }

    for (const cb of this.candleCallbacks) {
      cb(pair, timeframe, cached.candles[cached.candles.length - 1]);
    }
  }

  private connectWebSocket(): void {
    if (!POLYGON_API_KEY) return;

    try {
      this.ws = new WebSocket(`${POLYGON_WS_BASE_URL}/forex`);

      this.ws.on("open", () => {
        console.log("[MarketDataService] WebSocket connected");
        this.wsConnected = true;
        this.ws?.send(JSON.stringify({ action: "auth", params: POLYGON_API_KEY }));
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const messages = JSON.parse(data.toString());
          for (const msg of messages) {
            this.handleWebSocketMessage(msg);
          }
        } catch (e) {
          console.error("[MarketDataService] Failed to parse WS message:", e);
        }
      });

      this.ws.on("close", () => {
        console.log("[MarketDataService] WebSocket closed, reconnecting...");
        this.wsConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[MarketDataService] WebSocket error:", err);
      });
    } catch (e) {
      console.error("[MarketDataService] Failed to connect WebSocket:", e);
      this.scheduleReconnect();
    }
  }

  private handleWebSocketMessage(msg: any): void {
    if (msg.ev === "status" && msg.status === "auth_success") {
      // Subscribe to both quotes (C) and per-second aggregates (CAS)
      const quoteSubscriptions = FX_PAIRS.map((p) => `C.${p}`).join(",");
      const candleSubscriptions = FX_PAIRS.map((p) => `CAS.${p}`).join(",");
      const allSubscriptions = `${quoteSubscriptions},${candleSubscriptions}`;
      this.ws?.send(JSON.stringify({ action: "subscribe", params: allSubscriptions }));
      console.log("[MarketDataService] Subscribed to:", allSubscriptions);
    }

    // Handle quote updates (C event)
    if (msg.ev === "C") {
      const pair = msg.p;
      if (!FX_PAIRS.includes(pair)) return;

      const pipSize = getPipSize(pair);
      const bid = msg.b;
      const ask = msg.a;
      const spread = ask - bid;

      const quote: Quote = {
        pair,
        bid,
        ask,
        timestamp: msg.t || Date.now(),
        spreadPips: Math.round((spread / pipSize) * 10) / 10,
        status: "live",
      };

      this.quotes.set(pair, quote);
      this.notifyQuoteUpdate(quote);
    }

    // Handle per-second candle aggregates (CAS event)
    if (msg.ev === "CAS") {
      const pair = msg.pair?.replace("/", "-");
      if (!pair || !FX_PAIRS.includes(pair)) return;

      const candleTime = Math.floor(msg.s / 1000); // Convert ms to seconds
      const price = msg.c; // Use close price for updates
      
      // Update candle caches for all timeframes
      this.updateCandleFromWebSocket(pair, candleTime, msg.o, msg.h, msg.l, msg.c);
      
      // Also update the quote from candle data if we have it
      if (msg.o && msg.c) {
        const mid = (msg.o + msg.c) / 2;
        const pipSize = getPipSize(pair);
        const spread = pair.includes("JPY") ? 0.04 : 0.0002;
        
        const quote: Quote = {
          pair,
          bid: mid - spread / 2,
          ask: mid + spread / 2,
          timestamp: msg.s || Date.now(),
          spreadPips: Math.round((spread / pipSize) * 10) / 10,
          status: "live",
        };
        
        this.quotes.set(pair, quote);
        this.notifyQuoteUpdate(quote);
      }
    }
  }

  private updateCandleFromWebSocket(pair: string, time: number, open: number, high: number, low: number, close: number): void {
    // Update 1-minute candles by aggregating per-second data
    const timeframe = "1m";
    const cacheKey = `${pair}:${timeframe}`;
    const candleSeconds = TIMEFRAME_MAP[timeframe].seconds;
    const candleBucket = Math.floor(time / candleSeconds) * candleSeconds;
    
    let cached = this.candleCache.get(cacheKey);
    
    if (!cached) {
      // Initialize with this candle
      cached = {
        candles: [{
          time: candleBucket,
          open,
          high,
          low,
          close,
        }],
        fetchedAt: Date.now(),
        mock: false,
      };
      this.candleCache.set(cacheKey, cached);
    } else {
      const lastCandle = cached.candles[cached.candles.length - 1];
      
      if (lastCandle && lastCandle.time === candleBucket) {
        // Update existing candle
        lastCandle.high = Math.max(lastCandle.high, high);
        lastCandle.low = Math.min(lastCandle.low, low);
        lastCandle.close = close;
      } else {
        // New candle bucket
        cached.candles.push({
          time: candleBucket,
          open,
          high,
          low,
          close,
        });
        
        // Keep only last 1500 candles
        if (cached.candles.length > 1500) {
          cached.candles.shift();
        }
      }
      
      cached.fetchedAt = Date.now();
      cached.mock = false;
    }
    
    // Notify subscribers
    for (const cb of this.candleCallbacks) {
      cb(pair, timeframe, cached.candles[cached.candles.length - 1]);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, 5000);
  }

  private notifyQuoteUpdate(quote: Quote): void {
    for (const cb of this.quoteCallbacks) {
      cb(quote);
    }
  }

  public getQuote(pair: string): Quote | undefined {
    const quote = this.quotes.get(pair);
    if (!quote) return undefined;

    const age = Date.now() - quote.timestamp;
    let status: Quote["status"];
    
    if (!this.wsConnected && !this.isUsingMockData) {
      status = "disconnected";
    } else if (age > 10000) {
      status = "stale";
    } else if (age > 2000) {
      status = "delayed";
    } else {
      status = "live";
    }

    return { ...quote, status };
  }

  public isConnected(): boolean {
    return this.wsConnected || this.isUsingMockData;
  }

  public getAllQuotes(): Quote[] {
    return FX_PAIRS.map((pair) => this.getQuote(pair)!).filter(Boolean);
  }

  public async getCandles(pair: string, timeframe: string, limit: number = 500): Promise<Candle[]> {
    const result = await this.getCandlesWithMeta(pair, timeframe, limit);
    return result.candles;
  }

  public async getCandlesWithMeta(pair: string, timeframe: string, limit: number = 500): Promise<{ candles: Candle[]; mock: boolean }> {
    const cacheKey = `${pair}:${timeframe}:${limit}`;
    const cached = this.candleCache.get(cacheKey);
    
    // Only return cached data if it's real (not mock) or we're in mock mode
    if (cached && Date.now() - cached.fetchedAt < 30000) {
      // If connected to Polygon, only return cached if it's real data
      if (!this.isUsingMockData && cached.mock) {
        // Skip mock cache when connected to live data source
      } else {
        return { 
          candles: cached.candles.slice(-limit), 
          mock: cached.mock || false 
        };
      }
    }

    if (this.isUsingMockData) {
      // Only use mock candles when NOT connected to Polygon at all
      const candles = this.generateMockCandles(pair, timeframe, limit);
      return { candles, mock: true };
    }

    return this.fetchPolygonCandlesWithMeta(pair, timeframe, limit);
  }

  private async fetchPolygonCandlesWithMeta(pair: string, timeframe: string, limit: number): Promise<{ candles: Candle[]; mock: boolean }> {
    const tf = TIMEFRAME_MAP[timeframe];
    if (!tf) {
      console.error("[MarketDataService] Unknown timeframe:", timeframe);
      return { candles: [], mock: false };
    }

    // First, check the database cache for this pair/timeframe
    try {
      const now = Date.now();
      const cutoffTime = Math.floor((now - CANDLE_CACHE_DURATION_MS) / 1000);
      
      // Check if we have fresh cached candles in the database
      const cachedCandles = await db
        .select()
        .from(candleCache)
        .where(
          and(
            eq(candleCache.pair, pair),
            eq(candleCache.timeframe, timeframe)
          )
        )
        .orderBy(desc(candleCache.time))
        .limit(limit);
      
      if (cachedCandles.length > 0) {
        // Check if the most recent candle is fresh enough (within last hour)
        const mostRecentCachedTime = cachedCandles[0].fetchedAt.getTime();
        const isFresh = Date.now() - mostRecentCachedTime < CANDLE_CACHE_DURATION_MS;
        
        if (isFresh && cachedCandles.length >= Math.min(limit, 100)) {
          // Reverse to chronological order and return
          const candles: Candle[] = cachedCandles.reverse().map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume || undefined,
          }));
          console.log(`[MarketDataService] Returning ${candles.length} candles from database cache for ${pair}:${timeframe}`);
          return { candles, mock: false };
        }
      }
    } catch (dbError) {
      console.error("[MarketDataService] Database cache check failed:", dbError);
    }

    // Fetch from Polygon REST API
    const ticker = formatPolygonTicker(pair);
    const now = Date.now();
    // Request more historical data - go back at least 14 days for more history
    const daysBack = Math.max(14, Math.ceil((tf.seconds * limit * 3) / 86400));
    const from = new Date(now - daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const to = new Date(now).toISOString().split("T")[0];

    // Request more data from Polygon than needed - Polygon's limit can affect aggregation
    // Use sort=desc to get the most recent candles first (in case there are more candles than limit)
    const polygonLimit = Math.min(5000, Math.max(limit * 10, 1000));
    const url = `${POLYGON_REST_BASE_URL}/v2/aggs/ticker/${ticker}/range/${tf.multiplier}/${tf.timespan}/${from}/${to}?adjusted=true&sort=desc&limit=${polygonLimit}&apiKey=${POLYGON_API_KEY}`;

    try {
      console.log(`[MarketDataService] Fetching candles from Polygon REST API: ${ticker} ${from} to ${to}, limit=${limit}`);
      const response = await fetch(url);
      const data = await response.json();
      console.log(`[MarketDataService] Polygon REST API response: queryCount=${data.queryCount || 0}, resultsCount=${data.resultsCount || 0}, status=${data.status}`);

      if (!data.results || data.results.length === 0) {
        // No historical data from Polygon REST API
        // Check if we have real-time candles accumulated from WebSocket CAS events
        const realtimeCacheKey = `${pair}:1m`;
        const realtimeCandles = this.candleCache.get(realtimeCacheKey);
        
        if (realtimeCandles && realtimeCandles.candles.length > 0 && !realtimeCandles.mock) {
          console.log(`[MarketDataService] Using ${realtimeCandles.candles.length} real-time candles for ${pair}`);
          const aggregated = this.aggregateCandles(realtimeCandles.candles, tf.seconds);
          return { candles: aggregated.slice(-limit), mock: false };
        }
        
        console.warn(`[MarketDataService] No candle data available for ${pair}, returning empty`);
        return { candles: [], mock: false };
      }

      // Results come in descending order (newest first), so reverse to get chronological order
      const candles: Candle[] = data.results.map((r: any) => ({
        time: Math.floor(r.t / 1000),
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: r.v,
      })).reverse();

      // Take the last N candles (most recent) after reversing to chronological order
      const recentCandles = candles.slice(-limit);
      console.log(`[MarketDataService] Retrieved ${candles.length} real candles from Polygon REST API for ${pair}, returning ${recentCandles.length}`);

      // Store candles in database cache (async, don't block)
      this.storeCandlesInDatabase(pair, timeframe, recentCandles).catch(err => {
        console.error("[MarketDataService] Failed to store candles in database:", err);
      });

      // Also update memory cache
      const cacheKey = `${pair}:${timeframe}:${limit}`;
      this.candleCache.set(cacheKey, {
        candles: recentCandles,
        fetchedAt: Date.now(),
        mock: false,
      });

      return { candles: recentCandles, mock: false };
    } catch (e) {
      console.error("[MarketDataService] Failed to fetch Polygon candles:", e);
      const realtimeCacheKey = `${pair}:1m`;
      const realtimeCandles = this.candleCache.get(realtimeCacheKey);
      
      if (realtimeCandles && realtimeCandles.candles.length > 0 && !realtimeCandles.mock) {
        const aggregated = this.aggregateCandles(realtimeCandles.candles, tf.seconds);
        return { candles: aggregated.slice(-limit), mock: false };
      }
      
      return { candles: [], mock: false };
    }
  }

  private async storeCandlesInDatabase(pair: string, timeframe: string, candles: Candle[]): Promise<void> {
    if (candles.length === 0) return;

    // Delete old candles for this pair/timeframe and insert new ones
    await db.delete(candleCache).where(
      and(
        eq(candleCache.pair, pair),
        eq(candleCache.timeframe, timeframe)
      )
    );

    // Insert new candles in batches
    const now = new Date();
    const candleRows = candles.map(c => ({
      pair,
      timeframe,
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || null,
      fetchedAt: now,
    }));

    // Insert in batches of 100
    for (let i = 0; i < candleRows.length; i += 100) {
      const batch = candleRows.slice(i, i + 100);
      await db.insert(candleCache).values(batch);
    }

    console.log(`[MarketDataService] Stored ${candles.length} candles in database for ${pair}:${timeframe}`);
  }

  private aggregateCandles(candles: Candle[], targetSeconds: number): Candle[] {
    if (targetSeconds <= 60) return candles; // Already 1m or smaller
    
    const aggregated: Candle[] = [];
    let currentBucket: Candle | null = null;
    
    for (const candle of candles) {
      const bucket = Math.floor(candle.time / targetSeconds) * targetSeconds;
      
      if (!currentBucket || currentBucket.time !== bucket) {
        if (currentBucket) {
          aggregated.push(currentBucket);
        }
        currentBucket = {
          time: bucket,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        };
      } else {
        currentBucket.high = Math.max(currentBucket.high, candle.high);
        currentBucket.low = Math.min(currentBucket.low, candle.low);
        currentBucket.close = candle.close;
      }
    }
    
    if (currentBucket) {
      aggregated.push(currentBucket);
    }
    
    return aggregated;
  }


  private generateMockCandles(pair: string, timeframe: string, limit: number): Candle[] {
    const cacheKey = `${pair}:${timeframe}:${limit}`;
    const cached = this.candleCache.get(cacheKey);
    const quote = this.quotes.get(pair);
    const currentPrice = quote ? (quote.bid + quote.ask) / 2 : null;
    
    // Check if cached candles are still valid (last candle close within 0.5% of current price)
    if (cached && cached.mock && currentPrice && cached.candles.length > 0) {
      const lastCandle = cached.candles[cached.candles.length - 1];
      const priceDiff = Math.abs(lastCandle.close - currentPrice) / currentPrice;
      if (priceDiff < 0.005) {
        // Update the last candle to match current price
        lastCandle.close = currentPrice;
        lastCandle.high = Math.max(lastCandle.high, currentPrice);
        lastCandle.low = Math.min(lastCandle.low, currentPrice);
        return cached.candles.slice(-limit);
      }
    }

    const tf = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP["1m"];
    
    const basePrices: Record<string, number> = {
      // Majors
      "EUR-USD": 1.0875, "GBP-USD": 1.2650, "USD-JPY": 149.50, "USD-CHF": 0.8850,
      "AUD-USD": 0.6520, "USD-CAD": 1.3580, "NZD-USD": 0.6120,
      // EUR crosses
      "EUR-GBP": 0.8600, "EUR-JPY": 162.50, "EUR-CHF": 0.9620, "EUR-AUD": 1.6680,
      "EUR-CAD": 1.4760, "EUR-NZD": 1.7780,
      // GBP crosses
      "GBP-JPY": 189.00, "GBP-CHF": 1.1180, "GBP-AUD": 1.9400, "GBP-CAD": 1.7160, "GBP-NZD": 2.0680,
      // AUD crosses
      "AUD-JPY": 97.40, "AUD-CHF": 0.5770, "AUD-CAD": 0.8840, "AUD-NZD": 1.0650,
      // NZD crosses
      "NZD-JPY": 91.50, "NZD-CHF": 0.5420, "NZD-CAD": 0.8310,
      // CAD/CHF crosses
      "CAD-JPY": 110.10, "CAD-CHF": 0.6510, "CHF-JPY": 169.00,
    };
    
    // Always use current live price if available
    const endPrice = currentPrice || (basePrices[pair] || 1.0);
    const candles: Candle[] = [];
    const now = Math.floor(Date.now() / 1000);
    const volatility = pair.includes("JPY") ? 0.03 : 0.0003; // Reduced volatility

    // Generate candles BACKWARDS from current price
    // This ensures the last candle always matches the current price
    let price = endPrice;
    const tempCandles: { time: number; open: number; high: number; low: number; close: number }[] = [];

    for (let i = 0; i <= limit; i++) {
      const time = Math.floor((now - i * tf.seconds) / tf.seconds) * tf.seconds;
      const close = price;
      const change = (Math.random() - 0.5) * volatility;
      const open = price - change; // Going backwards, so open is before close
      price = open; // Move backwards in time
      
      const high = Math.max(open, close) + Math.random() * volatility * 0.2;
      const low = Math.min(open, close) - Math.random() * volatility * 0.2;

      tempCandles.unshift({
        time,
        open: Math.round(open * 100000) / 100000,
        high: Math.round(high * 100000) / 100000,
        low: Math.round(low * 100000) / 100000,
        close: Math.round(close * 100000) / 100000,
      });
    }

    // Ensure the very last candle matches the current price exactly
    if (tempCandles.length > 0 && currentPrice) {
      const lastCandle = tempCandles[tempCandles.length - 1];
      lastCandle.close = Math.round(currentPrice * 100000) / 100000;
      lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
      lastCandle.low = Math.min(lastCandle.low, lastCandle.close);
    }

    this.candleCache.set(cacheKey, { candles: tempCandles, fetchedAt: Date.now(), mock: true });
    return tempCandles;
  }

  public onQuoteUpdate(callback: QuoteCallback): () => void {
    this.quoteCallbacks.add(callback);
    return () => this.quoteCallbacks.delete(callback);
  }

  public onCandleUpdate(callback: CandleCallback): () => void {
    this.candleCallbacks.add(callback);
    return () => this.candleCallbacks.delete(callback);
  }

  public isUsingMock(): boolean {
    return this.isUsingMockData;
  }

  public destroy(): void {
    if (this.mockInterval) clearInterval(this.mockInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }
}

export const marketDataService = new MarketDataService();
