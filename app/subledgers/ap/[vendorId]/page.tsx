import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSubledgerRecord } from "@/app/actions/subledgers";
import { AppShell } from "@/components/app-shell";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import {
  getProfile,
  getSubledgerPostings,
  getVendor,
  requireUser,
} from "@/lib/data";
import { dollarsToCents, formatDate, formatMoney } from "@/lib/money";
import { partySignedBalance } from "@/lib/subledgers";

export default async function ApVendorPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const user = await requireUser();
  const [profile, vendor, postings] = await Promise.all([
    getProfile(user.id),
    getVendor(user.id, vendorId),
    getSubledgerPostings(user.id, "ap"),
  ]);

  if (!vendor) notFound();

  const rows = postings
    .filter((posting) => posting.vendor_id === vendorId)
    .sort((a, b) => {
      if (a.posting_date === b.posting_date) return a.id.localeCompare(b.id);
      return a.posting_date.localeCompare(b.posting_date);
    });

  const withBalance = rows.reduce<
    Array<(typeof rows)[number] & { running: number }>
  >((list, row) => {
    const previous = list.at(-1)?.running ?? 0;
    list.push({
      ...row,
      running:
        previous +
        partySignedBalance(
          "ap",
          dollarsToCents(row.debit),
          dollarsToCents(row.credit),
        ),
    });
    return list;
  }, []);
  const running = withBalance.at(-1)?.running ?? 0;

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <Link href="/subledgers/ap" className="text-sm text-forest hover:underline">
        Back to AP
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-gold">
            Vendor ledger
          </p>
          <h1 className="font-serif text-4xl">{vendor.name}</h1>
          <p className="money mt-3 font-serif text-3xl">{formatMoney(running)}</p>
        </div>
        <ConfirmDeleteForm
          action={deleteSubledgerRecord}
          fields={{ kind: "vendor", id: vendor.id }}
          label={`Delete ${vendor.name}`}
          variant="button"
          message={`Delete ${vendor.name} and the journal entries posted to them? The general ledger and cash book are updated with those entries.`}
        />
      </div>

      {withBalance.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-line bg-paper px-5 py-10 text-center text-muted">
          No bills or payments for this vendor yet.
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
                <th className="px-4 py-3 text-right font-medium">Balance</th>
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
