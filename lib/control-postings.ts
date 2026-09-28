import type { AccountSubledger } from "@/lib/database.types";

export const UNASSIGNED_PARTY_NAME = "Unassigned (general journal)";

export type ControlPostingDraft = {
  subledger: "ar" | "ap" | "fa" | "inv" | "cash" | "payroll";
  kind: string;
  postingDate: string;
  description: string;
  debitCents: number;
  creditCents: number;
  customerId?: string | null;
  vendorId?: string | null;
  assetId?: string | null;
  inventoryItemId?: string | null;
  employeeId?: string | null;
  quantity?: number | null;
};

export type ControlGlLine = {
  accountId: string;
  debitCents: number;
  creditCents: number;
  partyId?: string | null;
};

export type ExistingControlPosting = {
  subledger: string;
  debitCents: number;
  creditCents: number;
};

export type UncoveredControlLine = {
  accountId: string;
  subledger: Exclude<AccountSubledger, "cash">;
  debitCents: number;
  creditCents: number;
};

/** Accumulated depreciation is not its own subsidiary ledger.
 *  Its general-ledger movement is mirrored on the fixed-asset subledger so
 *  net book value stays equal to equipment minus accumulated depreciation. */
export function controlPostingSubledger(
  subledger: AccountSubledger,
): ControlPostingDraft["subledger"] {
  return subledger === "fa_accum" ? "fa" : subledger;
}

export function controlPostingKind(
  subledger: AccountSubledger,
  debitCents: number,
) {
  switch (subledger) {
    case "cash":
      return debitCents > 0 ? "receipt" : "disbursement";
    case "ar":
      return debitCents > 0 ? "invoice" : "payment";
    case "ap":
      return debitCents > 0 ? "disbursement" : "bill";
    case "fa":
      return debitCents > 0 ? "acquisition" : "disposal";
    case "fa_accum":
      return debitCents > 0 ? "disposal" : "depreciation";
    case "inv":
      return "adjustment";
    case "payroll":
      return "wage";
  }
}

export function partyNoun(subledger: AccountSubledger) {
  switch (subledger) {
    case "ar":
      return "customer";
    case "ap":
      return "vendor";
    case "fa":
    case "fa_accum":
      return "asset";
    case "inv":
      return "inventory item";
    case "payroll":
      return "employee";
    case "cash":
      return "cash account";
  }
}

function withParty(
  subledger: AccountSubledger,
  partyId: string,
): Pick<
  ControlPostingDraft,
  "customerId" | "vendorId" | "assetId" | "inventoryItemId" | "employeeId"
> {
  switch (subledger) {
    case "ar":
      return { customerId: partyId };
    case "ap":
      return { vendorId: partyId };
    case "fa":
    case "fa_accum":
      return { assetId: partyId };
    case "inv":
      return { inventoryItemId: partyId };
    case "payroll":
      return { employeeId: partyId };
    case "cash":
      return {};
  }
}

function isSingleSided(debitCents: number, creditCents: number) {
  return (
    (debitCents > 0 && creditCents === 0) ||
    (creditCents > 0 && debitCents === 0)
  );
}

/**
 * Subsidiary rows still needed so each control-account general-ledger line
 * has matching subledger detail. Cash does not need a party. Every other
 * control account does, and those lines are returned in `needsParty` until
 * one is supplied.
 */
export function missingControlPostings(input: {
  entryDate: string;
  description: string;
  lines: ControlGlLine[];
  accountSubledgers: { id: string; subledger: AccountSubledger }[];
  existing?: ExistingControlPosting[];
}): { postings: ControlPostingDraft[]; needsParty: UncoveredControlLine[] } {
  const subledgerByAccount = new Map(
    input.accountSubledgers.map((account) => [account.id, account.subledger]),
  );
  const remaining = [...(input.existing ?? [])];
  const postings: ControlPostingDraft[] = [];
  const needsParty: UncoveredControlLine[] = [];

  for (const line of input.lines) {
    const subledger = subledgerByAccount.get(line.accountId);
    if (!subledger) continue;
    if (!isSingleSided(line.debitCents, line.creditCents)) continue;

    const target = controlPostingSubledger(subledger);
    const index = remaining.findIndex(
      (posting) =>
        posting.subledger === target &&
        posting.debitCents === line.debitCents &&
        posting.creditCents === line.creditCents,
    );
    if (index >= 0) {
      remaining.splice(index, 1);
      continue;
    }

    if (subledger !== "cash" && !line.partyId) {
      needsParty.push({
        accountId: line.accountId,
        subledger,
        debitCents: line.debitCents,
        creditCents: line.creditCents,
      });
      continue;
    }

    postings.push({
      subledger: target,
      kind: controlPostingKind(subledger, line.debitCents),
      postingDate: input.entryDate,
      description: input.description,
      debitCents: line.debitCents,
      creditCents: line.creditCents,
      ...(line.partyId ? withParty(subledger, line.partyId) : {}),
    });
  }

  return { postings, needsParty };
}
