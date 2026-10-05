import { getQuotes, getScreenerPresets } from "@/lib/data";
import ScreenerClient from "./ScreenerClient";

export const dynamic = "force-dynamic";

export default async function ScreenerPage() {
  const [quotes, presets] = await Promise.all([getQuotes(), getScreenerPresets()]);
  return <ScreenerClient quotes={quotes} presets={presets} />;
}
