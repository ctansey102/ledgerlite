"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { dollarsToCents } from "@/lib/money";
import { attachMissingCashPostings } from "@/lib/posting";
import { revalidateBooks } from "@/lib/revalidate-books";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createJournalEntry(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const entryDate = asString(formData.get("entry_date"));
  const description = asString(formData.get("description"));
  const accountIds = formData.getAll("account_id").map(asString);
  const debits = formData.getAll("debit").map(asString);
  const credits = formData.getAll("credit").map(asString);

  if (!entryDate || !description) {
    redirect("/journal/new?error=Add a date and a short description.");
  }

  const lines = accountIds
    .map((accountId, index) => ({
      accountId,
      debitCents: dollarsToCents(debits[index]),
      creditCents: dollarsToCents(credits[index]),
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

  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      user_id: user.id,
      entered_by: user.id,
      entry_date: entryDate,
      description,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    redirect(
      `/journal/new?error=${encodeURIComponent(entryError?.message ?? "Could not save the entry.")}`,
    );
  }

  const { error: lineError } = await supabase.from("journal_lines").insert(
    lines.map((line) => ({
      entry_id: entry.id,
      account_id: line.accountId,
      user_id: user.id,
      debit: line.debitCents / 100,
      credit: line.creditCents / 100,
    })),
  );

  if (lineError) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    redirect(`/journal/new?error=${encodeURIComponent(lineError.message)}`);
  }

  try {
    await attachMissingCashPostings({
      userId: user.id,
      entryId: entry.id,
      entryDate,
      description,
      lines,
    });
  } catch (error) {
    await supabase.from("subledger_postings").delete().eq("journal_entry_id", entry.id);
    await supabase.from("journal_lines").delete().eq("entry_id", entry.id);
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    redirect(
      `/journal/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not update the cash book.")}`,
    );
  }

  revalidateBooks();
  redirect(`/journal/${entry.id}`);
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
