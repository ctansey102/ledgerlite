"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, requireUser } from "@/lib/data";
import { controlSubledgerByAccountId } from "@/lib/control-accounts";
import { missingControlPostings, partyNoun } from "@/lib/control-postings";
import type { AccountSubledger } from "@/lib/database.types";
import { dollarsToCents } from "@/lib/money";
import { postBalancedEntry } from "@/lib/posting";
import { revalidateBooks } from "@/lib/revalidate-books";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function assertOwnedParty(
  userId: string,
  subledger: AccountSubledger,
  partyId: string,
) {
  const supabase = await createClient();
  const label = partyNoun(subledger);

  if (subledger === "ar") {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .eq("id", partyId)
      .maybeSingle();
    if (error || !data) throw new Error(`That ${label} was not found.`);
    return;
  }
  if (subledger === "ap") {
    const { data, error } = await supabase
      .from("vendors")
      .select("id")
      .eq("user_id", userId)
      .eq("id", partyId)
      .maybeSingle();
    if (error || !data) throw new Error(`That ${label} was not found.`);
    return;
  }
  if (subledger === "fa" || subledger === "fa_accum") {
    const { data, error } = await supabase
      .from("fixed_assets")
      .select("id")
      .eq("user_id", userId)
      .eq("id", partyId)
      .maybeSingle();
    if (error || !data) throw new Error(`That ${label} was not found.`);
    return;
  }
  if (subledger === "inv") {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("user_id", userId)
      .eq("id", partyId)
      .maybeSingle();
    if (error || !data) throw new Error(`That ${label} was not found.`);
    return;
  }
  if (subledger === "payroll") {
    const { data, error } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", userId)
      .eq("id", partyId)
      .maybeSingle();
    if (error || !data) throw new Error(`That ${label} was not found.`);
  }
}

export async function createJournalEntry(formData: FormData) {
  const user = await requireUser();

  const entryDate = asString(formData.get("entry_date"));
  const description = asString(formData.get("description"));
  const accountIds = formData.getAll("account_id").map(asString);
  const debits = formData.getAll("debit").map(asString);
  const credits = formData.getAll("credit").map(asString);
  const partyIds = formData.getAll("party_id").map(asString);

  if (!entryDate || !description) {
    redirect("/journal/new?error=Add a date and a short description.");
  }

  const lines = accountIds
    .map((accountId, index) => ({
      accountId,
      debitCents: dollarsToCents(debits[index]),
      creditCents: dollarsToCents(credits[index]),
      partyId: partyIds[index] || null,
    }))
    .filter((line) => line.accountId && (line.debitCents > 0 || line.creditCents > 0));

  if (lines.length < 2) {
    redirect("/journal/new?error=Every journal entry needs at least two lines.");
  }

  if (lines.some((line) => line.debitCents > 0 && line.creditCents > 0)) {
    redirect("/journal/new?error=A line can be a debit or a credit, not both.");
  }

  const debitTotal = lines.reduce((sum, line) => sum + line.debitCents, 0);
  const creditTotal = lines.reduce((sum, line) => sum + line.creditCents, 0);

  if (debitTotal === 0 || debitTotal !== creditTotal) {
    redirect("/journal/new?error=Debits and credits must be equal before you can save.");
  }

  const accounts = await getAccounts(user.id);
  const subledgerById = controlSubledgerByAccountId(accounts);
  const reconciled = missingControlPostings({
    entryDate,
    description,
    lines,
    accountSubledgers: Object.entries(subledgerById).flatMap(([id, subledger]) =>
      subledger ? [{ id, subledger }] : [],
    ),
  });

  if (reconciled.needsParty.length > 0) {
    const missing = reconciled.needsParty[0];
    const account = accounts.find((row) => row.id === missing.accountId);
    redirect(
      `/journal/new?error=${encodeURIComponent(
        `Choose a ${partyNoun(missing.subledger)} for ${account?.name ?? "that control account"} so its subledger stays in balance with the general ledger.`,
      )}`,
    );
  }

  let entryId: string;
  try {
    for (const line of lines) {
      const subledger = subledgerById[line.accountId];
      if (!subledger || subledger === "cash" || !line.partyId) continue;
      await assertOwnedParty(user.id, subledger, line.partyId);
    }

    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "manual",
      glLines: lines,
      subledgerPostings: reconciled.postings,
    });
  } catch (error) {
    redirect(
      `/journal/new?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Could not save the entry.",
      )}`,
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

export async function deleteJournalEntry(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const id = asString(formData.get("id"));

  if (!id) redirect("/journal");

  await supabase
    .from("subledger_postings")
    .delete()
    .eq("journal_entry_id", id)
    .eq("user_id", user.id);
  await supabase.from("journal_lines").delete().eq("entry_id", id).eq("user_id", user.id);
  await supabase.from("journal_entries").delete().eq("id", id).eq("user_id", user.id);

  revalidateBooks();
  redirect("/journal");
}

export async function createAccount(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const code = asString(formData.get("code"));
  const name = asString(formData.get("name"));
  const type = asString(formData.get("type"));
  const cashFlowSection = asString(formData.get("cash_flow_section"));

  if (!code || !name || !type) {
    redirect("/accounts?error=Add a code, name, and account type.");
  }

  const lowerName = name.toLowerCase();
  const isContra =
    lowerName.includes("draw") || lowerName.includes("accumulated");
  const normalBalance = isContra
    ? type === "asset"
      ? "credit"
      : "debit"
    : type === "asset" || type === "expense"
      ? "debit"
      : "credit";

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    code,
    name,
    type,
    normal_balance: normalBalance,
    cash_flow_section: cashFlowSection || null,
    is_contra: isContra,
  });

  if (error) {
    redirect(`/accounts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/accounts");
  revalidatePath("/journal");
  redirect("/accounts");
}
