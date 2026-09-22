"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureControlAccounts } from "@/lib/control-accounts";
import { requireUser } from "@/lib/data";
import { dollarsToCents } from "@/lib/money";
import { postBalancedEntry } from "@/lib/posting";
import { monthlyDepreciationCents } from "@/lib/subledgers";
import { createClient } from "@/lib/supabase/server";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function revalidateBooks() {
  revalidatePath("/dashboard");
  revalidatePath("/journal");
  revalidatePath("/accounts");
  revalidatePath("/statements");
  revalidatePath("/subledgers");
  revalidatePath("/subledgers/ar");
  revalidatePath("/subledgers/ap");
  revalidatePath("/subledgers/fa");
  revalidatePath("/subledgers/cash");
  revalidatePath("/subledgers/inventory");
  revalidatePath("/subledgers/payroll");
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function ensureSubledgerAccountsAction() {
  const user = await requireUser();
  try {
    await ensureControlAccounts(user.id);
  } catch (error) {
    fail(
      "/subledgers",
      error instanceof Error ? error.message : "Could not set up control accounts.",
    );
  }
  revalidateBooks();
  redirect("/subledgers?message=Control+accounts+are+ready.");
}

export async function createCustomer(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const name = asString(formData.get("name"));
  const email = asString(formData.get("email"));
  const notes = asString(formData.get("notes"));

  if (!name) fail("/subledgers/ar", "Add a customer name.");

  const { error } = await supabase.from("customers").insert({
    user_id: user.id,
    name,
    email: email || null,
    notes: notes || null,
  });

  if (error) fail("/subledgers/ar", error.message);

  revalidatePath("/subledgers/ar");
  redirect("/subledgers/ar");
}

export async function createVendor(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const name = asString(formData.get("name"));
  const email = asString(formData.get("email"));
  const notes = asString(formData.get("notes"));

  if (!name) fail("/subledgers/ap", "Add a vendor name.");

  const { error } = await supabase.from("vendors").insert({
    user_id: user.id,
    name,
    email: email || null,
    notes: notes || null,
  });

  if (error) fail("/subledgers/ap", error.message);

  revalidatePath("/subledgers/ap");
  redirect("/subledgers/ap");
}

/** AR invoice: Dr AR control, Cr revenue; subsidiary debit to customer. */
export async function postArInvoice(formData: FormData) {
  const user = await requireUser();
  const customerId = asString(formData.get("customer_id"));
  const entryDate = asString(formData.get("entry_date"));
  const description = asString(formData.get("description"));
  const amountCents = dollarsToCents(asString(formData.get("amount")));
  const revenueAccountId = asString(formData.get("revenue_account_id"));

  if (!customerId || !entryDate || !description || amountCents <= 0) {
    fail("/subledgers/ar", "Add customer, date, description, and amount.");
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    const revenueId = revenueAccountId || controls.revenue.id;
    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "ar",
      sourceKind: "invoice",
      glLines: [
        { accountId: controls.ar.id, debitCents: amountCents, creditCents: 0 },
        { accountId: revenueId, debitCents: 0, creditCents: amountCents },
      ],
      subledgerPostings: [
        {
          subledger: "ar",
          kind: "invoice",
          postingDate: entryDate,
          description,
          debitCents: amountCents,
          creditCents: 0,
          customerId,
        },
      ],
    });
  } catch (error) {
    fail(
      "/subledgers/ar",
      error instanceof Error ? error.message : "Could not post the invoice.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

/** AR payment: Dr cash, Cr AR control; subsidiary credit to customer. */
export async function postArPayment(formData: FormData) {
  const user = await requireUser();
  const customerId = asString(formData.get("customer_id"));
  const entryDate = asString(formData.get("entry_date"));
  const description = asString(formData.get("description"));
  const amountCents = dollarsToCents(asString(formData.get("amount")));
  const cashAccountId = asString(formData.get("cash_account_id"));

  if (!customerId || !entryDate || !description || amountCents <= 0) {
    fail("/subledgers/ar", "Add customer, date, description, and amount.");
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    const cashId = cashAccountId || controls.cash.id;
    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "ar",
      sourceKind: "payment",
      glLines: [
        { accountId: cashId, debitCents: amountCents, creditCents: 0 },
        { accountId: controls.ar.id, debitCents: 0, creditCents: amountCents },
      ],
      subledgerPostings: [
        {
          subledger: "ar",
          kind: "payment",
          postingDate: entryDate,
          description,
          debitCents: 0,
          creditCents: amountCents,
          customerId,
        },
      ],
    });
  } catch (error) {
    fail(
      "/subledgers/ar",
      error instanceof Error ? error.message : "Could not post the payment.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

/** AP bill: Dr expense/asset, Cr AP control; subsidiary credit to vendor. */
export async function postApBill(formData: FormData) {
  const user = await requireUser();
  const vendorId = asString(formData.get("vendor_id"));
  const entryDate = asString(formData.get("entry_date"));
  const description = asString(formData.get("description"));
  const amountCents = dollarsToCents(asString(formData.get("amount")));
  const expenseAccountId = asString(formData.get("expense_account_id"));

  if (
    !vendorId ||
    !entryDate ||
    !description ||
    amountCents <= 0 ||
    !expenseAccountId
  ) {
    fail(
      "/subledgers/ap",
      "Add vendor, date, description, amount, and expense account.",
    );
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "ap",
      sourceKind: "bill",
      glLines: [
        {
          accountId: expenseAccountId,
          debitCents: amountCents,
          creditCents: 0,
        },
        { accountId: controls.ap.id, debitCents: 0, creditCents: amountCents },
      ],
      subledgerPostings: [
        {
          subledger: "ap",
          kind: "bill",
          postingDate: entryDate,
          description,
          debitCents: 0,
          creditCents: amountCents,
          vendorId,
        },
      ],
    });
  } catch (error) {
    fail(
      "/subledgers/ap",
      error instanceof Error ? error.message : "Could not post the bill.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

/** AP payment: Dr AP control, Cr cash; subsidiary debit to vendor. */
export async function postApPayment(formData: FormData) {
  const user = await requireUser();
  const vendorId = asString(formData.get("vendor_id"));
  const entryDate = asString(formData.get("entry_date"));
  const description = asString(formData.get("description"));
  const amountCents = dollarsToCents(asString(formData.get("amount")));
  const cashAccountId = asString(formData.get("cash_account_id"));

  if (!vendorId || !entryDate || !description || amountCents <= 0) {
    fail("/subledgers/ap", "Add vendor, date, description, and amount.");
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    const cashId = cashAccountId || controls.cash.id;
    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "ap",
      sourceKind: "disbursement",
      glLines: [
        { accountId: controls.ap.id, debitCents: amountCents, creditCents: 0 },
        { accountId: cashId, debitCents: 0, creditCents: amountCents },
      ],
      subledgerPostings: [
        {
          subledger: "ap",
          kind: "disbursement",
          postingDate: entryDate,
          description,
          debitCents: amountCents,
          creditCents: 0,
          vendorId,
        },
      ],
    });
  } catch (error) {
    fail(
      "/subledgers/ap",
      error instanceof Error ? error.message : "Could not post the payment.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

/** FA acquisition (cash or AP with vendor): register + GL + FA subledger. */
export async function acquireFixedAsset(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const name = asString(formData.get("name"));
  const assetTag = asString(formData.get("asset_tag"));
  const entryDate = asString(formData.get("entry_date"));
  const cost = asString(formData.get("cost"));
  const salvage = asString(formData.get("salvage_value")) || "0";
  const lifeMonths = Number(asString(formData.get("useful_life_months")));
  const payFrom = asString(formData.get("pay_from")) || "cash";
  const vendorId = asString(formData.get("vendor_id"));
  const description =
    asString(formData.get("description")) || `Acquired ${name}`;

  const costCents = dollarsToCents(cost);
  if (
    !name ||
    !entryDate ||
    costCents <= 0 ||
    !Number.isFinite(lifeMonths) ||
    lifeMonths <= 0
  ) {
    fail(
      "/subledgers/fa",
      "Add name, date, cost, and useful life in months.",
    );
  }
  if (payFrom === "ap" && !vendorId) {
    fail("/subledgers/fa", "Choose a vendor when buying on account.");
  }

  const { data: asset, error: assetError } = await supabase
    .from("fixed_assets")
    .insert({
      user_id: user.id,
      name,
      asset_tag: assetTag || null,
      acquisition_date: entryDate,
      cost: costCents / 100,
      salvage_value: dollarsToCents(salvage) / 100,
      useful_life_months: lifeMonths,
      status: "active",
    })
    .select("*")
    .single();

  if (assetError || !asset) {
    fail(
      "/subledgers/fa",
      assetError?.message ?? "Could not create the asset.",
    );
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    const creditAccountId =
      payFrom === "ap" ? controls.ap.id : controls.cash.id;

    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "fa",
      sourceKind: "acquisition",
      glLines: [
        { accountId: controls.fa.id, debitCents: costCents, creditCents: 0 },
        {
          accountId: creditAccountId,
          debitCents: 0,
          creditCents: costCents,
        },
      ],
      subledgerPostings:
        payFrom === "ap" && vendorId
          ? [
              {
                subledger: "fa",
                kind: "acquisition",
                postingDate: entryDate,
                description,
                debitCents: costCents,
                creditCents: 0,
                assetId: asset.id,
              },
              {
                subledger: "ap",
                kind: "bill",
                postingDate: entryDate,
                description: `Payable for ${name}`,
                debitCents: 0,
                creditCents: costCents,
                vendorId,
              },
            ]
          : [
              {
                subledger: "fa",
                kind: "acquisition",
                postingDate: entryDate,
                description,
                debitCents: costCents,
                creditCents: 0,
                assetId: asset.id,
              },
            ],
    });
  } catch (error) {
    await supabase.from("fixed_assets").delete().eq("id", asset.id);
    fail(
      "/subledgers/fa",
      error instanceof Error ? error.message : "Could not acquire the asset.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

/** Record one month of straight-line depreciation for an asset. */
export async function postFaDepreciation(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const assetId = asString(formData.get("asset_id"));
  const entryDate = asString(formData.get("entry_date"));

  if (!assetId || !entryDate) {
    fail("/subledgers/fa", "Choose an asset and date.");
  }

  const { data: asset, error } = await supabase
    .from("fixed_assets")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", assetId)
    .maybeSingle();

  if (error || !asset) fail("/subledgers/fa", "Asset not found.");
  if (asset.status !== "active") {
    fail("/subledgers/fa", "Disposed assets cannot be depreciated.");
  }

  const monthCents = monthlyDepreciationCents(
    asset.cost,
    asset.salvage_value,
    asset.useful_life_months,
  );
  if (monthCents <= 0) {
    fail("/subledgers/fa", "This asset has no depreciable basis.");
  }

  const { data: prior } = await supabase
    .from("subledger_postings")
    .select("credit, debit, kind")
    .eq("user_id", user.id)
    .eq("asset_id", assetId)
    .eq("kind", "depreciation");

  const alreadyTaken = (prior ?? []).reduce(
    (sum, row) => sum + dollarsToCents(row.credit),
    0,
  );
  const maxDepreciable =
    dollarsToCents(asset.cost) - dollarsToCents(asset.salvage_value);
  const remaining = maxDepreciable - alreadyTaken;
  const amountCents = Math.min(monthCents, remaining);

  if (amountCents <= 0) {
    fail("/subledgers/fa", "This asset is fully depreciated.");
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    const description = `Depreciation — ${asset.name}`;
    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "fa",
      sourceKind: "depreciation",
      glLines: [
        {
          accountId: controls.depreciationExpense.id,
          debitCents: amountCents,
          creditCents: 0,
        },
        {
          accountId: controls.fa_accum.id,
          debitCents: 0,
          creditCents: amountCents,
        },
      ],
      subledgerPostings: [
        {
          subledger: "fa",
          kind: "depreciation",
          postingDate: entryDate,
          description,
          debitCents: 0,
          creditCents: amountCents,
          assetId,
        },
      ],
    });
  } catch (err) {
    fail(
      "/subledgers/fa",
      err instanceof Error ? err.message : "Could not post depreciation.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

export async function createInventoryItem(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const sku = asString(formData.get("sku"));
  const name = asString(formData.get("name"));
  const unitCost = dollarsToCents(asString(formData.get("unit_cost")));

  if (!sku || !name) fail("/subledgers/inventory", "Add a SKU and item name.");

  const { error } = await supabase.from("inventory_items").insert({
    user_id: user.id,
    sku,
    name,
    unit_cost: unitCost / 100,
  });

  if (error) fail("/subledgers/inventory", error.message);

  revalidatePath("/subledgers/inventory");
  redirect("/subledgers/inventory");
}

export async function recordInventoryPurchase(formData: FormData) {
  const user = await requireUser();
  const itemId = asString(formData.get("item_id"));
  const offsetAccountId = asString(formData.get("offset_account_id"));
  const entryDate = asString(formData.get("entry_date"));
  const quantity = Number.parseFloat(asString(formData.get("quantity")));
  const unitCostCents = dollarsToCents(asString(formData.get("unit_cost")));
  const description =
    asString(formData.get("description")) || "Inventory purchase";

  if (
    !itemId ||
    !offsetAccountId ||
    !entryDate ||
    !(quantity > 0) ||
    unitCostCents <= 0
  ) {
    fail(
      "/subledgers/inventory",
      "Add an item, quantity, unit cost, date, and payment account.",
    );
  }

  const amountCents = Math.round(quantity * unitCostCents);
  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    if (offsetAccountId === controls.inv.id) {
      fail("/subledgers/inventory", "Choose a different account to credit.");
    }

    const supabase = await createClient();
    await supabase
      .from("inventory_items")
      .update({ unit_cost: unitCostCents / 100 })
      .eq("id", itemId)
      .eq("user_id", user.id);

    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "inv",
      sourceKind: "purchase",
      glLines: [
        { accountId: controls.inv.id, debitCents: amountCents, creditCents: 0 },
        { accountId: offsetAccountId, debitCents: 0, creditCents: amountCents },
      ],
      subledgerPostings: [
        {
          subledger: "inv",
          kind: "purchase",
          postingDate: entryDate,
          description,
          debitCents: amountCents,
          creditCents: 0,
          inventoryItemId: itemId,
          quantity,
        },
      ],
    });
  } catch (err) {
    fail(
      "/subledgers/inventory",
      err instanceof Error ? err.message : "Could not record purchase.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

export async function recordInventoryIssue(formData: FormData) {
  const user = await requireUser();
  const itemId = asString(formData.get("item_id"));
  const entryDate = asString(formData.get("entry_date"));
  const quantity = Number.parseFloat(asString(formData.get("quantity")));
  const description =
    asString(formData.get("description")) || "Inventory issued to COGS";

  if (!itemId || !entryDate || !(quantity > 0)) {
    fail(
      "/subledgers/inventory",
      "Add an item, quantity, and date to issue stock.",
    );
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", itemId)
    .maybeSingle();

  if (!item) fail("/subledgers/inventory", "That inventory item was not found.");

  const unitCostCents = dollarsToCents(item.unit_cost);
  const amountCents = Math.round(quantity * unitCostCents);
  if (amountCents <= 0) {
    fail(
      "/subledgers/inventory",
      "Set a unit cost on the item before issuing stock.",
    );
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "inv",
      sourceKind: "issue",
      glLines: [
        { accountId: controls.cogs.id, debitCents: amountCents, creditCents: 0 },
        { accountId: controls.inv.id, debitCents: 0, creditCents: amountCents },
      ],
      subledgerPostings: [
        {
          subledger: "inv",
          kind: "issue",
          postingDate: entryDate,
          description,
          debitCents: 0,
          creditCents: amountCents,
          inventoryItemId: itemId,
          quantity,
        },
      ],
    });
  } catch (err) {
    fail(
      "/subledgers/inventory",
      err instanceof Error ? err.message : "Could not issue inventory.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

export async function recordCashMovement(formData: FormData) {
  const user = await requireUser();
  const kind = asString(formData.get("kind"));
  const entryDate = asString(formData.get("entry_date"));
  const offsetAccountId = asString(formData.get("offset_account_id"));
  const amountCents = dollarsToCents(asString(formData.get("amount")));
  const description = asString(formData.get("description"));

  if (
    (kind !== "receipt" && kind !== "disbursement") ||
    !entryDate ||
    !offsetAccountId ||
    !description ||
    amountCents <= 0
  ) {
    fail(
      "/subledgers/cash",
      "Add a type, date, amount, description, and the other account.",
    );
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    if (offsetAccountId === controls.cash.id) {
      fail("/subledgers/cash", "Choose a different account for the other side.");
    }

    const glLines =
      kind === "receipt"
        ? [
            {
              accountId: controls.cash.id,
              debitCents: amountCents,
              creditCents: 0,
            },
            {
              accountId: offsetAccountId,
              debitCents: 0,
              creditCents: amountCents,
            },
          ]
        : [
            {
              accountId: offsetAccountId,
              debitCents: amountCents,
              creditCents: 0,
            },
            {
              accountId: controls.cash.id,
              debitCents: 0,
              creditCents: amountCents,
            },
          ];

    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "cash",
      sourceKind: kind,
      glLines,
      subledgerPostings: [
        {
          subledger: "cash",
          kind,
          postingDate: entryDate,
          description,
          debitCents: kind === "receipt" ? amountCents : 0,
          creditCents: kind === "disbursement" ? amountCents : 0,
        },
      ],
    });
  } catch (err) {
    fail(
      "/subledgers/cash",
      err instanceof Error ? err.message : "Could not record cash movement.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}

export async function createEmployee(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const name = asString(formData.get("name"));
  const email = asString(formData.get("email"));

  if (!name) fail("/subledgers/payroll", "Add the employee name.");

  const { error } = await supabase.from("employees").insert({
    user_id: user.id,
    name,
    email: email || null,
  });

  if (error) fail("/subledgers/payroll", error.message);

  revalidatePath("/subledgers/payroll");
  redirect("/subledgers/payroll");
}

export async function recordWagePayment(formData: FormData) {
  const user = await requireUser();
  const employeeId = asString(formData.get("employee_id"));
  const entryDate = asString(formData.get("entry_date"));
  const amountCents = dollarsToCents(asString(formData.get("amount")));
  const description = asString(formData.get("description")) || "Wage payment";

  if (!employeeId || !entryDate || amountCents <= 0) {
    fail("/subledgers/payroll", "Add an employee, date, and wage amount.");
  }

  let entryId: string;
  try {
    const controls = await ensureControlAccounts(user.id);
    entryId = await postBalancedEntry({
      userId: user.id,
      entryDate,
      description,
      source: "payroll",
      sourceKind: "wage",
      glLines: [
        {
          accountId: controls.payroll.id,
          debitCents: amountCents,
          creditCents: 0,
        },
        { accountId: controls.cash.id, debitCents: 0, creditCents: amountCents },
      ],
      subledgerPostings: [
        {
          subledger: "payroll",
          kind: "wage",
          postingDate: entryDate,
          description,
          debitCents: amountCents,
          creditCents: 0,
          employeeId,
        },
      ],
    });
  } catch (err) {
    fail(
      "/subledgers/payroll",
      err instanceof Error ? err.message : "Could not record wage payment.",
    );
  }

  revalidateBooks();
  redirect(`/journal/${entryId}`);
}
