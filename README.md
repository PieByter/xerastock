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
- 🧾 **SignalLog & evaluasi strategi** — setiap sinyal diarsipkan bersama kondisi saat match (rule yang terpenuhi, RSI, rasio volume, hasil eksekusi). Halaman `/signals` merangkumnya jadi performa per gaya trading (match, eksekusi, win rate, total PnL) dan daftar rule paling sering match
- 🔍 **Analisis mendalam saham** (`/stock/[ticker]`) — broker summary multi-periode (top net buy/sell per kode broker, streak akumulasi, konsentrasi HHI), chart foreign flow (net harian + kumulatif), support/resistance otomatis, rentang 52 minggu, return 1M/3M/6M/1Y, serta volume & volatilitas
- 📁 **Halaman Portfolio** — nilai aset, P/L harian & total, alokasi sektor (donut), dan tabel kepemilikan dari posisi paper trading (fallback data contoh saat DB kosong)
- 🔀 **Halaman Broker Flow** — peringkat net foreign flow seluruh watchlist + broker summary multi-periode & chart akumulasi per saham
- 📈 **Halaman Technical Analysis** — ringkasan MA20/MA50, RSI, MACD, Bollinger, dan ATR seluruh saham dengan filter tren
- 📰 **News feed + ringkasan AI** — agregasi RSS otomatis (Kontan/CNBC/Bisnis atau feed sendiri via `NEWS_RSS_URLS`), ringkasan 1-2 kalimat & sentimen otomatis, plus kalender corporate action
- ✍️ **CRUD dari web** — tambah/hapus watchlist, mode bot, kill switch, dan risk params tersimpan ke database lewat server actions
- 🌊 **Net foreign flow** — kolom net asing di watchlist, daftar "Top Net Buy / Net Sell" di dashboard, dan agregat net asing per saham di halaman detail
- 🤖 **Bot Discord** — notifikasi real-time ke HP, 10 slash commands (`/watch`, `/price`, `/signal`, `/alert`, `/status`, `/start`, `/stop`, dll)
- 🔔 **Notifier multi-channel** — abstraksi `NotificationChannel` dengan routing per tipe notifikasi ke channel `#sinyal`, `#news`, `#admin`, atau default
- 🔁 **Provider data berlapis** — Yahoo Finance (default) dengan fallback otomatis ke Twelve Data bila `TWELVE_DATA_API_KEY` diisi
- 🚨 **Signal Engine** — rule-based teknikal + fundamental, anti-look-ahead, dedup sinyal
- 💰 **Paper Trading tersambung otomatis** — sinyal BUY membuka posisi (ukuran dari risk per posisi, dibulatkan per lot), sinyal SELL menutupnya, dan stop loss / take profit ditutup otomatis saat refresh quote & EOD. PnL realisasi, saldo, dan posisi tercatat ke database sehingga halaman Portfolio & Bot menampilkan angka nyata
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
npm run db:seed        # user owner + watchlist default + 3 strategi sinyal (BSJP/BPJS/SWING)

# 5. Jalankan web (http://localhost:3000)
npm run dev:web

# 6. Jalankan worker (bot + scheduler) — terminal terpisah
npm run dev:worker
```

> `db:seed` idempoten dan juga dijalankan otomatis saat worker start. Tanpa seed, tabel `Strategy` kosong sehingga evaluator sinyal tidak menghasilkan apa pun.

## Test Engine

```bash
npm run test --workspace @stock-analyst/engine
```

## Sinkronisasi Berita Manual

```bash
npm run news:sync     # tarik RSS → ringkas → simpan ke tabel News (dedup URL)
```

Scheduler worker juga menjalankannya otomatis tiap 30 menit pada hari kerja (06:00–21:00 WIB). Tanpa `ANTHROPIC_API_KEY`, ringkasan memakai fallback ekstraktif + sentimen berbasis kata kunci (tanpa biaya API).

## Commit Otomatis

`scripts/auto-commit.mjs` membaca perubahan di working tree, mengelompokkannya per tipe + scope Conventional Commits (`feat(web):`, `refactor(engine):`, …), lalu menyusun pesan commit beserta daftar berkasnya. Default-nya hanya menampilkan rencana (dry-run).

```bash
npm run commit:auto                 # lihat rencana commit
npm run commit:auto -- --apply      # buat commit-nya
npm run commit:auto -- --staged     # hanya berkas yang sudah di-stage
npm run commit:auto -- --json       # keluaran JSON untuk tooling lain
npm run commit:auto -- --co-author=copilot   # tambah trailer Co-authored-by
npm run commit:auto -- --ai         # subjek ditulis AI (butuh ANTHROPIC_API_KEY)
npm run commit:auto -- --staged --ai --apply # langsung commit dengan subjek AI
```

Di VS Code tersedia task siap-pakai (**Terminal → Run Task…**): *Git: generate commit otomatis (dry-run)*, *Git: buat commit otomatis (apply)*, *Git: generate commit otomatis (JSON)*, *Git: generate commit dengan AI (dry-run)*, dan *Git: buat commit dengan AI (apply)* — bisa dijadikan keybinding lewat `keybindings.json`.

### Mode `--ai`

Pengelompokan berkas tetap deterministik (dari aturan di bawah); AI **hanya** menulis teks subjeknya.

- Membaca `ANTHROPIC_API_KEY` (dan opsional `CLAUDE_MODEL`, `ANTHROPIC_BASE_URL`) dari environment atau `.env` root.
- Diff besar dipotong per grup (± 9.000 karakter konteks), jadi perubahan ribuan baris tetap aman — inilah alasan mode ini dipakai kalau tombol generate di Source Control VS Code menyerah pada diff besar.
- Subjek hasil AI divalidasi (harus Conventional Commits dengan tipe/scope yang sama, ≤ 72 karakter). Kalau tidak valid, API gagal, atau key tidak ada, subjek deterministik dipakai dan perintah tetap selesai tanpa error.
- Konvensi yang sama juga ditulis di `.github/copilot-instructions.md` supaya generator bawaan VS Code (bila aktif) menghasilkan format yang seragam.

### Kalau tombol generate commit di Source Control VS Code tidak berfungsi

Tombol ✨ di kotak pesan commit adalah fitur **ekstensi resmi GitHub Copilot Chat** (`github.copilot-chat`). Kalau ekstensi itu tidak terpasang/aktif, tombol tidak bisa bekerja — file `.md` tambahan **bukan** penyebabnya (`.github/copilot-instructions.md` hanya mengatur gaya keluaran). Yang bisa dicek:

1. Ekstensi `GitHub.copilot` + `GitHub.copilot-chat` terpasang dan sudah login.
2. `github.copilot.enable` tidak mematikan `scminput` (kunci language ID untuk kotak pesan commit).
3. Diff tidak terlalu besar — untuk kasus itu pakai `npm run commit:auto -- --ai`.

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
| **Fase 2** | Screener fundamental, broker summary & foreign flow, AI/ML sidecar, paper trading penuh | 🚧 Screener, portfolio, technical, broker flow, news + AI summary, paper trading tersambung, SignalLog selesai; ML sidecar & backtest UI menyusul |
| **Fase 3** | Auto buy/sell live + integrasi broker | ⏳ |

## Catatan Penting

- **Data**: Yahoo Finance gratis (`.JK`). Kualitas data IDX terbatas — verifikasi sebelum keputusan riil.
- **Dashboard**: membaca dari Postgres (`apps/web/src/lib/data.ts`). Tanpa `DATABASE_URL` atau saat tabel masih kosong, dashboard otomatis memakai data contoh (`apps/web/src/lib/mock.ts`) supaya tetap bisa dijalankan tanpa DB.
- **Provider data**: `MARKET_DATA_PROVIDER=yahoo` (default). Isi `TWELVE_DATA_API_KEY` untuk mengaktifkan Twelve Data sebagai provider utama atau fallback.
- **Broker summary & foreign flow**: dibaca dari tabel `broker_summaries` dan kolom `foreign_buy_value`/`foreign_sell_value` pada `price_bars` (lihat `apps/web/src/lib/brokerAnalysis.ts`). Halaman detail memakai jendela 90 hari terakhir; tanpa data di DB, tabel broker dan chart foreign flow memakai data contoh yang deterministik.
- **Sumber data broker**: `apps/worker/src/services/brokerData.ts` mendefinisikan `BrokerSummaryProvider` (`getBrokerSummary`/`getForeignFlow`). Set `BROKER_API_URL` (template dengan placeholder `{ticker}`, opsional `{date}`) untuk memakai endpoint JSON sendiri; kalau kosong, worker memakai provider `sample` deterministik. Baris hasil provider `http` disimpan dengan `source = "scraper"`, hasil fallback dengan `source = "sample"`, jadi data sintetis selalu bisa dibedakan.
- **Channel notifikasi**: atur `DISCORD_SIGNAL_CHANNEL_ID`, `DISCORD_NEWS_CHANNEL_ID`, dan `DISCORD_ADMIN_CHANNEL_ID`. Bila kosong, notifikasi jatuh ke `DISCORD_NOTIFY_CHANNEL_ID`.
- **Auto trade live**: butuh broker dengan API resmi. Paper trading dulu sampai ada broker terverifikasi.
- **Mengaktifkan paper trading**: buka **Settings → Mode Bot → PAPER**, lalu **Start Bot**. Mode global ini jadi master switch — ia juga menyinkronkan `mode` semua strategi. Eksekusi hanya jalan bila `killSwitch = false`, `mode = PAPER`, dan `status = RUNNING`; kalau salah satu tidak terpenuhi, sinyal tetap dibuat & dinotifikasi tapi tidak ada order.
- **Guardrail trading** (`apps/worker/src/services/tradeEngine.ts`): maksimum posisi terbuka, ukuran posisi = (saldo × risk per posisi) ÷ jarak stop loss dibulatkan ke bawah per lot, batas kerugian harian 2% memblokir entry baru, dan tidak ada averaging (satu posisi per saham per strategi). Nilai default ada di `DEFAULT_RISK_PARAMS` dan bisa diubah dari halaman Settings.
- **Stop loss / take profit** dipantau pada tiap refresh quote (jam bursa) dan di pipeline EOD; posisi yang kena akan ditutup otomatis dengan PnL tercatat plus notifikasi `TRADE_EXECUTED` ke Discord.
- **SignalLog**: `apps/worker/src/services/signalEngine.ts` menulis satu baris `SignalLog` per sinyal — berisi `reasons`, harga, snapshot indikator (RSI/MA/MACD/rasio volume), dan hasil eksekusi (`filled:buy`, `skipped:kill switch aktif`, dst.). Trade keluar mewarisi `signalId` dari trade masuk sehingga PnL realisasi bisa ditelusuri ke sinyal asalnya — itulah dasar angka win rate di halaman `/signals`. Catatan: menghapus baris `Signal` akan mengosongkan `Trade.signalId` (relasi `onDelete: SetNull`), jadi hindari pemangkasan sinyal kalau ingin riwayat hasil tetap utuh.
- **Berita & AI**: pipeline RSS menyimpan berita yang menyebut ticker watchlist atau isu pasar (IHSG/BEI) ke tabel `News`; berita watchlist otomatis diantre ke channel `#news`. `NEWS_RSS_URLS` (dipisah koma) menimpa feed default. Semua fitur AI tetap berjalan tanpa `ANTHROPIC_API_KEY` memakai fallback deterministik — key hanya diperlukan untuk ringkasan/jawaban model.
- **CRUD web**: aksi tulis (watchlist, mode bot, kill switch, risk params) memerlukan `DATABASE_URL`; tanpa itu UI menampilkan pesan mode demo dan tidak menyimpan apa pun. Mode `LIVE` sengaja ditolak sampai integrasi broker tersedia.
- **Risiko**: trading punya risiko finansial. Gunakan guardrail (risk per posisi 1%, daily loss limit 2%) dan jangan pernah trading dengan uang yang tidak siap hilang.