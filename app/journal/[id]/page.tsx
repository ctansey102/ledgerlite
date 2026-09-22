import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteJournalEntry } from "@/app/actions/journal";
import { AppShell } from "@/components/app-shell";
import { getAccounts, getEntry, getProfile, requireUser } from "@/lib/data";
import { dollarsToCents, formatDate, formatMoney } from "@/lib/money";

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [profile, accounts, entry] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getEntry(user.id, id),
  ]);

  if (!entry) notFound();

  const accountNames = new Map(accounts.map((account) => [account.id, account]));
  const total = entry.journal_lines.reduce(
    (sum, line) => sum + dollarsToCents(line.debit),
    0,
  );

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <Link href="/journal" className="text-sm text-forest hover:underline">
        Back to journal
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted">{formatDate(entry.entry_date)}</p>
          <h1 className="mt-1 font-serif text-4xl">{entry.description}</h1>
          <p className="mt-3 text-muted">
            Entered by {entry.enterer?.display_name ?? "you"} ·{" "}
            {new Date(entry.created_at).toLocaleString()}
            {entry.source && entry.source !== "manual"
              ? ` · From ${entry.source.toUpperCase()} subledger${entry.source_kind ? ` (${entry.source_kind})` : ""}`
              : ""}
          </p>
        </div>
        <form action={deleteJournalEntry}>
          <input type="hidden" name="id" value={entry.id} />
          <button className="rounded-full border border-line px-4 py-2 text-sm text-danger hover:border-danger">
            Delete entry
          </button>
        </form>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-paper">
        <table className="w-full text-sm">
          <thead className="bg-sage/60 text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 text-right font-medium">Debit</th>
              <th className="px-4 py-3 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entry.journal_lines.map((line) => {
              const account = accountNames.get(line.account_id);
              return (
                <tr key={line.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link
                      href={`/accounts/${line.account_id}`}
                      className="hover:text-forest"
                    >
                      {account
                        ? `${account.code} · ${account.name}`
                        : "Account"}
                    </Link>
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(line.debit) > 0
                      ? formatMoney(dollarsToCents(line.debit))
                      : ""}
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(line.credit) > 0
                      ? formatMoney(dollarsToCents(line.credit))
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-sage/40 font-medium">
              <td className="px-4 py-3">Totals</td>
              <td className="money px-4 py-3 text-right">{formatMoney(total)}</td>
              <td className="money px-4 py-3 text-right">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </AppShell>
  );
}
