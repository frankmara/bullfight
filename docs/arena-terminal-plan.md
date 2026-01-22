# Arena Terminal Redesign Plan

## Current File Map

### Arena Page
- **Main Screen**: `client/screens/ArenaScreen.tsx` (~1710 lines)
  - Layout wrapper: Inline in ArenaScreen
  - Watchlist/Instrument selector: Inline `renderInstrumentSelector()`
  - Chart: `<TradingViewChart>` component
  - Order ticket: Inline `renderOrderPanel()`
  - Bottom blotter: Inline `renderBlotterPanel()` with tabs (positions/orders/history)

### Chart Component
- **TradingView Chart**: `client/components/TradingViewChart.tsx`
  - Uses `lightweight-charts` v5
  - Fetches candles from `/api/market/candles/:pair`
  - Supports position/order overlays

### Server-Side
- **Market Data**: `server/services/MarketDataService.ts`
  - Auto-detects Polygon API key for live data
  - Falls back to mock data when no key
  - Provides `/api/market/candles/:pair` and `/api/market/status`
- **Trading Engine**: `server/services/ExecutionService.ts`
  - Deal-based execution model
  - Market orders, partial closes, SL/TP modification
- **API Routes**: `server/routes.ts`
  - `/api/arena/:id` - Arena data (positions, orders, fills)
  - `/api/arena/:id/orders` - Place orders
  - `/api/arena/:id/positions/:id/close` - Close positions

### Terminal Primitives (NEW)
- `client/components/terminal/theme.ts` - Terminal color palette, typography, spacing
- `client/components/terminal/TerminalPanel.tsx` - Panel containers
- `client/components/terminal/TerminalHeader.tsx` - Section headers
- `client/components/terminal/TerminalTabs.tsx` - Tab navigation
- `client/components/terminal/TerminalTable.tsx` - Data tables
- `client/components/terminal/TerminalButton.tsx` - Action buttons
- `client/components/terminal/TerminalIconButton.tsx` - Icon buttons
- `client/components/terminal/TerminalInput.tsx` - Form inputs
- `client/components/terminal/TerminalBadge.tsx` - Status badges

---

## Current State Summary

### What's Wired
- Real-time quotes via polling (simulated or Polygon when API key present)
- Trading execution (market/limit/stop orders)
- Position management (close, partial close, modify SL/TP)
- TradingView-style charting with candlesticks
- Leaderboard integration
- Toast notifications for order feedback
- Keyboard shortcuts (B/S/ESC/Ctrl+K)

### What's Mocked/Simulated
- Quote generation when no Polygon API key (realistic spreads)
- No WebSocket real-time streaming yet (polling only)

### Current Layout
- Desktop: 2-column (chart+blotter left, order panel right)
- Mobile: Stacked layout with scrollable sections
- Instrument selector: Horizontal scroll at top
- Chart: Center with timeframe buttons
- Order panel: Buy/Sell buttons, lot size, SL/TP
- Blotter: Tabs for Positions, Orders, History

---

## Target Terminal Layout

Based on reference screenshots, the target layout includes:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [◀ Back]  Competition Title  [RUNNING] [02:15:34] [DEMO/LIVE]  [🏆]    │
├───────────────────────────────────────────────────────────────────────── │
│ EQUITY       │ P&L          │ RETURN       │ RANK         │ DRAWDOWN   │
│ $10,500.00   │ +$500.00     │ +5.00%       │ #3           │ -2.1%      │
├──────┬───────────────────────────────────────────────────────┬──────────┤
│      │  Chart Toolbar: [1m] [5m] [15m] [1h] [4h] [1D]       │          │
│ TOOL │                                                       │ MARKET   │
│ DOCK │                                                       │ WATCH    │
│      │          CANDLESTICK CHART                           │          │
│ [+]  │          (TradingView lightweight-charts)            │ EUR/USD  │
│ [✎]  │                                                       │ 1.0875   │
│ [📏] │                                                       │ ─────────│
│ [🔲] │                                                       │ ORDER    │
│      │                                                       │ TICKET   │
│      │                                                       │          │
│      │                                                       │ [BUY]    │
│      │                                                       │ [SELL]   │
├──────┴───────────────────────────────────────────────────────┴──────────┤
│ [Competition▼]  │ Positions (2) │ Pending (1) │ Closed │ Trades │ Deals │
│                 ├───────────────────────────────────────────────────────┤
│                 │  Symbol  Side  Lots   Entry     P&L       SL/TP  [X] │
│                 │  EUR/USD BUY   0.10   1.0875   +$25.00   ---   [X]   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Layout Elements

1. **Left Vertical Tool Dock** - Chart drawing tools (new)
2. **Top Header** - Competition info, timer, status, account metrics
3. **Chart Toolbar** - Timeframe selector, chart type, indicators
4. **Center Chart** - Full-height candlestick chart
5. **Right Panel** - Market Watch + Order Ticket (stacked)
6. **Bottom Blotter** - 6 tabs: Positions, Pending, Closed Positions, Trades, Deal History, Order History
7. **Bottom-Left** - Competition Switcher dropdown

---

## Phased Implementation Plan

### P0: Foundation (Current Sprint)
**Status: ✅ COMPLETE**

- [x] Create terminal theme system (`client/components/terminal/theme.ts`)
- [x] Create reusable primitives (Panel, Header, Tabs, Table, Button, etc.)
- [x] Apply terminal colors to ArenaScreen (darker backgrounds, burnt-red accent)
- [x] Apply tabular-nums to all price displays
- [x] Standardize typography (10-13px terminal sizing)

### P1: Layout Restructure
**Goal: Match reference 3-column layout**

- [ ] Extract ArenaScreen components into separate files:
  - `client/components/arena/ArenaHeader.tsx`
  - `client/components/arena/AccountMetrics.tsx`
  - `client/components/arena/MarketWatch.tsx`
  - `client/components/arena/OrderTicket.tsx`
  - `client/components/arena/Blotter.tsx`
  - `client/components/arena/ChartToolbar.tsx`
- [ ] Implement 3-column desktop layout (dock | chart | right panel)
- [ ] Add left tool dock (placeholder icons)
- [ ] Expand blotter tabs to 6 (Positions, Pending, Closed, Trades, Deals, Orders)
- [ ] Add Competition Switcher dropdown (bottom-left)
- [ ] Responsive breakpoints (desktop >1024px, tablet 768-1024px, mobile <768px)

### P2: Enhanced Functionality
**Goal: Professional trading terminal features**

- [ ] Chart drawing tools integration (trend lines, fibonacci, etc.)
- [ ] Chart indicators panel (MA, RSI, MACD, Bollinger Bands)
- [ ] Advanced order types (OCO, trailing stop)
- [ ] One-click close buttons on chart position lines
- [ ] Drag-to-modify SL/TP on chart
- [ ] WebSocket integration for real-time quotes (replace polling)
- [ ] Sound notifications for order fills
- [ ] Trade confirmation modal with details
- [ ] Position averaging / scaling in/out
- [ ] Historical trade export (CSV)

---

## Terminal Theme Colors

```typescript
const TerminalColors = {
  // Backgrounds
  bgBase: "#070A0F",      // Darkest base
  bgPanel: "#0B0F14",     // Panel backgrounds
  bgSurface: "#0E141C",   // Elevated surfaces
  bgElevated: "#101924",  // Hover/active states
  bgInput: "#0A0E14",     // Input fields
  
  // Borders
  border: "#1C2533",      // Primary borders
  borderLight: "#243040", // Lighter borders
  
  // Text
  textPrimary: "#E6EDF3", // Primary text
  textSecondary: "#9AA4B2", // Secondary text
  textMuted: "#5C6673",   // Muted/disabled text
  
  // Accents
  accent: "#D14B3A",      // Bullfight burnt-red
  positive: "#16C784",    // Buy/profit green
  negative: "#D14B3A",    // Sell/loss red (same as accent)
  warning: "#F0B90B",     // Warnings (amber)
};
```

## Typography

```typescript
const TerminalTypography = {
  // All prices use tabular-nums for alignment
  price: {
    fontSize: 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
    fontFamily: "JetBrains Mono, monospace",
  },
  tableCell: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontFamily: "JetBrains Mono, monospace",
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
};
```

---

## Notes

- ArenaScreen is currently a monolithic ~1700 line file
- P1 should break it into smaller, maintainable components
- WebSocket streaming deferred to P2 (polling is acceptable for MVP)
- Tool dock is placeholder in P1, functional in P2
- Competition Switcher requires API endpoint for user's active competitions
