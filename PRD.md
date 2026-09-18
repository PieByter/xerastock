# PRD — IDX Trading Assistant
**Personal stock analysis dashboard + signal bot untuk saham Indonesia (IDX)**

| | |
|---|---|
| Owner | Pieter |
| Status | Draft v1 |
| Stack | Next.js (Vercel) · Supabase (Postgres + Auth + Cron) · Claude API |
| Data sources | idx-bei (scraper OHLCV/broker/foreign flow) · Index Alpha (broker summary API, opsional paid tier) |

---

## 1. Problem Statement

Trader retail Indonesia gak punya alat gratis/terjangkau yang gabungin: chart teknikal tanpa limit indikator, data broker summary/foreign flow (bandarmology), berita relevan per emiten, dan notifikasi otomatis saat kombinasi sinyal tertentu terpenuhi. Tools yang ada (TradingView, Stockbit) kena paywall di fitur-fitur ini secara terpisah-pisah.

## 2. Goals

- **G1** — Satu dashboard buat pantau saham watchlist: chart + indikator + broker flow dalam satu tempat.
- **G2** — Notifikasi proaktif (bukan pull, tapi push) saat kondisi teknikal/fundamental tertentu kejadian.
- **G3** — AI assistant (Claude) yang bisa dipanggil untuk analisis kontekstual per saham ("kenapa ES naik hari ini", "ringkas broker summary BBCA minggu ini").
- **G4** — Biaya operasional serendah mungkin (Vercel + Supabase free/hobby tier di awal).

### Non-goals (v1)
- Bukan platform eksekusi order (gak connect ke broker buat auto-buy/sell) — murni analisis & notifikasi.
- Bukan multi-user SaaS publik — v1 didesain single-user/personal use dulu.
- Bukan real-time tick-by-tick (cukup interval menit-an, gak perlu WebSocket exchange-grade).

## 3. User (Persona)

Trader/investor individu yang aktif pantau saham IDX harian-mingguan, familiar baca chart dan broker summary, mau automasi bagian repetitif (cek sinyal, cek berita) supaya gak harus screen-time manual tiap hari.

---

## 4. Feature Breakdown

### 4.1 Dashboard Utama
- Watchlist saham (tambah/hapus ticker) dengan ringkasan harga, %change, volume, net foreign flow hari ini.
- Sort/filter: top gainers/losers dari watchlist, top net foreign buy/sell.
- Quick status badge per saham: "🟢 signal aktif" kalau ada rule yang match hari ini.

### 4.2 Chart & Analisis Teknikal (per saham)
- Candlestick chart (Lightweight Charts) dengan multi-pane indikator: SMA/EMA, RSI, MACD, Bollinger Bands, Volume — tanpa limit jumlah indikator aktif sekaligus.
- Overlay marker: tanggal broker asing net buy besar, tanggal ada berita penting, tanggal cum-dividend.
- Timeframe switch: daily, weekly; intraday opsional fase 2 kalau data provider support.

### 4.3 Broker Summary & Foreign Flow
- Tabel broker teraktif per saham per hari (top buyer/seller broker code, volume, value).
- Grafik net foreign flow historis (cumulative line chart) — kelihatan tren akumulasi/distribusi asing.
- Highlight otomatis: "broker X net buy 3 hari berturut-turut" (pattern deteksi sederhana, bukan ML).

### 4.4 Kalender Dividen & Corporate Action
- List saham watchlist yang mendekati cum-date dividen/RUPS/stock split.
- Notifikasi H-3 dan H-1 sebelum cum-date.

### 4.5 News Feed (per saham & general market)
- Agregasi berita dari RSS/scraping sumber publik (Kontan, Bisnis, IDX announcement) di-filter berdasarkan ticker watchlist (keyword/NER matching nama emiten).
- Tiap berita di-summarize otomatis 1-2 kalimat pakai Claude API supaya gak perlu baca artikel penuh.
- Tag sentimen kasar (positif/netral/negatif) per berita, dihasilkan Claude, ditampilkan sebagai badge — bukan sinyal trading, murni konteks tambahan.

### 4.6 Signal Engine & Notifikasi
- User bikin rule kombinasi lewat UI (bukan hardcode), contoh: `RSI < 30 AND foreign_flow_5d > 0 AND volume > avg_20d * 1.5`.
- Rule dievaluasi tiap interval terjadwal (misal tiap 15-30 menit jam bursa buka, sekali di penutupan).
- Saat match → push notifikasi ke **Telegram Bot** (channel utama, paling murah & reliable) dengan ringkasan kondisi yang match + link ke dashboard.
- Riwayat sinyal tersimpan (log) supaya bisa dicek "seberapa sering rule ini match & gimana hasilnya" — dasar buat evaluasi rule di masa depan (bukan backtest otomatis di v1, manual review dulu).

### 4.7 Claude Bot — Analisis On-Demand
- Chat interface (bisa embed di dashboard, atau via Telegram bot command `/tanya <ticker> <pertanyaan>`).
- Claude API dikasih context: data OHLCV terbaru, broker summary ringkas, berita terkait — lewat tool calling/function calling ke Supabase, bukan Claude nebak dari training data.
- Contoh use case: "ringkas kenapa broker asing net sell BBRI minggu ini", "bandingkan RSI TLKM vs sektor telco", "apa ada berita negatif buat ANTM 3 hari terakhir".
- **Guardrail penting**: respons Claude harus eksplisit disclaimer "bukan rekomendasi beli/jual" — ini fitur analisis, bukan financial advisory.

---

## 5. Data Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  idx-bei scraper │────▶│                   │     │   Vercel     │
│  (Python, cron)  │     │  Supabase Postgres │◀───▶│  Next.js App │
└─────────────────┘     │  (data + auth +   │     └─────┬───────┘
┌─────────────────┐     │   cron jobs)       │           │
│  Index Alpha API │────▶│                   │           ▼
│  (broker summary  │     └──────────────────┘     ┌─────────────┐
│   fallback/paid)  │                               │ Claude API  │
└─────────────────┘                               │ (analysis + │
┌─────────────────┐                               │  bot)       │
│  News RSS scraper │──────────────────────────────▶└─────────────┘
└─────────────────┘              │
                                  ▼
                          ┌───────────────┐
                          │ Telegram Bot   │
                          │ (notifikasi)   │
                          └───────────────┘
```

**Kenapa dua sumber data broker summary (idx-bei + Index Alpha):**
- `idx-bei` (scraper, gratis) sebagai sumber utama — tapi fragile, bisa berubah/block sewaktu-waktu.
- Index Alpha (API resmi, free tier 5 req/hari) sebagai **fallback tervalidasi** kalau scraper gagal, atau buat cross-check akurasi data scraper. Upgrade ke paid tier kalau volume kebutuhan naik dan scraper kurang reliable.

**Kenapa scraper jalan terpisah dari Vercel:** Vercel serverless function ada execution time limit (10-60 detik tergantung plan) — scraping + parsing banyak ticker gak cocok jalan di situ. Scraper (Python) jalan sebagai **cron job terpisah** (GitHub Actions scheduled workflow — gratis, atau VPS kecil), nulis hasil ke Supabase Postgres. Next.js di Vercel cuma **baca** dari Supabase, gak scraping langsung.

---

## 6. Tech Stack Detail

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | Next.js (App Router) | sesuai requirement, deploy Vercel native |
| Chart | TradingView Lightweight Charts + community indicator lib | gratis, Apache 2.0, unlimited indikator (self-compute) |
| DB + Auth | Supabase (Postgres) | free tier cukup buat single-user, built-in cron (pg_cron) & realtime subscription |
| Scraper | Python (idx-bei base), dijadwalkan via GitHub Actions | gratis, terpisah dari Vercel function limit |
| Broker data fallback | Index Alpha API | data tervalidasi, dipakai selektif (hemat quota free tier) |
| Notifikasi | Telegram Bot API | gratis, gampang setup, reliable delivery |
| AI | Claude API (tool calling ke Supabase) | analisis kontekstual, summary berita, chat bot |
| Job queue (opsional fase 2) | Supabase Edge Functions + pg_cron, atau BullMQ+Redis kalau butuh lebih robust | evaluasi signal terjadwal |

---

## 7. Skema Data (Supabase) — Ringkas

```sql
-- watchlist
watchlist(id, user_id, ticker, added_at)

-- harga harian (dari scraper)
daily_price(ticker, date, open, high, low, close, volume, foreign_buy, foreign_sell)

-- broker summary harian
broker_summary(ticker, date, broker_code, buy_freq, buy_volume, buy_value, sell_freq, sell_volume, sell_value, investor_type)

-- berita
news(id, ticker, source, title, url, published_at, ai_summary, ai_sentiment)

-- corporate action / dividen
corporate_action(id, ticker, type, cum_date, ex_date, record_date, detail)

-- signal rule (user-defined)
signal_rule(id, user_id, ticker, name, conditions_json, is_active)

-- signal log (riwayat match)
signal_log(id, rule_id, ticker, matched_at, snapshot_json)
```

---

## 8. Roadmap / Fase

### Fase 1 — MVP (fokus: dashboard + chart + watchlist)
- Setup Supabase schema + Next.js skeleton di Vercel.
- Integrasi scraper `idx-bei` → populate `daily_price` harian via GitHub Actions cron.
- Dashboard watchlist + chart per saham (Lightweight Charts + indikator dasar: SMA, RSI, Volume).

### Fase 2 — Broker Summary & Foreign Flow
- Populate `broker_summary` dari scraper, tampilkan tabel & grafik net foreign flow.
- Setup Index Alpha API sebagai fallback/cross-check.

### Fase 3 — News & Kalender Dividen
- News scraper + Claude summary/sentiment pipeline.
- Corporate action calendar + notifikasi H-3/H-1.

### Fase 4 — Signal Engine & Notifikasi
- UI builder buat rule kombinasi sinyal, dengan field `strategy_type` (BSJP / BPJS / swing) yang nentuin jadwal evaluasi.
- Cron evaluator terpisah per strategy_type (pg_cron / Edge Function) — sesi sore untuk BSJP, sesi pagi untuk BPJS, EOD untuk swing.
- Push ke **Discord**, dipisah per channel sesuai `strategy_type` (`#sinyal-bsjp`, `#sinyal-bpjs`, `#sinyal-swing`) — pakai Discord embed buat notifikasi terstruktur (judul, warna badge sesuai jenis sinyal, field harga/volume/kondisi yang match).

### Fase 5 — Claude Bot Interaktif
- Chat interface (dashboard + Telegram command).
- Tool calling: Claude query Supabase langsung buat jawab pertanyaan kontekstual.

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Scraper IDX/Stockbit/RTI diblokir atau struktur berubah | Data berhenti update | Fallback ke Index Alpha API; monitoring alert kalau scraper gagal >1 hari |
| Legalitas scraping data broker | Potensi ToS violation | Review ToS tiap sumber; pertimbangkan full-paid API kalau mau dipakai serius/lebih dari personal use |
| Free tier Supabase/Vercel kena limit | App down/lambat | Monitor usage; siap upgrade tier kalau data historis makin banyak |
| Claude API cost membengkak (tiap chat/summary panggil API) | Biaya operasional naik | Cache summary berita (jangan re-summarize berita yang sama), batasi frekuensi chat bot per hari |
| Sinyal palsu / over-reliance ke bot untuk keputusan trading | Kerugian finansial user | Disclaimer eksplisit di tiap output AI; log historis sinyal buat evaluasi manual, bukan auto-execute |

---

## 10. Keputusan MVP (v1)

| Pertanyaan | Keputusan |
|---|---|
| Ukuran watchlist awal | Belum ditentukan jumlah pasti — mulai **kecil (5-10 ticker)** buat jaga beban scraping & quota API tetap ringan selama fase eksplorasi, expand belakangan setelah pipeline stabil |
| Interval evaluasi signal | **Real-time-ish, tiap 15 menit jam bursa buka**, karena dipakai buat 3 gaya trading: BSJP (beli sore jual pagi), BPJS/day trade (beli pagi jual sore), dan swing/hold — lihat §10.1 |
| Channel notifikasi | **Discord** — struktur multi-channel native (`#sinyal-bsjp`, `#sinyal-swing`, `#news`) lebih cocok buat pisahin notifikasi per strategy_type dari awal |
| Data provider berbayar (Index Alpha dll) | **Ditunda** — MVP jalan full pakai scraper gratis (`idx-bei`) dulu. Arsitektur disiapkan dari awal supaya provider berbayar tinggal "plug-in" nanti tanpa refactor besar — lihat §10.2 |

### 10.1 Signal per gaya trading

Interval 15-menit yang sama dipakai, tapi **rule dan window evaluasinya beda** tergantung gaya trading — ini perlu dibedakan di level data model (`signal_rule.strategy_type`), bukan cuma satu rule generik:

| Gaya | Kapan dievaluasi | Contoh kondisi sinyal | Kapan notifikasi paling berguna |
|---|---|---|---|
| **BSJP** (beli sore, jual pagi) | Sesi sore (~14:30–15:50 WIB, mendekati closing) | Volume spike + foreign net buy di 30 menit terakhir, candle bullish menutup dekat high | Notif sore, sebelum market close |
| **BPJS / day trade** (beli pagi, jual sore) | Sesi pagi (~09:00–10:30 WIB, buka gap-up/gap-down) | Gap up dengan volume awal tinggi, RSI belum overbought, momentum breakout dari resistance intraday | Notif pagi, segera setelah open |
| **Swing/hold** | End-of-day (sekali, setelah closing) | Kombinasi trend indikator (EMA cross, MACD) + broker asing akumulasi multi-hari + gak ada berita negatif | Notif EOD, buat rencana besok/minggu depan |

Konsekuensi teknis: cron evaluator butuh jadwal berbeda per strategy_type (bukan satu job generik tiap 15 menit sepanjang hari) — hemat compute & API call karena BSJP/BPJS cuma perlu jalan di window sesinya, swing cukup sekali sehari.

### 10.2 Notifier Abstraction — Discord sekarang, channel lain nanti tinggal nambah

Sama kayak provider data (§10.2 sebelumnya), notifier juga dibikin di belakang interface, biar nambah channel kedua (misal Telegram buat alert darurat, atau email buat digest mingguan) nanti gak perlu ubah signal engine:

```typescript
interface NotificationChannel {
  send(signal: SignalMatch): Promise<void>;
}

class DiscordNotifier implements NotificationChannel { ... }
// nanti: class TelegramNotifier implements NotificationChannel { ... }
```

Setup Discord bot: buat aplikasi di Discord Developer Portal, invite ke server pribadi kamu dengan permission `Send Messages` + `Embed Links`, simpan bot token di env var. Bikin 1 server pribadi dulu dengan 3 channel sesuai strategy_type + 1 channel `#news` — signal engine tinggal pilih channel ID sesuai `strategy_type` saat kirim embed.

### 10.3 Provider Abstraction — biar paid API "tinggal colok" nanti

Supaya keputusan "tunda provider berbayar" gak bikin refactor gede pas mau upgrade, desain data layer di belakang **satu interface**, bukan langsung hardcode ke scraper:

```typescript
// lib/data-providers/broker-summary.interface.ts
interface BrokerSummaryProvider {
  getBrokerSummary(ticker: string, date: string): Promise<BrokerSummaryData>;
  getForeignFlow(ticker: string, from: string, to: string): Promise<ForeignFlowData[]>;
}

// implementasi awal — scraper (gratis)
class ScraperBrokerProvider implements BrokerSummaryProvider { ... }

// implementasi nanti — tinggal aktifkan kalau upgrade
class IndexAlphaProvider implements BrokerSummaryProvider { ... }
```

Service layer (API routes, signal engine) manggil lewat interface ini, gak pernah tahu implementasi di baliknya. Nanti kalau mau upgrade ke Index Alpha (atau provider lain), tinggal ganti satu binding di config/env var (`BROKER_PROVIDER=scraper` → `BROKER_PROVIDER=indexalpha`), gak perlu sentuh kode dashboard/signal engine sama sekali.

### 10.4 Kontrol biaya Claude API (bukan Claude Code)

Perlu ditegaskan: kebutuhan API di PRD ini itu **Claude API (pay-per-call)**, beda dari subscription Claude Code yang dipakai buat ngoding. Gak perlu subs apapun buat mulai — cukup API key dengan billing pay-as-you-go, dan biayanya bisa dikontrol ketat:

- **Jangan** panggil Claude tiap evaluasi signal (itu logic deterministik biasa, gratis, gak butuh LLM).
- Panggil Claude **hanya** saat: (a) signal match dan mau generate ringkasan konteks buat notifikasi, (b) user eksplisit chat/tanya, (c) summarize berita baru — dan itu pun **cache** hasilnya (jangan re-summarize artikel yang sama dua kali).
- Set **budget alert** di Anthropic Console dari awal supaya gak kebablasan sebelum tau pola pemakaian real.