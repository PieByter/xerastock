"use server";

/**
 * Server action asisten AI. Memakai Claude API bila `ANTHROPIC_API_KEY` di-set;
 * kalau tidak, menjawab deterministik dari data yang tersedia (mode demo)
 * sehingga UI tetap berfungsi tanpa biaya API.
 */

import { callClaude } from "@stock-analyst/shared";
import { getQuotes, getSignals, type Quote, type SignalView } from "@/lib/data";
import { formatIDR } from "@/lib/format";

export interface AssistantReply {
    answer: string;
    mode: "claude" | "demo";
}

const SYSTEM_PROMPT = [
    "Kamu asisten analisis saham Indonesia (IDX) yang ringkas, faktual, dan hati-hati.",
    "Jawab dalam Bahasa Indonesia, maksimal 6 kalimat, fokus pada data yang diberikan.",
    "JANGAN pernah memberi rekomendasi beli/jual. Selalu tutup dengan pengingat singkat",
    'bahwa ini analisis data, bukan rekomendasi finansial ("bukan rekomendasi beli/jual").',
].join(" ");

function buildContext(quotes: Quote[], signals: SignalView[]): string {
    const rows = quotes
        .slice(0, 20)
        .map(
            (q) =>
                `${q.ticker} | harga ${formatIDR(q.price)} | ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}% | RSI ${q.rsi} | PER ${q.per}x | PBV ${q.pbv}x | net asing ${formatIDR(q.foreignNet1d, true)} | sinyal ${q.signal}`,
        )
        .join("\n");
    const sig = signals
        .slice(0, 8)
        .map((s) => `${s.ticker} ${s.direction} (${s.source}) ${s.reason} @ ${formatIDR(s.price)}`)
        .join("\n");
    return `DATA SAHAM PANTAUAN:\n${rows}\n\nSINYAL TERBARU:\n${sig || "belum ada sinyal"}`;
}

/** Jawaban deterministik saat Claude tidak aktif — tetap berbasis data nyata. */
function demoAnswer(question: string, quotes: Quote[], signals: SignalView[]): string {
    const upper = question.toUpperCase();
    const mentioned = quotes.find((q) => upper.includes(q.ticker.replace(".JK", "")));

    if (mentioned) {
        const latest = signals.find((s) => s.ticker === mentioned.ticker);
        return [
            `${mentioned.ticker} (${mentioned.name}) diperdagangkan di ${formatIDR(mentioned.price)} (${mentioned.changePct >= 0 ? "+" : ""}${mentioned.changePct.toFixed(2)}%).`,
            `RSI ${mentioned.rsi}, PER ${mentioned.per}x, PBV ${mentioned.pbv}x, net asing ${formatIDR(mentioned.foreignNet1d, true)}.`,
            latest ? `Sinyal terakhir: ${latest.direction} — ${latest.reason}.` : "Belum ada sinyal terbaru untuk saham ini.",
            "Mode demo aktif (ANTHROPIC_API_KEY belum di-set), jawaban disusun dari data tersimpan — bukan rekomendasi beli/jual.",
        ].join(" ");
    }

    const gainers = [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    const totalNet = quotes.reduce((sum, q) => sum + q.foreignNet1d, 0);
    return [
        `Pasar pantauan: ${quotes.length} saham, total net asing ${formatIDR(totalNet, true)}.`,
        `Top gainer: ${gainers.map((q) => `${q.ticker} ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%`).join(", ")}.`,
        `Sinyal aktif terbaru: ${signals.length > 0 ? signals.slice(0, 3).map((s) => `${s.ticker} ${s.direction}`).join(", ") : "belum ada"}.`,
        "Sebutkan ticker tertentu (mis. BBCA) untuk ringkasan lebih detail. Mode demo aktif — bukan rekomendasi beli/jual.",
    ].join(" ");
}

export async function askAssistant(question: string): Promise<AssistantReply> {
    const trimmed = question.trim().slice(0, 500);
    if (!trimmed) return { answer: "Tulis pertanyaan dulu ya.", mode: "demo" };

    const [quotes, signals] = await Promise.all([getQuotes(), getSignals(10)]);
    const context = buildContext(quotes, signals);

    const answer = await callClaude(
        [{ role: "user", content: `${context}\n\nPertanyaan pengguna: ${trimmed}` }],
        { system: SYSTEM_PROMPT, maxTokens: 500 },
    );

    if (answer) return { answer, mode: "claude" };
    return { answer: demoAnswer(trimmed, quotes, signals), mode: "demo" };
}
