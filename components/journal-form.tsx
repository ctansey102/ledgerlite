"use client";

import { useMemo, useState } from "react";
import { createJournalEntry } from "@/app/actions/journal";
import { Notice } from "@/components/notice";
import type { Account } from "@/lib/database.types";
import { accountTypeLabels, accountTypeOrder } from "@/lib/ledger";
import { dollarsToCents, formatMoney, todayISO } from "@/lib/money";

type Line = {
  accountId: string;
  debit: string;
  credit: string;
};

const emptyLine = (): Line => ({ accountId: "", debit: "", credit: "" });

export function JournalForm({
  accounts,
  error,
}: {
  accounts: Account[];
  error?: string;
}) {
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        sum.debit += dollarsToCents(line.debit);
        sum.credit += dollarsToCents(line.credit);
        return sum;
      },
      { debit: 0, credit: 0 },
    );
  }, [lines]);

  const balanced = totals.debit > 0 && totals.debit === totals.credit;
  const difference = totals.debit - totals.credit;

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  return (
    <form action={createJournalEntry} className="space-y-6">
      <Notice message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Transaction date</span>
          <input
            type="date"
            name="entry_date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-forest"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block text-muted">What happened?</span>
          <input
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            placeholder="Received $1,200 from a landscaping client"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-forest"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-3xl border border-line bg-paper">
        <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr] gap-3 border-b border-line bg-sage/50 px-4 py-3 text-sm text-muted sm:grid">
          <span>Account</span>
          <span className="text-right">Debit</span>
          <span className="text-right">Credit</span>
        </div>
        <div className="divide-y divide-line">
          {lines.map((line, index) => (
            <div
              key={index}
              className="grid gap-3 px-4 py-4 sm:grid-cols-[1.4fr_0.7fr_0.7fr]"
            >
              <select
                name="account_id"
                value={line.accountId}
                onChange={(event) =>
                  updateLine(index, { accountId: event.target.value })
                }
                className="rounded-2xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-forest"
              >
                <option value="">Choose an account</option>
                {accountTypeOrder.map((type) => (
                  <optgroup key={type} label={accountTypeLabels[type]}>
                    {accounts
                      .filter((account) => account.type === type)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <input
                name="debit"
                inputMode="decimal"
                placeholder="0.00"
                value={line.debit}
                onChange={(event) =>
                  updateLine(index, { debit: event.target.value, credit: "" })
                }
                className="money rounded-2xl border border-line bg-white px-3 py-3 text-right outline-none focus:border-forest"
              />
              <input
                name="credit"
                inputMode="decimal"
                placeholder="0.00"
                value={line.credit}
                onChange={(event) =>
                  updateLine(index, { credit: event.target.value, debit: "" })
                }
                className="money rounded-2xl border border-line bg-white px-3 py-3 text-right outline-none focus:border-forest"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setLines((current) => [...current, emptyLine()])}
            className="text-sm text-forest hover:underline"
          >
            Add another line
          </button>
          <div className="text-sm">
            <p className="money">
              Debits {formatMoney(totals.debit)} · Credits {formatMoney(totals.credit)}
            </p>
            {balanced ? (
              <p className="mt-1 text-forest-dark">
                This entry balances. You&apos;re ready to save it.
              </p>
            ) : (
              <p className="mt-1 text-muted">
                Difference {formatMoney(Math.abs(difference))}. Add the other
                side so debits equal credits.
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        disabled={!balanced}
        className="rounded-full bg-forest px-6 py-3 font-medium text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save journal entry
      </button>
    </form>
  );
}
