import LoginForm from "@/components/login-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-black dark:to-zinc-900">
      <LoginForm />
    </main>
  );
}
