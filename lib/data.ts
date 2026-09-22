import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  Customer,
  Employee,
  FixedAsset,
  InventoryItem,
  JournalEntry,
  JournalLine,
  Profile,
  SubledgerPosting,
  Vendor,
} from "@/lib/database.types";

export async function getAuthUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub as string, email: String(data.claims.email ?? "") };
}

export async function requireUser() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data as Profile | null;
}

export async function getAccounts(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("code");
  if (error) throw error;
  return (data ?? []) as Account[];
}

export type EntryWithLines = JournalEntry & {
  journal_lines: JournalLine[];
  enterer: Pick<Profile, "display_name" | "role"> | null;
};

export async function getEntries(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(
      "*, journal_lines(*), enterer:profiles!entered_by(display_name, role)",
    )
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EntryWithLines[];
}

export async function getEntry(userId: string, entryId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*, journal_lines(*), enterer:profiles!entered_by(display_name, role)")
    .eq("user_id", userId)
    .eq("id", entryId)
    .maybeSingle();
  if (error) throw error;
  return data as EntryWithLines | null;
}

export type LineWithEntry = JournalLine & {
  journal_entries: Pick<JournalEntry, "id" | "entry_date" | "description" | "entered_by"> & {
    enterer: Pick<Profile, "display_name"> | null;
  };
};

export async function getLedgerLines(userId: string, accountId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("journal_lines")
    .select(
      "*, journal_entries!inner(id, entry_date, description, entered_by, enterer:profiles!entered_by(display_name))",
    )
    .eq("user_id", userId);

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LineWithEntry[];
}

export function flattenLedgerLines(lines: LineWithEntry[]) {
  return lines.map((line) => ({
    ...line,
    entry_date: line.journal_entries.entry_date,
    description: line.journal_entries.description,
    entered_by_name: line.journal_entries.enterer?.display_name ?? "Unknown",
  }));
}

export async function getCustomers(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function getVendors(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Vendor[];
}

export async function getFixedAssets(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixed_assets")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as FixedAsset[];
}

export async function getInventoryItems(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", userId)
    .order("sku");
  if (error) throw error;
  return (data ?? []) as InventoryItem[];
}

export async function getEmployees(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Employee[];
}

export async function getSubledgerPostings(
  userId: string,
  subledger?: "ar" | "ap" | "fa" | "inv" | "cash" | "payroll",
) {
  const supabase = await createClient();
  let query = supabase
    .from("subledger_postings")
    .select("*")
    .eq("user_id", userId)
    .order("posting_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (subledger) {
    query = query.eq("subledger", subledger);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SubledgerPosting[];
}

export async function getCustomer(userId: string, customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data as Customer | null;
}

export async function getVendor(userId: string, vendorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", userId)
    .eq("id", vendorId)
    .maybeSingle();
  if (error) throw error;
  return data as Vendor | null;
}

export async function getFixedAsset(userId: string, assetId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixed_assets")
    .select("*")
    .eq("user_id", userId)
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw error;
  return data as FixedAsset | null;
}
