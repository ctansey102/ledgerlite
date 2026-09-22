import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";
import { Notice } from "@/components/notice";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[2rem] border border-line bg-paper p-8 shadow-sm">
        <p className="font-serif text-3xl text-forest">Create your books</p>
        <p className="mt-2 text-muted">
          Use your email and a password. We&apos;ll send a confirmation link —
          after you open it, come back and sign in.
        </p>
        <form action={signUpAction} className="mt-6 space-y-4">
          <Notice message={error} />
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Your name</span>
            <input
              name="display_name"
              required
              placeholder="Maria"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-forest"
            />
          </label>
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
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-forest"
            />
          </label>
          <button className="w-full rounded-full bg-forest py-3 font-medium text-white hover:bg-forest-dark">
            Create account
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-forest underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
