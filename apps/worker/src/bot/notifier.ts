/**
 * Notifier — kirim notifikasi keluar via Discord (embed).
 * Mengonsumsi AlertEvent dari outbox (status QUEUED → SENT/FAILED).
 */

import { EmbedBuilder, type TextChannel } from "discord.js";
import type { PrismaClient } from "@stock-analyst/db";
import { EMBED_COLORS, type NotificationPayload } from "@stock-analyst/shared";
import { client } from "./client";
import { env } from "../config";
import { logger } from "../logger";

function toEmbed(payload: NotificationPayload) {
    const embed = new EmbedBuilder()
        .setTitle(payload.title)
        .setDescription(payload.description)
        .setColor(payload.color ?? EMBED_COLORS.info)
        .setTimestamp(payload.timestamp ?? new Date());

    if (payload.fields?.length) {
        embed.addFields(payload.fields);
    }
    return embed;
}

/** Kirim notifikasi ke channel utama. */
export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
    const channelId = env.DISCORD_NOTIFY_CHANNEL_ID;
    if (!channelId) {
        logger.warn("DISCORD_NOTIFY_CHANNEL_ID belum di-set");
        return false;
    }
    const channel = (await client.channels.fetch(channelId)) as TextChannel | null;
    if (!channel?.isTextBased()) {
        logger.error({ channelId }, "channel notifikasi tidak valid");
        return false;
    }
    await channel.send({ embeds: [toEmbed(payload)] });
    return true;
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
        try {
            const ok = await sendNotification(payload);
            await prisma.alertEvent.update({
                where: { id: event.id },
                data: { status: ok ? "SENT" : "FAILED", sentAt: ok ? new Date() : null },
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