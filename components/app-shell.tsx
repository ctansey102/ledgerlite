import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

const links = [
  { href: "/dashboard", label: "Home" },
  { href: "/journal", label: "Journal" },
  { href: "/accounts", label: "Accounts" },
  { href: "/subledgers", label: "Subledgers" },
  { href: "/statements", label: "Statements" },
];

export function AppShell({
  name,
  role,
  children,
}: {
  name: string;
  role?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="font-serif text-2xl text-forest">
              LedgerLite
            </Link>
            <form action={signOutAction} className="sm:hidden">
              <button className="text-sm text-muted underline-offset-4 hover:underline">
                Sign out
              </button>
            </form>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-ink hover:bg-sage"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 text-sm sm:flex">
            <div className="text-right">
              <p className="font-medium text-ink">{name}</p>
              {role === "admin" ? (
                <p className="text-xs text-muted">Administrator</p>
              ) : (
                <p className="text-xs text-muted">Your books</p>
              )}
            </div>
            <form action={signOutAction}>
              <button className="rounded-full border border-line px-3 py-1.5 text-muted hover:border-forest hover:text-forest">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
