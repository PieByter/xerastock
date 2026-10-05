"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/format";
import { askAssistant, type AssistantReply } from "./actions";

interface ChatMessage {
    id: number;
    role: "user" | "assistant";
    text: string;
    mode?: AssistantReply["mode"];
}

const SUGGESTIONS = [
    "Ringkas broker flow BBCA minggu ini",
    "Ada berita negatif TLKM?",
    "Bandingkan RSI BBCA vs BMRI",
    "Saham mana yang net asing paling besar hari ini?",
];

export default function AssistantChat({ claudeActive }: { claudeActive: boolean }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isPending, startTransition] = useTransition();
    const nextId = useRef(1);

    const submit = (question: string) => {
        const trimmed = question.trim();
        if (!trimmed || isPending) return;
        setInput("");
        setMessages((prev) => [...prev, { id: nextId.current++, role: "user", text: trimmed }]);
        startTransition(async () => {
            const reply = await askAssistant(trimmed);
            setMessages((prev) => [
                ...prev,
                { id: nextId.current++, role: "assistant", text: reply.answer, mode: reply.mode },
            ]);
        });
    };

    return (
        <div className="flex h-[calc(100vh-220px)] min-h-96 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/20 p-4">
                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <p className="text-sm font-medium">Tanya apa saja soal saham pantauan</p>
                        <p className="max-w-md text-xs text-muted-foreground">
                            Asisten membaca harga, indikator, net asing, dan sinyal terbaru dari database.
                            {claudeActive
                                ? " Claude API aktif — jawaban dihasilkan model."
                                : " ANTHROPIC_API_KEY belum di-set, jawaban disusun deterministik dari data (mode demo)."}
                        </p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                        >
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-xl border px-3 py-2 text-sm leading-relaxed",
                                    message.role === "user"
                                        ? "border-primary/30 bg-primary/10"
                                        : "border-border bg-card",
                                )}
                            >
                                {message.text}
                                {message.role === "assistant" && message.mode && (
                                    <span className="mt-1.5 block">
                                        <Badge tone={message.mode === "claude" ? "info" : "muted"}>
                                            {message.mode === "claude" ? "Claude AI" : "Mode demo"}
                                        </Badge>
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isPending && (
                    <div className="flex justify-start">
                        <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                            Menganalisis data…
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={s}
                        onClick={() => submit(s)}
                        disabled={isPending}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                        {s}
                    </button>
                ))}
            </div>

            <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit(input);
                }}
            >
                <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Tanya soal saham, broker flow, atau sinyal…"
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button type="submit" disabled={isPending || !input.trim()} className="btn-primary disabled:opacity-50">
                    Kirim
                </button>
            </form>

            <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Analisis AI, bukan rekomendasi beli/jual.
            </p>
        </div>
    );
}
