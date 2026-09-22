import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  flattenLedgerLines,
  getAccounts,
  getLedgerLines,
  getProfile,
  requireUser,
} from "@/lib/data";
import { accountSignedBalance } from "@/lib/ledger";
import { dollarsToCents, formatDate, formatMoney } from "@/lib/money";

export default async function AccountLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const user = await requireUser();
  const [profile, accounts, rawLines] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getLedgerLines(user.id, id),
  ]);

  const account = accounts.find((item) => item.id === id);
  if (!account) notFound();

  const lines = flattenLedgerLines(rawLines)
    .filter((line) => (!from || line.entry_date >= from) && (!to || line.entry_date <= to))
    .sort((a, b) => {
      if (a.entry_date === b.entry_date) return a.id.localeCompare(b.id);
      return a.entry_date.localeCompare(b.entry_date);
    });

  let running = 0;
  const rows = lines.map((line) => {
    running += accountSignedBalance(
      account,
      dollarsToCents(line.debit),
      dollarsToCents(line.credit),
    );
    return { ...line, running };
  });

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <Link href="/accounts" className="text-sm text-forest hover:underline">
        Back to accounts
      </Link>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-gold">
            General ledger
          </p>
          <h1 className="font-serif text-4xl">
            {account.code} · {account.name}
          </h1>
          <p className="mt-2 text-muted">
            {from && to
              ? `Showing activity from ${from} to ${to}.`
              : "Every posted line for this account, with a running balance."}
          </p>
        </div>
        <p className="money font-serif text-3xl">{formatMoney(running)}</p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-line bg-paper px-5 py-10 text-center text-muted">
          Nothing has posted to {account.name} yet. Record a journal entry that
          uses this account and it will show up here.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-3xl border border-line bg-paper">
          <table className="min-w-full text-sm">
            <thead className="bg-sage/60 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Entered by</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">{formatDate(row.entry_date)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/journal/${row.entry_id}`} className="hover:text-forest">
                      {row.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.entered_by_name}</td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(row.debit) > 0
                      ? formatMoney(dollarsToCents(row.debit))
                      : ""}
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(row.credit) > 0
                      ? formatMoney(dollarsToCents(row.credit))
                      : ""}
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {formatMoney(row.running)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
