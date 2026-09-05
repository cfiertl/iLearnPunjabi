import { AppHeader } from "@/components/app-header";
import { AppNav } from "@/components/app-nav";

// Deliberately does NOT call getUser(). Everything under (app) is already
// gated by src/proxy.ts, which does the authoritative check, so a second
// auth round trip here only re-proves what the proxy established — and it is
// a full network hop to Supabase on every single page render.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">
        {children}
      </main>
      <AppNav />
    </div>
  );
}
