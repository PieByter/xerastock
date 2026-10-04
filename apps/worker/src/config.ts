import { z } from "zod";

/** Validasi env worker (t3-env style). */
const envSchema = z.object({
    DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/stock_analyst"),
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_GUILD_ID: z.string().optional(),
    DISCORD_NOTIFY_CHANNEL_ID: z.string().optional(),
    DISCORD_SIGNAL_CHANNEL_ID: z.string().optional(),
    DISCORD_NEWS_CHANNEL_ID: z.string().optional(),
    DISCORD_ADMIN_CHANNEL_ID: z.string().optional(),
    DISCORD_OWNER_ID: z.string().optional(),
    DISCORD_CHANNEL_BSJP_ID: z.string().optional(),
    DISCORD_CHANNEL_BPJS_ID: z.string().optional(),
    DISCORD_CHANNEL_SWING_ID: z.string().optional(),
    DISCORD_CHANNEL_NEWS_ID: z.string().optional(),
    DISCORD_WEBHOOK_BSJP: z.string().optional(),
    DISCORD_WEBHOOK_BPJS: z.string().optional(),
    DISCORD_WEBHOOK_SWING: z.string().optional(),
    DISCORD_WEBHOOK_NEWS: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),
    REDIS_URL: z.string().optional(),
    BOT_MODE: z.enum(["SIGNAL_ONLY", "PAPER", "LIVE"]).default("SIGNAL_ONLY"),
    BOT_TIMEZONE: z.string().default("Asia/Jakarta"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    // Provider data pasar (PRD 10.3) — Twelve Data hanya aktif bila API key diisi.
    MARKET_DATA_PROVIDER: z.enum(["yahoo", "twelvedata"]).default("yahoo"),
    TWELVE_DATA_API_KEY: z.string().optional(),
    // Broker summary & foreign flow (PRD 10.3) — provider ditukar lewat env.
    BROKER_PROVIDER: z.enum(["auto", "http", "sample"]).default("auto"),
    BROKER_API_URL: z
        .string()
        .refine((value) => /^https?:\/\/\S+$/i.test(value) && value.includes("{ticker}"), {
            message: "BROKER_API_URL harus URL http(s) dan memuat placeholder {ticker}",
        })
        .optional(),
    BROKER_API_KEY: z.string().optional(),
    BROKER_SYNC_DAYS: z.coerce.number().int().min(1).max(60).default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Env worker tidak valid:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;