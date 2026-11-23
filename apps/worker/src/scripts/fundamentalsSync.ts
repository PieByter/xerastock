/**
 * Sinkronisasi manual fundamental + profil emiten.
 *
 *   npm run fundamentals:sync --workspace @stock-analyst/worker
 *
 * Sumber: Yahoo Finance (`quoteSummary`) — sama seperti provider harga default.
 */

import "dotenv/config";
import { prisma } from "@stock-analyst/db";
import { runFundamentalsSyncPipeline } from "../services/fundamentalsData";
import { logger } from "../logger";

async function main() {
    await prisma.$connect();
    const stocks = await prisma.stock.findMany({ where: { isActive: true } });
    const results = await runFundamentalsSyncPipeline(prisma, stocks);
    for (const result of results) {
        logger.info(result, "fundamental");
    }
    logger.info(
        { total: results.length, saved: results.filter((r) => r.saved).length },
        "sinkronisasi fundamental manual selesai",
    );
}

main()
    .catch((err) => {
        logger.error({ err }, "sinkronisasi fundamental manual gagal");
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
