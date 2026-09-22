import Link from "next/link";
import {
  createInventoryItem,
  recordInventoryIssue,
  recordInventoryPurchase,
} from "@/app/actions/subledgers";
import { AppShell } from "@/components/app-shell";
import { Notice } from "@/components/notice";
import {
  getAccounts,
  getInventoryItems,
  getProfile,
  getSubledgerPostings,
  requireUser,
} from "@/lib/data";
import { accountTypeLabels, accountTypeOrder } from "@/lib/ledger";
import { dollarsToCents, formatDate, formatMoney, todayISO } from "@/lib/money";
import { inventoryBalances } from "@/lib/subledgers";
import { controlAccountFor } from "@/lib/control-accounts";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [profile, accounts, items, postings] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getInventoryItems(user.id),
    getSubledgerPostings(user.id, "inv"),
  ]);

  const inventory = controlAccountFor(accounts, "inv");
  const balances = inventoryBalances(items, postings);
  const totalValue = balances.reduce((sum, item) => sum + item.valueCents, 0);

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-gold">
            Subledger
          </p>
          <h1 className="mt-1 font-serif text-4xl text-ink">Inventory</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Track stock by item. Purchases and issues post to the Inventory
            control account and the general ledger automatically.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Inventory value</p>
          <p className="money font-serif text-3xl">{formatMoney(totalValue)}</p>
          {inventory ? (
            <Link
              href={`/accounts/${inventory.id}`}
              className="mt-1 inline-block text-sm text-forest hover:underline"
            >
              Open {inventory.code} · {inventory.name}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <Notice message={error} />
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-2xl">Items on hand</h2>
        {balances.length === 0 ? (
          <p className="mt-4 rounded-3xl border border-dashed border-line bg-paper px-5 py-8 text-center text-muted">
            Add your first inventory item, then record a purchase to bring stock
            onto the books.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-3xl border border-line bg-paper">
            <table className="min-w-full text-sm">
              <thead className="bg-sage/60 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 text-right font-medium">On hand</th>
                  <th className="px-4 py-3 text-right font-medium">Unit cost</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{item.sku}</td>
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="money px-4 py-3 text-right">
                      {item.quantityOnHand}
                    </td>
                    <td className="money px-4 py-3 text-right">
                      {formatMoney(Math.round(Number(item.unit_cost) * 100))}
                    </td>
                    <td className="money px-4 py-3 text-right">
                      {formatMoney(item.valueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <details open className="rounded-3xl border border-line bg-paper p-5">
          <summary className="cursor-pointer font-medium">Add item</summary>
          <form action={createInventoryItem} className="mt-4 grid gap-3">
            <input
              name="sku"
              placeholder="SKU"
              required
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="name"
              placeholder="Item name"
              required
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="unit_cost"
              inputMode="decimal"
              placeholder="Unit cost"
              defaultValue="0.00"
              className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white">
              Save item
            </button>
          </form>
        </details>

        <details open className="rounded-3xl border border-line bg-paper p-5">
          <summary className="cursor-pointer font-medium">Record purchase</summary>
          <form action={recordInventoryPurchase} className="mt-4 grid gap-3">
            <select
              name="item_id"
              required
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              defaultValue=""
            >
              <option value="" disabled>
                Choose item
              </option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="entry_date"
              required
              defaultValue={todayISO()}
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="quantity"
              inputMode="decimal"
              placeholder="Quantity"
              required
              className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="unit_cost"
              inputMode="decimal"
              placeholder="Unit cost"
              required
              className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <select
              name="offset_account_id"
              required
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              defaultValue=""
            >
              <option value="" disabled>
                Credit account
              </option>
              {accountTypeOrder.map((type) => (
                <optgroup key={type} label={accountTypeLabels[type]}>
                  {accounts
                    .filter(
                      (account) =>
                        account.type === type && account.subledger !== "inv",
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <input
              name="description"
              placeholder="Bought mulch from supplier"
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white">
              Post purchase
            </button>
          </form>
        </details>

        <details open className="rounded-3xl border border-line bg-paper p-5">
          <summary className="cursor-pointer font-medium">Issue to COGS</summary>
          <form action={recordInventoryIssue} className="mt-4 grid gap-3">
            <select
              name="item_id"
              required
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              defaultValue=""
            >
              <option value="" disabled>
                Choose item
              </option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="entry_date"
              required
              defaultValue={todayISO()}
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="quantity"
              inputMode="decimal"
              placeholder="Quantity"
              required
              className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="description"
              placeholder="Used inventory on a job"
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white">
              Post issue
            </button>
          </form>
        </details>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Recent movements</h2>
        {postings.length === 0 ? (
          <p className="mt-4 text-muted">No inventory activity yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-3xl border border-line bg-paper">
            <table className="min-w-full text-sm">
              <thead className="bg-sage/60 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Entry</th>
                </tr>
              </thead>
              <tbody>
                {postings.slice(0, 20).map((posting) => (
                  <tr key={posting.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      {formatDate(posting.posting_date)}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const item = items.find(
                          (row) => row.id === posting.inventory_item_id,
                        );
                        return item ? `${item.sku} · ${item.name}` : "—";
                      })()}
                    </td>
                    <td className="px-4 py-3 capitalize">{posting.kind}</td>
                    <td className="money px-4 py-3 text-right">
                      {posting.quantity ?? ""}
                    </td>
                    <td className="money px-4 py-3 text-right">
                      {formatMoney(
                        dollarsToCents(posting.debit) ||
                          dollarsToCents(posting.credit),
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/journal/${posting.journal_entry_id}`}
                        className="text-forest hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
