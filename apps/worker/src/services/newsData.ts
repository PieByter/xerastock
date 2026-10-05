/**
 * Pipeline berita (PRD §4.5): tarik RSS → cocokkan dengan ticker watchlist →
 * ringkas + sentimen (Claude bila `ANTHROPIC_API_KEY` diisi, fallback
 * deterministik tanpa biaya API) → simpan ke tabel `News` (dedup URL) →
 * antre notifikasi channel #news.
 *
 * Parser RSS/Atom ditulis minimal tanpa dependency tambahan; feed yang gagal
 * dilewati dengan log, tidak menghentikan feed lain.
 */

import type { PrismaClient } from "@stock-analyst/db";
import {
    callClaude,
    extractiveSummary,
    guessSentiment,
    hasClaudeKey,
    stripHtml,
    type NotificationPayload,
} from "@stock-analyst/shared";
import { env } from "../config";
import { logger } from "../logger";

export interface RssItem {
    title: string;
    link: string;
    description: string;
    publishedAt: Date;
    source: string;
}

export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

/** Feed default (gratis, publik). Bisa ditimpa lewat env `NEWS_RSS_URLS`. */
const DEFAULT_FEEDS = [
    "https://investasi.kontan.co.id/rss",
    "https://www.cnbcindonesia.com/market/rss",
    "https://finansial.bisnis.com/rss",
];

const MAX_ITEMS_PER_FEED = 25;
const USER_AGENT = "XerastockBot/0.1 (personal research)";
const MARKET_WIDE_RE = /\b(ihsg|bei|idx|bursa efek|pasar modal)\b/i;

function decodeXml(value: string): string {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&");
}

function extractTag(block: string, tag: string): string | null {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return match ? decodeXml(match[1]!).trim() : null;
}

/** Nama sumber dari judul channel/feed, fallback ke hostname. */
export function feedSourceName(xml: string, url: string): string {
    const channel = xml.match(/<(?:channel|feed)\b[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
    const name = channel ? stripHtml(decodeXml(channel[1]!)).trim() : "";
    if (name) return name;
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "RSS";
    }
}

/** Parser RSS 2.0 & Atom minimal. */
export function parseFeed(xml: string, source: string): RssItem[] {
    const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
    const items: RssItem[] = [];

    for (const block of blocks) {
        const title = extractTag(block, "title");
        let link = extractTag(block, "link");
        if (!link) {
            const href = block.match(/<link[^>]*href="([^"]+)"/i);
            link = href ? decodeXml(href[1]!).trim() : null;
        }
        if (!title || !link) continue;

        const rawDescription =
            extractTag(block, "description") ??
            extractTag(block, "summary") ??
            extractTag(block, "content:encoded") ??
            "";
        const rawDate =
            extractTag(block, "pubDate") ??
            extractTag(block, "published") ??
            extractTag(block, "updated") ??
            extractTag(block, "dc:date");
        const publishedAt = rawDate ? new Date(rawDate) : new Date();

        items.push({
            title: stripHtml(title),
            link,
            description: stripHtml(rawDescription),
            publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
            source,
        });
    }
    return items;
}

/** Cocokkan kode ticker (tanpa suffix .JK) di dalam teks berita. */
export function matchTickers(text: string, tickers: string[]): string[] {
    const upper = text.toUpperCase();
    const matched = new Set<string>();
    for (const ticker of tickers) {
        const code = ticker.replace(/\.JK$/, "");
        if (new RegExp(`\\b${code}\\b`).test(upper)) matched.add(ticker);
    }
    return [...matched];
}

/** Ringkas + sentimen; pakai Claude bila aktif, fallback ekstraktif bila tidak. */
export async function summarizeNews(
    title: string,
    description: string,
): Promise<{ summary: string; sentiment: Sentiment }> {
    const text = `${title}. ${description}`.trim();

    if (hasClaudeKey()) {
        const answer = await callClaude(
            [
                {
                    role: "user",
                    content: `Judul: ${title}\nIsi: ${description.slice(0, 1500)}\n\nBalas dengan format tepat:\nRINGKASAN: <1-2 kalimat>\nSENTIMEN: <POSITIVE|NEUTRAL|NEGATIVE>`,
                },
            ],
            {
                system:
                    "Kamu editor berita finansial Indonesia. Ringkas netral dan faktual, tanpa opini beli/jual. " +
                    "SENTIMEN mencerminkan dampak berita terhadap emiten/pasar, bukan rekomendasi.",
                maxTokens: 200,
            },
        );
        if (answer) {
            const summary = answer.match(/RINGKASAN\s*:\s*([\s\S]*?)(?:\n|$)/i)?.[1]?.trim();
            const rawSentiment = answer.match(/SENTIMEN\s*:\s*(POSITIVE|NEGATIVE|NEUTRAL)/i)?.[1]?.toUpperCase();
            if (summary) {
                return {
                    summary,
                    sentiment: (rawSentiment as Sentiment | undefined) ?? guessSentiment(text),
                };
            }
        }
    }

    return { summary: extractiveSummary(description || title, 240), sentiment: guessSentiment(text) };
}

export interface NewsSyncResult {
    fetched: number;
    saved: number;
    queued: number;
}

/** Tarik semua feed, simpan berita baru yang relevan, antre notifikasi. */
export async function syncNewsToDb(prisma: PrismaClient): Promise<NewsSyncResult> {
    const configured = (env.NEWS_RSS_URLS ?? "")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);
    const feeds = configured.length > 0 ? configured : DEFAULT_FEEDS;

    const stocks = await prisma.stock.findMany({
        where: { isActive: true },
        select: { id: true, ticker: true },
    });
    const tickers = stocks.map((s) => s.ticker);
    const stockIdByTicker = new Map(stocks.map((s) => [s.ticker, s.id]));

    let fetched = 0;
    let saved = 0;
    let queued = 0;

    for (const feedUrl of feeds) {
        try {
            const response = await fetch(feedUrl, {
                headers: {
                    "user-agent": USER_AGENT,
                    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
                },
            });
            if (!response.ok) {
                logger.warn({ feedUrl, status: response.status }, "feed RSS tidak merespons OK");
                continue;
            }

            const xml = await response.text();
            const items = parseFeed(xml, feedSourceName(xml, feedUrl)).slice(0, MAX_ITEMS_PER_FEED);
            fetched += items.length;

            for (const item of items) {
                const haystack = `${item.title} ${item.description}`;
                const related = matchTickers(haystack, tickers);
                const marketWide = MARKET_WIDE_RE.test(haystack);
                if (related.length === 0 && !marketWide) continue;
                if (/\bihsg\b/i.test(haystack) && !related.includes("IHSG")) related.push("IHSG");

                const existing = await prisma.news.findUnique({ where: { url: item.link } });
                if (existing) continue;

                const { summary, sentiment } = await summarizeNews(item.title, item.description);
                const watchlistTickers = related.filter((t) => stockIdByTicker.has(t));
                const primaryTicker = watchlistTickers[0] ?? related[0] ?? null;

                await prisma.news.create({
                    data: {
                        stockId: primaryTicker ? (stockIdByTicker.get(primaryTicker) ?? null) : null,
                        ticker: primaryTicker,
                        relatedTickers: related,
                        source: item.source,
                        title: item.title,
                        url: item.link,
                        publishedAt: item.publishedAt,
                        aiSummary: summary,
                        aiSentiment: sentiment,
                    },
                });
                saved++;

                if (watchlistTickers.length > 0) {
                    const payload: NotificationPayload = {
                        type: "NEWS",
                        title: `📰 ${watchlistTickers.join(", ")} — ${item.source}`,
                        description: `${item.title}\n\n${summary}`,
                        color: sentiment === "POSITIVE" ? 0x22c55e : sentiment === "NEGATIVE" ? 0xef4444 : 0xf59e0b,
                        fields: [
                            { name: "Sentimen", value: sentiment, inline: true },
                            { name: "Ticker", value: watchlistTickers.join(", "), inline: true },
                        ],
                    };
                    await prisma.alertEvent.create({
                        data: {
                            type: "NEWS",
                            sentTo: "discord",
                            status: "QUEUED",
                            payloadJson: JSON.parse(JSON.stringify(payload)),
                        },
                    });
                    queued++;
                }
            }
        } catch (err) {
            logger.error({ err, feedUrl }, "gagal memproses feed RSS");
        }
    }

    logger.info({ feeds: feeds.length, fetched, saved, queued }, "sinkronisasi berita selesai");
    return { fetched, saved, queued };
}
