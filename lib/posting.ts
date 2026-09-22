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

  if (subledgerPostings.length > 0) {
    const { error: subError } = await supabase.from("subledger_postings").insert(
      subledgerPostings.map((posting) => ({
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
        journal_entry_id: entry.id,
      })),
    );

    if (subError) {
      await supabase.from("journal_lines").delete().eq("entry_id", entry.id);
      await supabase.from("journal_entries").delete().eq("id", entry.id);
      throw new Error(subError.message);
    }
  }

  return entry.id as string;
}
