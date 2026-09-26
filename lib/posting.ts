import { cache } from "react";
import { dollarsToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export type GlLineInput = {
  accountId: string;
  debitCents: number;
  creditCents: number;
};

export type SubledgerPostingInput = {
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

type CashAmount = { debitCents: number; creditCents: number };

/** Cash-book lines still needed so the cash subledger matches cash GL lines. */
export function missingCashPostings(input: {
  entryDate: string;
  description: string;
  lines: { accountId: string; debitCents: number; creditCents: number }[];
  cashAccountIds: ReadonlySet<string>;
  existing?: CashAmount[];
}): SubledgerPostingInput[] {
  const cashLines = input.lines.filter(
    (line) =>
      input.cashAccountIds.has(line.accountId) &&
      ((line.debitCents > 0 && line.creditCents === 0) ||
        (line.creditCents > 0 && line.debitCents === 0)),
  );
  const remaining = [...(input.existing ?? [])];
  const missing: SubledgerPostingInput[] = [];

  for (const line of cashLines) {
    const index = remaining.findIndex(
      (posting) =>
        posting.debitCents === line.debitCents &&
        posting.creditCents === line.creditCents,
    );
    if (index >= 0) {
      remaining.splice(index, 1);
      continue;
    }
    missing.push({
      subledger: "cash",
      kind: line.debitCents > 0 ? "receipt" : "disbursement",
      postingDate: input.entryDate,
      description: input.description,
      debitCents: line.debitCents,
      creditCents: line.creditCents,
    });
  }

  return missing;
}

function postingRows(
  userId: string,
  entryId: string,
  postings: SubledgerPostingInput[],
) {
  return postings.map((posting) => ({
    user_id: userId,
    subledger: posting.subledger,
    kind: posting.kind,
    posting_date: posting.postingDate,
    description: posting.description,
    debit: posting.debitCents / 100,
    credit: posting.creditCents / 100,
    customer_id: posting.customerId ?? null,
    vendor_id: posting.vendorId ?? null,
    asset_id: posting.assetId ?? null,
    inventory_item_id: posting.inventoryItemId ?? null,
    employee_id: posting.employeeId ?? null,
    quantity: posting.quantity ?? null,
    journal_entry_id: entryId,
  }));
}

export async function loadCashControlIds(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("subledger", "cash");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((account) => account.id));
}

/**
 * Adds cash-book rows for journal lines already posted to the cash control
 * account. Collections and payments from other subledgers used to hit Cash
 * in the GL without a matching cash subledger row.
 */
async function backfillCashSubledgerOnce(userId: string) {
  const cashAccountIds = await loadCashControlIds(userId);
  const ids = [...cashAccountIds];
  if (ids.length === 0) return;

  const supabase = await createClient();
  const [{ data: rawLines, error: lineError }, { data: existing, error: existingError }] =
    await Promise.all([
      supabase
        .from("journal_lines")
        .select(
          "account_id, debit, credit, entry_id, journal_entries!inner(entry_date, description)",
        )
        .eq("user_id", userId)
        .in("account_id", ids),
      supabase
        .from("subledger_postings")
        .select("journal_entry_id, debit, credit")
        .eq("user_id", userId)
        .eq("subledger", "cash"),
    ]);

  if (lineError) throw new Error(lineError.message);
  if (existingError) throw new Error(existingError.message);

  type CashLineRow = {
    account_id: string;
    debit: number | string;
    credit: number | string;
    entry_id: string;
    journal_entries:
      | { entry_date: string; description: string }
      | { entry_date: string; description: string }[]
      | null;
  };

  const groups = new Map<
    string,
    {
      entryDate: string;
      description: string;
      lines: { accountId: string; debitCents: number; creditCents: number }[];
      existing: CashAmount[];
    }
  >();

  for (const row of (rawLines ?? []) as CashLineRow[]) {
    const entry = Array.isArray(row.journal_entries)
      ? row.journal_entries[0]
      : row.journal_entries;
    if (!entry) continue;
    const current = groups.get(row.entry_id) ?? {
      entryDate: entry.entry_date,
      description: entry.description,
      lines: [],
      existing: [],
    };
    current.lines.push({
      accountId: row.account_id,
      debitCents: dollarsToCents(row.debit),
      creditCents: dollarsToCents(row.credit),
    });
    groups.set(row.entry_id, current);
  }

  for (const posting of existing ?? []) {
    const current = groups.get(posting.journal_entry_id);
    if (!current) continue;
    current.existing.push({
      debitCents: dollarsToCents(posting.debit),
      creditCents: dollarsToCents(posting.credit),
    });
  }

  const rows = [...groups.entries()].flatMap(([entryId, group]) =>
    postingRows(
      userId,
      entryId,
      missingCashPostings({
        entryDate: group.entryDate,
        description: group.description,
        lines: group.lines,
        cashAccountIds,
        existing: group.existing,
      }),
    ),
  );

  if (rows.length === 0) return;

  const { data: fresh, error: freshError } = await supabase
    .from("subledger_postings")
    .select("journal_entry_id, debit, credit")
    .eq("user_id", userId)
    .eq("subledger", "cash");
  if (freshError) throw new Error(freshError.message);

  const already = new Map<string, number>();
  for (const posting of fresh ?? []) {
    const key = `${posting.journal_entry_id}:${dollarsToCents(posting.debit)}:${dollarsToCents(posting.credit)}`;
    already.set(key, (already.get(key) ?? 0) + 1);
  }

  const pending = rows.filter((row) => {
    const key = `${row.journal_entry_id}:${dollarsToCents(row.debit)}:${dollarsToCents(row.credit)}`;
    const count = already.get(key) ?? 0;
    if (count > 0) {
      already.set(key, count - 1);
      return false;
    }
    return true;
  });

  if (pending.length === 0) return;

  const { error } = await supabase.from("subledger_postings").insert(pending);
  if (error) throw new Error(error.message);
}

export const backfillCashSubledger = cache(backfillCashSubledgerOnce);

export async function attachMissingCashPostings(options: {
  userId: string;
  entryId: string;
  entryDate: string;
  description: string;
  lines: { accountId: string; debitCents: number; creditCents: number }[];
}) {
  const cashAccountIds = await loadCashControlIds(options.userId);
  const missing = missingCashPostings({
    entryDate: options.entryDate,
    description: options.description,
    lines: options.lines,
    cashAccountIds,
  });
  if (missing.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("subledger_postings")
    .insert(postingRows(options.userId, options.entryId, missing));
  if (error) throw new Error(error.message);
}

/**
 * Posts a balanced GL journal entry and optional subsidiary-ledger detail
 * in one flow. Rolls back the journal entry if line or subledger inserts fail.
 */
export async function postBalancedEntry(options: {
  userId: string;
  entryDate: string;
  description: string;
  source: "manual" | "ar" | "ap" | "fa" | "inv" | "cash" | "payroll";
  sourceKind?: string;
  glLines: GlLineInput[];
  subledgerPostings?: SubledgerPostingInput[];
}) {
  const {
    userId,
    entryDate,
    description,
    source,
    sourceKind,
    glLines,
    subledgerPostings = [],
  } = options;

  const activeLines = glLines.filter(
    (line) => line.accountId && (line.debitCents > 0 || line.creditCents > 0),
  );

  if (activeLines.length < 2) {
    throw new Error("Every journal entry needs at least two lines.");
  }
  if (activeLines.some((line) => line.debitCents > 0 && line.creditCents > 0)) {
    throw new Error("A line can be a debit or a credit, not both.");
  }

  const debitTotal = activeLines.reduce((sum, line) => sum + line.debitCents, 0);
  const creditTotal = activeLines.reduce(
    (sum, line) => sum + line.creditCents,
    0,
  );
  if (debitTotal === 0 || debitTotal !== creditTotal) {
    throw new Error("Debits and credits must be equal before you can save.");
  }

  const supabase = await createClient();
  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      entered_by: userId,
      entry_date: entryDate,
      description,
      source,
      source_kind: sourceKind ?? null,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    throw new Error(entryError?.message ?? "Could not save the entry.");
  }

  const { error: lineError } = await supabase.from("journal_lines").insert(
    activeLines.map((line) => ({
      entry_id: entry.id,
      account_id: line.accountId,
      user_id: userId,
      debit: line.debitCents / 100,
      credit: line.creditCents / 100,
    })),
  );

  if (lineError) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    throw new Error(lineError.message);
  }

  try {
    const cashAccountIds = await loadCashControlIds(userId);
    const postings = [
      ...subledgerPostings,
      ...missingCashPostings({
        entryDate,
        description,
        lines: activeLines,
        cashAccountIds,
        existing: subledgerPostings
          .filter((posting) => posting.subledger === "cash")
          .map((posting) => ({
            debitCents: posting.debitCents,
            creditCents: posting.creditCents,
          })),
      }),
    ];

    if (postings.length > 0) {
      const { error: subError } = await supabase
        .from("subledger_postings")
        .insert(postingRows(userId, entry.id, postings));
      if (subError) throw new Error(subError.message);
    }
  } catch (error) {
    await supabase.from("subledger_postings").delete().eq("journal_entry_id", entry.id);
    await supabase.from("journal_lines").delete().eq("entry_id", entry.id);
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    throw error instanceof Error ? error : new Error("Could not post subledger detail.");
  }

  return entry.id as string;
}
