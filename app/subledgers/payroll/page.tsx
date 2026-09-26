import Link from "next/link";
import {
  createEmployee,
  deleteSubledgerRecord,
  recordWagePayment,
} from "@/app/actions/subledgers";
import { AppShell } from "@/components/app-shell";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Notice } from "@/components/notice";
import {
  getAccounts,
  getEmployees,
  getProfile,
  getSubledgerPostings,
  requireUser,
} from "@/lib/data";
import { dollarsToCents, formatDate, formatMoney, todayISO } from "@/lib/money";
import { employeeWageTotals } from "@/lib/subledgers";
import { controlAccountFor } from "@/lib/control-accounts";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [profile, accounts, employees, postings] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
    getEmployees(user.id),
    getSubledgerPostings(user.id, "payroll"),
  ]);

  const wages = controlAccountFor(accounts, "payroll");
  const wageTotals = employeeWageTotals(postings);
  const periodTotal = postings.reduce(
    (sum, posting) => sum + dollarsToCents(posting.debit),
    0,
  );

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-gold">
            Subledger
          </p>
          <h1 className="mt-1 font-serif text-4xl text-ink">Payroll</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Keep wages by employee. Each payment debits Wages Expense, credits
            Cash, and posts the disbursement to the cash book.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Wages recorded</p>
          <p className="money font-serif text-3xl">{formatMoney(periodTotal)}</p>
          {wages ? (
            <Link
              href={`/accounts/${wages.id}`}
              className="mt-1 inline-block text-sm text-forest hover:underline"
            >
              Open {wages.code} · {wages.name}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <Notice message={error} />
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-serif text-2xl">Employees</h2>
          {employees.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Add people you pay so wage detail stays tied to each employee.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-sage/60 text-left text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 text-right font-medium">Paid</th>
                    <th className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <p className="font-medium">{employee.name}</p>
                        {employee.email ? (
                          <p className="text-xs text-muted">{employee.email}</p>
                        ) : null}
                      </td>
                      <td className="money px-4 py-3 text-right">
                        {formatMoney(wageTotals.get(employee.id) ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ConfirmDeleteForm
                          action={deleteSubledgerRecord}
                          fields={{ kind: "employee", id: employee.id }}
                          label={`Delete ${employee.name}`}
                          message={`Delete ${employee.name} and the wage payments posted to them? Cash is updated with those entries.`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form action={createEmployee} className="mt-5 grid gap-3">
            <input
              name="name"
              required
              placeholder="Employee name"
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="email"
              type="email"
              placeholder="Email (optional)"
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white">
              Add employee
            </button>
          </form>
        </div>

        <form
          action={recordWagePayment}
          className="rounded-3xl border border-line bg-paper p-5"
        >
          <h2 className="font-serif text-2xl">Record wage payment</h2>
          <p className="mt-1 text-sm text-muted">
            Debit Wages Expense, credit Cash, and record the disbursement in
            the cash book.
          </p>
          <div className="mt-4 grid gap-3">
            <select
              name="employee_id"
              required
              defaultValue=""
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            >
              <option value="" disabled>
                Choose employee
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
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
              name="amount"
              inputMode="decimal"
              placeholder="Gross wages"
              required
              className="money rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <input
              name="description"
              placeholder="Biweekly payroll"
              className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
            />
            <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white">
              Post wages
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Wage history</h2>
        {postings.length === 0 ? (
          <p className="mt-4 rounded-3xl border border-dashed border-line bg-paper px-5 py-8 text-center text-muted">
            No wage payments yet. Add an employee and post their first paycheck.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-3xl border border-line bg-paper">
            <table className="min-w-full text-sm">
              <thead className="bg-sage/60 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Entry</th>
                </tr>
              </thead>
              <tbody>
                {postings.map((posting) => (
                  <tr key={posting.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      {formatDate(posting.posting_date)}
                    </td>
                    <td className="px-4 py-3">
                      {employees.find((row) => row.id === posting.employee_id)
                        ?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">{posting.description}</td>
                    <td className="money px-4 py-3 text-right">
                      {formatMoney(dollarsToCents(posting.debit))}
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
