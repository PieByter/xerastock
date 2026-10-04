"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Briefcase,
    Eye,
    ArrowLeftRight,
    Filter,
    LineChart,
    Radio,
    Newspaper,
    Sparkles,
    Settings,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
} from "lucide-react";

const NAV_ITEMS = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/watchlist", label: "Watchlist", icon: Eye },
    { href: "/broker-flow", label: "Broker Flow", icon: ArrowLeftRight },
    { href: "/screener", label: "Stock Screener", icon: Filter },
    { href: "/technical", label: "Technical Analysis", icon: LineChart },
    { href: "/signals", label: "Signals & Alerts", icon: Radio },
    { href: "/news", label: "News", icon: Newspaper },
    { href: "/ai-assistant", label: "AI Assistant", icon: Sparkles },
    { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={`sticky top-0 flex h-screen flex-col border-r border-border bg-card transition-all duration-300 z-40 ${
                collapsed ? "w-[72px] px-2" : "w-60 px-4"
            } py-4`}
        >
            {/* Logo / Brand */}
            <div className="mb-6 flex items-center justify-between px-2">
                <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/15 text-primary">
                        <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col truncate">
                            <span className="text-sm font-bold tracking-tight text-foreground">
                                XERASTOCK
                            </span>
                            <span className="text-[10px] text-muted-foreground">IDX Trading Terminal</span>
                        </div>
                    )}
                </Link>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="btn-ghost hidden lg:flex h-7 w-7 rounded-lg p-0 text-muted-foreground hover:text-foreground"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const active =
                        item.href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? item.label : undefined}
                            className={`group flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-all ${
                                active
                                    ? "bg-primary/15 text-primary shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            } ${collapsed ? "justify-center px-0" : ""}`}
                        >
                            <Icon
                                className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                }`}
                            />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Bot Status widget */}
            {!collapsed ? (
                <div className="mt-auto rounded-[10px] border border-border bg-muted/40 p-3 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Worker Engine</span>
                        <span className="flex h-2 w-2 items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        BSJP · BPJS · Swing aktif
                    </p>
                    <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/60 pt-1.5 flex justify-between">
                        <span>Discord Bot</span>
                        <span className="text-cyan-400 font-mono">4 channels</span>
                    </div>
                </div>
            ) : (
                <div className="mt-auto flex justify-center py-2" title="Worker Engine: Online">
                    <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
                </div>
            )}
        </aside>
    );
}