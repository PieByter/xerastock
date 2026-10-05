/** CLI seed: `npm run db:seed` (dijalankan dari root monorepo). */

import "dotenv/config";
import { prisma } from "@stock-analyst/db";
import { ensureSeedData } from "../services/seed";
import { logger } from "../logger";

async function main() {
    await prisma.$connect();
    await ensureSeedData(prisma);
    logger.info("seed selesai");
    await prisma.$disconnect();
}

main().catch((err) => {
    logger.error({ err }, "seed gagal");
    process.exit(1);
});
