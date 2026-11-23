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

/**
 * Channel Telegram (PRD §10.2 fallback). Mengirim payload yang sama dengan
 * Discord sebagai teks biasa — tidak butuh dependency tambahan.
 */
export class TelegramChannel implements NotificationChannel {
    readonly name = "telegram";

    constructor(
        private readonly botToken: string,
        private readonly chatId: string,
    ) { }

    private format(payload: NotificationPayload): string {
        const lines = [`${payload.title}`, "", payload.description];
        for (const field of payload.fields ?? []) {
            lines.push(`${field.name}: ${field.value}`);
        }
        return lines.join("\n").slice(0, 4000);
    }

    async send(payload: NotificationPayload): Promise<boolean> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: this.format(payload),
                    disable_web_page_preview: true,
                }),
                signal: controller.signal,
            });
            const json = (await response.json().catch(() => ({}))) as { ok?: boolean; description?: string };
            if (!response.ok || json.ok === false) {
                logger.error(
                    { status: response.status, description: json.description },
                    "Telegram menolak pesan",
                );
                return false;
            }
            return true;
        } catch (err) {
            logger.error({ err }, "gagal kirim notifikasi Telegram");
            return false;
        } finally {
            clearTimeout(timeout);
        }
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

/** Channel Telegram bila token & chat ID tersedia. */
export function createTelegramChannel(): TelegramChannel | null {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    return token && chatId ? new TelegramChannel(token, chatId) : null;
}

/**
 * Semua channel aktif untuk satu payload. Discord tetap primary; Telegram
 * ikut dikirim bila dikonfigurasi (fallback/backup channel).
 */
export function resolveChannels(payload: NotificationPayload): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    const { name, channelId } = routeFor(payload.type);
    if (channelId) channels.push(new DiscordChannel(name, channelId));

    const telegram = createTelegramChannel();
    if (telegram) channels.push(telegram);
    return channels;
}

/** Pilih channel pertama untuk sebuah payload; null bila belum ada. */
export function resolveChannel(payload: NotificationPayload): NotificationChannel | null {
    return resolveChannels(payload)[0] ?? null;
}
