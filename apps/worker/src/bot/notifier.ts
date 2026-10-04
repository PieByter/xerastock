/**
 * Notifier — kirim notifikasi keluar via channel abstraction (PRD 10.2).
 *
 * Dua jalur:
 * - `sendNotification`/`processOutbox`: payload umum dari outbox AlertEvent,
 *   dirutekan per tipe notifikasi (sinyal / news / admin) lewat `resolveChannel`.
 * - `DiscordNotifier`/`createSignalEmbed`: embed khusus sinyal, dipisah per
 *   strategy (BSJP / BPJS / SWING) dengan webhook atau channel Discord.
 */

import type { PrismaClient } from "@stock-analyst/db";
import {
    EMBED_COLORS,
    STRATEGY_CONFIG,
    type NotificationChannel,
    type NotificationPayload,
    type SignalMatch,
    type StrategyType,
} from "@stock-analyst/shared";
import { EmbedBuilder, type TextChannel } from "discord.js";
import { client } from "./client";
import { resolveChannel } from "./channels";
import { env } from "../config";
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

export function createSignalEmbed(signal: SignalMatch): EmbedBuilder {
    const strat = STRATEGY_CONFIG[signal.strategyType];
    const color = strat ? parseInt(strat.hexColor.replace("#", ""), 16) : EMBED_COLORS.info;

    const embed = new EmbedBuilder()
        .setTitle(`🚨 Sinyal ${strat ? strat.shortName : signal.strategyType} — ${signal.ticker}`)
        .setDescription(signal.conditionSummary)
        .setColor(color)
        .addFields([
            { name: "Ticker", value: signal.ticker, inline: true },
            { name: "Arah", value: signal.direction, inline: true },
            { name: "Harga", value: `Rp ${signal.price.toLocaleString("id-ID")}`, inline: true },
            { name: "Volume", value: signal.volume.toLocaleString("id-ID"), inline: true },
            ...(signal.foreignNetBuy != null
                ? [{ name: "Foreign Net Flow", value: `Rp ${signal.foreignNetBuy.toLocaleString("id-ID")}`, inline: true }]
                : []),
            {
                name: "Waktu Evaluasi",
                value: new Date(signal.matchedAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB",
                inline: true,
            },
        ])
        .setFooter({ text: "IDX Trading Assistant · Analisis otomatis, bukan rekomendasi finansial" })
        .setTimestamp(new Date(signal.matchedAt));

    return embed;
}

/** Implementasi Notifier Discord dengan Multi-Channel per strategy_type (PRD §10.2) */
export class DiscordNotifier implements NotificationChannel {
    async send(signal: SignalMatch): Promise<void> {
        const embed = createSignalEmbed(signal);
        await this.dispatchEmbed(signal.strategyType, embed);
    }

    async dispatchEmbed(strategyType: StrategyType | "NEWS", embed: EmbedBuilder): Promise<boolean> {
        const webhookUrl = this.getWebhookUrl(strategyType);
        if (webhookUrl) {
            try {
                await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ embeds: [embed.toJSON()] }),
                });
                logger.info({ strategyType }, "Sinyal terkirim via Discord Webhook");
                return true;
            } catch (err) {
                logger.error({ err, strategyType }, "Gagal kirim via Discord Webhook");
            }
        }

        const channelId = this.getChannelId(strategyType);
        if (channelId && client.isReady()) {
            try {
                const channel = (await client.channels.fetch(channelId)) as TextChannel | null;
                if (channel?.isTextBased()) {
                    await channel.send({ embeds: [embed] });
                    logger.info({ strategyType, channelId }, "Sinyal terkirim via Discord Bot Channel");
                    return true;
                }
            } catch (err) {
                logger.error({ err, channelId }, "Gagal kirim via Discord Bot Channel");
            }
        }

        logger.info({ strategyType, title: embed.data.title }, "[MOCK/LOCAL NOTIFY] Discord embed disimulasikan");
        return true;
    }

    private getWebhookUrl(strategyType: StrategyType | "NEWS"): string | undefined {
        if (strategyType === "BSJP") return env.DISCORD_WEBHOOK_BSJP;
        if (strategyType === "BPJS") return env.DISCORD_WEBHOOK_BPJS;
        if (strategyType === "SWING") return env.DISCORD_WEBHOOK_SWING;
        if (strategyType === "NEWS") return env.DISCORD_WEBHOOK_NEWS;
        return undefined;
    }

    private getChannelId(strategyType: StrategyType | "NEWS"): string | undefined {
        if (strategyType === "BSJP") return env.DISCORD_CHANNEL_BSJP_ID ?? env.DISCORD_NOTIFY_CHANNEL_ID;
        if (strategyType === "BPJS") return env.DISCORD_CHANNEL_BPJS_ID ?? env.DISCORD_NOTIFY_CHANNEL_ID;
        if (strategyType === "SWING") return env.DISCORD_CHANNEL_SWING_ID ?? env.DISCORD_NOTIFY_CHANNEL_ID;
        if (strategyType === "NEWS") return env.DISCORD_CHANNEL_NEWS_ID ?? env.DISCORD_NOTIFY_CHANNEL_ID;
        return env.DISCORD_NOTIFY_CHANNEL_ID;
    }
}

/** Implementasi Fallback Notifier Telegram (PRD §10.2) */
export class TelegramNotifier implements NotificationChannel {
    async send(signal: SignalMatch): Promise<void> {
        logger.info({ signalId: signal.id, ticker: signal.ticker }, "TelegramNotifier: Notifikasi disiapkan (PRD §10.2 fallback)");
    }
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
