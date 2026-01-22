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
- `trades`, `deals`: Professional FX deal-based execution model (Orders → Deals → Trades → Positions)
- `payments`, `payouts`: Financial transaction records
- `auditLog`: System event tracking

### Execution Model
- **ExecutionService** (`/server/services/ExecutionService.ts`) handles order execution
- Deal-based model: market orders create deals, deals create trades, trades update positions via netting
- Supports market orders, partial closes (by lots or percentage), SL/TP modification
- Units conversion: 1 lot = 100,000 units (UNITS_PER_LOT constant)

### Real-time Features
- Simulated forex quotes generated server-side (EUR-USD, GBP-USD, USD-JPY, AUD-USD, USD-CAD)
- Client polls for quotes and leaderboard updates
- WebSocket integration scaffolded for future Polygon/Massive market data

## External Dependencies

### Database
- PostgreSQL accessed via `DATABASE_URL` environment variable
- Drizzle ORM for schema management and queries
- Migrations stored in `/migrations` directory

### Market Data
- **MarketDataService** (`/server/services/MarketDataService.ts`) provides unified market data access
- Auto-detects `POLYGON_API_KEY` environment variable for live data, falls back to mock data
- Polygon.io REST API for historical candles, WebSocket for real-time quotes (when API key provided)
- Mock data generates realistic forex quotes with proper spreads when no API key
- Supported pairs: EUR-USD, GBP-USD, USD-JPY, AUD-USD, USD-CAD

#### Market Data Endpoints
- `GET /api/market/status` - Returns `{ isUsingMock: boolean }` for data source indicator
- `GET /api/market/quotes` - Returns all pairs with bid/ask/spreadPips/status/ageMs
- `GET /api/market/candles?pair=EUR-USD&tf=1m&limit=500` - Returns candle history
  - Supported timeframes: 1m, 5m, 15m, 1h, 4h, 1d
  - Returns `{ pair, timeframe, mock: boolean, candles: [{time, open, high, low, close, volume?}] }`
  - Candle time is in Unix seconds (Lightweight Charts format)
  - 30-second in-memory cache per pair+tf+limit
  - Falls back to mock random walk data if Polygon unavailable

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
- Fetches candles from `/api/market/candles/:pair` endpoint (MarketDataService)
- Real-time price updates with 1-minute candle intervals
- OHLC overlay shows symbol, timeframe, O/H/L/C values, and % change in top-left of chart
- Crosshair enabled with hover tracking to update OHLC display
- Last price label on right price scale
- Live candle updates using mid=(bid+ask)/2 from quote polling
- Creates new candle automatically when timeframe bucket changes

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

#### Layout Structure (Desktop)
- **ArenaLayout wrapper** (`/client/components/arena/ArenaLayout.tsx`): CSS Grid layout orchestrator
- **ToolDock** (48px left): Vertical tool bar with 8 drawing tool icons (cursor, crosshair, trend, horizontal, fib, rectangle, text, measure)
- **ChartToolbar** (44px top): Symbol info, price display, timeframe selector (M1-D1)
- **Center Chart**: TradingView candlestick chart with position/order overlays
- **Right Panel** (400px): Split 62% MarketWatch / 38% OrderTicket
- **Bottom Blotter** (280px): 6 tabs - Positions, Pending, Closed Positions, Trades, Deal History, Order History

#### Arena Components
- `/client/components/arena/ArenaLayout.tsx` - Grid layout wrapper
- `/client/components/arena/ToolDock.tsx` - Drawing tools sidebar
- `/client/components/arena/ChartToolbar.tsx` - Symbol and timeframe controls
- `/client/components/arena/MarketWatch.tsx` - Currency pair table with search and favorites
- `/client/components/arena/OrderTicket.tsx` - Order entry form with one-click trading
- `/client/components/arena/Blotter.tsx` - Tabbed positions/orders/history panel
- `/client/components/arena/index.ts` - Barrel export

#### Terminal Theme System
- `/client/components/terminal/theme.ts` - Premium dark theme (bgBase #070A0F, bgPanel #0B0F14, accent #D14B3A)
- Tabular-nums font variant for price alignment
- Reusable primitives: TerminalColors, TerminalTypography, TerminalSpacing, TerminalRadius

#### Features
- Top header with comprehensive metrics: Balance, Equity, P&L, Return%, Rank, Drawdown
- Data status indicator shows MOCK (amber) or LIVE (green) next to competition status
- Enhanced watchlist: search input, favorite symbols with stars, tick indicators (up/down arrows), spread display
- Order ticket: one-click trading toggle, BUY/SELL buttons with live prices, quick lot size buttons (0.01-1.0), SL/TP inputs
- Lots-based sizing: 1 lot = 100,000 units (standard FX contract), quick sizes: 0.01, 0.05, 0.1, 0.5, 1.0
- Chart overlays: position entry lines showing lots (e.g., "BUY 0.10 lots"), pending order lines, SL/TP price lines
- Collapsible leaderboard panel slides in from right side
- Order confirmation: OrderTicket component shows a custom React Native Modal for confirmation when oneClickTrading is OFF

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

### Stripe Payment Integration
- **StripeClient** (`/server/stripeClient.ts`) handles Stripe API initialization and checkout sessions
- Uses Replit's managed Stripe integration with automatic secret handling
- Webhook handlers process payment completion events

#### Payment Flow
1. **Competition Entry**: User clicks join on paid competition → redirects to Stripe Checkout
2. **PvP Stakes**: User clicks pay on accepted challenge → redirects to Stripe Checkout  
3. **Stripe Checkout**: User completes payment on Stripe's hosted page
4. **Webhook/Redirect**: Payment confirmation creates competition entry or marks stake as paid
5. **Success Screen**: User sees confirmation and can enter arena

#### Payment API Endpoints
- `POST /api/competitions/:id/checkout` - Create Stripe session for competition buy-in
- `GET /api/payment/competition/:id/confirm` - Confirm payment after redirect
- `POST /api/pvp/challenges/:id/checkout` - Create Stripe session for PvP stake
- `GET /api/payment/pvp/:id/confirm` - Confirm PvP payment after redirect

#### Payment Screens
- `PaymentSuccessScreen` - Confirms payment, handles redirect with session verification
- `PaymentCancelScreen` - Handles cancelled payments, offers retry

#### Schema Fields
- `competition_entries.stripeSessionId` - Tracks Stripe checkout session
- `competition_entries.stripePaymentId` - Tracks successful payment ID
- `pvp_challenges.challengerStripeSessionId/PaymentId` - Challenger payment tracking
- `pvp_challenges.inviteeStripeSessionId/PaymentId` - Invitee payment tracking

### PvP Challenges System
- One-on-one trading competitions between users
- Challenger sets initial terms (stake, balance, duration, trading pairs)
- Invitee can accept or propose counter-terms (negotiation)
- Both parties must accept final terms before payment
- Both parties pay stake via Stripe; when both paid, competition auto-creates and starts
- Winner determined by highest % return when competition ends
- 3% rake (300 bps) taken from prize pool, configurable via `rakeBps` field

#### PvP Database Schema
- `pvpChallenges` table tracks challenge lifecycle
- Status flow: draft → pending → negotiating → accepted → payment_pending → active → completed/cancelled
- Links to auto-created `competitions` table entry with `type="pvp"` and `entryCap=2`

#### PvP API Endpoints
- GET `/api/pvp/challenges` - List user's challenges
- GET `/api/pvp/challenges/:id` - Get challenge details
- POST `/api/pvp/challenges` - Create new challenge
- PUT `/api/pvp/challenges/:id` - Propose new terms
- POST `/api/pvp/challenges/:id/accept` - Accept current terms
- POST `/api/pvp/challenges/:id/pay` - Submit payment
- POST `/api/pvp/challenges/:id/cancel` - Cancel challenge

#### PvP Frontend Screens
- `PvPListScreen` - View all user's challenges with status badges
- `PvPNewScreen` - Create new challenge form
- `PvPDetailScreen` - View/negotiate challenge, accept terms, pay, enter arena

#### Audit Logging
- All PvP actions logged to `auditLog` table
- Events: pvp_challenge_created, pvp_terms_proposed, pvp_terms_accepted, pvp_payment_made, pvp_challenge_cancelled

### Email Notification System
- **EmailService** (`/server/services/EmailService.ts`) handles all email functionality
- **Resend Integration**: Uses Resend API for reliable email delivery
- Admin-configurable HTML templates with variable substitution

#### Email Types
1. **Welcome** - Sent on user registration
2. **Challenge Entry Confirmed** - Sent when user joins a competition
3. **Challenge Started** - Sent to all participants when competition status changes to "running"
4. **Challenge Concluded** - Sent to all participants with final rankings when competition ends
5. **PvP Invitation** - Sent when user creates a PvP challenge
6. **Daily Standings** - Sent daily to participants in running competitions with leaderboard updates

#### Email Admin Portal
- AdminEmailScreen: View/toggle templates, view email logs
- AdminEmailEditorScreen: Edit HTML templates with variable insertion UI
- Template variables: {{userName}}, {{competitionName}}, {{buyInAmount}}, {{prizePool}}, etc.

#### Email API Endpoints
- GET `/api/admin/email/templates` - List all templates
- PUT `/api/admin/email/templates/:type` - Update template
- GET `/api/admin/email/logs` - View email send history
- POST `/api/admin/email/test` - Send test email
- POST `/api/admin/email/trigger-standings` - Manually trigger daily standings emails

#### Scheduled Jobs
- **ScheduledJobs** (`/server/services/ScheduledJobs.ts`) manages automated tasks
- Daily standings emails run every 24 hours automatically
- Admin can manually trigger via endpoint