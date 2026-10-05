import { Badge } from "@/components/ui";
import { hasClaudeKey } from "@stock-analyst/shared";
import AssistantChat from "./AssistantChat";

export const dynamic = "force-dynamic";

export default function AiAssistantPage() {
  const claudeActive = hasClaudeKey();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Analisis kontekstual per saham dari data harga, broker flow, dan sinyal
          </p>
        </div>
        <Badge tone={claudeActive ? "info" : "warning"}>
          {claudeActive ? "Claude API aktif" : "Mode demo — tanpa API key"}
        </Badge>
      </div>

      <AssistantChat claudeActive={claudeActive} />
    </div>
  );
}
