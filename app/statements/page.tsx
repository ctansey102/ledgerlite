import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PeriodForm } from "@/components/period-form";
import {
  flattenLedgerLines,
  getAccounts,
  getLedgerLines,
  getProfile,
  requireUser,
} from "@/lib/data";
import {
  balancesByAccount,
  buildCashFlow,
  netIncome,
  statementRows,
} from "@/lib/ledger";
import { formatDate, formatMoney } from "@/lib/money";
import { resolvePeriod, type PeriodKey } from "@/lib/periods";

function ledgerHref(ids: string[], from: string, to: string) {
  if (ids.length === 1) {
    return `/accounts/${ids[0]}?from=${from}&to=${to}`;
  }
  return `/accounts?highlight=${ids.join(",")}`;
}

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const period = (params.period as PeriodKey) || "this-month";
  const range = resolvePeriod(period, params.from, params.to);
  const [profile, accounts, rawLines] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getLedgerLines(user.id),
  ]);
  const lines = flattenLedgerLines(rawLines);
  const income = netIncome(accounts, lines, { from: range.from, to: range.to });
  const revenues = statementRows(accounts, lines, ["revenue"], range);
  const expenses = statementRows(accounts, lines, ["expense"], range);
  const asOf = balancesByAccount(accounts, lines, { to: range.to });
  const assets = asOf.filter((row) => row.account.type === "asset");
  const liabilities = asOf.filter((row) => row.account.type === "liability");
  const equity = asOf.filter((row) => row.account.type === "equity");
  const assetTotal = assets.reduce(
    (sum, row) => sum + (row.account.is_contra ? -row.signed : row.signed),
    0,
  );
  const liabilityTotal = liabilities.reduce((sum, row) => sum + row.signed, 0);
  const equityPosted = equity.reduce(
    (sum, row) => sum + (row.account.is_contra ? -row.signed : row.signed),
    0,
  );
  const equityTotal = equityPosted + income.net;
  const cashFlow = buildCashFlow(accounts, lines, range.from, range.to);

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <h1 className="font-serif text-4xl">Financial statements</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {range.label}: {formatDate(range.from)} through {formatDate(range.to)}.
        Click any line to see the journal entries behind it.
      </p>
      <div className="mt-6">
        <PeriodForm period={period} from={range.from} to={range.to} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-serif text-2xl">Income statement</h2>
          <StatementLines rows={revenues} from={range.from} to={range.to} />
          <p className="mt-3 flex justify-between border-t border-line pt-3 font-medium">
            <span>Total revenue</span>
            <span className="money">{formatMoney(income.revenue)}</span>
          </p>
          <StatementLines rows={expenses} from={range.from} to={range.to} />
          <p className="mt-3 flex justify-between border-t border-line pt-3 font-medium">
            <span>Total expenses</span>
            <span className="money">{formatMoney(income.expenses)}</span>
          </p>
          <p className="mt-4 flex justify-between rounded-2xl bg-sage px-4 py-3 font-serif text-xl">
            <span>Net income</span>
            <span className="money">{formatMoney(income.net)}</span>
          </p>
        </section>

        <section className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-serif text-2xl">Balance sheet</h2>
          <p className="text-sm text-muted">As of {formatDate(range.to)}</p>
          <h3 className="mt-4 text-sm font-medium uppercase tracking-wide text-muted">
            Assets
          </h3>
          <BalanceLines rows={assets} from={range.from} to={range.to} />
          <p className="mt-2 flex justify-between font-medium">
            <span>Total assets</span>
            <span className="money">{formatMoney(assetTotal)}</span>
          </p>
          <h3 className="mt-6 text-sm font-medium uppercase tracking-wide text-muted">
            Liabilities
          </h3>
          <BalanceLines rows={liabilities} from={range.from} to={range.to} />
          <p className="mt-2 flex justify-between font-medium">
            <span>Total liabilities</span>
            <span className="money">{formatMoney(liabilityTotal)}</span>
          </p>
          <h3 className="mt-6 text-sm font-medium uppercase tracking-wide text-muted">
            Equity
          </h3>
          <BalanceLines rows={equity} from={range.from} to={range.to} />
          <Link
            href={ledgerHref(
              accounts.filter((account) => ["revenue", "expense"].includes(account.type)).map((account) => account.id),
              range.from,
              range.to,
            )}
            className="mt-1 flex justify-between text-sm hover:text-forest"
          >
            <span>Current period net income</span>
            <span className="money">{formatMoney(income.net)}</span>
          </Link>
          <p className="mt-2 flex justify-between font-medium">
            <span>Total equity</span>
            <span className="money">{formatMoney(equityTotal)}</span>
          </p>
          <p className="mt-4 flex justify-between rounded-2xl bg-sage px-4 py-3 font-serif text-xl">
            <span>Liabilities + equity</span>
            <span className="money">{formatMoney(liabilityTotal + equityTotal)}</span>
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl">Statement of cash flows</h2>
        <p className="text-sm text-muted">Indirect method</p>
        <CashRow
          label="Net income"
          amount={cashFlow.netIncome}
          href={ledgerHref(
            accounts
              .filter((account) => ["revenue", "expense"].includes(account.type))
              .map((account) => account.id),
            range.from,
            range.to,
          )}
        />
        {cashFlow.depreciation !== 0 && (
          <CashRow
            label="Depreciation"
            amount={cashFlow.depreciation}
            href="/accounts"
          />
        )}
        {cashFlow.operatingChanges.map((row) => (
          <CashRow
            key={row.label}
            label={row.label}
            amount={row.amount}
            href={ledgerHref(row.accountIds, range.from, range.to)}
          />
        ))}
        <p className="mt-3 flex justify-between border-t border-line pt-3 font-medium">
          <span>Cash from operations</span>
          <span className="money">{formatMoney(cashFlow.cashFromOperations)}</span>
        </p>
        {cashFlow.investing.map((row) => (
          <CashRow
            key={row.label}
            label={row.label}
            amount={row.amount}
            href={ledgerHref(row.accountIds, range.from, range.to)}
          />
        ))}
        <p className="mt-3 flex justify-between border-t border-line pt-3 font-medium">
          <span>Cash from investing</span>
          <span className="money">{formatMoney(cashFlow.cashFromInvesting)}</span>
        </p>
        {cashFlow.financing.map((row) => (
          <CashRow
            key={row.label}
            label={row.label}
            amount={row.amount}
            href={ledgerHref(row.accountIds, range.from, range.to)}
          />
        ))}
        <p className="mt-3 flex justify-between border-t border-line pt-3 font-medium">
          <span>Cash from financing</span>
          <span className="money">{formatMoney(cashFlow.cashFromFinancing)}</span>
        </p>
        <div className="mt-4 rounded-2xl bg-sage px-4 py-3">
          <p className="flex justify-between font-serif text-xl">
            <span>Net change in cash</span>
            <span className="money">{formatMoney(cashFlow.netChange)}</span>
          </p>
          <Link
            href={ledgerHref(cashFlow.cashAccountIds, range.from, range.to)}
            className="mt-2 flex justify-between text-sm hover:text-forest"
          >
            <span>Beginning cash</span>
            <span className="money">{formatMoney(cashFlow.beginningCash)}</span>
          </Link>
          <Link
            href={ledgerHref(cashFlow.cashAccountIds, range.from, range.to)}
            className="mt-1 flex justify-between text-sm hover:text-forest"
          >
            <span>Ending cash</span>
            <span className="money">{formatMoney(cashFlow.endingCash)}</span>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function StatementLines({
  rows,
  from,
  to,
}: {
  rows: ReturnType<typeof statementRows>;
  from: string;
  to: string;
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-muted">No activity in this period yet.</p>;
  }

  return (
    <ul className="mt-3 space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.account.id}>
          <Link
            href={`/accounts/${row.account.id}?from=${from}&to=${to}`}
            className="flex justify-between hover:text-forest"
          >
            <span>{row.account.name}</span>
            <span className="money">{formatMoney(row.signed)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BalanceLines({
  rows,
  from,
  to,
}: {
  rows: ReturnType<typeof balancesByAccount>;
  from: string;
  to: string;
}) {
  const visible = rows.filter((row) => row.signed !== 0);
  if (visible.length === 0) {
    return <p className="mt-2 text-sm text-muted">No balances yet.</p>;
  }

  return (
    <ul className="mt-2 space-y-2 text-sm">
      {visible.map((row) => (
        <li key={row.account.id}>
          <Link
            href={`/accounts/${row.account.id}?from=${from}&to=${to}`}
            className="flex justify-between hover:text-forest"
          >
            <span>
              {row.account.is_contra ? "Less: " : ""}
              {row.account.name}
            </span>
            <span className="money">
              {formatMoney(row.account.is_contra ? row.signed : row.signed)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CashRow({
  label,
  amount,
  href,
}: {
  label: string;
  amount: number;
  href: string;
}) {
  return (
    <Link href={href} className="mt-2 flex justify-between text-sm hover:text-forest">
      <span>{label}</span>
      <span className="money">{formatMoney(amount)}</span>
    </Link>
  );
}
