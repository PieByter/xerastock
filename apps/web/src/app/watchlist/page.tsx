import { getQuotes } from "@/lib/data";
import WatchlistTable from "./WatchlistTable";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const quotes = await getQuotes();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Watchlist</h1>
          <p className="text-sm text-muted-foreground">
            Pantau saham favorit — alert harga & sinyal otomatis ke Discord
          </p>
        </div>
      </div>

      <WatchlistTable quotes={quotes} />
    </div>
  );
}