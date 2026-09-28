import { AppShell } from "@/components/app-shell";
import { JournalForm } from "@/components/journal-form";
import { controlSubledgerByAccountId } from "@/lib/control-accounts";
import {
  getAccounts,
  getCustomers,
  getEmployees,
  getFixedAssets,
  getInventoryItems,
  getProfile,
  getVendors,
  requireUser,
} from "@/lib/data";

export default async function NewJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [profile, accounts, customers, vendors, assets, items, employees] =
    await Promise.all([
      getProfile(user.id),
      getAccounts(user.id),
      getCustomers(user.id).catch(() => []),
      getVendors(user.id).catch(() => []),
      getFixedAssets(user.id).catch(() => []),
      getInventoryItems(user.id).catch(() => []),
      getEmployees(user.id).catch(() => []),
    ]);

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <h1 className="font-serif text-4xl">New journal entry</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Debits on the left, credits on the right. Cash lines update the cash
        book on their own. For receivables, payables, equipment, accumulated
        depreciation, inventory, or wages, choose the customer, vendor, asset,
        item, or employee so that subledger stays tied to the general ledger.
      </p>
      <div className="mt-8">
        <JournalForm
          accounts={accounts}
          error={error}
          controlSubledgers={controlSubledgerByAccountId(accounts)}
          parties={{
            ar: customers.map((party) => ({ id: party.id, name: party.name })),
            ap: vendors.map((party) => ({ id: party.id, name: party.name })),
            fa: assets.map((party) => ({ id: party.id, name: party.name })),
            inv: items.map((party) => ({
              id: party.id,
              name: `${party.sku} · ${party.name}`,
            })),
            payroll: employees.map((party) => ({
              id: party.id,
              name: party.name,
            })),
          }}
        />
      </div>
    </AppShell>
  );
}
