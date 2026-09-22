import Link from "next/link";
import {
  createCustomer,
  postArInvoice,
  postArPayment,
} from "@/app/actions/subledgers";
import { AppShell } from "@/components/app-shell";
import { Notice } from "@/components/notice";
import { controlAccountFor } from "@/lib/control-accounts";
import {
  flattenLedgerLines,
  getAccounts,
  getCustomers,
  getLedgerLines,
  getProfile,
  getSubledgerPostings,
  requireUser,
} from "@/lib/data";
import { formatDate, formatMoney, todayISO } from "@/lib/money";
import { dollarsToCents } from "@/lib/money";
import {
  controlBalanceCents,
  sumPartyBalances,
  subledgerTotalCents,
} from "@/lib/subledgers";

export default async function ArSubledgerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [profile, accounts, customers, postings, rawLines] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getCustomers(user.id),
    getSubledgerPostings(user.id, "ar"),
    getLedgerLines(user.id),
  ]);

  const lines = flattenLedgerLines(rawLines);
  const control = controlAccountFor(accounts, "ar");
  const glBalance = control
    ? controlBalanceCents(
        control,
        lines.filter((line) => line.account_id === control.id),
      )
    : 0;
  const subTotal = subledgerTotalCents("ar", postings);
  const balances = sumPartyBalances("ar", postings, "customer_id");
  const revenueAccounts = accounts.filter((account) => account.type === "revenue");
  const cashAccounts = accounts.filter(
    (account) =>
      account.cash_flow_section === "cash" || account.code === "1000",
  );

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <Link href="/subledgers" className="text-sm text-forest hover:underline">
        Back to subledgers
      </Link>
      <h1 className="mt-4 font-serif text-4xl">Accounts receivable</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Invoices debit the customer and the AR control account; payments credit
        both. Open a customer to see their detail ledger.
      </p>
      <Notice message={error} />

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-sm text-muted">Subledger total</p>
          <p className="money mt-2 font-serif text-3xl">{formatMoney(subTotal)}</p>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-sm text-muted">
            {control ? `${control.code} · ${control.name}` : "AR control"}
          </p>
          <p className="money mt-2 font-serif text-3xl">{formatMoney(glBalance)}</p>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-sm text-muted">Reconciliation</p>
          <p
            className={`mt-2 font-serif text-2xl ${subTotal === glBalance ? "text-forest-dark" : "text-danger"}`}
          >
            {subTotal === glBalance ? "Tied to GL" : "Out of balance"}
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-serif text-2xl">Customers</h2>
          {customers.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Add a customer, then record an invoice.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-line">
                    <td className="py-3">
                      <Link
                        href={`/subledgers/ar/${customer.id}`}
                        className="hover:text-forest"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="money py-3 text-right">
                      {formatMoney(balances.get(customer.id)?.signed ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium text-forest">
              Add customer
            </summary>
            <form action={createCustomer} className="mt-3 grid gap-3">
              <input
                name="name"
                required
                placeholder="Customer name"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="email"
                type="email"
                placeholder="Email (optional)"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <button className="rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white">
                Save customer
              </button>
            </form>
          </details>
        </section>

        <section className="space-y-6">
          <form
            action={postArInvoice}
            className="rounded-3xl border border-line bg-paper p-5"
          >
            <h2 className="font-serif text-2xl">Record invoice</h2>
            <p className="mt-1 text-sm text-muted">
              Dr Accounts Receivable · Cr Revenue
            </p>
            <div className="mt-4 grid gap-3">
              <select
                name="customer_id"
                required
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
                defaultValue=""
              >
                <option value="" disabled>
                  Customer
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="entry_date"
                required
                defaultValue={todayISO()}
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="description"
                required
                placeholder="Invoice for landscaping services"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="amount"
                required
                inputMode="decimal"
                placeholder="Amount"
                className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <select
                name="revenue_account_id"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
                defaultValue={revenueAccounts[0]?.id ?? ""}
              >
                {revenueAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
              <button className="rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white">
                Post invoice to GL
              </button>
            </div>
          </form>

          <form
            action={postArPayment}
            className="rounded-3xl border border-line bg-paper p-5"
          >
            <h2 className="font-serif text-2xl">Record payment</h2>
            <p className="mt-1 text-sm text-muted">
              Dr Cash · Cr Accounts Receivable
            </p>
            <div className="mt-4 grid gap-3">
              <select
                name="customer_id"
                required
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
                defaultValue=""
              >
                <option value="" disabled>
                  Customer
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="entry_date"
                required
                defaultValue={todayISO()}
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="description"
                required
                placeholder="Payment received"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="amount"
                required
                inputMode="decimal"
                placeholder="Amount"
                className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <select
                name="cash_account_id"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
                defaultValue={cashAccounts[0]?.id ?? ""}
              >
                {cashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
              <button className="rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white">
                Post payment to GL
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-line bg-paper">
        <h2 className="bg-sage/60 px-4 py-3 font-serif text-xl">
          Recent AR postings
        </h2>
        {postings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No AR activity yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {postings.slice(0, 20).map((posting) => (
                <tr key={posting.id} className="border-t border-line">
                  <td className="px-4 py-3">{formatDate(posting.posting_date)}</td>
                  <td className="px-4 py-3 capitalize">{posting.kind}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/journal/${posting.journal_entry_id}`}
                      className="hover:text-forest"
                    >
                      {posting.description}
                    </Link>
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(posting.debit) > 0
                      ? formatMoney(dollarsToCents(posting.debit))
                      : ""}
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(posting.credit) > 0
                      ? formatMoney(dollarsToCents(posting.credit))
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
