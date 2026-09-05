import { AppHeader } from "@/components/app-header";
import { AppNav } from "@/components/app-nav";
import { getUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader email={user?.email} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">
        {children}
      </main>
      <AppNav />
    </div>
  );
}
