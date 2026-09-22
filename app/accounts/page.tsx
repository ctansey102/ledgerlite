import { createAccount } from "@/app/actions/journal";
import { AccountsBrowser } from "@/components/accounts-browser";
import { AppShell } from "@/components/app-shell";
import { Notice } from "@/components/notice";
import {
  flattenLedgerLines,
  getAccounts,
  getLedgerLines,
  getProfile,
  requireUser,
} from "@/lib/data";
import { balancesByAccount } from "@/lib/ledger";
import { todayISO } from "@/lib/money";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [profile, accounts, rawLines] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getLedgerLines(user.id),
  ]);
  const rows = balancesByAccount(accounts, flattenLedgerLines(rawLines), {
    to: todayISO(),
  });

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <h1 className="font-serif text-4xl">Chart of accounts</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Search any account, check its balance, then open the general ledger to
        see every journal entry that touched it — including who entered it.
      </p>
      <div className="mt-8">
        <Notice message={error} />
        <AccountsBrowser rows={rows} />
      </div>

      <details className="mt-8 rounded-3xl border border-line bg-paper p-5">
        <summary className="cursor-pointer font-medium text-ink">
          Add another account
        </summary>
        <form action={createAccount} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="code"
            placeholder="5800"
            required
            className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
          />
          <input
            name="name"
            placeholder="Fuel Expense"
            required
            className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
          />
          <select
            name="type"
            className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            defaultValue="expense"
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
          </select>
          <select
            name="cash_flow_section"
            className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            defaultValue="operating"
          >
            <option value="operating">Operating</option>
            <option value="investing">Investing</option>
            <option value="financing">Financing</option>
            <option value="cash">Cash</option>
          </select>
          <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white sm:col-span-2">
            Save account
          </button>
        </form>
      </details>
    </AppShell>
  );
}
