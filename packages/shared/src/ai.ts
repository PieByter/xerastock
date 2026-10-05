/**
 * Helper AI opsional (Claude API) untuk ringkasan berita & asisten analisis.
 *
 * Semua fungsi di sini aman dipanggil tanpa `ANTHROPIC_API_KEY`: pemanggilan
 * Claude mengembalikan `null` dan pemanggil memakai fallback deterministik
 * (tanpa biaya API). Ini menjaga aplikasi tetap berfungsi penuh saat offline.
 */

export interface ClaudeMessage {
    role: "user" | "assistant";
    content: string;
}

export interface ClaudeOptions {
    system?: string;
    maxTokens?: number;
    model?: string;
}

export function hasClaudeKey(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Panggil Claude Messages API. Kembalikan null bila key tidak ada / request gagal. */
export async function callClaude(messages: ClaudeMessage[], options: ClaudeOptions = {}): Promise<string | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: options.model ?? process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5",
                max_tokens: options.maxTokens ?? 400,
                ...(options.system ? { system: options.system } : {}),
                messages,
            }),
        });

        if (!response.ok) return null;

        const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
        const text = data.content
            ?.filter((block) => block.type === "text")
            .map((block) => block.text ?? "")
            .join("\n")
            .trim();
        return text || null;
    } catch {
        return null;
    }
}

/** Bersihkan teks HTML/entitas sederhana dari deskripsi RSS. */
export function stripHtml(value: string): string {
    return value
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

/** Ringkasan ekstraktif deterministik — fallback saat Claude tidak aktif. */
export function extractiveSummary(text: string, maxChars = 260): string {
    const clean = stripHtml(text);
    if (!clean) return "";
    if (clean.length <= maxChars) return clean;

    const sentences = clean.split(/(?<=[.!?])\s+/);
    let summary = "";
    for (const sentence of sentences) {
        if ((summary ? `${summary} ${sentence}` : sentence).length > maxChars) break;
        summary = summary ? `${summary} ${sentence}` : sentence;
    }
    return summary || `${clean.slice(0, maxChars).trim()}…`;
}

const POSITIVE_WORDS = [
    "naik", "menguat", "laba", "untung", "tumbuh", "positif", "rekor", "borong",
    "akumulasi", "surplus", "melonjak", "melesat", "upgrade", "beli",
];
const NEGATIVE_WORDS = [
    "turun", "melemah", "rugi", "anjlok", "negatif", "gagal", "tekanan", "jual",
    "distribusi", "defisit", "koreksi", "phk", "default", "sanksi", "turunkan",
];

/** Sentimen kasar berbasis kata kunci — fallback saat Claude tidak aktif. */
export function guessSentiment(text: string): "POSITIVE" | "NEUTRAL" | "NEGATIVE" {
    const lower = stripHtml(text).toLowerCase();
    let score = 0;
    for (const word of POSITIVE_WORDS) if (lower.includes(word)) score++;
    for (const word of NEGATIVE_WORDS) if (lower.includes(word)) score--;
    if (score > 0) return "POSITIVE";
    if (score < 0) return "NEGATIVE";
    return "NEUTRAL";
}
