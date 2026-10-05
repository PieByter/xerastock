import { getBacktestOptions } from "@/lib/backtest";
import BacktestClient from "./BacktestClient";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  const options = await getBacktestOptions();
  return <BacktestClient options={options} />;
}
