"use server";

/**
 * Server action asisten AI. Memakai Claude API bila `ANTHROPIC_API_KEY` di-set;
 * kalau tidak, menjawab deterministik dari data yang tersedia (mode demo)
 * sehingga UI tetap berfungsi tanpa biaya API.
 *
 * Konteks diperkaya per saham: harga/indikator, fundamental, broker summary,
 * foreign flow, berita, dan corporate action — bukan hanya daftar quote.
 */

import { callClaude, type ClaudeMessage } from "@stock-analyst/shared";
import {
    getCorporateActions,
    getNews,
    getQuotes,
    getSignals,
    getStockDetail,
    type Quote,
    type SignalView,
} from "@/lib/data";
import { formatIDR } from "@/lib/format";

export interface AssistantReply {
    answer: string;
    mode: "claude" | "demo";
    contextTickers: string[];
}

export interface AssistantHistoryItem {
    role: "user" | "assistant";
    content: string;
}

const SYSTEM_PROMPT = [
    "Kamu asisten analisis saham Indonesia (IDX) yang ringkas, faktual, dan hati-hati.",
    "Jawab dalam Bahasa Indonesia, maksimal 6 kalimat, fokus pada data yang diberikan.",
    "JANGAN pernah memberi rekomendasi beli/jual. Selalu tutup dengan pengingat singkat",
    'bahwa ini analisis data, bukan rekomendasi finansial ("bukan rekomendasi beli/jual").',
].join(" ");

/** Cari ticker yang disebut user (cocokkan kode tanpa suffix .JK). */
function mentionedTickers(question: string, quotes: Quote[]): string[] {
    const upper = question.toUpperCase();
    return quotes
        .map((quote) => quote.ticker)
        .filter((ticker) => new RegExp(`\\b${ticker.replace(/\.JK$/, "")}\\b`).test(upper))
        .slice(0, 3);
}

function quoteLine(quote: Quote): string {
    return `${quote.ticker} | harga ${formatIDR(quote.price)} | ${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}% | RSI ${quote.rsi} | PER ${quote.per}x | PBV ${quote.pbv}x | ROE ${quote.roe}% | div yield ${quote.divYield}% | net asing ${formatIDR(quote.foreignNet1d, true)}`;
}

function buildBaseContext(quotes: Quote[], signals: SignalView[]): string {
    const rows = quotes.slice(0, 20).map(quoteLine).join("\n");
    const sig = signals
        .slice(0, 8)
        .map((signal) => `${signal.ticker} ${signal.direction} (${signal.source}) ${signal.reason} @ ${formatIDR(signal.price)}`)
        .join("\n");
    return `DATA SAHAM PANTAUAN:\n${rows}\n\nSINYAL TERBARU:\n${sig || "belum ada sinyal"}`;
}

function buildStockContext(
    ticker: string,
    detail: NonNullable<Awaited<ReturnType<typeof getStockDetail>>>,
    news: Awaited<ReturnType<typeof getNews>>,
    corporateActions: Awaited<ReturnType<typeof getCorporateActions>>,
): string {
    const { quote, indicators, fundamentals, stats, levels, brokerSummary, foreignFlow } = detail;
    const sections: string[] = [];

    sections.push(
        `PROFIL ${ticker}${detail.isDemo ? " (DATA CONTOH — bukan data pasar asli)" : ""}:\n${quoteLine(quote)}`,
    );
    if (indicators.length > 0) {
        sections.push(
            `INDIKATOR:\n${indicators.map((indicator) => `${indicator.label}: ${indicator.value} (${indicator.note})`).join("\n")}`,
        );
    }
    if (fundamentals.length > 0) {
        sections.push(`FUNDAMENTAL:\n${fundamentals.map((item) => `${item.label}: ${item.value}`).join(" · ")}`);
    }
    if (stats) {
        sections.push(
            `STATISTIK:\nRentang 52w ${formatIDR(stats.low52w)}–${formatIDR(stats.high52w)} · volume ratio ${stats.volumeRatio.toFixed(2)}x · ATR ${stats.atrPct.toFixed(2)}% · return ${stats.returns.map((item) => `${item.label} ${item.value.toFixed(1)}%`).join(", ")}`,
        );
    }
    if (levels.supports.length > 0 || levels.resistances.length > 0) {
        sections.push(
            `SUPPORT/RESISTANCE:\nsupport ${levels.supports.map((level) => formatIDR(level.price)).join(", ") || "—"} · resistance ${levels.resistances.map((level) => formatIDR(level.price)).join(", ") || "—"}`,
        );
    }
    if (brokerSummary) {
        const buyers = brokerSummary.buyers
            .slice(0, 3)
            .map((row) => `${row.brokerCode} ${formatIDR(row.netValue, true)}`)
            .join(", ");
        const sellers = brokerSummary.sellers
            .slice(0, 3)
            .map((row) => `${row.brokerCode} ${formatIDR(row.netValue, true)}`)
            .join(", ");
        sections.push(
            `BROKER SUMMARY (${brokerSummary.periodLabel}, sumber ${brokerSummary.source}):\nTop net buy: ${buyers || "—"}\nTop net sell: ${sellers || "—"}\nNet asing periode: ${formatIDR(brokerSummary.balance.foreignNetValue, true)}`,
        );
    }
    if (foreignFlow) {
        sections.push(
            `FOREIGN FLOW:\nnet 5d ${formatIDR(foreignFlow.net5d, true)} · net 20d ${formatIDR(foreignFlow.net20d, true)} · tren ${foreignFlow.trend} · kumulatif ${formatIDR(foreignFlow.cumulativeNet, true)}`,
        );
    }
    if (news.length > 0) {
        sections.push(
            `BERITA TERKAIT:\n${news
                .slice(0, 5)
                .map(
                    (article) =>
                        `- ${article.isDemo ? "[DEMO] " : ""}[${article.aiSentiment}] ${article.title} — ${article.aiSummary}`,
                )
                .join("\n")}`,
        );
    }
    // Aksi korporasi sintetis jangan dipakai sebagai fakta oleh AI.
    const actions = corporateActions
        .filter(
            (action) =>
                action.ticker === ticker &&
                !`${action.title} ${action.detail ?? ""}`.toLowerCase().includes("data contoh"),
        )
        .slice(0, 4);
    if (actions.length > 0) {
        sections.push(
            `CORPORATE ACTION:\n${actions
                .map((action) => `- ${action.type} ${action.title} · cum ${action.cumDate} (H-${action.daysUntilCumDate})`)
                .join("\n")}`,
        );
    }

    return sections.join("\n\n");
}

function demoAnswer(
    quotes: Quote[],
    signals: SignalView[],
    tickerDetails: Array<{ ticker: string; detail: NonNullable<Awaited<ReturnType<typeof getStockDetail>>> }>,
): string {
    const mentioned = tickerDetails[0];
    if (mentioned) {
        const { quote, brokerSummary, foreignFlow, fundamentals, signals: stockSignals } = mentioned.detail;
        const latest = stockSignals[0] ?? signals.find((signal) => signal.ticker === mentioned.ticker);
        return [
            `${quote.ticker} (${quote.name}) diperdagangkan di ${formatIDR(quote.price)} (${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%).`,
            `RSI ${quote.rsi}, PER ${quote.per}x, PBV ${quote.pbv}x${fundamentals.length > 0 ? ", fundamental tersedia" : ", fundamental belum tersedia"}.`,
            brokerSummary
                ? `Broker summary ${brokerSummary.periodLabel}: net asing ${formatIDR(brokerSummary.balance.foreignNetValue, true)}; top buyer ${brokerSummary.buyers[0]?.brokerCode ?? "—"}, top seller ${brokerSummary.sellers[0]?.brokerCode ?? "—"}.`
                : "Broker summary belum tersedia untuk saham ini.",
            foreignFlow
                ? `Foreign flow 5 hari ${formatIDR(foreignFlow.net5d, true)}, 20 hari ${formatIDR(foreignFlow.net20d, true)}.`
                : "Foreign flow belum tersedia.",
            latest ? `Sinyal terakhir: ${latest.direction} — ${latest.reason}.` : "Belum ada sinyal terbaru untuk saham ini.",
            "Mode demo aktif (ANTHROPIC_API_KEY belum di-set), jawaban disusun dari data tersimpan — bukan rekomendasi beli/jual.",
        ].join(" ");
    }

    const gainers = [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    const totalNet = quotes.reduce((sum, quote) => sum + quote.foreignNet1d, 0);
    return [
        `Pasar pantauan: ${quotes.length} saham, total net asing ${formatIDR(totalNet, true)}.`,
        `Top gainer: ${gainers.map((quote) => `${quote.ticker} ${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%`).join(", ")}.`,
        `Sinyal aktif terbaru: ${signals.length > 0 ? signals.slice(0, 3).map((signal) => `${signal.ticker} ${signal.direction}`).join(", ") : "belum ada"}.`,
        "Sebutkan ticker tertentu (mis. BBCA) untuk ringkasan lebih detail. Mode demo aktif — bukan rekomendasi beli/jual.",
    ].join(" ");
}

export async function askAssistant(
    question: string,
    history: AssistantHistoryItem[] = [],
): Promise<AssistantReply> {
    const trimmed = question.trim().slice(0, 500);
    if (!trimmed) return { answer: "Tulis pertanyaan dulu ya.", mode: "demo", contextTickers: [] };

    const [quotes, signals] = await Promise.all([getQuotes(), getSignals(10)]);
    const tickers = mentionedTickers(trimmed, quotes);

    const tickerDetails = (
        await Promise.all(
            tickers.map(async (ticker) => {
                const [detail, news, corporateActions] = await Promise.all([
                    getStockDetail(ticker),
                    getNews(5, ticker),
                    getCorporateActions(90),
                ]);
                return detail ? { ticker, detail, news, corporateActions } : null;
            }),
        )
    ).filter((item): item is NonNullable<typeof item> => item != null);

    const context = [
        buildBaseContext(quotes, signals),
        ...tickerDetails.map((item) => buildStockContext(item.ticker, item.detail, item.news, item.corporateActions)),
    ].join("\n\n");

    const messages: ClaudeMessage[] = [
        ...history
            .filter((item) => item.content.trim().length > 0)
            .slice(-8)
            .map((item) => ({ role: item.role, content: item.content.slice(0, 1200) })),
        { role: "user", content: `${context}\n\nPertanyaan pengguna: ${trimmed}` },
    ];

    const answer = await callClaude(messages, { system: SYSTEM_PROMPT, maxTokens: 600 });
    if (answer) return { answer, mode: "claude", contextTickers: tickers };

    return {
        answer: demoAnswer(
            quotes,
            signals,
            tickerDetails.map((item) => ({ ticker: item.ticker, detail: item.detail })),
        ),
        mode: "demo",
        contextTickers: tickers,
    };
}
