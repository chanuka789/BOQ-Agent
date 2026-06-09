import { currentUser } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  return (
    <AppShell
      userName={user?.fullName ?? user?.firstName ?? "QS reviewer"}
      userEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
    >
      {children}
    </AppShell>
  );
}
