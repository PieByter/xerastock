import { authConfigured } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  // Hanya terima path internal — cegah open redirect.
  const raw = searchParams.next ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LoginForm next={next} authActive={authConfigured()} />
    </div>
  );
}
