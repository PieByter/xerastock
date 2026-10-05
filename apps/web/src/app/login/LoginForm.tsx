"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { loginAction } from "./actions";

export default function LoginForm({ next, authActive }: { next: string; authActive: boolean }) {
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    if (!password || isPending) return;
    startTransition(async () => {
      const result = await loginAction(password);
      setNotice(result);
      if (result.ok) {
        router.replace(next);
        router.refresh();
      }
    });
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold">XERASTOCK</h1>
        <p className="mt-1 text-sm text-muted-foreground">IDX Trading Terminal</p>
      </div>

      <div className="card space-y-4">
        {!authActive && (
          <Badge tone="warning">
            DASHBOARD_PASSWORD belum di-set — dashboard terbuka tanpa login
          </Badge>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-xs text-muted-foreground">
            Password dashboard
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            className="input"
            placeholder="••••••••"
          />
        </div>

        {notice && <Badge tone={notice.ok ? "success" : "danger"}>{notice.message}</Badge>}

        <button className="btn-primary w-full" disabled={isPending || !password} onClick={submit}>
          {isPending ? "Memeriksa…" : "Masuk"}
        </button>

        <p className="text-[11px] text-muted-foreground">
          Sesi disimpan sebagai cookie httpOnly berisi hash password selama 30 hari.
        </p>
      </div>
    </div>
  );
}
