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

- 📊 **Dashboard UI** — watchlist, chart candlestick + indikator (MA/RSI/MACD/Bollinger), screener fundamental, sinyal, monitoring bot. Data dibaca langsung dari Postgres lewat server component, dan otomatis fallback ke data contoh bila DB belum dikonfigurasi
- 🔍 **Analisis mendalam saham** (`/stock/[ticker]`) — broker summary multi-periode (top net buy/sell per kode broker, streak akumulasi, konsentrasi HHI), chart foreign flow (net harian + kumulatif), support/resistance otomatis, rentang 52 minggu, return 1M/3M/6M/1Y, serta volume & volatilitas
- 🌊 **Net foreign flow** — kolom net asing di watchlist, daftar "Top Net Buy / Net Sell" di dashboard, dan agregat net asing per saham di halaman detail
- 🤖 **Bot Discord** — notifikasi real-time ke HP, 10 slash commands (`/watch`, `/price`, `/signal`, `/alert`, `/status`, `/start`, `/stop`, dll)
- 🔔 **Notifier multi-channel** — abstraksi `NotificationChannel` dengan routing per tipe notifikasi ke channel `#sinyal`, `#news`, `#admin`, atau default
- 🔁 **Provider data berlapis** — Yahoo Finance (default) dengan fallback otomatis ke Twelve Data bila `TWELVE_DATA_API_KEY` diisi
- 🚨 **Signal Engine** — rule-based teknikal + fundamental, anti-look-ahead, dedup sinyal
- 💰 **Paper Trading** — simulasi eksekusi next-bar dengan risk management (stop loss, take profit, daily loss limit)
- 🔌 **Broker-agnostic** — adapter pattern siap untuk integrasi broker live (Fase 3)
- 🧩 **Provider broker dapat ditukar** — `BrokerSummaryProvider` (PRD 10.3) dengan pilihan `BROKER_PROVIDER=auto|http|sample`; sinkronisasi otomatis tiap hari kerja 16:30 WIB

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

## Commit Otomatis

`scripts/auto-commit.mjs` membaca perubahan di working tree, mengelompokkannya per tipe + scope Conventional Commits (`feat(web):`, `refactor(engine):`, …), lalu menyusun pesan commit beserta daftar berkasnya. Default-nya hanya menampilkan rencana (dry-run).

```bash
npm run commit:auto                 # lihat rencana commit
npm run commit:auto -- --apply      # buat commit-nya
npm run commit:auto -- --staged     # hanya berkas yang sudah di-stage
npm run commit:auto -- --json       # keluaran JSON untuk tooling lain
npm run commit:auto -- --co-author=copilot   # tambah trailer Co-authored-by
```

Di VS Code tersedia task siap-pakai (**Terminal → Run Task…**): *Git: generate commit otomatis (dry-run)*, *Git: buat commit otomatis (apply)*, dan *Git: generate commit otomatis (JSON)* — bisa dijadikan keybinding lewat `keybindings.json`.

Cara penentuannya:

- **Scope** diambil otomatis dari daftar `workspaces` di `package.json` (`apps/web` → `web`, `packages/engine` → `engine`, …).
- **Tipe** ditentukan dari aturan bawaan (tes → `test`, markdown → `docs`, `.env.example` → `chore`, `prisma`/`sql` → `feat`, …), lalu dari status & isi diff: berkas baru atau yang menambah deklarasi/ekspor → `feat`, perubahan internal → `refactor`.
- **Tes** yang se-scope digabung ke commit `feat`/`refactor` pasangannya.
- **Berkas rahasia** (`.env` asli, `*.pem`, `*.key`, kredensial) otomatis dilewati dan dilaporkan.

Perilaku bisa disesuaikan lewat `.commitrc.json` di root:

```json
{
  "mergeTestsIntoFeature": true,
  "rules": [{ "match": "^docs/", "type": "docs", "scope": "docs" }],
  "overrides": { "packages/engine/src/stats.ts": "fix(engine)" }
}
```

`overrides` memaksa tipe (dan opsional scope) untuk berkas tertentu — berguna untuk perbaikan bug yang secara otomatis terbaca sebagai `refactor`.

## Roadmap

| Fase | Isi | Status |
|---|---|---|
| **Fase 1** | Data EOD, analisis teknikal, UI dashboard, Discord notifikasi | 🚧 Scaffold selesai |
| **Fase 2** | Screener fundamental, broker summary & foreign flow, AI/ML sidecar, paper trading penuh | 🚧 Broker summary & foreign flow selesai |
| **Fase 3** | Auto buy/sell live + integrasi broker | ⏳ |

## Catatan Penting

- **Data**: Yahoo Finance gratis (`.JK`). Kualitas data IDX terbatas — verifikasi sebelum keputusan riil.
- **Dashboard**: membaca dari Postgres (`apps/web/src/lib/data.ts`). Tanpa `DATABASE_URL` atau saat tabel masih kosong, dashboard otomatis memakai data contoh (`apps/web/src/lib/mock.ts`) supaya tetap bisa dijalankan tanpa DB.
- **Provider data**: `MARKET_DATA_PROVIDER=yahoo` (default). Isi `TWELVE_DATA_API_KEY` untuk mengaktifkan Twelve Data sebagai provider utama atau fallback.
- **Broker summary & foreign flow**: dibaca dari tabel `broker_summaries` dan kolom `foreign_buy_value`/`foreign_sell_value` pada `price_bars` (lihat `apps/web/src/lib/brokerAnalysis.ts`). Halaman detail memakai jendela 90 hari terakhir; tanpa data di DB, tabel broker dan chart foreign flow memakai data contoh yang deterministik.
- **Sumber data broker**: `apps/worker/src/services/brokerData.ts` mendefinisikan `BrokerSummaryProvider` (`getBrokerSummary`/`getForeignFlow`). Set `BROKER_API_URL` (template dengan placeholder `{ticker}`, opsional `{date}`) untuk memakai endpoint JSON sendiri; kalau kosong, worker memakai provider `sample` deterministik. Baris hasil provider `http` disimpan dengan `source = "scraper"`, hasil fallback dengan `source = "sample"`, jadi data sintetis selalu bisa dibedakan.
- **Channel notifikasi**: atur `DISCORD_SIGNAL_CHANNEL_ID`, `DISCORD_NEWS_CHANNEL_ID`, dan `DISCORD_ADMIN_CHANNEL_ID`. Bila kosong, notifikasi jatuh ke `DISCORD_NOTIFY_CHANNEL_ID`.
- **Auto trade live**: butuh broker dengan API resmi. Paper trading dulu sampai ada broker terverifikasi.
- **Risiko**: trading punya risiko finansial. Gunakan guardrail (risk per posisi 1%, daily loss limit 2%) dan jangan pernah trading dengan uang yang tidak siap hilang.