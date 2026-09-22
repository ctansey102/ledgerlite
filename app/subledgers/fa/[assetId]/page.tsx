import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  getFixedAsset,
  getProfile,
  getSubledgerPostings,
  requireUser,
} from "@/lib/data";
import { dollarsToCents, formatDate, formatMoney } from "@/lib/money";
import { partySignedBalance } from "@/lib/subledgers";

export default async function FaAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const user = await requireUser();
  const [profile, asset, postings] = await Promise.all([
    getProfile(user.id),
    getFixedAsset(user.id, assetId),
    getSubledgerPostings(user.id, "fa"),
  ]);

  if (!asset) notFound();

  const rows = postings
    .filter((posting) => posting.asset_id === assetId)
    .sort((a, b) => {
      if (a.posting_date === b.posting_date) return a.id.localeCompare(b.id);
      return a.posting_date.localeCompare(b.posting_date);
    });

  let running = 0;
  const withBalance = rows.map((row) => {
    running += partySignedBalance(
      "fa",
      dollarsToCents(row.debit),
      dollarsToCents(row.credit),
    );
    return { ...row, running };
  });

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <Link href="/subledgers/fa" className="text-sm text-forest hover:underline">
        Back to fixed assets
      </Link>
      <p className="mt-4 text-sm uppercase tracking-[0.16em] text-gold">
        Asset ledger
      </p>
      <h1 className="font-serif text-4xl">{asset.name}</h1>
      <p className="mt-2 text-sm text-muted">
        Acquired {formatDate(asset.acquisition_date)} · Cost{" "}
        {formatMoney(dollarsToCents(asset.cost))} · Life{" "}
        {asset.useful_life_months} months · Status {asset.status}
      </p>
      <p className="money mt-3 font-serif text-3xl">
        NBV {formatMoney(running)}
      </p>

      {withBalance.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-line bg-paper px-5 py-10 text-center text-muted">
          No postings for this asset yet.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-3xl border border-line bg-paper">
          <table className="min-w-full text-sm">
            <thead className="bg-sage/60 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 text-right font-medium">NBV</th>
              </tr>
            </thead>
            <tbody>
              {withBalance.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">{formatDate(row.posting_date)}</td>
                  <td className="px-4 py-3 capitalize">{row.kind}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/journal/${row.journal_entry_id}`}
                      className="hover:text-forest"
                    >
                      {row.description}
                    </Link>
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(row.debit) > 0
                      ? formatMoney(dollarsToCents(row.debit))
                      : ""}
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {dollarsToCents(row.credit) > 0
                      ? formatMoney(dollarsToCents(row.credit))
                      : ""}
                  </td>
                  <td className="money px-4 py-3 text-right">
                    {formatMoney(row.running)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
