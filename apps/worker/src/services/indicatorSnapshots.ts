/**
 * Snapshot indikator harian (FR-TA-004) — menyimpan nilai indikator terakhir
 * per saham per hari kerja ke tabel `IndicatorSnapshot` supaya konsumen
 * (screener/teknikal) tidak perlu menghitung ulang seluruh riwayat.
 */

import type { PrismaClient } from "@stock-analyst/db";
import { buildIndicatorSnapshot, type Candle } from "@stock-analyst/engine";
import { logger } from "../logger";

/** Stempel tanggal diskalakan ke tengah malam UTC (idempoten per hari bursa). */
function toTradingDate(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Upsert snapshot indikator (timeframe 1D). false bila bar belum cukup. */
export async function saveIndicatorSnapshot(
    prisma: PrismaClient,
    stockId: string,
    ticker: string,
    candles: Candle[],
    asOf = new Date(),
): Promise<boolean> {
    const snapshot = buildIndicatorSnapshot(candles);
    if (!snapshot) {
        logger.debug({ ticker }, "snapshot indikator dilewati — bar belum cukup");
        return false;
    }

    const date = toTradingDate(asOf);
    const indicatorsJson = JSON.parse(JSON.stringify(snapshot));
    await prisma.indicatorSnapshot.upsert({
        where: { stockId_date_timeframe: { stockId, date, timeframe: "1D" } },
        update: { indicatorsJson },
        create: { stockId, date, timeframe: "1D", indicatorsJson },
    });
    logger.debug({ ticker, date: date.toISOString().slice(0, 10) }, "snapshot indikator disimpan");
    return true;
}
