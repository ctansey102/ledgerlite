import Link from "next/link";
import {
  acquireFixedAsset,
  deleteSubledgerRecord,
  postFaDepreciation,
} from "@/app/actions/subledgers";
import { AppShell } from "@/components/app-shell";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Notice } from "@/components/notice";
import { controlAccountFor } from "@/lib/control-accounts";
import {
  flattenLedgerLines,
  getAccounts,
  getFixedAssets,
  getLedgerLines,
  getProfile,
  getSubledgerPostings,
  getVendors,
  requireUser,
} from "@/lib/data";
import { dollarsToCents, formatDate, formatMoney, todayISO } from "@/lib/money";
import {
  controlBalanceCents,
  monthlyDepreciationCents,
  partySignedBalance,
  subledgerTotalCents,
} from "@/lib/subledgers";

export default async function FaSubledgerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [profile, accounts, assets, vendors, postings, rawLines] =
    await Promise.all([
      getProfile(user.id),
      getAccounts(user.id),
      getFixedAssets(user.id),
      getVendors(user.id),
      getSubledgerPostings(user.id, "fa"),
      getLedgerLines(user.id),
    ]);

  const lines = flattenLedgerLines(rawLines);
  const faControl = controlAccountFor(accounts, "fa");
  const faAccum = controlAccountFor(accounts, "fa_accum");
  const faGl = faControl
    ? controlBalanceCents(
        faControl,
        lines.filter((line) => line.account_id === faControl.id),
      )
    : 0;
  const accumGl = faAccum
    ? controlBalanceCents(
        faAccum,
        lines.filter((line) => line.account_id === faAccum.id),
      )
    : 0;
  const netGl = faGl - accumGl;
  const subTotal = subledgerTotalCents("fa", postings);

  const assetRows = assets.map((asset) => {
    const assetPostings = postings.filter((p) => p.asset_id === asset.id);
    const net = assetPostings.reduce(
      (sum, p) =>
        sum +
        partySignedBalance(
          "fa",
          dollarsToCents(p.debit),
          dollarsToCents(p.credit),
        ),
      0,
    );
    const accum = assetPostings
      .filter((p) => p.kind === "depreciation")
      .reduce((sum, p) => sum + dollarsToCents(p.credit), 0);
    return {
      asset,
      net,
      accum,
      monthly: monthlyDepreciationCents(
        asset.cost,
        asset.salvage_value,
        asset.useful_life_months,
      ),
    };
  });

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <Link href="/subledgers" className="text-sm text-forest hover:underline">
        Back to subledgers
      </Link>
      <h1 className="mt-4 font-serif text-4xl">Fixed assets</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Acquisitions debit the equipment control account. Paying cash also
        posts a disbursement to the cash book. Monthly depreciation hits
        expense and accumulated depreciation. Subledger balances are net book
        value.
      </p>
      <Notice message={error} />

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-sm text-muted">Subledger NBV</p>
          <p className="money mt-2 font-serif text-3xl">{formatMoney(subTotal)}</p>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-sm text-muted">GL net (cost − accum. dep.)</p>
          <p className="money mt-2 font-serif text-3xl">{formatMoney(netGl)}</p>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-sm text-muted">Reconciliation</p>
          <p
            className={`mt-2 font-serif text-2xl ${subTotal === netGl ? "text-forest-dark" : "text-danger"}`}
          >
            {subTotal === netGl ? "Tied to GL" : "Out of balance"}
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-serif text-2xl">Asset register</h2>
          {assetRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Acquire an asset to start the register.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="pb-2 font-medium">Asset</th>
                  <th className="pb-2 text-right font-medium">Cost</th>
                  <th className="pb-2 text-right font-medium">NBV</th>
                  <th className="pb-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {assetRows.map(({ asset, net }) => (
                  <tr key={asset.id} className="border-t border-line">
                    <td className="py-3">
                      <Link
                        href={`/subledgers/fa/${asset.id}`}
                        className="hover:text-forest"
                      >
                        {asset.name}
                      </Link>
                      <p className="text-xs text-muted capitalize">
                        {asset.status}
                      </p>
                    </td>
                    <td className="money py-3 text-right">
                      {formatMoney(dollarsToCents(asset.cost))}
                    </td>
                    <td className="money py-3 text-right">{formatMoney(net)}</td>
                    <td className="py-3 text-right">
                      <ConfirmDeleteForm
                        action={deleteSubledgerRecord}
                        fields={{ kind: "asset", id: asset.id }}
                        label={`Delete ${asset.name}`}
                        message={`Delete ${asset.name} and the journal entries posted to it, including depreciation and any cash or payable lines on those entries?`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="space-y-6">
          <form
            action={acquireFixedAsset}
            className="rounded-3xl border border-line bg-paper p-5"
          >
            <h2 className="font-serif text-2xl">Acquire asset</h2>
            <p className="mt-1 text-sm text-muted">
              Dr Equipment · Cr Cash (or AP)
            </p>
            <div className="mt-4 grid gap-3">
              <input
                name="name"
                required
                placeholder="Asset name"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="asset_tag"
                placeholder="Tag / serial (optional)"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                type="date"
                name="entry_date"
                required
                defaultValue={todayISO()}
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="cost"
                required
                inputMode="decimal"
                placeholder="Cost"
                className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="salvage_value"
                inputMode="decimal"
                placeholder="Salvage value (default 0)"
                className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <input
                name="useful_life_months"
                required
                inputMode="numeric"
                placeholder="Useful life (months)"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              />
              <select
                name="pay_from"
                defaultValue="cash"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
              >
                <option value="cash">Pay with cash</option>
                <option value="ap">Buy on account (AP)</option>
              </select>
              <select
                name="vendor_id"
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
                defaultValue=""
              >
                <option value="">Vendor (required if on account)</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
              <button className="rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white">
                Post acquisition to GL
              </button>
            </div>
          </form>

          <form
            action={postFaDepreciation}
            className="rounded-3xl border border-line bg-paper p-5"
          >
            <h2 className="font-serif text-2xl">Post depreciation</h2>
            <p className="mt-1 text-sm text-muted">
              Dr Depreciation Expense · Cr Accumulated Depreciation
            </p>
            <div className="mt-4 grid gap-3">
              <select
                name="asset_id"
                required
                className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
                defaultValue=""
              >
                <option value="" disabled>
                  Asset
                </option>
                {assetRows
                  .filter((row) => row.asset.status === "active")
                  .map(({ asset, monthly }) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} · ~{formatMoney(monthly)}/mo
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
              <button className="rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white">
                Post one month to GL
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-line bg-paper">
        <h2 className="bg-sage/60 px-4 py-3 font-serif text-xl">
          Recent FA postings
        </h2>
        {postings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No fixed-asset activity yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {postings.slice(0, 20).map((posting) => (
                <tr key={posting.id} className="border-t border-line">
                  <td className="px-4 py-3">{formatDate(posting.posting_date)}</td>
                  <td className="px-4 py-3 capitalize">{posting.kind}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/journal/${posting.journal_entry_id}`}
                      className="hover:text-forest"
                    >
                      {posting.description}
                    </Link>
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(posting.debit) > 0
                      ? formatMoney(dollarsToCents(posting.debit))
                      : ""}
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(posting.credit) > 0
                      ? formatMoney(dollarsToCents(posting.credit))
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
