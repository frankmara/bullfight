# Bullfight Trading Competition Platform - Design Guidelines

## Brand Identity

**Purpose**: A high-stakes trading tournament platform where users compete in paper-trading competitions for real prize pools. Think competitive gaming meets financial markets.

**Aesthetic Direction**: **Bold/Striking with Gamified Arena Feel**
- Dark theme (finance terminal meets esports arena)
- High contrast for critical data visibility
- Sharp, precise UI elements conveying professionalism and competition
- Data-dense yet organized (trading terminal aesthetic)
- Real-time updates create urgency and excitement

**Memorable Element**: The live leaderboard that updates with every trade, showing dramatic rank changes in real-time, creating a spectator-sport experience around trading.

---

## Navigation Architecture

**Root Navigation**: Persistent top navigation bar (not tab-based)

**Public Pages** (no auth required):
- `/` - Landing page
- `/competitions/[id]` - Competition details

**Authenticated Pages**:
- `/dashboard` - User hub
- `/arena/[competitionId]` - Live trading interface

**Admin Pages** (RBAC protected):
- `/admin` - Admin dashboard
- `/admin/competitions` - Manage all competitions
- `/admin/competitions/new` - Create competition
- `/admin/competitions/[id]` - Competition management

---

## Screen-by-Screen Specifications

### 1. Landing Page (`/`)
**Purpose**: Showcase active competitions and drive conversions

**Layout**:
- Fixed top nav: Logo left, "Login" + "Sign Up" buttons right
- Hero section: Bold headline + subheadline + primary CTA ("Browse Competitions")
- Competition grid: Cards showing active tournaments

**Competition Card Components**:
- Competition title + theme badge
- Buy-in amount (large, prominent)
- Live prize pool (animated counter)
- Participants count / cap (e.g., "247/1000")
- Countdown timer (for start or end)
- Status badge (OPEN, RUNNING, ENDED)
- "View Details" or "Join Now" CTA

**Empty State**: "No active competitions - check back soon!" with illustration

---

### 2. Competition Detail (`/competitions/[id]`)
**Purpose**: Show rules, prize structure, and entry point

**Layout**:
- Header: Competition title + status
- Left column (2/3 width):
  - Prize Pool (large, live-updating)
  - Prize Distribution table (1st, 2nd, 3rd places with $ amounts)
  - Allowed instruments list
  - Execution rules (spread markup, slippage, rate limits)
  - Start/End times
- Right column (1/3 width):
  - Entry card: Buy-in, "Join Competition" button, participants count
  - Current leaderboard preview (top 5)

---

### 3. User Dashboard (`/dashboard`)
**Purpose**: User activity hub

**Layout**:
- Top nav: Logo, "Dashboard", "Logout"
- Stats cards row: Total Spent, Total Won, Active Competitions
- Tabs: "Active Competitions" | "Past Competitions"
- Active: List of joined competitions with quick "Enter Arena" links
- Past: Table with competition name, placement, prize won

---

### 4. Trading Arena (`/arena/[competitionId]`)
**Purpose**: Live trading interface - the core product experience

**Layout** (dense, terminal-style):
- Top bar: Competition name, timer, your rank badge, equity display
- Left panel (60%):
  - Candlestick chart with live price line
  - Entry/exit markers on chart
- Right panel (40%):
  - Order Ticket (top):
    - Pair selector dropdown
    - Side toggle (BUY/SELL with color coding)
    - Order type tabs (Market, Limit, Stop)
    - Quantity input
    - Limit/Stop price fields (conditional)
    - SL/TP toggles + inputs
    - Trailing stop checkbox + pips input
    - Submit button (large, color-coded)
  - Positions Table (middle):
    - Columns: Pair, Side, Qty, Entry, Current, P&L, Actions
    - Actions: Modify SL/TP, Close
  - Pending Orders Table (below):
    - Columns: Pair, Side, Type, Qty, Price, Actions
    - Actions: Edit, Cancel
- Bottom/Side Panel: Live Leaderboard
  - Your rank highlighted
  - Top 20 displayed
  - Columns: Rank, Name, Equity, Return %, Trades
  - Search/filter input

**Real-time Updates**:
- Price ticker updates on every quote
- Chart line moves live
- Leaderboard re-sorts on equity changes
- Position P&L recalculates continuously

---

### 5. Admin Dashboard (`/admin/competitions`)
**Purpose**: Manage all competitions

**Layout**:
- Admin nav: "Competitions", "Users", "Payouts"
- Action button: "Create New Competition"
- Competition table: Title, Status, Entries, Prize Pool, Actions (Edit, Start, End, Payouts)

---

### 6. Create Competition (`/admin/competitions/new`)
**Purpose**: Configure new tournament

**Layout**: Multi-section form
- Basic Info: Title, Description, Theme
- Financial: Buy-in, Entry cap, Rake %
- Schedule: Start date/time, End date/time
- Trading Rules: Starting balance, Allowed pairs (multi-select), Spread markup, Slippage, Order interval
- Prize Splits: Dynamic input (rank 1, 2, 3... with % fields, must sum to 100%)
- Submit button

---

## Color Palette

**Dark Theme Foundation**:
- Background: `#0A0E14` (deep dark blue-black)
- Surface: `#151B23` (elevated panels)
- Surface Hover: `#1C242E`
- Border: `#2D3748` (subtle dividers)

**Primary (Competition/Arena)**:
- Electric Blue: `#00D4FF` (primary actions, highlights)
- Electric Blue Hover: `#00B8E6`

**Semantic Colors**:
- Success/Buy: `#10B981` (green)
- Danger/Sell: `#EF4444` (red)
- Warning: `#F59E0B` (amber)
- Info: `#3B82F6` (blue)

**Text**:
- Primary: `#F9FAFB` (near white)
- Secondary: `#9CA3AF` (gray)
- Muted: `#6B7280` (darker gray)

**Accent (Live Updates)**:
- Gold: `#FBBF24` (prize pool, rank up animations)
- Purple: `#A78BFA` (premium features)

---

## Typography

**Font Family**: 
- Headers: `"Space Grotesk"` (bold, modern, technical)
- Body/Data: `"Inter"` (legible, professional)
- Monospace (prices/numbers): `"JetBrains Mono"`

**Type Scale**:
- H1 (Hero): 48px / Bold
- H2 (Section): 32px / Bold
- H3 (Card Title): 24px / Semibold
- Body: 16px / Regular
- Small: 14px / Regular
- Tiny (labels): 12px / Medium
- Monospace Data: 16px / Medium (for prices, P&L)

---

## Visual Design

**Trading Terminal Aesthetic**:
- Dense information display (data-first)
- Sharp corners (not rounded) for professional feel
- Subtle grid lines on charts
- High-contrast text on dark backgrounds
- Blinking/pulsing indicators for live updates (use sparingly)

**Interactive Elements**:
- Buttons: Solid fills with subtle border, hover state brightens
- Inputs: Dark surface with border, focus state shows primary color border
- Cards: Elevated surface with subtle border
- Dropdowns: Dark with border, options on hover show surface-hover color

**Live Data Indicators**:
- Positive P&L: Green text with ↑ arrow
- Negative P&L: Red text with ↓ arrow
- Price changes: Flash animation (green for up-tick, red for down-tick)
- Leaderboard rank changes: Smooth re-ordering animation

**Shadows**: Minimal usage
- Modals/Popovers: `0 20px 60px rgba(0, 0, 0, 0.4)`
- Floating panels: `0 4px 12px rgba(0, 0, 0, 0.3)`

---

## Assets to Generate

| Filename | Description | Where Used |
|----------|-------------|------------|
| `logo.png` | "Bullfight" logotype - bold, aggressive bull icon + wordmark, electric blue on transparent | Top nav, landing hero |
| `hero-illustration.png` | Abstract trading chart with upward trajectory + bull silhouette, electric blue gradient | Landing page hero section |
| `empty-competitions.png` | Bull sleeping in arena, minimal/playful, muted colors | Landing when no active competitions |
| `empty-dashboard.png` | Empty trophy case or podium, subtle/encouraging | Dashboard when user has no competitions |
| `empty-leaderboard.png` | Single person on podium waiting, minimalist | Arena when leaderboard is loading |
| `trophy-gold.png` | 3D gold trophy icon | 1st place indicator |
| `trophy-silver.png` | 3D silver trophy icon | 2nd place indicator |
| `trophy-bronze.png` | 3D bronze trophy icon | 3rd place indicator |

**Icon Set**: Use Heroicons (outline for navigation, solid for actions) - no custom icons needed beyond trophies.