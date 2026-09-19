"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Search,
    Bell,
    Moon,
    Sun,
    TrendingUp,
    TrendingDown,
    Clock,
    User,
    CheckCircle2,
    ExternalLink,
    X,
} from "lucide-react";
import { MOCK_QUOTES, MOCK_SIGNAL_LOGS, MOCK_PORTFOLIO } from "@/lib/mock";
import { formatIDR, formatPct } from "@/lib/format";

export default function Header() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(MOCK_PORTFOLIO.wibTime);

    const searchRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Theme init
        const saved = localStorage.getItem("xerastock_theme") as "dark" | "light" | null;
        if (saved) {
            setTheme(saved);
            document.documentElement.classList.toggle("light", saved === "light");
            document.documentElement.classList.toggle("dark", saved === "dark");
        }
    }, []);

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        localStorage.setItem("xerastock_theme", next);
        document.documentElement.classList.toggle("light", next === "light");
        document.documentElement.classList.toggle("dark", next === "dark");
    };

    // Filter tickers for search dropdown
    const filteredStocks = searchQuery.trim()
        ? MOCK_QUOTES.filter(
            (q) =>
                q.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
                q.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ).slice(0, 5)
        : [];

    const handleSelectStock = (ticker: string) => {
        setIsSearching(false);
        setSearchQuery("");
        router.push(`/stock/${ticker}`);
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsSearching(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setIsNotificationOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
            {/* Search Bar */}
            <div ref={searchRef} className="relative w-80">
                <div className="relative flex items-center">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearching(true);
                        }}
                        onFocus={() => setIsSearching(true)}
                        placeholder="Cari ticker (BBCA, BBRI, ASII)..."
                        className="input pl-9 pr-8"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery("");
                                setIsSearching(false);
                            }}
                            className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Search dropdown */}
                {isSearching && filteredStocks.length > 0 && (
                    <div className="card-elevated absolute left-0 top-full mt-2 w-full p-1.5 shadow-xl">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Saham IDX
                        </div>
                        {filteredStocks.map((stock) => (
                            <button
                                key={stock.ticker}
                                onClick={() => handleSelectStock(stock.ticker)}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                            >
                                <div>
                                    <span className="font-bold text-foreground">{stock.ticker}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">{stock.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="font-medium">{formatIDR(stock.price)}</div>
                                    <div
                                        className={`text-xs ${stock.changePct >= 0 ? "text-success" : "text-danger"
                                            }`}
                                    >
                                        {formatPct(stock.changePct)}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Right side items: Market Status Pill, Notification Bell, Theme, User Profile */}
            <div className="flex items-center gap-3.5">
                {/* Market Status Pill */}
                <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs">
                    <span className="flex h-2 w-2 items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    </span>
                    <span className="font-semibold text-foreground">IHSG {MOCK_PORTFOLIO.ihsgValue.toLocaleString("id-ID")}</span>
                    <span className="flex items-center text-success font-medium">
                        <TrendingUp className="mr-0.5 h-3 w-3" />
                        +{MOCK_PORTFOLIO.ihsgChangePct}%
                    </span>
                    <span className="text-border">|</span>
                    <span className="flex items-center text-muted-foreground">
                        <Clock className="mr-1 h-3 w-3" />
                        {currentTime}
                    </span>
                </div>

                {/* Discord Notification Alert Bell */}
                <div ref={notifRef} className="relative">
                    <button
                        onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                        className="btn-ghost relative h-9 w-9 rounded-full p-0"
                        title="Alert Sinyal Discord"
                    >
                        <Bell className="h-4 w-4" />
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
                    </button>

                    {/* Popover Preview Notifikasi Discord */}
                    {isNotificationOpen && (
                        <div className="card-elevated absolute right-0 top-full mt-2 w-80 p-3 shadow-2xl z-50">
                            <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2">
                                <div className="flex items-center gap-1.5">
                                    <Bell className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-xs font-bold text-foreground">Preview Notifikasi Discord</span>
                                </div>
                                <Link
                                    href="/settings"
                                    onClick={() => setIsNotificationOpen(false)}
                                    className="text-[11px] text-primary hover:underline"
                                >
                                    Konfigurasi
                                </Link>
                            </div>

                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {MOCK_SIGNAL_LOGS.slice(0, 3).map((log) => {
                                    const borderLeftColor =
                                        log.strategyType === "BSJP"
                                            ? "border-l-cyan-400"
                                            : log.strategyType === "BPJS"
                                                ? "border-l-amber-400"
                                                : "border-l-blue-400";
                                    return (
                                        <div
                                            key={log.id}
                                            className={`rounded-lg border border-border border-l-4 ${borderLeftColor} bg-muted/40 p-2.5 text-xs transition-colors hover:bg-muted`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-foreground">{log.ticker}</span>
                                                <span className="text-[10px] text-muted-foreground">{log.notifiedChannel}</span>
                                            </div>
                                            <p className="mt-1 text-[11px] text-muted-foreground">{log.conditionSnapshot}</p>
                                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                                                <span>Rp {log.price.toLocaleString("id-ID")}</span>
                                                <span>{log.strategyType}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <Link
                                href="/signals"
                                onClick={() => setIsNotificationOpen(false)}
                                className="btn-outline mt-2.5 w-full py-1 text-center text-xs"
                            >
                                Lihat Semua Sinyal
                            </Link>
                        </div>
                    )}
                </div>

                {/* Theme Toggle (Dark / Light) */}
                <button
                    onClick={toggleTheme}
                    className="btn-ghost h-9 w-9 rounded-full p-0"
                    title={theme === "dark" ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
                >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                {/* User Profile */}
                <div className="flex items-center gap-2 border-l border-border pl-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
                        PT
                    </div>
                    <div className="hidden lg:block text-left">
                        <div className="text-xs font-semibold text-foreground">Pieter</div>
                        <div className="text-[10px] text-muted-foreground">Personal Trader</div>
                    </div>
                </div>
            </div>
        </header>
    );
}
