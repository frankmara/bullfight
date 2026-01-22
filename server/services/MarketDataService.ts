import WebSocket from "ws";

const POLYGON_REST_BASE_URL = process.env.POLYGON_REST_BASE_URL || "https://api.polygon.io";
const POLYGON_WS_BASE_URL = process.env.POLYGON_WS_BASE_URL || "wss://socket.polygon.io";
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

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

const FX_PAIRS = ["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"];

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
  private candleCache: Map<string, { candles: Candle[]; fetchedAt: number }> = new Map();
  private ws: WebSocket | null = null;
  private quoteCallbacks: Set<QuoteCallback> = new Set();
  private candleCallbacks: Set<CandleCallback> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private mockInterval: NodeJS.Timeout | null = null;
  private isUsingMockData: boolean = !POLYGON_API_KEY;
  private lastCandles: Map<string, Candle> = new Map();

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
      "EUR-USD": 1.0875,
      "GBP-USD": 1.2650,
      "USD-JPY": 149.50,
      "AUD-USD": 0.6520,
      "USD-CAD": 1.3580,
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
      const subscriptions = FX_PAIRS.map((p) => `C.${p}`).join(",");
      this.ws?.send(JSON.stringify({ action: "subscribe", params: subscriptions }));
      console.log("[MarketDataService] Subscribed to:", subscriptions);
    }

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
      this.updateLastCandle(pair, (bid + ask) / 2);
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
    let status: Quote["status"] = "live";
    if (age > 10000) status = "stale";
    else if (age > 2000) status = "delayed";

    return { ...quote, status };
  }

  public getAllQuotes(): Quote[] {
    return FX_PAIRS.map((pair) => this.getQuote(pair)!).filter(Boolean);
  }

  public async getCandles(pair: string, timeframe: string, limit: number = 500): Promise<Candle[]> {
    const cacheKey = `${pair}:${timeframe}`;
    const cached = this.candleCache.get(cacheKey);
    
    if (cached && Date.now() - cached.fetchedAt < 30000) {
      return cached.candles.slice(-limit);
    }

    if (this.isUsingMockData) {
      return this.generateMockCandles(pair, timeframe, limit);
    }

    return this.fetchPolygonCandles(pair, timeframe, limit);
  }

  private async fetchPolygonCandles(pair: string, timeframe: string, limit: number): Promise<Candle[]> {
    const tf = TIMEFRAME_MAP[timeframe];
    if (!tf) {
      console.error("[MarketDataService] Unknown timeframe:", timeframe);
      return this.generateMockCandles(pair, timeframe, limit);
    }

    const ticker = formatPolygonTicker(pair);
    const now = Date.now();
    const from = new Date(now - tf.seconds * limit * 1000).toISOString().split("T")[0];
    const to = new Date(now).toISOString().split("T")[0];

    const url = `${POLYGON_REST_BASE_URL}/v2/aggs/ticker/${ticker}/range/${tf.multiplier}/${tf.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${POLYGON_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        console.warn("[MarketDataService] No candle data from Polygon, using mock");
        return this.generateMockCandles(pair, timeframe, limit);
      }

      const candles: Candle[] = data.results.map((r: any) => ({
        time: Math.floor(r.t / 1000),
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: r.v,
      }));

      this.candleCache.set(`${pair}:${timeframe}`, {
        candles,
        fetchedAt: Date.now(),
      });

      return candles;
    } catch (e) {
      console.error("[MarketDataService] Failed to fetch Polygon candles:", e);
      return this.generateMockCandles(pair, timeframe, limit);
    }
  }

  private generateMockCandles(pair: string, timeframe: string, limit: number): Candle[] {
    const cacheKey = `${pair}:${timeframe}`;
    const cached = this.candleCache.get(cacheKey);
    if (cached) return cached.candles.slice(-limit);

    const tf = TIMEFRAME_MAP[timeframe] || TIMEFRAME_MAP["1m"];
    const quote = this.quotes.get(pair);
    const basePrice = quote ? (quote.bid + quote.ask) / 2 : 1.0;
    const candles: Candle[] = [];
    const now = Math.floor(Date.now() / 1000);

    let price = basePrice * (0.99 + Math.random() * 0.02);

    for (let i = limit; i >= 0; i--) {
      const time = Math.floor((now - i * tf.seconds) / tf.seconds) * tf.seconds;
      const volatility = pair.includes("JPY") ? 0.1 : 0.001;
      const change = (Math.random() - 0.5) * volatility;
      const open = price;
      price = price + change;
      const close = price;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;

      candles.push({
        time,
        open: Math.round(open * 100000) / 100000,
        high: Math.round(high * 100000) / 100000,
        low: Math.round(low * 100000) / 100000,
        close: Math.round(close * 100000) / 100000,
      });
    }

    this.candleCache.set(cacheKey, { candles, fetchedAt: Date.now() });
    return candles;
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
