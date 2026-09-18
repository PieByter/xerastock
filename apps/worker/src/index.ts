/**
 * Worker entry point — menjalankan Discord bot + scheduler.
 * Proses selalu-aktif (VPS / Fly.io / Railway / PC rumahan).
 */

import "dotenv/config";
import { prisma } from "@stock-analyst/db";
import { startBot } from "./bot/client";
import { startScheduler } from "./scheduler";
import { logger } from "./logger";

async function main() {
    logger.info("🚀 Stock Analyst worker dimulai");

    // Verifikasi koneksi DB
    await prisma.$connect();
    logger.info("koneksi database OK");

    // Pastikan BotConfig ada
    const config = await prisma.botConfig.findFirst();
    if (!config) {
        await prisma.botConfig.create({
            data: {
                mode: process.env.BOT_MODE ?? "SIGNAL_ONLY",
                status: "RUNNING",
            },
        });
        logger.info("BotConfig default dibuat");
    }

    // Mulai scheduler (selalu jalan, terlepas dari status bot)
    startScheduler();

    // Mulai Discord bot
    await startBot();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
        logger.info({ signal }, "shutdown diterima");
        await prisma.$disconnect();
        process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
    logger.error({ err }, "worker gagal start");
    process.exit(1);
});