/** CLI sinkronisasi berita manual: `npm run news:sync`. */

import "dotenv/config";
import { prisma } from "@stock-analyst/db";
import { syncNewsToDb } from "../services/newsData";
import { logger } from "../logger";

async function main() {
    await prisma.$connect();
    const result = await syncNewsToDb(prisma);
    logger.info(result, "sinkronisasi berita manual selesai");
    await prisma.$disconnect();
}

main().catch((err) => {
    logger.error({ err }, "sinkronisasi berita gagal");
    process.exit(1);
});
