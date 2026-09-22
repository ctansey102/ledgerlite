"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Account } from "@/lib/database.types";
import { accountTypeLabels, accountTypeOrder } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";

type Row = {
  account: Account;
  debit: number;
  credit: number;
  signed: number;
};

export function AccountsBrowser({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [view, setView] = useState<"accounts" | "trial">("accounts");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const haystack = `${row.account.code} ${row.account.name}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesType = type === "all" || row.account.type === type;
      return matchesQuery && matchesType;
    });
  }, [query, rows, type]);

  function trialSides(row: Row) {
    if (row.account.normal_balance === "debit") {
      return row.signed >= 0
        ? { debit: row.signed, credit: 0 }
        : { debit: 0, credit: Math.abs(row.signed) };
    }
    return row.signed >= 0
      ? { debit: 0, credit: row.signed }
      : { debit: Math.abs(row.signed), credit: 0 };
  }

  const trialRows = filtered.filter((row) => row.signed !== 0);
  const trialTotals = trialRows.reduce(
    (sum, row) => {
      const sides = trialSides(row);
      sum.debit += sides.debit;
      sum.credit += sides.credit;
      return sum;
    },
    { debit: 0, credit: 0 },
  );

  const grouped = accountTypeOrder
    .map((accountType) => ({
      type: accountType,
      rows: filtered.filter((row) => row.account.type === accountType),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Cash, revenue, rent..."
          className="w-full rounded-full border border-line bg-paper px-4 py-3 outline-none focus:border-forest lg:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("accounts")}
            className={`rounded-full px-4 py-2 text-sm ${view === "accounts" ? "bg-forest text-white" : "border border-line bg-paper"}`}
          >
            Chart of accounts
          </button>
          <button
            type="button"
            onClick={() => setView("trial")}
            className={`rounded-full px-4 py-2 text-sm ${view === "trial" ? "bg-forest text-white" : "border border-line bg-paper"}`}
          >
            Trial balance
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...accountTypeOrder].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setType(item)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              type === item ? "bg-sage text-forest-dark" : "text-muted hover:text-ink"
            }`}
          >
            {item === "all" ? "All types" : accountTypeLabels[item]}
          </button>
        ))}
      </div>

      {view === "accounts" ? (
        <div className="space-y-4">
          {grouped.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line bg-paper px-5 py-8 text-center text-muted">
              No accounts match that search. Try &quot;Cash&quot; or clear the filter.
            </p>
          ) : (
            grouped.map((group) => (
              <section key={group.type} className="overflow-hidden rounded-3xl border border-line bg-paper">
                <h2 className="bg-sage/60 px-4 py-3 font-serif text-xl">
                  {accountTypeLabels[group.type]}
                </h2>
                <table className="w-full text-sm">
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.account.id} className="border-t border-line">
                        <td className="px-4 py-3">
                          <Link href={`/accounts/${row.account.id}`} className="hover:text-forest">
                            <span className="mr-3 text-muted">{row.account.code}</span>
                            {row.account.name}
                            {row.account.subledger ? (
                              <span className="ml-2 text-xs uppercase tracking-wide text-gold">
                                {row.account.subledger.replace("_", " ")} control
                              </span>
                            ) : null}
                          </Link>
                        </td>
                        <td className="money px-4 py-3 text-right">
                          {formatMoney(row.signed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-sage/60 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialRows.map((row) => {
                const sides = trialSides(row);
                return (
                  <tr key={row.account.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link href={`/accounts/${row.account.id}`} className="hover:text-forest">
                        {row.account.code} · {row.account.name}
                      </Link>
                    </td>
                    <td className="money px-4 py-3 text-right">
                      {sides.debit ? formatMoney(sides.debit) : ""}
                    </td>
                    <td className="money px-4 py-3 text-right">
                      {sides.credit ? formatMoney(sides.credit) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-sage/40 font-medium">
                <td className="px-4 py-3">Totals</td>
                <td className="money px-4 py-3 text-right">
                  {formatMoney(trialTotals.debit)}
                </td>
                <td className="money px-4 py-3 text-right">
                  {formatMoney(trialTotals.credit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
