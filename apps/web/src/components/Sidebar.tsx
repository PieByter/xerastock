"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/watchlist", label: "Watchlist", icon: "👁️" },
  { href: "/screener", label: "Screener", icon: "🔍" },
  { href: "/signals", label: "Sinyal", icon: "🚨" },
  { href: "/bot", label: "Bot & Trading", icon: "🤖" },
  { href: "/settings", label: "Pengaturan", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="text-2xl">📈</span>
        <div>
          <p className="text-sm font-bold">Stock Analyst</p>
          <p className="text-xs text-muted-foreground">IDX · Bot · Auto Trade</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary/15 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Bot Status</p>
        <p className="mt-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          Running · SIGNAL_ONLY
        </p>
      </div>
    </aside>
  );
}