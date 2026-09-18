/**
 * Slash commands Discord (PRD Bagian 6).
 * /watch /unwatch /price /signal /screener /alert /status /start /stop /report
 */

import {
    Client,
    SlashCommandBuilder,
    EmbedBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import { prisma } from "@stock-analyst/db";
import { marketData } from "../services/marketData";
import { EMBED_COLORS } from "@stock-analyst/shared";
import { logger } from "../logger";

export const COMMAND_BUILDERS = [
    new SlashCommandBuilder()
        .setName("watch")
        .setDescription("Tambah saham ke watchlist")
        .addStringOption((o) => o.setName("ticker").setDescription("Contoh: BBCA.JK").setRequired(true)),

    new SlashCommandBuilder()
        .setName("unwatch")
        .setDescription("Hapus saham dari watchlist")
        .addStringOption((o) => o.setName("ticker").setDescription("Contoh: BBCA.JK").setRequired(true)),

    new SlashCommandBuilder()
        .setName("price")
        .setDescription("Cek harga saham terkini")
        .addStringOption((o) => o.setName("ticker").setDescription("Contoh: BBCA.JK").setRequired(true)),

    new SlashCommandBuilder()
        .setName("signal")
        .setDescription("Lihat sinyal terbaru untuk saham")
        .addStringOption((o) => o.setName("ticker").setDescription("Contoh: BBCA.JK").setRequired(true)),

    new SlashCommandBuilder()
        .setName("screener")
        .setDescription("Jalankan screener (contoh: /screener per:15 pbv:1.5)"),

    new SlashCommandBuilder()
        .setName("alert")
        .setDescription("Buat alert harga")
        .addStringOption((o) => o.setName("ticker").setDescription("Contoh: BBCA.JK").setRequired(true))
        .addStringOption((o) => o.setName("condition").setDescription("Contoh: above:10000 / below:9000").setRequired(true)),

    new SlashCommandBuilder()
        .setName("status")
        .setDescription("Status bot, scheduler, dan mode trading"),

    new SlashCommandBuilder()
        .setName("start")
        .setDescription("Mulai bot (owner only)"),

    new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Hentikan bot / kill switch (owner only)"),

    new SlashCommandBuilder()
        .setName("report")
        .setDescription("Laporan harian ringkas"),
];

function embed(title: string, color: number, description?: string) {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(description ?? null)
        .setTimestamp();
}

export function registerCommands(client: Client) {
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;
        logger.info({ command: commandName, user: interaction.user.tag }, "slash command");

        try {
            switch (commandName) {
                case "price":
                    await handlePrice(interaction);
                    break;
                case "watch":
                    await handleWatch(interaction);
                    break;
                case "unwatch":
                    await handleUnwatch(interaction);
                    break;
                case "signal":
                    await handleSignal(interaction);
                    break;
                case "status":
                    await handleStatus(interaction);
                    break;
                case "alert":
                    await handleAlert(interaction);
                    break;
                case "start":
                case "stop":
                    await handleStartStop(interaction, commandName === "start");
                    break;
                case "report":
                    await handleReport(interaction);
                    break;
                case "screener":
                    await interaction.reply({
                        embeds: [
                            embed(
                                "🔍 Screener",
                                EMBED_COLORS.info,
                                "Screener penuh tersedia di dashboard web. Contoh filter: PER < 15, PBV < 1.5, ROE > 15%.",
                            ),
                        ],
                    });
                    break;
                default:
                    await interaction.reply("Perintah belum diimplementasikan.");
            }
        } catch (err) {
            logger.error({ err, command: commandName }, "error eksekusi command");
            await interaction
                .reply({ content: "⚠️ Terjadi error. Cek log.", ephemeral: true })
                .catch(() => { });
        }
    });
}

async function handlePrice(interaction: ChatInputCommandInteraction) {
    const ticker = interaction.options.getString("ticker", true).toUpperCase();
    const quote = await marketData.getQuote(ticker);
    const sign = quote.changePct >= 0 ? "+" : "";
    await interaction.reply({
        embeds: [
            embed(
                `📈 ${ticker}`,
                quote.changePct >= 0 ? EMBED_COLORS.buy : EMBED_COLORS.sell,
                `Harga: **${quote.price.toLocaleString("id-ID")}**\nPerubahan: **${sign}${quote.changePct.toFixed(2)}%**\nVolume: ${quote.volume.toLocaleString("id-ID")}`,
            ),
        ],
    });
}

async function handleWatch(interaction: ChatInputCommandInteraction) {
    const ticker = interaction.options.getString("ticker", true).toUpperCase();
    const user = await prisma.user.findFirst({ where: { discordUserId: interaction.user.id } });
    if (!user) {
        await interaction.reply("⚠️ Akun Discord belum terhubung. Hubungi owner.");
        return;
    }
    const stock = await prisma.stock.upsert({
        where: { ticker },
        create: { ticker, name: ticker, exchange: "IDX", yahooSymbol: ticker },
        update: {},
    });
    const watchlist = await prisma.watchlist.findFirst({
        where: { userId: user.id, isDefault: true },
    });
    if (watchlist) {
        await prisma.watchlistItem.upsert({
            where: { watchlistId_stockId: { watchlistId: watchlist.id, stockId: stock.id } },
            create: { watchlistId: watchlist.id, stockId: stock.id },
            update: {},
        });
    }
    await interaction.reply({
        embeds: [embed("✅ Watchlist", EMBED_COLORS.buy, `${ticker} ditambahkan ke watchlist.`)],
    });
}

async function handleUnwatch(interaction: ChatInputCommandInteraction) {
    const ticker = interaction.options.getString("ticker", true).toUpperCase();
    const user = await prisma.user.findFirst({ where: { discordUserId: interaction.user.id } });
    const stock = await prisma.stock.findUnique({ where: { ticker } });
    if (user && stock) {
        const watchlist = await prisma.watchlist.findFirst({
            where: { userId: user.id, isDefault: true },
        });
        if (watchlist) {
            await prisma.watchlistItem.deleteMany({
                where: { watchlistId: watchlist.id, stockId: stock.id },
            });
        }
    }
    await interaction.reply({
        embeds: [embed("🗑️ Watchlist", EMBED_COLORS.info, `${ticker} dihapus dari watchlist.`)],
    });
}

async function handleSignal(interaction: ChatInputCommandInteraction) {
    const ticker = interaction.options.getString("ticker", true).toUpperCase();
    const stock = await prisma.stock.findUnique({ where: { ticker } });
    const signals = stock
        ? await prisma.signal.findMany({
            where: { stockId: stock.id },
            orderBy: { createdAt: "desc" },
            take: 3,
        })
        : [];
    if (signals.length === 0) {
        await interaction.reply({
            embeds: [embed("🚨 Sinyal", EMBED_COLORS.watch, `Belum ada sinyal untuk ${ticker}.`)],
        });
        return;
    }
    const lines = signals
        .map((s) => {
            const reasons = (s.reasonJson as string[]).join(", ");
            return `**${s.direction}** · ${s.source} — ${reasons} (@ ${Number(s.price).toLocaleString("id-ID")})`;
        })
        .join("\n");
    await interaction.reply({
        embeds: [embed(`🚨 Sinyal ${ticker}`, EMBED_COLORS.info, lines)],
    });
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
    const botConfig = await prisma.botConfig.findFirst();
    const mode = botConfig?.mode ?? "SIGNAL_ONLY";
    const status = botConfig?.status ?? "STOPPED";
    await interaction.reply({
        embeds: [
            embed(
                "🤖 Status Bot",
                status === "RUNNING" ? EMBED_COLORS.buy : EMBED_COLORS.watch,
                `Mode: **${mode}**\nStatus: **${status}**\nKill switch: ${botConfig?.killSwitch ? "AKTIF" : "nonaktif"}\nScheduler: EOD 16:00 WIB · Quote refresh 5 menit`,
            ),
        ],
    });
}

async function handleAlert(interaction: ChatInputCommandInteraction) {
    const ticker = interaction.options.getString("ticker", true).toUpperCase();
    const condition = interaction.options.getString("condition", true);
    const match = condition.match(/^(above|below):(\d+)$/i);
    if (!match) {
        await interaction.reply("Format salah. Gunakan: `above:10000` atau `below:9000`.");
        return;
    }
    const [, dir, level] = match;
    const user = await prisma.user.findFirst({ where: { discordUserId: interaction.user.id } });
    const stock = await prisma.stock.findUnique({ where: { ticker } });
    if (!user || !stock) {
        await interaction.reply("⚠️ Saham atau user tidak ditemukan.");
        return;
    }
    await prisma.alert.create({
        data: {
            userId: user.id,
            stockId: stock.id,
            type: dir === "above" ? "PRICE_ABOVE" : "PRICE_BELOW",
            conditionJson: { level: Number(level) },
            repeat: false,
            status: "ACTIVE",
        },
    });
    await interaction.reply({
        embeds: [
            embed(
                "🔔 Alert dibuat",
                EMBED_COLORS.buy,
                `${ticker} — alert ${dir === "above" ? "di atas" : "di bawah"} ${Number(level).toLocaleString("id-ID")}.`,
            ),
        ],
    });
}

async function handleStartStop(interaction: ChatInputCommandInteraction, start: boolean) {
    const ownerId = process.env.DISCORD_OWNER_ID;
    if (ownerId && interaction.user.id !== ownerId) {
        await interaction.reply({ content: "⛔ Hanya owner yang bisa menjalankan perintah ini.", ephemeral: true });
        return;
    }
    const botConfig = await prisma.botConfig.findFirst();
    if (botConfig) {
        await prisma.botConfig.update({
            where: { id: botConfig.id },
            data: { status: start ? "RUNNING" : "STOPPED", killSwitch: !start },
        });
    }
    await interaction.reply({
        embeds: [
            embed(
                start ? "▶️ Bot dimulai" : "⏹️ Bot dihentikan",
                start ? EMBED_COLORS.buy : EMBED_COLORS.sell,
                start ? "Scheduler & trade engine aktif." : "Kill switch aktif. Semua eksekusi dihentikan.",
            ),
        ],
    });
}

async function handleReport(interaction: ChatInputCommandInteraction) {
    const signals = await prisma.signal.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "desc" },
        take: 10,
    });
    const lines =
        signals.length === 0
            ? "Tidak ada sinyal dalam 24 jam terakhir."
            : signals
                .map((s) => `**${s.direction}** ${s.stockId.slice(0, 8)} — ${(s.reasonJson as string[]).join(", ")}`)
                .join("\n");
    await interaction.reply({
        embeds: [embed("📋 Laporan Harian", EMBED_COLORS.info, lines)],
    });
}