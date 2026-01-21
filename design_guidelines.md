# Bullfight Design Guidelines - Fire & Ash Theme

## Brand Identity
Bullfight is a competitive trading platform with a dark, aggressive aesthetic inspired by fire and ash. The design evokes power, intensity, and the heat of battle in financial markets. Think TradeLocker meets competitive gaming.

## Color Palette

### Primary Colors
- **Deep Black** `#0A0A0A` - Primary background, creates depth
- **Charcoal** `#121212` - Card backgrounds, panels
- **Dark Gray** `#1A1A1A` - Elevated surfaces, modals
- **Smoke** `#252525` - Borders, dividers
- **Ash** `#333333` - Tertiary surfaces

### Accent Colors
- **Fire Red** `#FF3B3B` - Primary accent, CTAs, branding
- **Ember** `#FF5252` - Hover states, highlights
- **Blood Red** `#CC0000` - Sell orders, destructive actions
- **Crimson** `#DC143C` - Important highlights

### Trading Colors
- **Profit Green** `#00C853` - Buy orders, gains, positive values
- **Loss Red** `#FF3B3B` - Sell orders, losses, negative values

### Text Colors
- **Pure White** `#FFFFFF` - Primary text, headings
- **Light Gray** `#B0B0B0` - Secondary text, labels
- **Muted Gray** `#666666` - Placeholder text, disabled states

## Typography
- **Headings**: Bold, sharp, uppercase for emphasis
- **Body**: Clean, readable sans-serif
- **Numbers**: Monospace for financial data alignment
- **Font Weights**: Regular (400), Medium (500), Bold (700)

## Component Styling

### Cards
- Background: Charcoal (#121212)
- Border: 1px solid Smoke (#252525)
- Border Radius: 8px (sharp, not overly rounded)
- No shadows - use border contrast

### Buttons
- Primary: Fire Red (#FF3B3B) background, white text
- Secondary: Transparent with Fire Red border
- Success/Buy: Profit Green (#00C853)
- Danger/Sell: Loss Red (#FF3B3B)
- Disabled: Smoke background, muted text

### Inputs
- Background: Deep Black (#0A0A0A)
- Border: Smoke (#252525)
- Focus Border: Fire Red (#FF3B3B)
- Text: White

### Trading Interface (TradeLocker Style)
- Order panel: Deep Black background with Charcoal cards
- Instrument list: Right sidebar with bid/ask prices
- Buy button: Profit Green with white text
- Sell button: Loss Red with white text
- Price displays: Monospace font, color-coded
- Positive P&L: Profit Green text
- Negative P&L: Loss Red text
- Selected instrument: Fire Red highlight

## Layout Principles
- Dense, information-rich layouts
- Sharp corners throughout (8px max radius)
- High contrast for readability
- Minimal whitespace - efficient use of space
- Clear visual hierarchy
- Dark terminal aesthetic

## Icons
- Use Feather icons
- Default color: Light Gray (#B0B0B0)
- Interactive: Fire Red on hover/active

## Animation
- Subtle transitions (150ms)
- Price tick animations (flash green/red)
- No excessive motion

## NO Blues Policy
- Absolutely no blue colors anywhere in the UI
- Replace all info/link blue with Fire Red or Light Gray
- Links use Fire Red instead of blue
