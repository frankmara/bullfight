# Bullfight

## Overview

Bullfight is a competitive paper trading platform featuring a React Native/Expo mobile app and an Express.js API. It allows users to enter trading competitions, track real-time forex quotes, and compete on live leaderboards. The platform aims to provide a dynamic and engaging experience for aspiring traders, offering public competitions with prize pools, a robust paper trading engine, and an upcoming peer-to-peer (PvP) challenge system. The long-term vision is to become a leading platform for trading skill development and competitive financial gaming.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54, targeting iOS, Android, and web.
- **Navigation**: React Navigation v7.
- **State Management**: TanStack React Query for server state, React Context for authentication.
- **Styling**: Custom dark mode theme ("fire and ash" palette).
- **Animations**: React Native Reanimated.
- **UI/UX**: Desktop-first responsive design, professional trading terminal layout for the Arena screen, and a two-column desktop dashboard layout.
- **Charting**: Integrated Lightweight Charts v5 for candlestick charting with real-time updates and OHLC overlay.

### Backend Architecture
- **Framework**: Express.js 5 with TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Custom session-based authentication with bcrypt.
- **API Pattern**: RESTful endpoints.
- **Storage Layer**: Abstracted database operations for flexibility.
- **Execution Model**: Deal-based system (Orders → Deals → Trades → Positions) managed by an `ExecutionService`.

### Data Models
Key entities include `users`, `competitions`, `competitionEntries`, `orders`, `fills`, `positions`, `trades`, `deals`, `payments`, `payouts`, `auditLog`, `wallets`, and `tokenTransactions`.

### Token Wallet System
- Each user has a wallet with `balanceTokens`, `lockedTokens`, and computed `availableTokens`.
- All token changes are recorded in an immutable ledger (`tokenTransactions` table).
- Transaction kinds: PURCHASE, COMPETITION_ENTRY, PVP_STAKE_LOCK, PVP_STAKE_RELEASE, BET_PLACE, BET_REFUND, BET_PAYOUT, RAKE_FEE, ADJUSTMENT.
- Wallets are auto-created on user registration.
- API: GET /api/wallet, GET /api/wallet/transactions, POST /api/wallet/dev-adjust (dev only).
- WalletBadge component displays token balance in the desktop navigation bar, clickable to navigate to Wallet screen.

### Token Purchasing Flow
- Token packages: 25, 50, 100, 250, 500, 1000 tokens at $1 per token (amountCents).
- Purchase endpoints:
  - GET /api/tokens/packages - Returns available token packages.
  - POST /api/tokens/purchase-intent - Creates pending purchase, returns Stripe Checkout URL (or simulate mode in dev).
  - POST /api/tokens/purchase-confirm - Confirms purchase after Stripe checkout, credits tokens to wallet.
- Database: `token_purchases` table tracks all purchases with status (pending, completed, failed, refunded).
- Stripe Checkout: When Stripe is configured, users are redirected to Stripe's hosted checkout page, then returned to /payment/success?type=tokens&id={purchaseId}&session_id={sessionId}.
- Simulation mode: In development without Stripe, purchases complete immediately without payment.

### Real-time Features
- Server-side simulated forex quotes.
- Client-side polling for quotes and leaderboard updates.
- WebSocket integration planned for external market data.

### Trading Terminal (Arena)
- **Layout**: CSS Grid-based layout with a left tool dock, top chart toolbar, central chart, right MarketWatch/OrderTicket panels, and a bottom blotter for positions/orders/history.
- **Features**: One-click trading, quick lot sizing, chart overlays for positions/orders, collapsible leaderboard, and toast notifications.
- **Keyboard Shortcuts**: `B` (Buy), `S` (Sell), `ESC` (Close leaderboard), `Ctrl+K` (Focus watchlist search).

### PvP Challenges System
- Enables one-on-one trading competitions between users with stake, balance, duration, and pair negotiation.
- Both parties stake tokens (not direct payment) to enter, creating an auto-generated competition.
- Winner determined by highest % return; a 3% rake is applied.
- **Visibility Options**:
  - `visibility`: 'private' (default) or 'public' (spectators can watch)
  - `arenaListed`: Boolean to list in public arena mode (only when public)
  - `chatEnabled`: Boolean to enable spectator chat (default true)
  - `bettingEnabled`: Boolean for bet-behind feature (disabled by default, requires compliance flag)
  - `scheduledLiveAt`: Optional timestamp for scheduled live events
  - `liveStatus`: 'offline' | 'scheduled' | 'live' | 'ended'
  - `streamEmbedType`: 'none' | 'twitch' | 'youtube' | 'url'
  - `streamUrl`: Optional stream URL for embedded streams

### Arena Mode & Watch Page
- **Arena Mode** (`/arena-mode`): Lists public arena-listed PvP matches with LIVE/UPCOMING/ALL tabs.
- **Watch Page** (`/watch/pvp/:matchId`): Spectator view for public PvP matches showing:
  - Scoreboard header with both traders' stats (equity, P&L, return%, open positions)
  - Time remaining countdown
  - Live status indicator (LIVE, SCHEDULED, ENDED, OFFLINE)
  - Stream container placeholder (for future video integration)
  - Chat panel (if chatEnabled) on the right (desktop) or bottom (mobile)
  - Bet Behind panel placeholder (disabled by default, for future betting feature)
- API: `GET /api/watch/pvp/:matchId` returns trader stats, refreshes every 5 seconds
- Only public matches can be watched; private matches return 403

### Email Notification System
- Uses `EmailService` and Resend API for welcome, competition, PvP, and daily standings emails.
- Admin portal for managing email templates and viewing logs.

### Admin
- An admin role exists (`fjmara@outlook.com`) for competition and email management.

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL`).
- Drizzle ORM.

### Market Data
- `MarketDataService` provides unified data access.
- Polygon.io (REST API for historical, WebSocket for real-time) if `POLYGON_API_KEY` is provided.
- Falls back to mock data for forex quotes and historical candles if Polygon.io is unavailable.
- Supported pairs: EUR-USD, GBP-USD, USD-JPY, AUD-USD, USD-CAD.

### Payments
- Stripe integration for competition buy-ins and PvP stakes using `StripeClient`.
- Webhooks handle payment completion events.
- **TEMPORARY**: Currently using Stripe sandbox mode in production (see `server/stripeClient.ts` line 21-23). Change `targetEnvironment` to use production credentials when ready for live payments.
- Falls back to simulated payments if Stripe connector is not configured.

### Mobile Development
- Expo managed workflow with EAS build.
- `@expo-google-fonts/nunito` for custom fonts.
- `expo-haptics` for haptic feedback.
- Async storage for client-side authentication.

### Email Service
- Resend API for email delivery.