"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { updateBotAction } from "@/app/actions";

export default function BotControls({ status, killSwitch }: { status: string; killSwitch: boolean }) {
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const running = status === "RUNNING";

  const run = (action: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => setNotice(await action()));
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {notice && <Badge tone={notice.ok ? "success" : "danger"}>{notice.message}</Badge>}
      <button
        className="btn-ghost"
        disabled={isPending || !running}
        onClick={() => run(() => updateBotAction({ status: "STOPPED" }))}
      >
        Pause
      </button>
      <button
        className="btn-primary"
        disabled={isPending || running}
        onClick={() => run(() => updateBotAction({ status: "RUNNING" }))}
      >
        Start Bot
      </button>
      <button
        className={killSwitch ? "btn-primary" : "btn-ghost"}
        disabled={isPending}
        title="Kill switch menghentikan seluruh evaluasi & eksekusi trading"
        onClick={() => run(() => updateBotAction({ killSwitch: !killSwitch }))}
      >
        {killSwitch ? "Kill Switch: AKTIF" : "Kill Switch: Aman"}
      </button>
    </div>
  );
}
