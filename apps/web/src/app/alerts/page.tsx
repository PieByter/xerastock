import { getAlerts } from "@/lib/data";
import AlertManager from "./AlertManager";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const data = await getAlerts();
  return <AlertManager alerts={data.alerts} stocks={data.stocks} isDemo={data.isDemo} />;
}
