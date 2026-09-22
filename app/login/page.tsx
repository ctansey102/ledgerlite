import Link from "next/link";
import { signInAction } from "@/app/actions/auth";
import { Notice } from "@/components/notice";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[2rem] border border-line bg-paper p-8 shadow-sm">
        <p className="font-serif text-3xl text-forest">Welcome back</p>
        <p className="mt-2 text-muted">
          Sign in with the same email and password you used to create your
          account.
        </p>
        <form action={signInAction} className="mt-6 space-y-4">
          <Notice message={message} tone="success" />
          <Notice message={error} />
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-forest"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-forest"
            />
          </label>
          <button className="w-full rounded-full bg-forest py-3 font-medium text-white hover:bg-forest-dark">
            Sign in
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="text-forest underline-offset-4 hover:underline">
            Create a free account
          </Link>
        </p>
      </div>
    </div>
  );
}
