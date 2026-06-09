import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4 py-10">
      <SignUp />
    </main>
  );
}
