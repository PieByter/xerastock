---
name: Terminal IDX Pro
colors:
  surface: '#0b141c'
  surface-dim: '#0b141c'
  surface-bright: '#313a43'
  surface-container-lowest: '#060f16'
  surface-container-low: '#141c24'
  surface-container: '#182028'
  surface-container-high: '#222b33'
  surface-container-highest: '#2d363e'
  on-surface: '#dae3ee'
  on-surface-variant: '#c1c6d6'
  inverse-surface: '#dae3ee'
  inverse-on-surface: '#29313a'
  outline: '#8b909f'
  outline-variant: '#414754'
  surface-tint: '#acc7ff'
  primary: '#acc7ff'
  on-primary: '#002f68'
  primary-container: '#498fff'
  on-primary-container: '#00285b'
  inverse-primary: '#005bbf'
  secondary: '#5de6ff'
  on-secondary: '#00363e'
  secondary-container: '#00cbe6'
  on-secondary-container: '#00515d'
  tertiary: '#4ae176'
  on-tertiary: '#003915'
  tertiary-container: '#00a74b'
  on-tertiary-container: '#003111'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#acc7ff'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#004492'
  secondary-fixed: '#a2eeff'
  secondary-fixed-dim: '#2fd9f4'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#004e5a'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#0b141c'
  on-background: '#dae3ee'
  surface-variant: '#2d363e'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-mono-xl:
    fontFamily: JetBrains Mono
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  data-mono-xl-mobile:
    fontFamily: JetBrains Mono
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  data-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  data-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  data-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a high-performance, institutional-grade analytical terminal tailored specifically for active participants in the Indonesian Stock Exchange (IDX / Bursa Efek Indonesia). The core personality is precise, authoritative, fast, and uncompromisingly data-focused. It eliminates decorative distraction in favor of extreme cognitive clarity, low eye strain during prolonged sessions, and sub-second data scannability.

The visual direction merges **Minimalism** with **Modern Data Terminal** aesthetics:
- **Tonal Layering & Crisp Precision:** Deep charcoal architectural layers define hierarchy without harsh contrast.
- **Color-Coded Semantic Anchors:** Standardized IDX market signifiers—green for upward momentum and Net Foreign Buy (NFB), red for corrections and Net Foreign Sell (NFS), and distinct cyan/amber/blue markers for Indonesian trading modalities (BSJP, BPJS/Day Trade, Swing).
- **Tabular Rigor:** Strict monospaced alignment across numeric matrices ensures that figures, lots, transaction volumes, and valuations never shift or jitter under real-time WebSocket updates.

## Colors

The palette uses dark mode as its standard operating environment, built on strict functional roles. 

### Foundation Surfaces
- **Canvas / Base Background:** `#0D1117` (Deep Charcoal workspace foundation)
- **Surface / Containers & Cards:** `#161B22` (Panel baseline)
- **Elevated Surfaces / Modals & Dropdowns:** `#1C2128` (Overlay elevation)
- **Borders & Dividers:** `#21262D` (Structural separator)

### Brand & Interactive Accents
- **Primary Accent:** `#2F81F7` (Interactive CTA, focus rings, primary navigation)
- **Active / Accent Variant:** `#22D3EE` (Active tab highlights, metric callouts, selected state markers)

### Market Semantics
- **Gain / Net Foreign Buy (NFB):** `#22C55E` (Bullish signals, positive P/L, bid dominance)
- **Loss / Net Foreign Sell (NFS):** `#EF4444` (Bearish signals, negative P/L, ask dominance)
- **Warning / Stagnant:** `#F59E0B` (Unchanged prices, alerts, pending executions)

### Typography & Iconography Hierarchy
- **Text Primary:** `#E6EDF3` (Primary labels, ticker symbols, headline metrics)
- **Text Secondary:** `#8B949E` (Metadata, lot sizes, secondary market labels)
- **Text Disabled:** `#545D68` (Inactive fields, closed market states)

## Typography

The type system is bifurcated:
1. **Interface Neutral (Inter):** Applied across global controls, titles, tooltips, and narrative readouts.
2. **Numeric Engine (JetBrains Mono):** Mandated for all Indonesian Rupiah values (`Rp X.XXX.XXX`), 4-character IDX stock tickers (`BBCA`, `TLKM`, `GOTO`), lot volumes, P/L percentages, bid/ask depth prices, and broker codes (`YP`, `CC`, `AK`). Tabular lining numerals eliminate visual drift during streaming price refreshes.

Always format currency values using the Indonesian locale convention with dot separators (`Rp 1.450.000`), never commas. Percentage changes must explicitly present sign prefixes (`+2.45%`, `-1.20%`).

## Layout & Spacing

The terminal uses a 12-column adaptive grid designed for high information density:
- **Desktop (1280px+):** 12-column layout with 20px (`1.25rem`) gutters and 32px (`2rem`) outer margin. Data panels are tiled to permit concurrent orderbook, chart, and portfolio analysis without vertical scrolling.
- **Tablet (768px - 1279px):** 8-column layout with 16px (`1rem`) gutters and 24px outer margin. Auxiliary panels collapse into tabbed panes.
- **Mobile (< 768px):** 4-column layout with 12px gutters and 16px (`1rem`) canvas margins. Primary tabs switch between Portfolio, Watchlist, Orderbook, and Trade History.

Component spacing adheres strictly to 4px multiples. Dense tables employ `space-xs` (4px) vertical cell padding and `space-md` (12px) horizontal cell padding to maximize row exposure per viewport.

## Elevation & Depth

Visual hierarchy is created through layered tonal elevation paired with low-contrast structural borders rather than blur-heavy drop shadows:

- **Level 0 (Canvas Base):** Solid `#0D1117`. Flat workspace floor.
- **Level 1 (Card / Grid Container):** Solid `#161B22` bounded by a 1px border of `#21262D`. No shadow.
- **Level 2 (Active Item / Hover Focus):** Background shifts to `#1C2128` with an active 1px border of `#2F81F7` (or `#22D3EE` when selected).
- **Level 3 (Modals, Overlays, Command Palette):** Background `#1C2128`, border 1px `#30363D`, supported by an ambient directional shadow: `0 16px 32px -8px rgba(0, 0, 0, 0.65)`.
- **Discord-Style Embed Cards:** 1px `#21262D` enclosure on top, right, and bottom, with a high-emphasis 4px solid left accent border corresponding to the signal condition (Green for Buy signal, Amber for Alert/Execution, Red for Stop Loss triggered).

## Shapes

The interface balances sharp analytical clarity with a modern fintech look through a consistent 10px to 14px curvature hierarchy:

- **Base Components (Inputs, Buttons, Cards, Modals):** `10px` to `12px` border radius (`rounded-lg` / `rounded-xl`).
- **Strategy Badges & Indicator Tags:** Continuous pill shape (`rounded-full` / `9999px`) to immediately visually differentiate tags from structural containers.
- **Status Dots & Sentiment Indicators:** Strict circles (`rounded-full`, 6px × 6px).

## Components

### Buttons
- **Primary:** Background `#2F81F7`, text `#FFFFFF`, radius 10px, padding 8px 16px. Hover: brightness 1.1; Active: `#22D3EE` background with `#0D1117` text.
- **Secondary / Action Ghost:** Background transparent, border 1px solid `#21262D`, text `#E6EDF3`. Hover: background `#1C2128`, border `#30363D`.
- **Danger:** Background `rgba(239, 68, 68, 0.12)`, border 1px solid `rgba(239, 68, 68, 0.3)`, text `#EF4444`.

### Strategy-Type Pill Badges
- **BSJP (Beli Sore Jual Pagi):** Background `rgba(34, 211, 238, 0.15)`, text `#22D3EE`, border 1px solid `rgba(34, 211, 238, 0.30)`. Font: `label-sm`.
- **BPJS / Day Trade:** Background `rgba(245, 158, 11, 0.15)`, text `#F59E0B`, border 1px solid `rgba(245, 158, 11, 0.30)`. Font: `label-sm`.
- **Swing / Hold:** Background `rgba(47, 129, 247, 0.15)`, text `#58A6FF`, border 1px solid `rgba(47, 129, 247, 0.30)`. Font: `label-sm`.

### Sentiment Indicators
- Fixed 6px × 6px circular dot placed adjacent to ticker symbols:
  - **Bullish / Strong NFB:** `#22C55E` with subtle glow (`box-shadow: 0 0 6px rgba(34, 197, 94, 0.5)`).
  - **Neutral / Watch:** `#F59E0B`.
  - **Bearish / Strong NFS:** `#EF4444` with subtle glow (`box-shadow: 0 0 6px rgba(239, 68, 68, 0.5)`).

### Dense Analytical Data Tables
- **Container:** Background `#161B22`, border 1px solid `#21262D`, radius 12px.
- **Headers:** Sticky positioning, background `#161B22`, border-bottom 1px solid `#21262D`, text `#8B949E`, font `label-md`, padding 8px 12px.
- **Rows:** Alternating transparent and subtle `#1C2128` on hover. Padding 6px 12px. All numbers right-aligned using `data-mono-md`.

### Signal & Alert Preview Cards (Embed Pattern)
- Background `#161B22`, 1px border `#21262D`, left border 4px solid:
  - Green (`#22C55E`) for Foreign Accumulation or Take Profit triggers.
  - Cyan (`#22D3EE`) for BSJP algorithmic screen hits.
  - Red (`#EF4444`) for Stop-loss or Margin alarms.
- Header row combines Ticker badge, Strategy badge, timestamp in `data-mono-sm` (`#8B949E`), and current price (`Rp X.XXX`).

### Inputs & Selectors
- Background `#0D1117`, border 1px solid `#21262D`, radius 10px, text `#E6EDF3`, font `body-md`. Focus ring: 1px solid `#22D3EE` with no outer spread.