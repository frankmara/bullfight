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
Key entities include `users`, `competitions`, `competitionEntries`, `orders`, `fills`, `positions`, `trades`, `deals`, `payments`, `payouts`, and `auditLog`.

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
- Both parties pay a stake via Stripe, creating an auto-generated competition.
- Winner determined by highest % return; a 3% rake is applied.

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
- Falls back to simulated payments if `STRIPE_SECRET_KEY` is not provided.

### Mobile Development
- Expo managed workflow with EAS build.
- `@expo-google-fonts/nunito` for custom fonts.
- `expo-haptics` for haptic feedback.
- Async storage for client-side authentication.

### Email Service
- Resend API for email delivery.