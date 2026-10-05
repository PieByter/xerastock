import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Stock Analyst — IDX",
  description: "Platform analisis saham Indonesia + Bot Discord + Auto Trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Pathname disisipkan middleware; halaman login tampil tanpa chrome dashboard.
  const pathname = headers().get("x-pathname") ?? "";
  const isAuthPage = pathname.startsWith("/login");

  return (
    <html lang="id" className="dark">
      <body>
        {isAuthPage ? (
          <div className="min-h-screen">{children}</div>
        ) : (
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}