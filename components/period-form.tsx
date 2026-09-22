import { periodOptions, type PeriodKey } from "@/lib/periods";

export function PeriodForm({
  period,
  from,
  to,
}: {
  period: PeriodKey;
  from: string;
  to: string;
}) {
  return (
    <form className="flex flex-col gap-3 rounded-3xl border border-line bg-paper p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="text-sm">
        <span className="mb-1.5 block text-muted">Period</span>
        <select
          name="period"
          defaultValue={period}
          className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
        >
          {periodOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1.5 block text-muted">From</span>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1.5 block text-muted">To</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded-2xl border border-line px-4 py-3 outline-none focus:border-forest"
        />
      </label>
      <button className="rounded-full bg-forest px-5 py-3 text-sm font-medium text-white">
        Update statements
      </button>
    </form>
  );
}
