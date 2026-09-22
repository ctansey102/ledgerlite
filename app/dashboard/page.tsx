import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import {
  flattenLedgerLines,
  getAccounts,
  getEntries,
  getLedgerLines,
  getProfile,
  requireUser,
} from "@/lib/data";
import { balancesByAccount, netIncome } from "@/lib/ledger";
import { formatDate, formatMoney, todayISO } from "@/lib/money";
import { resolvePeriod } from "@/lib/periods";

export default async function DashboardPage() {
  const user = await requireUser();
  const [profile, accounts, entries, rawLines] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getEntries(user.id),
    getLedgerLines(user.id),
  ]);

  const lines = flattenLedgerLines(rawLines);
  const month = resolvePeriod("this-month");
  const income = netIncome(accounts, lines, { from: month.from, to: month.to });
  const cash = balancesByAccount(accounts, lines, { to: todayISO() }).find(
    (row) => row.account.subledger === "cash" || row.account.code === "1000",
  );

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-gold">
            Welcome back
          </p>
          <h1 className="mt-1 font-serif text-4xl text-ink">
            Hi {profile?.display_name ?? "there"}, your books are ready.
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Record what happened, then watch it flow into the trial balance and
            financial statements. You do not need to close the books first.
          </p>
        </div>
        <Link
          href="/journal/new"
          className="rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white hover:bg-forest-dark"
        >
          New journal entry
        </Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { label: "Cash on hand", value: cash?.signed ?? 0, href: "/subledgers/cash" },
          { label: `${month.label} revenue`, value: income.revenue, href: "/statements" },
          { label: `${month.label} net income`, value: income.net, href: "/statements" },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-3xl border border-line bg-paper p-5 hover:border-forest"
          >
            <p className="text-sm text-muted">{card.label}</p>
            <p className="money mt-2 font-serif text-3xl">{formatMoney(card.value)}</p>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Recent entries</h2>
          <Link href="/journal" className="text-sm text-forest hover:underline">
            View journal
          </Link>
        </div>
        {entries.length === 0 ? (
          <EmptyState
            title="Your first entry is waiting"
            body="Try Maria's example: debit Cash $1,200 and credit Service Revenue $1,200. LedgerLite will only save it if the two sides match."
            href="/journal/new"
            action="Record a transaction"
          />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-line bg-paper">
            <table className="w-full text-sm">
              <thead className="bg-sage/60 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Entered by</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 6).map((entry) => (
                  <tr key={entry.id} className="border-t border-line">
                    <td className="px-4 py-3">{formatDate(entry.entry_date)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/journal/${entry.id}`} className="hover:text-forest">
                        {entry.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {entry.enterer?.display_name ?? "You"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
