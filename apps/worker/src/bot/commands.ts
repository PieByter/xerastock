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
import { runScreener } from "../services/screener";
import { callClaude, EMBED_COLORS, hasClaudeKey, type ScreenerFilter } from "@stock-analyst/shared";
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
        .setDescription("Jalankan screener (mis. per:15 pbv:1.5 atau preset:Nama)")
        .addStringOption((o) =>
            o.setName("preset").setDescription("Nama preset tersimpan dari dashboard").setRequired(false),
        )
        .addNumberOption((o) => o.setName("per").setDescription("PER maksimum").setMinValue(0))
        .addNumberOption((o) => o.setName("pbv").setDescription("PBV maksimum").setMinValue(0))
        .addNumberOption((o) => o.setName("roe").setDescription("ROE minimum (%)").setMinValue(0))
        .addNumberOption((o) =>
            o.setName("divyield").setDescription("Dividend yield minimum (%)").setMinValue(0),
        )
        .addNumberOption((o) =>
            o
                .setName("rsi_max")
                .setDescription("RSI maksimum (mis. 30 untuk oversold)")
                .setMinValue(0)
                .setMaxValue(100),
        ),

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

    new SlashCommandBuilder()
        .setName("tanya")
        .setDescription("Tanya asisten AI soal saham/broker flow")
        .addStringOption((o) => o.setName("pertanyaan").setDescription("Pertanyaan, mis. ringkas broker flow BBCA").setRequired(true)),
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
                case "tanya":
                    await handleTanya(interaction);
                    break;
                case "screener":
                    await handleScreener(interaction);
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

async function handleScreener(interaction: ChatInputCommandInteraction) {
    const presetName = interaction.options.getString("preset")?.trim();
    const filters: ScreenerFilter[] = [];

    if (presetName) {
        const preset = await prisma.screenerPreset.findFirst({
            where: { name: { equals: presetName, mode: "insensitive" } },
        });
        if (!preset) {
            await interaction.reply({
                embeds: [
                    embed(
                        "🔍 Screener",
                        EMBED_COLORS.watch,
                        `Preset "${presetName}" tidak ditemukan. Simpan preset dulu di halaman Screener dashboard.`,
                    ),
                ],
            });
            return;
        }
        filters.push(...((preset.filtersJson ?? []) as unknown as ScreenerFilter[]));
    }

    // Opsi ad-hoc bisa dipakai sendiri atau menimpa preset.
    const per = interaction.options.getNumber("per");
    const pbv = interaction.options.getNumber("pbv");
    const roe = interaction.options.getNumber("roe");
    const divYield = interaction.options.getNumber("divyield");
    const rsiMax = interaction.options.getNumber("rsi_max");
    if (per != null) filters.push({ field: "per", operator: "lt", value: per });
    if (pbv != null) filters.push({ field: "pbv", operator: "lt", value: pbv });
    if (roe != null) filters.push({ field: "roe", operator: "gt", value: roe });
    if (divYield != null) filters.push({ field: "divYield", operator: "gt", value: divYield });
    if (rsiMax != null) filters.push({ field: "rsi14", operator: "lt", value: rsiMax });

    if (filters.length === 0) {
        await interaction.reply({
            embeds: [
                embed(
                    "🔍 Screener",
                    EMBED_COLORS.info,
                    "Contoh: `/screener per:15 pbv:1.5` atau `/screener preset:Nama Preset`.\nPreset dibuat & disimpan dari halaman Screener di dashboard.",
                ),
            ],
        });
        return;
    }

    await interaction.deferReply();
    const { rows, scanned } = await runScreener(prisma, filters);
    const shown = rows.slice(0, 15);
    const lines = shown.map(
        (r) =>
            `**${r.ticker}** · Rp ${r.price.toLocaleString("id-ID")} (${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(1)}%) · PER ${r.per > 0 ? r.per.toFixed(1) : "—"} · PBV ${r.pbv > 0 ? r.pbv.toFixed(1) : "—"} · ROE ${r.roe !== 0 ? `${r.roe.toFixed(1)}%` : "—"} · RSI ${r.rsi14.toFixed(0)}`,
    );

    await interaction.editReply({
        embeds: [
            embed(
                `🔍 Screener — ${rows.length} hasil`,
                rows.length > 0 ? EMBED_COLORS.buy : EMBED_COLORS.watch,
                rows.length === 0
                    ? `Tidak ada saham yang cocok dari ${scanned} saham aktif.`
                    : lines.join("\n") +
                      (rows.length > shown.length ? `\n… dan ${rows.length - shown.length} lainnya.` : ""),
            ),
        ],
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

async function handleTanya(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const question = interaction.options.getString("pertanyaan", true).slice(0, 500);

    const stocks = await prisma.stock.findMany({
        where: { isActive: true },
        orderBy: { ticker: "asc" },
        take: 30,
        include: {
            priceBars: { orderBy: { timestamp: "desc" }, take: 2 },
            fundamentalSnapshots: { orderBy: { asOfDate: "desc" }, take: 1 },
            signals: { orderBy: { createdAt: "desc" }, take: 1 },
        },
    });

    const context = stocks
        .filter((stock) => stock.priceBars.length > 0)
        .map((stock) => {
            const [last, prev] = stock.priceBars;
            const price = Number(last!.close);
            const change = prev ? ((price - Number(prev.close)) / Number(prev.close)) * 100 : 0;
            const fundamental = stock.fundamentalSnapshots[0];
            const signal = stock.signals[0];
            return `${stock.ticker} | harga ${price.toLocaleString("id-ID")} | ${change >= 0 ? "+" : ""}${change.toFixed(2)}% | PER ${fundamental?.per ?? "—"} | PBV ${fundamental?.pbv ?? "—"} | sinyal ${signal ? `${signal.direction}: ${(signal.reasonJson as string[]).join(", ")}` : "—"}`;
        })
        .join("\n");

    const answer = await callClaude(
        [
            {
                role: "user",
                content: `DATA SAHAM:\n${context}\n\nPERTANYAAN: ${question}\n\nJawab ringkas dalam Bahasa Indonesia berdasarkan data di atas. Jangan memberi rekomendasi beli/jual.`,
            },
        ],
        {
            system:
                "Kamu asisten analisis saham IDX. Jawab faktual dari data yang diberikan, maksimal 6 kalimat. " +
                "Selalu akhiri dengan pengingat bahwa ini analisis, bukan rekomendasi finansial.",
            maxTokens: 500,
        },
    );

    const fallback = stocks
        .slice(0, 5)
        .map((stock) => {
            const last = stock.priceBars[0];
            return last ? `${stock.ticker} ${Number(last.close).toLocaleString("id-ID")}` : null;
        })
        .filter(Boolean)
        .join(" · ");

    const text =
        answer ??
        `Mode demo (ANTHROPIC_API_KEY belum di-set). Ringkasan data: ${fallback || "belum ada data harga"}. ` +
            "Ini analisis data, bukan rekomendasi beli/jual.";

    await interaction.editReply({
        embeds: [embed("🤖 Tanya AI", hasClaudeKey() ? EMBED_COLORS.info : EMBED_COLORS.watch, text.slice(0, 3900))],
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