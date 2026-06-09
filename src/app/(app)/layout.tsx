import { currentUser } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  try {
    const user = await currentUser();

    return (
      <AppShell
        userName={user?.fullName ?? user?.firstName ?? "QS reviewer"}
        userEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
      >
        {children}
      </AppShell>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <div className="p-6 max-w-xl mx-auto mt-12 bg-red-50 border border-red-200 text-red-700 rounded-lg font-mono text-xs">
        <h1 className="text-sm font-bold uppercase text-red-800">Protected Layout Error</h1>
        <p className="mt-2 font-bold">{error instanceof Error ? error.name : "Error"}: {message}</p>
        {error instanceof Error && error.stack ? (
          <pre className="mt-4 p-2 bg-red-100/60 rounded overflow-auto max-h-60 whitespace-pre-wrap">{error.stack}</pre>
        ) : null}
      </div>
    );
  }
}
