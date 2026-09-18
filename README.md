# Stock Analyst

Platform analisis saham Indonesia (IDX/BEI) + Bot Discord + Auto Trading (fase lanjutan).

> 📄 Spesifikasi lengkap: [docs/PRD.md](docs/PRD.md)

## Struktur Monorepo

```
stock-analyst/
├── apps/
│   ├── web/          # Next.js UI dashboard (Vercel)
│   └── worker/       # Discord bot + scheduler + trade engine (proses selalu-aktif)
├── packages/
│   ├── shared/       # Tipe domain & konstanta bersama
│   ├── db/           # Prisma schema + client (PostgreSQL/Supabase)
│   └── engine/       # Indikator teknikal, rules sinyal, backtest (fungsi murni)
├── docs/PRD.md       # Product Requirements Document
└── docker-compose.yml # Postgres + Redis untuk dev lokal
```

## Fitur

- 📊 **Dashboard UI** — watchlist, chart candlestick + indikator (MA/RSI/MACD/Bollinger), screener fundamental, sinyal, monitoring bot
- 🤖 **Bot Discord** — notifikasi real-time ke HP, 10 slash commands (`/watch`, `/price`, `/signal`, `/alert`, `/status`, `/start`, `/stop`, dll)
- 🚨 **Signal Engine** — rule-based teknikal + fundamental, anti-look-ahead, dedup sinyal
- 💰 **Paper Trading** — simulasi eksekusi next-bar dengan risk management (stop loss, take profit, daily loss limit)
- 🔌 **Broker-agnostic** — adapter pattern siap untuk integrasi broker live (Fase 3)

## Prasyarat

- Node.js ≥ 20
- Docker (untuk Postgres + Redis lokal)
- Discord Bot Token (buat di [Discord Developer Portal](https://discord.com/developers/applications))

## Setup Lokal

```bash
# 1. Install dependencies (workspaces)
npm install

# 2. Jalankan Postgres + Redis
docker compose up -d

# 3. Setup env
cp .env.example .env
# isi DATABASE_URL, DISCORD_BOT_TOKEN, dll

# 4. Setup database (Prisma)
npm run db:generate
npm run db:push

# 5. Jalankan web (http://localhost:3000)
npm run dev:web

# 6. Jalankan worker (bot + scheduler) — terminal terpisah
npm run dev:worker
```

## Test Engine

```bash
npm run test --workspace @stock-analyst/engine
```

## Roadmap

| Fase | Isi | Status |
|---|---|---|
| **Fase 1** | Data EOD, analisis teknikal, UI dashboard, Discord notifikasi | 🚧 Scaffold selesai |
| **Fase 2** | Screener fundamental, AI/ML sidecar, paper trading penuh | ⏳ |
| **Fase 3** | Auto buy/sell live + integrasi broker | ⏳ |

## Catatan Penting

- **Data**: Yahoo Finance gratis (`.JK`). Kualitas data IDX terbatas — verifikasi sebelum keputusan riil.
- **Auto trade live**: butuh broker dengan API resmi. Paper trading dulu sampai ada broker terverifikasi.
- **Risiko**: trading punya risiko finansial. Gunakan guardrail (risk per posisi 1%, daily loss limit 2%) dan jangan pernah trading dengan uang yang tidak siap hilang.