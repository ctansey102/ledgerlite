import type { Account } from "@/lib/database.types";
import { accountSignedBalance } from "@/lib/ledger";
import { dollarsToCents } from "@/lib/money";

export type SubledgerPostingLine = {
  debit: number | string;
  credit: number | string;
  customer_id?: string | null;
  vendor_id?: string | null;
  asset_id?: string | null;
  posting_date?: string;
};

/** AR/FA detail: debit increases the subsidiary balance; credit decreases it.
 *  AP detail: credit increases the subsidiary balance; debit decreases it. */
export function partySignedBalance(
  subledger: "ar" | "ap" | "fa",
  debitCents: number,
  creditCents: number,
) {
  if (subledger === "ap") return creditCents - debitCents;
  return debitCents - creditCents;
}

export function sumPartyBalances(
  subledger: "ar" | "ap" | "fa",
  postings: SubledgerPostingLine[],
  partyKey: "customer_id" | "vendor_id" | "asset_id",
) {
  const map = new Map<string, { debit: number; credit: number; signed: number }>();

  for (const posting of postings) {
    const partyId = posting[partyKey];
    if (!partyId) continue;
    const current = map.get(partyId) ?? { debit: 0, credit: 0, signed: 0 };
    current.debit += dollarsToCents(posting.debit);
    current.credit += dollarsToCents(posting.credit);
    current.signed = partySignedBalance(subledger, current.debit, current.credit);
    map.set(partyId, current);
  }

  return map;
}

export function controlBalanceCents(
  account: Pick<Account, "normal_balance"> | undefined,
  glLines: { debit: number | string; credit: number | string }[],
) {
  if (!account) return 0;
  let debit = 0;
  let credit = 0;
  for (const line of glLines) {
    debit += dollarsToCents(line.debit);
    credit += dollarsToCents(line.credit);
  }
  return accountSignedBalance(account, debit, credit);
}

export function subledgerTotalCents(
  subledger: "ar" | "ap" | "fa",
  postings: SubledgerPostingLine[],
) {
  return postings.reduce((sum, posting) => {
    return (
      sum +
      partySignedBalance(
        subledger,
        dollarsToCents(posting.debit),
        dollarsToCents(posting.credit),
      )
    );
  }, 0);
}

/** Straight-line monthly depreciation in cents (cost and salvage in dollars). */
export function monthlyDepreciationCents(
  cost: number | string,
  salvage: number | string,
  usefulLifeMonths: number,
) {
  if (usefulLifeMonths <= 0) return 0;
  const depreciable = dollarsToCents(cost) - dollarsToCents(salvage);
  if (depreciable <= 0) return 0;
  return Math.floor(depreciable / usefulLifeMonths);
}
