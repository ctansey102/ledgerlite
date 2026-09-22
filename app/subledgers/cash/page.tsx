import Link from "next/link";
import { recordCashMovement } from "@/app/actions/subledgers";
import { AppShell } from "@/components/app-shell";
import { Notice } from "@/components/notice";
import {
  flattenLedgerLines,
  getAccounts,
  getLedgerLines,
  getProfile,
  getSubledgerPostings,
  requireUser,
} from "@/lib/data";
import { accountSignedBalance, accountTypeLabels, accountTypeOrder } from "@/lib/ledger";
import { dollarsToCents, formatDate, formatMoney, todayISO } from "@/lib/money";
import { cashBookSignedCents } from "@/lib/subledgers";
import { controlAccountFor } from "@/lib/control-accounts";

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [profile, accounts, postings, rawLines] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getSubledgerPostings(user.id, "cash"),
    getLedgerLines(user.id),
  ]);

  const cash = controlAccountFor(accounts, "cash");
  const lines = flattenLedgerLines(rawLines);
  const cashBalance = cash
    ? lines
        .filter((line) => line.account_id === cash.id)
        .reduce(
          (sum, line) =>
            sum +
            accountSignedBalance(
              cash,
              dollarsToCents(line.debit),
              dollarsToCents(line.credit),
            ),
          0,
        )
    : 0;

  const chronological = [...postings].sort((a, b) => {
    if (a.posting_date === b.posting_date) {
      return a.created_at.localeCompare(b.created_at);
    }
    return a.posting_date.localeCompare(b.posting_date);
  });
  const withRunning = chronological.reduce<
    Array<(typeof chronological)[number] & { running: number }>
  >((rows, posting) => {
    const previous = rows.at(-1)?.running ?? 0;
    rows.push({
      ...posting,
      running: previous + cashBookSignedCents(posting),
    });
    return rows;
  }, []);
  const displayRows = [...withRunning].reverse();

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-gold">
            Subledger
          </p>
          <h1 className="mt-1 font-serif text-4xl text-ink">Cash book</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Record receipts and disbursements here. Each movement posts a
            balanced journal entry against Cash and the other account you choose.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Cash on hand</p>
          <p className="money font-serif text-3xl">{formatMoney(cashBalance)}</p>
          {cash ? (
            <Link
              href={`/accounts/${cash.id}`}
              className="mt-1 inline-block text-sm text-forest hover:underline"
            >
              Open {cash.code} · {cash.name}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <Notice message={error} />
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <form
          action={recordCashMovement}
          className="rounded-3xl border border-line bg-paper p-5"
        >
          <input type="hidden" name="kind" value="receipt" />
          <h2 className="font-serif text-2xl">Cash receipt</h2>
          <p className="mt-1 text-sm text-muted">
            Debit Cash, credit the account money came from.
          </p>
          <div className="mt-4 grid gap-3">
            <input
              type="date"
              name="entry_date"
              required
              defaultValue={todayISO()}
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="amount"
              inputMode="decimal"
              placeholder="Amount"
              required
              className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <select
              name="offset_account_id"
              required
              defaultValue=""
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            >
              <option value="" disabled>
                Credit account
              </option>
              {accountTypeOrder.map((type) => (
                <optgroup key={type} label={accountTypeLabels[type]}>
                  {accounts
                    .filter(
                      (account) =>
                        account.type === type && account.subledger !== "cash",
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <input
              name="description"
              required
              placeholder="Client payment received"
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white">
              Post receipt
            </button>
          </div>
        </form>

        <form
          action={recordCashMovement}
          className="rounded-3xl border border-line bg-paper p-5"
        >
          <input type="hidden" name="kind" value="disbursement" />
          <h2 className="font-serif text-2xl">Cash disbursement</h2>
          <p className="mt-1 text-sm text-muted">
            Credit Cash, debit the expense or other account.
          </p>
          <div className="mt-4 grid gap-3">
            <input
              type="date"
              name="entry_date"
              required
              defaultValue={todayISO()}
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="amount"
              inputMode="decimal"
              placeholder="Amount"
              required
              className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <select
              name="offset_account_id"
              required
              defaultValue=""
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            >
              <option value="" disabled>
                Debit account
              </option>
              {accountTypeOrder.map((type) => (
                <optgroup key={type} label={accountTypeLabels[type]}>
                  {accounts
                    .filter(
                      (account) =>
                        account.type === type && account.subledger !== "cash",
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <input
              name="description"
              required
              placeholder="Paid rent"
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white">
              Post disbursement
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Cash book</h2>
        {displayRows.length === 0 ? (
          <p className="mt-4 rounded-3xl border border-dashed border-line bg-paper px-5 py-8 text-center text-muted">
            No cash movements yet. Post a receipt or disbursement to start the
            cash book.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-3xl border border-line bg-paper">
            <table className="min-w-full text-sm">
              <thead className="bg-sage/60 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Receipt</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Disbursement
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Entry</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-4 py-3">{formatDate(row.posting_date)}</td>
                    <td className="px-4 py-3">{row.description}</td>
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
                    <td className="px-4 py-3">
                      <Link
                        href={`/journal/${row.journal_entry_id}`}
                        className="text-forest hover:underline"
                      >
                        View
                      </Link>
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
