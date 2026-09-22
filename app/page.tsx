import Link from "next/link";
import { getAuthUser } from "@/lib/data";

export default async function HomePage() {
  const user = await getAuthUser();

  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <p className="font-serif text-2xl text-forest">LedgerLite</p>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-forest px-4 py-2 font-medium text-white"
            >
              Open my books
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-ink">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-forest px-4 py-2 font-medium text-white"
              >
                Create a free account
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="grid gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">
              Double-entry, made friendly
            </p>
            <h1 className="mt-4 max-w-xl font-serif text-5xl leading-[1.15] tracking-normal text-ink sm:text-6xl">
              Keep honest books without the QuickBooks headache.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
              LedgerLite is for small business owners and accounting students who
              want journal entries that actually balance, then turn into a trial
              balance, income statement, balance sheet, and cash flow report.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="rounded-full bg-forest px-6 py-3 font-medium text-white hover:bg-forest-dark"
              >
                {user ? "Continue to your ledger" : "Start my first ledger"}
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-line px-6 py-3 text-ink hover:border-forest"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-line bg-paper p-6 shadow-sm">
            <p className="text-sm text-muted">Example for Maria&apos;s landscaping</p>
            <h2 className="mt-2 font-serif text-2xl">Client payment, $1,200</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-sage/70 text-left text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 text-right font-medium">Debit</th>
                    <th className="px-4 py-3 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-line">
                    <td className="px-4 py-3">Cash</td>
                    <td className="money px-4 py-3 text-right">$1,200.00</td>
                    <td className="px-4 py-3 text-right text-muted">—</td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="px-4 py-3">Service Revenue</td>
                    <td className="px-4 py-3 text-right text-muted">—</td>
                    <td className="money px-4 py-3 text-right">$1,200.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 rounded-2xl bg-sage px-4 py-3 text-sm text-forest-dark">
              Debits equal credits, so this entry is ready to post. Every
              statement later traces back to this same line.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Record a journal entry",
              body: "Pick the date, write what happened, and add debit and credit lines. LedgerLite will not save an unbalanced entry.",
            },
            {
              title: "Browse the chart of accounts",
              body: "Search Cash, Rent, or Revenue, see current balances, and drill into the general ledger for any account.",
            },
            {
              title: "Generate statements",
              body: "Choose a period and get an income statement, balance sheet, and indirect cash flow report from the same ledger.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-line bg-paper p-6"
            >
              <h2 className="font-serif text-2xl text-ink">{item.title}</h2>
              <p className="mt-3 leading-7 text-muted">{item.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
