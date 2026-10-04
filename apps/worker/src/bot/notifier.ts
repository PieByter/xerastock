/**
 * Notifier — kirim notifikasi keluar via channel abstraction (PRD 10.2).
 * Mengonsumsi AlertEvent dari outbox (status QUEUED → SENT/FAILED).
 */

import type { PrismaClient } from "@stock-analyst/db";
import type { NotificationPayload } from "@stock-analyst/shared";
import { resolveChannel } from "./channels";
import { logger } from "../logger";

/** Kirim satu notifikasi ke channel yang sesuai dengan tipe payload. */
export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
    const channel = resolveChannel(payload);
    if (!channel) {
        logger.warn({ type: payload.type }, "channel notifikasi belum dikonfigurasi");
        return false;
    }
    return channel.send(payload);
}

/** Proses outbox: kirim semua AlertEvent yang masih QUEUED. */
export async function processOutbox(prisma: PrismaClient): Promise<number> {
    const pending = await prisma.alertEvent.findMany({
        where: { status: "QUEUED" },
        take: 50,
        orderBy: { createdAt: "asc" },
    });

    let sent = 0;
    for (const event of pending) {
        const payload = event.payloadJson as unknown as NotificationPayload;
        const channel = resolveChannel(payload);
        try {
            const ok = channel ? await channel.send(payload) : false;
            await prisma.alertEvent.update({
                where: { id: event.id },
                data: {
                    status: ok ? "SENT" : "FAILED",
                    sentAt: ok ? new Date() : null,
                    ...(channel ? { sentTo: channel.name } : {}),
                },
            });
            if (ok) sent++;
        } catch (err) {
            logger.error({ err, eventId: event.id }, "gagal kirim notifikasi");
            await prisma.alertEvent.update({
                where: { id: event.id },
                data: { status: "FAILED" },
            });
        }
    }
    return sent;
}