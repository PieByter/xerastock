import { getQuotes } from "@/lib/data";
import ScreenerClient from "./ScreenerClient";

export const dynamic = "force-dynamic";

export default async function ScreenerPage() {
  const quotes = await getQuotes();
  return <ScreenerClient quotes={quotes} />;
}
