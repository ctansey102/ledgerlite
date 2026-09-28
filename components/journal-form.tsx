"use client";

import { useMemo, useState } from "react";
import { createJournalEntry } from "@/app/actions/journal";
import { Notice } from "@/components/notice";
import type { Account, AccountSubledger } from "@/lib/database.types";
import { accountTypeLabels, accountTypeOrder } from "@/lib/ledger";
import { dollarsToCents, formatMoney, todayISO } from "@/lib/money";

type PartyOption = { id: string; name: string };

type Line = {
  accountId: string;
  debit: string;
  credit: string;
  partyId: string;
};

const emptyLine = (): Line => ({
  accountId: "",
  debit: "",
  credit: "",
  partyId: "",
});

function partyField(subledger: AccountSubledger) {
  switch (subledger) {
    case "ar":
      return { bucket: "ar" as const, label: "Customer" };
    case "ap":
      return { bucket: "ap" as const, label: "Vendor" };
    case "fa":
    case "fa_accum":
      return { bucket: "fa" as const, label: "Asset" };
    case "inv":
      return { bucket: "inv" as const, label: "Item" };
    case "payroll":
      return { bucket: "payroll" as const, label: "Employee" };
    case "cash":
      return null;
  }
}

export function JournalForm({
  accounts,
  error,
  controlSubledgers,
  parties,
}: {
  accounts: Account[];
  error?: string;
  controlSubledgers: Partial<Record<string, AccountSubledger>>;
  parties: {
    ar: PartyOption[];
    ap: PartyOption[];
    fa: PartyOption[];
    inv: PartyOption[];
    payroll: PartyOption[];
  };
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
  const partyMissing = lines.some((line) => {
    const subledger = controlSubledgers[line.accountId];
    if (!subledger || subledger === "cash") return false;
    if (dollarsToCents(line.debit) <= 0 && dollarsToCents(line.credit) <= 0) {
      return false;
    }
    return !line.partyId;
  });
  const ready = balanced && !partyMissing;

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
              <div className="grid gap-2">
                <select
                  name="account_id"
                  value={line.accountId}
                  onChange={(event) =>
                    updateLine(index, {
                      accountId: event.target.value,
                      partyId: "",
                    })
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
                {(() => {
                  const subledger = controlSubledgers[line.accountId];
                  const field = subledger ? partyField(subledger) : null;
                  if (!field) {
                    return <input type="hidden" name="party_id" value="" />;
                  }
                  const options = parties[field.bucket];
                  return (
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted">
                        {field.label}
                      </span>
                      <select
                        name="party_id"
                        required={
                          dollarsToCents(line.debit) > 0 ||
                          dollarsToCents(line.credit) > 0
                        }
                        value={line.partyId}
                        onChange={(event) =>
                          updateLine(index, { partyId: event.target.value })
                        }
                        className="w-full rounded-2xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-forest"
                      >
                        <option value="">
                          {options.length === 0
                            ? `Add a ${field.label.toLowerCase()} in the subledger first`
                            : `Choose ${field.label.toLowerCase()}`}
                        </option>
                        {options.map((party) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })()}
              </div>
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
            {partyMissing ? (
              <p className="mt-1 text-danger">
                Choose who each control-account line belongs to so the
                subledger stays in balance.
              </p>
            ) : balanced ? (
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
        disabled={!ready}
        className="rounded-full bg-forest px-6 py-3 font-medium text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save journal entry
      </button>
    </form>
  );
}
