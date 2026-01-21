# Bullfight

## Overview

Bullfight is a competitive trading platform where users pay buy-ins to enter paper trading competitions. The application features a React Native/Expo mobile app with a dark, fire-and-ash themed UI, backed by an Express.js API server with PostgreSQL database.

Core functionality includes:
- Public trading competitions with prize pools and rake systems
- Real-time forex quotes and paper trading engine
- Live leaderboards ranked by portfolio return percentage
- Admin portal for competition management
- User authentication and competition entry tracking

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54, targeting iOS, Android, and web
- **Navigation**: React Navigation v7 with native stack and bottom tabs
- **State Management**: TanStack React Query for server state, React Context for auth
- **Styling**: Custom theme system with dark mode colors (fire/ash palette), no external CSS framework
- **Animations**: React Native Reanimated for smooth transitions and interactions

The client code lives in `/client` with screens, components, navigation, and hooks organized in subdirectories. Path aliases `@/` and `@shared/` are configured via babel module resolver.

### Backend Architecture
- **Framework**: Express.js 5 with TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `/shared/schema.ts` contains all table definitions shared between client and server
- **Authentication**: Custom session-based auth with bcrypt password hashing, user ID passed via headers for React Native compatibility
- **API Pattern**: RESTful endpoints under `/api/` prefix

The server uses a storage abstraction layer (`/server/storage.ts`) that wraps all database operations, making it easy to swap implementations or add caching.

### Data Models
Key entities defined in the schema:
- `users`: Authentication with email/password and role-based access
- `competitions`: Trading tournaments with configurable buy-ins, rake, prize splits, and trading parameters
- `competitionEntries`: User participation tracking with equity and P&L
- `orders`, `fills`, `positions`: Paper trading engine state
- `payments`, `payouts`: Financial transaction records
- `auditLog`: System event tracking

### Real-time Features
- Simulated forex quotes generated server-side (EUR-USD, GBP-USD, USD-JPY, AUD-USD, USD-CAD)
- Client polls for quotes and leaderboard updates
- WebSocket integration scaffolded for future Polygon/Massive market data

## External Dependencies

### Database
- PostgreSQL accessed via `DATABASE_URL` environment variable
- Drizzle ORM for schema management and queries
- Migrations stored in `/migrations` directory

### Market Data (Planned)
- Polygon.io or Massive.com for live forex quotes
- Configurable base URLs via `POLYGON_REST_BASE_URL` and `POLYGON_WS_BASE_URL`
- Currently using simulated quotes with realistic spreads

### Payments (Planned)
- Stripe integration for buy-ins and payouts (TEST mode)
- Falls back to simulated payment flow when `STRIPE_SECRET_KEY` not provided

### Mobile Development
- Expo managed workflow with EAS build support
- Custom fonts via `@expo-google-fonts/nunito`
- Haptic feedback via `expo-haptics`
- Async storage for client-side auth persistence

## Recent Changes (January 2026)

### Desktop-First UI Redesign
- Complete UI redesign with dark fire-and-ash theme (#0A0A0A black, #FF3B3B red accents)
- Desktop-first responsive layouts across all screens
- Removed all stock images; bull icon logo used prominently throughout
- Professional trading terminal layout in Arena screen

### TradingView Integration
- Integrated lightweight-charts v5 for candlestick charting in Arena
- Chart component: `/client/components/TradingViewChart.tsx`
- Uses `chart.addSeries(CandlestickSeries, options)` for v5 API compatibility
- Real-time simulated price data with 1-minute candle updates

### Trading Flow
- Late entry enabled: users can join both "open" and "running" competitions
- Arena layout: left instruments sidebar, center chart, right order panel, bottom positions/orders
- Full trading flow: register → join competition → place orders → view positions

### Responsive Navigation
- Desktop (>768px): Horizontal top navigation bar with logo, nav links, and user info
- Mobile (<768px): Bottom tab bar with icons
- Navigation component: `/client/navigation/MainTabNavigator.tsx` handles both layouts
- Screens use safe header/tab bar height detection for proper spacing

### Professional Trading Terminal (Arena)
- 3-column desktop layout: watchlist (left), chart (center), order ticket (right)
- Top header with comprehensive metrics: Balance, Equity, P&L, Return%, Rank, Drawdown
- Enhanced watchlist: search input, favorite symbols with stars, tick indicators (up/down arrows), spread display
- Order ticket: one-click trading toggle, BUY/SELL buttons with live prices, quick size buttons (1K-100K), SL/TP inputs
- Tabbed bottom blotter: Positions, Orders, History tabs with dense sortable tables
- Chart overlays: position entry lines, pending order lines, SL/TP price lines using lightweight-charts createPriceLine API
- Collapsible leaderboard panel slides in from right side

### Keyboard Shortcuts
- B = Buy at market
- S = Sell at market
- ESC = Close leaderboard panel
- Ctrl+K = Focus watchlist search

### Toast Notification System
- Animated toast notifications for order success/error/info using react-native-reanimated
- Fade in/out animations with slide transitions

### Backend API Additions
- PUT `/api/arena/:id/positions/:positionId` - Modify SL/TP on positions
- POST `/api/arena/:id/positions/:positionId/partial-close` - Partial close positions
- PUT `/api/arena/:id/orders/:orderId` - Modify pending orders (price, SL/TP)

### Admin
- fjmara@outlook.com has admin role
- Admin can set competition status via database updates