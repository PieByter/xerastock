/**
 * Notifier abstraction (PRD 10.2).
 * Signal engine hanya tahu `NotificationChannel` — nambah channel baru
 * (Telegram, email, dst) cukup implement interface ini tanpa ubah engine.
 */

import { EmbedBuilder, type TextChannel } from "discord.js";
import type { NotificationPayload, NotificationType } from "@stock-analyst/shared";
import { EMBED_COLORS } from "@stock-analyst/shared";
import { client } from "./client";
import { env } from "../config";
import { logger } from "../logger";

export interface NotificationChannel {
    /** Nama channel — dipakai untuk logging & kolom AlertEvent.sentTo. */
    name: string;
    send(payload: NotificationPayload): Promise<boolean>;
}

export function toEmbed(payload: NotificationPayload) {
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

/** Implementasi Discord dari NotificationChannel. */
export class DiscordChannel implements NotificationChannel {
    constructor(
        readonly name: string,
        private readonly channelId: string,
    ) { }

    async send(payload: NotificationPayload): Promise<boolean> {
        const channel = (await client.channels.fetch(this.channelId)) as TextChannel | null;
        if (!channel?.isTextBased()) {
            logger.error({ channelId: this.channelId, channel: this.name }, "channel Discord tidak valid");
            return false;
        }
        await channel.send({ embeds: [toEmbed(payload)] });
        return true;
    }
}

/** Channel default bila routing tidak menemukan channel spesifik. */
function defaultChannelId(): string | undefined {
    return env.DISCORD_NOTIFY_CHANNEL_ID ?? env.DISCORD_SIGNAL_CHANNEL_ID;
}

/** Channel & nama sesuai tipe notifikasi (PRD 10.2 — pisah per jenis sinyal). */
function routeFor(type: NotificationType): { name: string; channelId: string | undefined } {
    switch (type) {
        case "SIGNAL":
        case "TRADE_EXECUTED":
            return { name: "discord:signal", channelId: env.DISCORD_SIGNAL_CHANNEL_ID ?? defaultChannelId() };
        case "NEWS":
            return { name: "discord:news", channelId: env.DISCORD_NEWS_CHANNEL_ID ?? defaultChannelId() };
        case "SYSTEM":
        case "ERROR":
            return { name: "discord:admin", channelId: env.DISCORD_ADMIN_CHANNEL_ID ?? defaultChannelId() };
        default:
            return { name: "discord:notify", channelId: defaultChannelId() };
    }
}

/** Pilih channel untuk sebuah payload; null bila belum ada channel dikonfigurasi. */
export function resolveChannel(payload: NotificationPayload): NotificationChannel | null {
    const { name, channelId } = routeFor(payload.type);
    return channelId ? new DiscordChannel(name, channelId) : null;
}
