import type { Account } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type SubledgerKey =
  | "ar"
  | "ap"
  | "fa"
  | "fa_accum"
  | "inv"
  | "cash"
  | "payroll";

export const CONTROL_ACCOUNT_DEFAULTS: Record<
  SubledgerKey,
  {
    code: string;
    name: string;
    type: Account["type"];
    normal_balance: "debit" | "credit";
    cash_flow_section: string | null;
    is_contra: boolean;
  }
> = {
  ar: {
    code: "1100",
    name: "Accounts Receivable",
    type: "asset",
    normal_balance: "debit",
    cash_flow_section: "operating",
    is_contra: false,
  },
  ap: {
    code: "2000",
    name: "Accounts Payable",
    type: "liability",
    normal_balance: "credit",
    cash_flow_section: "operating",
    is_contra: false,
  },
  fa: {
    code: "1500",
    name: "Equipment",
    type: "asset",
    normal_balance: "debit",
    cash_flow_section: "investing",
    is_contra: false,
  },
  fa_accum: {
    code: "1550",
    name: "Accumulated Depreciation — Equipment",
    type: "asset",
    normal_balance: "credit",
    cash_flow_section: "investing",
    is_contra: true,
  },
  inv: {
    code: "1300",
    name: "Inventory",
    type: "asset",
    normal_balance: "debit",
    cash_flow_section: "operating",
    is_contra: false,
  },
  cash: {
    code: "1000",
    name: "Cash",
    type: "asset",
    normal_balance: "debit",
    cash_flow_section: "cash",
    is_contra: false,
  },
  payroll: {
    code: "5400",
    name: "Wages Expense",
    type: "expense",
    normal_balance: "debit",
    cash_flow_section: "operating",
    is_contra: false,
  },
};

const SUPPORTING_DEFAULTS = [
  {
    code: "1000",
    name: "Cash",
    type: "asset" as const,
    normal_balance: "debit" as const,
    cash_flow_section: "cash",
    is_contra: false,
    subledger: "cash" as const,
  },
  {
    code: "4000",
    name: "Service Revenue",
    type: "revenue" as const,
    normal_balance: "credit" as const,
    cash_flow_section: "operating",
    is_contra: false,
  },
  {
    code: "5000",
    name: "Cost of Goods Sold",
    type: "expense" as const,
    normal_balance: "debit" as const,
    cash_flow_section: "operating",
    is_contra: false,
  },
  {
    code: "5700",
    name: "Depreciation Expense",
    type: "expense" as const,
    normal_balance: "debit" as const,
    cash_flow_section: "operating",
    is_contra: false,
  },
];

async function findOrCreateAccount(
  userId: string,
  draft: {
    code: string;
    name: string;
    type: string;
    normal_balance: string;
    cash_flow_section: string | null;
    is_contra: boolean;
    subledger?: SubledgerKey | null;
  },
) {
  const supabase = await createClient();

  async function adopt(account: Account) {
    const patch: {
      subledger?: SubledgerKey;
      cash_flow_section?: string;
    } = {};
    if (draft.subledger && !account.subledger) {
      patch.subledger = draft.subledger;
    }
    if (draft.cash_flow_section && !account.cash_flow_section) {
      patch.cash_flow_section = draft.cash_flow_section;
    }
    if (Object.keys(patch).length === 0) return account;

    const { data: updated, error } = await supabase
      .from("accounts")
      .update(patch)
      .eq("id", account.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error || !updated) throw error ?? new Error("Could not update account");
    return updated as Account;
  }

  if (draft.subledger) {
    const { data: bySubledger } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("subledger", draft.subledger)
      .maybeSingle();
    if (bySubledger) return adopt(bySubledger as Account);
  }

  const { data: byCode } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("code", draft.code)
    .maybeSingle();

  if (byCode) return adopt(byCode as Account);

  const { data: byName } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", draft.name)
    .maybeSingle();

  if (byName) return adopt(byName as Account);

  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      code: draft.code,
      name: draft.name,
      type: draft.type,
      normal_balance: draft.normal_balance,
      cash_flow_section: draft.cash_flow_section,
      is_contra: draft.is_contra,
      subledger: draft.subledger ?? null,
    })
    .select("*")
    .single();

  if (error || !created) throw error ?? new Error("Could not create account");
  return created as Account;
}

/** Ensures AR/AP/FA/Inventory/Cash/Payroll control accounts (and companions) exist. */
export async function ensureControlAccounts(userId: string) {
  const controls = {
    ar: await findOrCreateAccount(userId, {
      ...CONTROL_ACCOUNT_DEFAULTS.ar,
      subledger: "ar",
    }),
    ap: await findOrCreateAccount(userId, {
      ...CONTROL_ACCOUNT_DEFAULTS.ap,
      subledger: "ap",
    }),
    fa: await findOrCreateAccount(userId, {
      ...CONTROL_ACCOUNT_DEFAULTS.fa,
      subledger: "fa",
    }),
    fa_accum: await findOrCreateAccount(userId, {
      ...CONTROL_ACCOUNT_DEFAULTS.fa_accum,
      subledger: "fa_accum",
    }),
    inv: await findOrCreateAccount(userId, {
      ...CONTROL_ACCOUNT_DEFAULTS.inv,
      subledger: "inv",
    }),
    cash: await findOrCreateAccount(userId, {
      ...CONTROL_ACCOUNT_DEFAULTS.cash,
      subledger: "cash",
    }),
    payroll: await findOrCreateAccount(userId, {
      ...CONTROL_ACCOUNT_DEFAULTS.payroll,
      subledger: "payroll",
    }),
  };

  const revenue = await findOrCreateAccount(userId, SUPPORTING_DEFAULTS[1]);
  const cogs = await findOrCreateAccount(userId, SUPPORTING_DEFAULTS[2]);
  const depreciationExpense = await findOrCreateAccount(
    userId,
    SUPPORTING_DEFAULTS[3],
  );

  return { ...controls, revenue, cogs, depreciationExpense };
}

export function controlAccountFor(
  accounts: Account[],
  key: SubledgerKey,
): Account | undefined {
  const tagged = accounts.find(
    (account) => (account as Account & { subledger?: string | null }).subledger === key,
  );
  if (tagged) return tagged;
  const defaults = CONTROL_ACCOUNT_DEFAULTS[key];
  return (
    accounts.find((account) => account.code === defaults.code) ??
    accounts.find(
      (account) => account.name.toLowerCase() === defaults.name.toLowerCase(),
    )
  );
}
