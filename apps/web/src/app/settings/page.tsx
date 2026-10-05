import { getBotOverview } from "@/lib/data";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const bot = await getBotOverview();

  return (
    <SettingsForm
      initial={{
        mode: bot.mode,
        status: bot.status,
        killSwitch: bot.killSwitch,
        risk: bot.risk,
      }}
    />
  );
}