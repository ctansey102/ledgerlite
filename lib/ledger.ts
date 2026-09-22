import type { Account } from "@/lib/database.types";
import { dollarsToCents } from "@/lib/money";

export type LedgerLine = {
  account_id: string;
  debit: number | string;
  credit: number | string;
  entry_id?: string;
  entry_date?: string;
};

export function accountSignedBalance(
  account: Pick<Account, "normal_balance">,
  debitCents: number,
  creditCents: number,
) {
  return account.normal_balance === "debit"
    ? debitCents - creditCents
    : creditCents - debitCents;
}

export function sumLines(lines: LedgerLine[]) {
  return lines.reduce(
    (totals, line) => {
      totals.debit += dollarsToCents(line.debit);
      totals.credit += dollarsToCents(line.credit);
      return totals;
    },
    { debit: 0, credit: 0 },
  );
}

export function balancesByAccount(
  accounts: Account[],
  lines: LedgerLine[],
  options?: { from?: string; to?: string; before?: string },
) {
  const totals = new Map<string, { debit: number; credit: number }>();

  for (const account of accounts) {
    totals.set(account.id, { debit: 0, credit: 0 });
  }

  for (const line of lines) {
    if (options?.from && line.entry_date && line.entry_date < options.from) {
      continue;
    }
    if (options?.to && line.entry_date && line.entry_date > options.to) {
      continue;
    }
    if (options?.before && line.entry_date && line.entry_date >= options.before) {
      continue;
    }

    const current = totals.get(line.account_id) ?? { debit: 0, credit: 0 };
    current.debit += dollarsToCents(line.debit);
    current.credit += dollarsToCents(line.credit);
    totals.set(line.account_id, current);
  }

  return accounts.map((account) => {
    const { debit, credit } = totals.get(account.id) ?? { debit: 0, credit: 0 };
    const signed = accountSignedBalance(account, debit, credit);
    return { account, debit, credit, signed };
  });
}

export function statementRows(
  accounts: Account[],
  lines: LedgerLine[],
  types: Account["type"][],
  range?: { from?: string; to?: string },
) {
  return balancesByAccount(accounts, lines, range)
    .filter((row) => types.includes(row.account.type) && row.signed !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));
}

export function netIncome(
  accounts: Account[],
  lines: LedgerLine[],
  range?: { from: string; to: string },
) {
  const rows = balancesByAccount(accounts, lines, range);
  const revenue = rows
    .filter((row) => row.account.type === "revenue")
    .reduce((sum, row) => sum + row.signed, 0);
  const expenses = rows
    .filter((row) => row.account.type === "expense")
    .reduce((sum, row) => sum + row.signed, 0);
  return { revenue, expenses, net: revenue - expenses };
}

export function buildCashFlow(
  accounts: Account[],
  lines: LedgerLine[],
  from: string,
  to: string,
) {
  const beginning = balancesByAccount(accounts, lines, { before: from });
  const ending = balancesByAccount(accounts, lines, { to });
  const period = balancesByAccount(accounts, lines, { from, to });
  const income = netIncome(accounts, lines, { from, to });

  const beginningMap = new Map(beginning.map((row) => [row.account.id, row]));
  const endingMap = new Map(ending.map((row) => [row.account.id, row]));

  const depreciation = period
    .filter((row) =>
      row.account.name.toLowerCase().includes("depreciation expense"),
    )
    .reduce((sum, row) => sum + row.signed, 0);

  const operatingChanges: {
    label: string;
    amount: number;
    accountIds: string[];
  }[] = [];
  const investing: { label: string; amount: number; accountIds: string[] }[] =
    [];
  const financing: { label: string; amount: number; accountIds: string[] }[] =
    [];

  for (const row of period) {
    const start = beginningMap.get(row.account.id)?.signed ?? 0;
    const end = endingMap.get(row.account.id)?.signed ?? 0;
    const change = end - start;

    if (change === 0) continue;
    if (row.account.cash_flow_section === "cash") continue;
    if (row.account.type === "revenue" || row.account.type === "expense") {
      continue;
    }

    if (row.account.name.toLowerCase().includes("accumulated depreciation")) {
      continue;
    }

    const label = row.account.name;
    const ids = [row.account.id];

    if (row.account.cash_flow_section === "investing") {
      investing.push({ label, amount: -change, accountIds: ids });
      continue;
    }

    if (row.account.cash_flow_section === "financing") {
      const amount = row.account.is_contra ? -change : change;
      financing.push({ label, amount, accountIds: ids });
      continue;
    }

    if (row.account.type === "asset") {
      operatingChanges.push({
        label: `Change in ${label}`,
        amount: -change,
        accountIds: ids,
      });
    } else if (row.account.type === "liability") {
      operatingChanges.push({
        label: `Change in ${label}`,
        amount: change,
        accountIds: ids,
      });
    }
  }

  const cashFromOperations =
    income.net +
    depreciation +
    operatingChanges.reduce((sum, row) => sum + row.amount, 0);
  const cashFromInvesting = investing.reduce((sum, row) => sum + row.amount, 0);
  const cashFromFinancing = financing.reduce((sum, row) => sum + row.amount, 0);
  const netChange =
    cashFromOperations + cashFromInvesting + cashFromFinancing;

  const cashAccounts = accounts.filter(
    (account) => account.cash_flow_section === "cash",
  );
  const beginningCash = cashAccounts.reduce(
    (sum, account) =>
      sum + (beginningMap.get(account.id)?.signed ?? 0),
    0,
  );
  const endingCash = cashAccounts.reduce(
    (sum, account) => sum + (endingMap.get(account.id)?.signed ?? 0),
    0,
  );

  return {
    netIncome: income.net,
    depreciation,
    operatingChanges,
    cashFromOperations,
    investing,
    cashFromInvesting,
    financing,
    cashFromFinancing,
    netChange,
    beginningCash,
    endingCash,
    cashAccountIds: cashAccounts.map((account) => account.id),
  };
}

export const accountTypeLabels: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

export const accountTypeOrder = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;
