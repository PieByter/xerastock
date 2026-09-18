import { z } from "zod";

/** Validasi env worker (t3-env style). */
const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    DISCORD_BOT_TOKEN: z.string().min(1),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_GUILD_ID: z.string().optional(),
    DISCORD_NOTIFY_CHANNEL_ID: z.string().optional(),
    DISCORD_ADMIN_CHANNEL_ID: z.string().optional(),
    DISCORD_OWNER_ID: z.string().optional(),
    REDIS_URL: z.string().optional(),
    BOT_MODE: z.enum(["SIGNAL_ONLY", "PAPER", "LIVE"]).default("SIGNAL_ONLY"),
    BOT_TIMEZONE: z.string().default("Asia/Jakarta"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Env worker tidak valid:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;