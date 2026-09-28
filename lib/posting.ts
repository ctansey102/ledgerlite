import { cache } from "react";
import {
  controlSubledgerByAccountId,
  type SubledgerKey,
} from "@/lib/control-accounts";
import {
  missingControlPostings,
  UNASSIGNED_PARTY_NAME,
  type ControlPostingDraft,
  type ExistingControlPosting,
} from "@/lib/control-postings";
import type { Account } from "@/lib/database.types";
import { dollarsToCents, todayISO } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export type GlLineInput = {
  accountId: string;
  debitCents: number;
  creditCents: number;
};

export type SubledgerPostingInput = ControlPostingDraft;

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

async function loadControlAccounts(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const accounts = (data ?? []) as Account[];
  const subledgerById = controlSubledgerByAccountId(accounts);
  const accountSubledgers = Object.entries(subledgerById).flatMap(
    ([id, subledger]) => (subledger ? [{ id, subledger }] : []),
  );
  return { accountSubledgers };
}

type PartyKind = "ar" | "ap" | "fa" | "inv" | "payroll";

function partyKindFor(subledger: SubledgerKey): PartyKind | null {
  if (subledger === "cash") return null;
  if (subledger === "fa_accum") return "fa";
  return subledger;
}

async function ensureUnassignedParty(userId: string, kind: PartyKind) {
  const supabase = await createClient();
  const notes =
    "General-journal amounts that were not posted to a specific subsidiary record.";

  if (kind === "ar") {
    return ensurePartyByName(userId, "customers", notes);
  }
  if (kind === "ap") {
    return ensurePartyByName(userId, "vendors", notes);
  }
  if (kind === "payroll") {
    return ensurePartyByName(userId, "employees", notes);
  }
  if (kind === "inv") {
    return ensureUnassignedItem(userId, notes);
  }

  const { data: existing, error: existingError } = await supabase
    .from("fixed_assets")
    .select("id")
    .eq("user_id", userId)
    .eq("name", UNASSIGNED_PARTY_NAME)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existing?.[0]) return existing[0].id;

  const { data: created, error } = await supabase
    .from("fixed_assets")
    .insert({
      user_id: userId,
      name: UNASSIGNED_PARTY_NAME,
      acquisition_date: todayISO(),
      cost: 0,
      salvage_value: 0,
      useful_life_months: 1,
      status: "active",
      notes,
    })
    .select("id")
    .single();
  if (created) return created.id;
  if (error?.code === "23505") {
    const { data: again, error: againError } = await supabase
      .from("fixed_assets")
      .select("id")
      .eq("user_id", userId)
      .eq("name", UNASSIGNED_PARTY_NAME)
      .limit(1);
    if (againError) throw new Error(againError.message);
    if (again?.[0]) return again[0].id;
  }
  throw new Error(error?.message ?? "Could not record unassigned asset activity.");
}

async function ensurePartyByName(
  userId: string,
  table: "customers" | "vendors" | "employees",
  notes: string,
) {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .eq("name", UNASSIGNED_PARTY_NAME)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existing?.[0]) return existing[0].id;

  const { data: created, error } = await supabase
    .from(table)
    .insert({ user_id: userId, name: UNASSIGNED_PARTY_NAME, notes })
    .select("id")
    .single();
  if (created) return created.id;
  throw new Error(error?.message ?? "Could not record unassigned subledger activity.");
}

async function ensureUnassignedItem(userId: string, notes: string) {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("user_id", userId)
    .eq("sku", "UNASSIGNED")
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existing?.[0]) return existing[0].id;

  const { data: created, error } = await supabase
    .from("inventory_items")
    .insert({
      user_id: userId,
      sku: "UNASSIGNED",
      name: UNASSIGNED_PARTY_NAME,
      unit_cost: 0,
      notes,
    })
    .select("id")
    .single();
  if (created) return created.id;
  if (error?.code === "23505") {
    const { data: again, error: againError } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("user_id", userId)
      .eq("sku", "UNASSIGNED")
      .limit(1);
    if (againError) throw new Error(againError.message);
    if (again?.[0]) return again[0].id;
  }
  throw new Error(error?.message ?? "Could not record unassigned inventory activity.");
}

/**
 * Adds subsidiary rows for control-account lines that were posted in the
 * general journal without matching detail. Cash is recorded directly. Other
 * control accounts are parked on an unassigned party so the totals can tie.
 */
async function backfillControlSubledgersOnce(userId: string) {
  const { accountSubledgers } = await loadControlAccounts(userId);
  const ids = accountSubledgers.map((account) => account.id);
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
        .select("journal_entry_id, subledger, debit, credit")
        .eq("user_id", userId),
    ]);

  if (lineError) throw new Error(lineError.message);
  if (existingError) throw new Error(existingError.message);

  type ControlLineRow = {
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
      existing: ExistingControlPosting[];
    }
  >();

  for (const row of (rawLines ?? []) as ControlLineRow[]) {
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
      subledger: posting.subledger,
      debitCents: dollarsToCents(posting.debit),
      creditCents: dollarsToCents(posting.credit),
    });
  }

  const partyIds = new Map<PartyKind, string>();
  const drafts: { entryId: string; posting: ControlPostingDraft }[] = [];

  for (const [entryId, group] of groups) {
    const uncovered = missingControlPostings({
      entryDate: group.entryDate,
      description: group.description,
      lines: group.lines,
      accountSubledgers,
      existing: group.existing,
    });
    if (uncovered.needsParty.length === 0) {
      for (const posting of uncovered.postings) {
        drafts.push({ entryId, posting });
      }
      continue;
    }

    const kindsNeeded = new Set<PartyKind>();
    for (const need of uncovered.needsParty) {
      const kind = partyKindFor(need.subledger);
      if (kind) kindsNeeded.add(kind);
    }
    for (const kind of kindsNeeded) {
      if (!partyIds.has(kind)) {
        partyIds.set(kind, await ensureUnassignedParty(userId, kind));
      }
    }

    const lines = group.lines.map((line) => {
      const subledger = accountSubledgers.find(
        (account) => account.id === line.accountId,
      )?.subledger;
      const kind = subledger ? partyKindFor(subledger) : null;
      if (
        !kind ||
        !uncovered.needsParty.some((need) => need.accountId === line.accountId)
      ) {
        return line;
      }
      return { ...line, partyId: partyIds.get(kind) };
    });

    const reconciled = missingControlPostings({
      entryDate: group.entryDate,
      description: group.description,
      lines,
      accountSubledgers,
      existing: group.existing,
    });
    for (const posting of reconciled.postings) {
      drafts.push({ entryId, posting });
    }
  }

  const rows = drafts.flatMap(({ entryId, posting }) =>
    postingRows(userId, entryId, [posting]),
  );
  if (rows.length === 0) return;

  const { data: fresh, error: freshError } = await supabase
    .from("subledger_postings")
    .select("journal_entry_id, subledger, debit, credit")
    .eq("user_id", userId);
  if (freshError) throw new Error(freshError.message);

  const already = new Map<string, number>();
  for (const posting of fresh ?? []) {
    const key = `${posting.journal_entry_id}:${posting.subledger}:${dollarsToCents(posting.debit)}:${dollarsToCents(posting.credit)}`;
    already.set(key, (already.get(key) ?? 0) + 1);
  }

  const pending = rows.filter((row) => {
    const key = `${row.journal_entry_id}:${row.subledger}:${dollarsToCents(row.debit)}:${dollarsToCents(row.credit)}`;
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

export const backfillControlSubledgers = cache(backfillControlSubledgersOnce);

export async function syncControlSubledgers(userId: string) {
  try {
    await backfillControlSubledgers(userId);
  } catch (error) {
    console.error("Could not sync subledgers with the general ledger.", error);
  }
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
    const { accountSubledgers } = await loadControlAccounts(userId);
    const reconciled = missingControlPostings({
      entryDate,
      description,
      lines: activeLines,
      accountSubledgers,
      existing: subledgerPostings.map((posting) => ({
        subledger: posting.subledger,
        debitCents: posting.debitCents,
        creditCents: posting.creditCents,
      })),
    });
    if (reconciled.needsParty.length > 0) {
      throw new Error(
        "Choose a customer, vendor, asset, item, or employee for each control account so the subledger stays in balance with the general ledger.",
      );
    }
    const postings = [...subledgerPostings, ...reconciled.postings];

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
