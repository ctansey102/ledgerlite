import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { getAccounts, getEntries, getProfile, requireUser } from "@/lib/data";
import { dollarsToCents } from "@/lib/money";
import { formatDate, formatMoney } from "@/lib/money";

export default async function JournalPage() {
  const user = await requireUser();
  const [profile, accounts, entries] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getEntries(user.id),
  ]);

  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl">Journal</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every transaction lives here, with the person who entered it. Click
            a row to see the debit and credit lines.
          </p>
        </div>
        <Link
          href="/journal/new"
          className="rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white hover:bg-forest-dark"
        >
          New entry
        </Link>
      </div>

      <div className="mt-8">
        {entries.length === 0 ? (
          <EmptyState
            title="No entries yet"
            body="Start with something simple: a sale, a bill, or money you put into the business. The form will coach you until the entry balances."
            href="/journal/new"
            action="Create an entry"
          />
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const total = entry.journal_lines.reduce(
                (sum, line) => sum + dollarsToCents(line.debit),
                0,
              );
              return (
                <Link
                  key={entry.id}
                  href={`/journal/${entry.id}`}
                  className="block rounded-3xl border border-line bg-paper p-5 hover:border-forest"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-muted">{formatDate(entry.entry_date)}</p>
                      <h2 className="mt-1 font-serif text-2xl">{entry.description}</h2>
                      <p className="mt-2 text-sm text-muted">
                        Entered by {entry.enterer?.display_name ?? "you"}
                        {entry.enterer?.role === "admin" ? " · administrator" : ""}
                      </p>
                    </div>
                    <p className="money text-lg font-medium">{formatMoney(total)}</p>
                  </div>
                  <ul className="mt-4 space-y-1 text-sm text-muted">
                    {entry.journal_lines.map((line) => (
                      <li key={line.id} className="flex justify-between gap-4">
                        <span>{accountNames.get(line.account_id) ?? "Account"}</span>
                        <span className="money">
                          {dollarsToCents(line.debit) > 0
                            ? `Dr ${formatMoney(dollarsToCents(line.debit))}`
                            : `Cr ${formatMoney(dollarsToCents(line.credit))}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
