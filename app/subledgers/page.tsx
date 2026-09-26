import Link from "next/link";
import { ensureSubledgerAccountsAction } from "@/app/actions/subledgers";
import { AppShell } from "@/components/app-shell";
import { Notice } from "@/components/notice";
import { controlAccountFor } from "@/lib/control-accounts";
import {
  flattenLedgerLines,
  getAccounts,
  getCustomers,
  getEmployees,
  getFixedAssets,
  getInventoryItems,
  getLedgerLines,
  getProfile,
  getSubledgerPostings,
  getVendors,
  requireUser,
} from "@/lib/data";
import { formatMoney } from "@/lib/money";
import {
  controlBalanceCents,
  inventoryBalances,
  subledgerTotalCents,
} from "@/lib/subledgers";

export default async function SubledgersHubPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const user = await requireUser();
  const { error, message } = await searchParams;
  const [
    profile,
    accounts,
    customers,
    vendors,
    assets,
    items,
    employees,
    arPostings,
    apPostings,
    faPostings,
    invPostings,
    cashPostings,
    payrollPostings,
    rawLines,
  ] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getCustomers(user.id).catch(() => []),
    getVendors(user.id).catch(() => []),
    getFixedAssets(user.id).catch(() => []),
    getInventoryItems(user.id).catch(() => []),
    getEmployees(user.id).catch(() => []),
    getSubledgerPostings(user.id, "ar").catch(() => []),
    getSubledgerPostings(user.id, "ap").catch(() => []),
    getSubledgerPostings(user.id, "fa").catch(() => []),
    getSubledgerPostings(user.id, "inv").catch(() => []),
    getSubledgerPostings(user.id, "cash").catch(() => []),
    getSubledgerPostings(user.id, "payroll").catch(() => []),
    getLedgerLines(user.id),
  ]);

  const lines = flattenLedgerLines(rawLines);
  const arControl = controlAccountFor(accounts, "ar");
  const apControl = controlAccountFor(accounts, "ap");
  const faControl = controlAccountFor(accounts, "fa");
  const faAccum = controlAccountFor(accounts, "fa_accum");
  const invControl = controlAccountFor(accounts, "inv");
  const cashControl = controlAccountFor(accounts, "cash");
  const payrollControl = controlAccountFor(accounts, "payroll");

  const arGl = arControl
    ? controlBalanceCents(
        arControl,
        lines.filter((line) => line.account_id === arControl.id),
      )
    : 0;
  const apGl = apControl
    ? controlBalanceCents(
        apControl,
        lines.filter((line) => line.account_id === apControl.id),
      )
    : 0;
  const faGl = faControl
    ? controlBalanceCents(
        faControl,
        lines.filter((line) => line.account_id === faControl.id),
      )
    : 0;
  const faAccumGl = faAccum
    ? controlBalanceCents(
        faAccum,
        lines.filter((line) => line.account_id === faAccum.id),
      )
    : 0;
  const invGl = invControl
    ? controlBalanceCents(
        invControl,
        lines.filter((line) => line.account_id === invControl.id),
      )
    : 0;
  const cashGl = cashControl
    ? controlBalanceCents(
        cashControl,
        lines.filter((line) => line.account_id === cashControl.id),
      )
    : 0;
  const payrollGl = payrollControl
    ? controlBalanceCents(
        payrollControl,
        lines.filter((line) => line.account_id === payrollControl.id),
      )
    : 0;

  const arSub = subledgerTotalCents("ar", arPostings);
  const apSub = subledgerTotalCents("ap", apPostings);
  const faSub = subledgerTotalCents("fa", faPostings);
  const invSub = inventoryBalances(items, invPostings).reduce(
    (sum, item) => sum + item.valueCents,
    0,
  );
  const cashSub = cashPostings.reduce((sum, posting) => {
    const debit = Math.round(Number(posting.debit) * 100);
    const credit = Math.round(Number(posting.credit) * 100);
    return sum + debit - credit;
  }, 0);
  const payrollSub = payrollPostings.reduce((sum, posting) => {
    return sum + Math.round(Number(posting.debit) * 100);
  }, 0);
  const faNetGl = faGl - faAccumGl;

  const cards = [
    {
      href: "/subledgers/ar",
      title: "Accounts receivable",
      body: "Customer invoices and payments that roll up to the AR control account.",
      parties: `${customers.length} customer${customers.length === 1 ? "" : "s"}`,
      sub: arSub,
      gl: arGl,
      control: arControl ? `${arControl.code} · ${arControl.name}` : "Not set up yet",
    },
    {
      href: "/subledgers/ap",
      title: "Accounts payable",
      body: "Vendor bills and disbursements that roll up to the AP control account.",
      parties: `${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`,
      sub: apSub,
      gl: apGl,
      control: apControl ? `${apControl.code} · ${apControl.name}` : "Not set up yet",
    },
    {
      href: "/subledgers/fa",
      title: "Fixed assets",
      body: "Asset register with acquisitions and depreciation posting to the GL.",
      parties: `${assets.length} asset${assets.length === 1 ? "" : "s"}`,
      sub: faSub,
      gl: faNetGl,
      control: faControl
        ? `${faControl.code} · ${faControl.name} (net of accum. dep.)`
        : "Not set up yet",
    },
    {
      href: "/subledgers/cash",
      title: "Cash book",
      body: "Receipts and payments from every subledger, plus cash book entries, that roll up to Cash.",
      parties: `${cashPostings.length} movement${cashPostings.length === 1 ? "" : "s"}`,
      sub: cashSub,
      gl: cashGl,
      control: cashControl
        ? `${cashControl.code} · ${cashControl.name}`
        : "Not set up yet",
    },
    {
      href: "/subledgers/inventory",
      title: "Inventory",
      body: "Stock purchases and issues that roll up to the Inventory control account.",
      parties: `${items.length} item${items.length === 1 ? "" : "s"}`,
      sub: invSub,
      gl: invGl,
      control: invControl
        ? `${invControl.code} · ${invControl.name}`
        : "Not set up yet",
    },
    {
      href: "/subledgers/payroll",
      title: "Payroll",
      body: "Wage payments by employee that roll up to Wages Expense.",
      parties: `${employees.length} employee${employees.length === 1 ? "" : "s"}`,
      sub: payrollSub,
      gl: payrollGl,
      control: payrollControl
        ? `${payrollControl.code} · ${payrollControl.name}`
        : "Not set up yet",
    },
  ];

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <h1 className="font-serif text-4xl">Subledgers</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Detail lives in each subsidiary ledger. Totals must match the control
        accounts in the general ledger — the same pattern used in full
        bookkeeping systems.
      </p>

      <div className="mt-6 space-y-3">
        <Notice message={error} />
        {message ? (
          <p className="rounded-2xl border border-line bg-sage/50 px-4 py-3 text-sm text-forest-dark">
            {decodeURIComponent(message.replace(/\+/g, " "))}
          </p>
        ) : null}
      </div>

      <form action={ensureSubledgerAccountsAction} className="mt-4">
        <button className="rounded-full border border-line bg-paper px-4 py-2 text-sm text-forest hover:border-forest">
          Set up control accounts
        </button>
      </form>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const tied = card.sub === card.gl;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-3xl border border-line bg-paper p-5 hover:border-forest"
            >
              <p className="text-sm uppercase tracking-[0.14em] text-gold">
                {card.parties}
              </p>
              <h2 className="mt-2 font-serif text-2xl">{card.title}</h2>
              <p className="mt-2 text-sm text-muted">{card.body}</p>
              <p className="mt-4 text-xs text-muted">{card.control}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted">Subledger</p>
                  <p className="money font-serif text-xl">
                    {formatMoney(card.sub)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">GL control</p>
                  <p className="money font-serif text-xl">
                    {formatMoney(card.gl)}
                  </p>
                </div>
              </div>
              <p
                className={`mt-3 text-sm ${tied ? "text-forest-dark" : "text-danger"}`}
              >
                {tied ? "In balance with the GL" : "Out of balance — investigate"}
              </p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
