# Social Arena + Bet-Behind Build Plan

> **Status:** Planning Document  
> **Created:** January 2026  
> **Scope:** Tokens, Chat, Arena Mode, Bet-Behind

---

## 1. Current Data Model Summary

### Core Tables (defined in `shared/schema.ts`)

| Table | Key Fields | Purpose |
|-------|------------|---------|
| `users` (L15-27) | id, email, username, passwordHash, role, usernameChangedAt | User authentication & identity |
| `competitions` (L29-58) | id, type, status, title, buyInCents, entryCap, rakeBps, startAt, endAt, startingBalanceCents, allowedPairsJson, prizeSplitsJson | Tournament configuration |
| `competition_entries` (L60-81) | id, competitionId, userId, paidCents, paymentStatus, cashCents, equityCents, maxEquityCents, dq | User participation in tournaments |
| `orders` (L83-105) | id, competitionId, userId, pair, side, type, quantityUnits, limitPrice, stopPrice, status | Pending/filled order records |
| `fills` (L107-126) | id, orderId, competitionId, userId, pair, side, quantityUnits, price, feeCents | Order execution fills |
| `positions` (L128-147) | id, competitionId, userId, pair, side, quantityUnits, avgEntryPrice, stopLossPrice, takeProfitPrice | Open position tracking |
| `trades` (L149-169) | id, competitionId, userId, pair, sideInitial, totalInUnits, totalOutUnits, avgEntryPrice, avgExitPrice, realizedPnlCents, status | Trade lifecycle (open→closed) |
| `deals` (L171-193) | id, tradeId, competitionId, userId, pair, side, units, lots, price, kind, realizedPnlCents | Individual deal executions |
| `payments` (L195-211) | id, userId, competitionId, kind, amountCents, provider, providerRef, status | Payment records for buy-ins |
| `payouts` (L213-228) | id, competitionId, userId, place, amountCents, status | Prize distribution records |
| `pvp_challenges` (L242-279) | id, challengerId, inviteeId, inviteeEmail, status, stakeCents, startingBalanceCents, allowedPairsJson, rakeBps, challengerPaid, inviteePaid, competitionId, winnerId | 1v1 challenge negotiation & tracking |
| `audit_log` (L230-240) | id, actorUserId, action, entityType, entityId, payloadJson | Action audit trail |
| `email_templates` (L373-385) | id, type, name, subject, htmlBody, enabled, variables | Email template storage |
| `email_logs` (L387-401) | id, templateType, recipientEmail, subject, status, resendMessageId | Email delivery tracking |
| `candle_cache` (L419-432) | id, pair, timeframe, time, open, high, low, close, volume | Historical OHLC cache |

---

## 2. PvP Challenge System Location

### Database Table
- **Schema:** `shared/schema.ts` lines 242-279
- **Table name:** `pvp_challenges`

### Backend Endpoints (`server/routes.ts`)
| Endpoint | Lines | Description |
|----------|-------|-------------|
| `GET /api/pvp/challenges` | ~1400-1430 | List user's challenges |
| `GET /api/pvp/challenges/:id` | 1431-1463 | Get challenge details |
| `POST /api/pvp/challenges` | 1466-1537 | Create new challenge |
| `PUT /api/pvp/challenges/:id` | 1539-1610 | Update challenge terms |
| `POST /api/pvp/challenges/:id/accept` | 1612-1685 | Accept/reject challenge |
| `POST /api/pvp/challenges/:id/checkout` | 1687-1764 | Create Stripe checkout session |
| `POST /api/pvp/challenges/:id/confirm-payment` | 1766-1884 | Confirm payment & create competition |
| `POST /api/pvp/challenges/:id/pay` | 1886-1970 | Legacy pay endpoint |
| `POST /api/pvp/challenges/:id/cancel` | 2004-2070 | Cancel challenge |

### Storage Layer (`server/storage.ts`)
| Method | Lines | Description |
|--------|-------|-------------|
| `getPvpChallenges()` | 535-544 | Get all challenges for user |
| `getPvpChallenge()` | 546-552 | Get single challenge |
| `createPvpChallenge()` | 554-557 | Create challenge record |
| `updatePvpChallenge()` | 559-570 | Update challenge fields |

### Frontend Screens (`client/screens/`)
| Screen | File | Description |
|--------|------|-------------|
| PvP List | `PvPListScreen.tsx` | Browse/manage challenges |
| PvP New | `PvPNewScreen.tsx` | Create new challenge |
| PvP Detail | `PvPDetailScreen.tsx` | View/negotiate challenge |

### Email Integration (`server/services/EmailService.ts`)
- `sendPvPInvitationEmail()` (L473+) - Invitation emails
- `sendPvPChallengeAcceptedEmail()` - Acceptance notification
- `sendPvPChallengeCompletedEmail()` - Results notification

---

## 3. Socket Architecture Summary

### Current State
- **No server-side WebSocket hub exists yet**
- Real-time quotes use **Polygon.io WebSocket** (client: `MarketDataService`)
- Client-side **polling** for leaderboard/equity updates

### WebSocket Implementation (`server/services/MarketDataService.ts`)
```typescript
// Line 71-88: Polygon.io WebSocket connection
private ws: WebSocket | null = null;
// Subscribes to: C.EUR-USD, C.GBP-USD, etc. (forex ticks)
// Events: quote updates, candle aggregates
```

### Proposed Socket Architecture (to be implemented)
```
Namespace: /arena
  Events:
    - join_room(competitionId)
    - leave_room(competitionId)
    - quote_update (pair, bid, ask, timestamp)
    - leaderboard_update (rankings[])
    - position_update (userId, positions[])
    - deal_executed (dealId, userId, pair, side, lots, price)
    
Namespace: /chat
  Events:
    - join_channel(channelId)
    - leave_channel(channelId)
    - message (channelId, userId, text, timestamp)
    - user_typing (channelId, userId)
    - message_deleted (channelId, messageId)
    
Namespace: /betting
  Events:
    - join_market(marketId)
    - odds_update (marketId, odds)
    - bet_placed (betId, userId, amount)
    - market_settled (marketId, winnerId, payout)
```

---

## 4. Proposed Database Additions

### 4.1 Token Wallet + Token Ledger

```sql
-- Token wallet per user
CREATE TABLE token_wallets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) UNIQUE,
  balance_tokens INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Transaction ledger (immutable)
CREATE TABLE token_ledger (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL, -- 'purchase', 'reward', 'bet', 'payout', 'refund', 'chat_tip'
  amount_tokens INTEGER NOT NULL, -- positive = credit, negative = debit
  balance_after INTEGER NOT NULL,
  reference_type TEXT, -- 'competition', 'pvp_challenge', 'bet_behind', 'purchase', 'tip'
  reference_id VARCHAR,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_token_ledger_user ON token_ledger(user_id);
CREATE INDEX idx_token_ledger_created ON token_ledger(created_at DESC);

-- Token purchase packages
CREATE TABLE token_packages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  bonus_tokens INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_price_id TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Drizzle Schema Location:** Add to `shared/schema.ts` after line 432

### 4.2 Chat Channels + Messages + Moderation

```sql
-- Chat channels
CREATE TABLE chat_channels (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'global', 'competition', 'pvp', 'direct'
  competition_id VARCHAR REFERENCES competitions(id),
  name TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_chat_channels_competition ON chat_channels(competition_id);

-- Chat messages
CREATE TABLE chat_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id VARCHAR NOT NULL REFERENCES chat_channels(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  reply_to_id VARCHAR REFERENCES chat_messages(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_by VARCHAR REFERENCES users(id),
  deleted_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);

-- Chat moderation actions
CREATE TABLE chat_moderation (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id), -- target user
  moderator_id VARCHAR NOT NULL REFERENCES users(id),
  action TEXT NOT NULL, -- 'warn', 'mute', 'ban', 'unmute', 'unban'
  channel_id VARCHAR REFERENCES chat_channels(id), -- null = global
  reason TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_chat_moderation_user ON chat_moderation(user_id);

-- User chat status
CREATE TABLE chat_user_status (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) UNIQUE,
  is_muted_globally BOOLEAN NOT NULL DEFAULT false,
  muted_until TIMESTAMP,
  is_banned_globally BOOLEAN NOT NULL DEFAULT false,
  banned_until TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### 4.3 Arena Listings (Public Trading Sessions)

```sql
-- Arena listings (viewable/joinable live sessions)
CREATE TABLE arena_listings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id VARCHAR NOT NULL REFERENCES competitions(id) UNIQUE,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  spectator_mode TEXT NOT NULL DEFAULT 'open', -- 'open', 'token_gated', 'closed'
  spectator_token_cost INTEGER NOT NULL DEFAULT 0,
  allow_bet_behind BOOLEAN NOT NULL DEFAULT false,
  bet_behind_min_tokens INTEGER NOT NULL DEFAULT 10,
  bet_behind_max_tokens INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_arena_listings_featured ON arena_listings(is_featured, viewer_count DESC);

-- Arena viewers (tracking who's watching)
CREATE TABLE arena_viewers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_listing_id VARCHAR NOT NULL REFERENCES arena_listings(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  left_at TIMESTAMP,
  UNIQUE(arena_listing_id, user_id)
);
```

### 4.4 Bet-Behind Markets + Bets + Settlement

```sql
-- Bet-behind markets (one per trader per competition)
CREATE TABLE bet_behind_markets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id VARCHAR NOT NULL REFERENCES competitions(id),
  trader_user_id VARCHAR NOT NULL REFERENCES users(id), -- the trader being bet on
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'settled'
  total_pool_tokens INTEGER NOT NULL DEFAULT 0,
  rake_bps INTEGER NOT NULL DEFAULT 500, -- 5% platform rake
  opened_at TIMESTAMP DEFAULT NOW() NOT NULL,
  closed_at TIMESTAMP,
  settled_at TIMESTAMP,
  final_return_pct REAL, -- trader's final % return
  UNIQUE(competition_id, trader_user_id)
);
CREATE INDEX idx_bet_behind_markets_comp ON bet_behind_markets(competition_id);

-- Individual bets
CREATE TABLE bet_behind_bets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id VARCHAR NOT NULL REFERENCES bet_behind_markets(id),
  bettor_user_id VARCHAR NOT NULL REFERENCES users(id),
  tokens_wagered INTEGER NOT NULL,
  prediction TEXT NOT NULL, -- 'positive', 'negative', 'beat_X_pct'
  threshold_pct REAL, -- for 'beat_X_pct' predictions
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'won', 'lost', 'cancelled', 'refunded'
  payout_tokens INTEGER,
  placed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  settled_at TIMESTAMP
);
CREATE INDEX idx_bet_behind_bets_market ON bet_behind_bets(market_id);
CREATE INDEX idx_bet_behind_bets_bettor ON bet_behind_bets(bettor_user_id);

-- Bet-behind settlement ledger (for transparency)
CREATE TABLE bet_behind_settlements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id VARCHAR NOT NULL REFERENCES bet_behind_markets(id),
  total_pool_tokens INTEGER NOT NULL,
  winning_pool_tokens INTEGER NOT NULL,
  losing_pool_tokens INTEGER NOT NULL,
  rake_tokens INTEGER NOT NULL,
  payout_multiplier REAL NOT NULL,
  settled_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

---

## 5. Key File Paths Reference

### Backend
| Area | File Path | Description |
|------|-----------|-------------|
| Database | `server/db.ts` | Drizzle DB connection |
| Schema | `shared/schema.ts` | All table definitions |
| Storage | `server/storage.ts` | CRUD operations |
| Routes | `server/routes.ts` | All API endpoints |
| Auth | `server/routes.ts` L20-200 | Auth endpoints |
| Competitions | `server/routes.ts` L200-800 | Competition CRUD |
| PvP | `server/routes.ts` L1400-2070 | PvP challenge system |
| Trading | `server/services/ExecutionService.ts` | Order execution engine |
| Market Data | `server/services/MarketDataService.ts` | Polygon.io + WebSocket |
| Email | `server/services/EmailService.ts` | Email notifications |
| Stripe | `server/stripeClient.ts` | Stripe integration |
| Jobs | `server/services/ScheduledJobs.ts` | Scheduled tasks |

### Frontend
| Area | File Path | Description |
|------|-----------|-------------|
| Auth Context | `client/context/AuthContext.tsx` | User session management |
| Arena | `client/screens/ArenaScreen.tsx` | Trading terminal |
| Dashboard | `client/screens/DashboardScreen.tsx` | User dashboard |
| PvP List | `client/screens/PvPListScreen.tsx` | Challenge list |
| PvP New | `client/screens/PvPNewScreen.tsx` | Create challenge |
| PvP Detail | `client/screens/PvPDetailScreen.tsx` | Challenge detail |
| Profile | `client/screens/ProfileScreen.tsx` | User profile |
| Leaderboard | `client/components/Leaderboard.tsx` | Ranking display |
| Navigation | `client/navigation/` | React Navigation config |

---

## 6. Phased Implementation Plan (16 Steps)

### Phase 1: Foundation (Steps 1-4)
> MVP: Token system + basic chat infrastructure

#### Step 1: Token Wallet Schema & API
- [ ] Add `token_wallets`, `token_ledger`, `token_packages` to `shared/schema.ts`
- [ ] Run `npm run db:push --force`
- [ ] Add storage methods: `getWallet()`, `creditTokens()`, `debitTokens()`, `getTransactionHistory()`
- [ ] Add endpoints: `GET /api/tokens/wallet`, `GET /api/tokens/history`
- **Files:** `shared/schema.ts`, `server/storage.ts`, `server/routes.ts`

#### Step 2: Token Purchase via Stripe
- [ ] Add `token_packages` seed data (100, 500, 1000, 5000 tokens)
- [ ] Add endpoint: `POST /api/tokens/checkout` - create Stripe checkout for package
- [ ] Add endpoint: `POST /api/tokens/confirm` - confirm purchase, credit tokens
- [ ] Add Stripe webhook handler for token purchases
- **Files:** `server/routes.ts`, `server/webhookHandlers.ts`, `server/seed.ts`

#### Step 3: Chat Schema & Basic API
- [ ] Add `chat_channels`, `chat_messages`, `chat_moderation`, `chat_user_status` tables
- [ ] Run `npm run db:push --force`
- [ ] Add storage methods for chat CRUD
- [ ] Add REST endpoints: `GET /api/chat/channels`, `GET /api/chat/:channelId/messages`, `POST /api/chat/:channelId/messages`
- **Files:** `shared/schema.ts`, `server/storage.ts`, `server/routes.ts`

#### Step 4: WebSocket Server Setup
- [ ] Install `socket.io` package
- [ ] Create `server/services/SocketService.ts` with namespaces: `/arena`, `/chat`, `/betting`
- [ ] Integrate with Express server in `server/index.ts`
- [ ] Add authentication middleware for WebSocket connections
- **Files:** `server/services/SocketService.ts`, `server/index.ts`

### Phase 2: Chat Integration (Steps 5-7)
> MVP: Real-time chat in competitions

#### Step 5: Chat Frontend Component
- [ ] Create `client/components/ChatPanel.tsx` - chat UI component
- [ ] Create `client/context/ChatContext.tsx` - socket connection management
- [ ] Add WebSocket client connection to chat namespace
- [ ] Implement send/receive messages in real-time
- **Files:** `client/components/ChatPanel.tsx`, `client/context/ChatContext.tsx`

#### Step 6: Arena Chat Integration
- [ ] Add ChatPanel to `ArenaScreen.tsx` as collapsible sidebar
- [ ] Auto-join competition chat channel on arena entry
- [ ] Show trader names (usernames) in chat
- [ ] Add token tipping feature (optional, later phase)
- **Files:** `client/screens/ArenaScreen.tsx`

#### Step 7: Chat Moderation System
- [ ] Add admin endpoints: `POST /api/chat/:channelId/moderate` (warn/mute/ban)
- [ ] Add moderation UI for admin users
- [ ] Implement mute/ban checks before message send
- [ ] Add global chat for non-competition discussions
- **Files:** `server/routes.ts`, `client/screens/AdminScreen.tsx`

### Phase 3: Arena Mode (Steps 8-10)
> MVP: Public spectator mode for live trading

#### Step 8: Arena Listings Schema & API
- [ ] Add `arena_listings`, `arena_viewers` tables
- [ ] Run `npm run db:push --force`
- [ ] Auto-create arena listing when competition starts (if public)
- [ ] Add endpoints: `GET /api/arena/listings`, `POST /api/arena/:id/join`, `POST /api/arena/:id/leave`
- **Files:** `shared/schema.ts`, `server/storage.ts`, `server/routes.ts`

#### Step 9: Arena Browser Screen
- [ ] Create `client/screens/ArenaBrowseScreen.tsx` - browse live competitions
- [ ] Show featured/popular listings with viewer counts
- [ ] Filter by: featured, viewer count, bet-behind enabled
- [ ] Click to spectate (view-only arena mode)
- **Files:** `client/screens/ArenaBrowseScreen.tsx`

#### Step 10: Spectator Mode in Arena
- [ ] Add `isSpectator` mode to `ArenaScreen.tsx`
- [ ] Hide order ticket for spectators
- [ ] Show all traders' positions/deals in blotter
- [ ] Real-time leaderboard + position updates via WebSocket
- **Files:** `client/screens/ArenaScreen.tsx`

### Phase 4: Bet-Behind (Steps 11-14)
> MVP: Parimutuel betting on trader performance

#### Step 11: Bet-Behind Schema & API
- [ ] Add `bet_behind_markets`, `bet_behind_bets`, `bet_behind_settlements` tables
- [ ] Run `npm run db:push --force`
- [ ] Auto-create market for each trader when competition opens (if bet-behind enabled)
- [ ] Add endpoints: `GET /api/betting/markets/:competitionId`, `POST /api/betting/bets`
- **Files:** `shared/schema.ts`, `server/storage.ts`, `server/routes.ts`

#### Step 12: Bet-Behind UI Component
- [ ] Create `client/components/BetBehindPanel.tsx`
- [ ] Show all traders with their current return %
- [ ] Allow placing bets: positive return, negative return, beats X%
- [ ] Show current pool size and implied odds
- **Files:** `client/components/BetBehindPanel.tsx`

#### Step 13: Arena Bet-Behind Integration
- [ ] Add BetBehindPanel to `ArenaScreen.tsx` (spectator view only)
- [ ] Real-time odds updates via `/betting` WebSocket
- [ ] Show user's active bets + potential payouts
- [ ] Token balance display in arena header
- **Files:** `client/screens/ArenaScreen.tsx`

#### Step 14: Bet-Behind Settlement Engine
- [ ] Create `server/services/BetSettlementService.ts`
- [ ] Hook into competition end event
- [ ] Calculate payouts using parimutuel formula
- [ ] Credit winners, debit losers via token ledger
- [ ] Create settlement record for transparency
- **Files:** `server/services/BetSettlementService.ts`, `server/services/ScheduledJobs.ts`

### Phase 5: Polish & Extras (Steps 15-16)
> Later/Optional features

#### Step 15: Token Economy Enhancements
- [ ] Add daily login bonus (tokens)
- [ ] Add referral bonus system
- [ ] Add token tipping in chat
- [ ] Add token rewards for competition placement
- [ ] Token leaderboard (most earned, most wagered)
- **Files:** Various

#### Step 16: Advanced Features
- [ ] PvP challenges with token stakes (alternative to USD)
- [ ] Private arena rooms (token-gated entry)
- [ ] Trader badges/achievements
- [ ] Historical bet-behind stats per trader
- [ ] Social features: follow traders, notifications
- **Files:** Various

---

## 7. MVP vs Later Features

### MVP (Steps 1-14)
- Token wallet + purchase
- Basic chat in competitions
- WebSocket real-time updates
- Arena browse + spectator mode
- Bet-behind with parimutuel settlement

### Later/Optional (Step 15-16)
- Daily bonuses / referrals
- Token tipping
- Token-staked PvP
- Private rooms
- Achievements
- Social following

---

## 8. Risk Considerations

1. **Gambling Regulations**: Bet-behind may be regulated. Consider:
   - Geo-blocking high-risk jurisdictions
   - Clear "entertainment purposes" disclaimers
   - Token = non-refundable, no cash-out option

2. **Scalability**: WebSocket at scale needs:
   - Redis adapter for Socket.io clustering
   - Horizontal scaling strategy

3. **Fraud Prevention**: 
   - Rate limiting on bets
   - Minimum bet thresholds
   - Anti-collusion monitoring

4. **Moderation**: 
   - Profanity filter for chat
   - Admin tools for bans
   - Automated spam detection

---

## 9. Dependencies to Add

```json
{
  "socket.io": "^4.7.x",
  "socket.io-client": "^4.7.x",
  "@socket.io/redis-adapter": "^8.x.x" // for scaling later
}
```

---

**End of Plan**
