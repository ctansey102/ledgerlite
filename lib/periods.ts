import { isoDate } from "@/lib/money";

export type PeriodKey =
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "this-year"
  | "custom";

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function resolvePeriod(
  key: PeriodKey,
  customFrom?: string,
  customTo?: string,
) {
  const today = new Date();

  if (key === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo, label: "Custom range" };
  }

  if (key === "last-month") {
    const date = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
      from: isoDate(startOfMonth(date)),
      to: isoDate(endOfMonth(date)),
      label: date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    };
  }

  if (key === "this-quarter") {
    const quarter = Math.floor(today.getMonth() / 3);
    const from = new Date(today.getFullYear(), quarter * 3, 1);
    const to = new Date(today.getFullYear(), quarter * 3 + 3, 0);
    return {
      from: isoDate(from),
      to: isoDate(to),
      label: `Q${quarter + 1} ${today.getFullYear()}`,
    };
  }

  if (key === "this-year") {
    return {
      from: `${today.getFullYear()}-01-01`,
      to: isoDate(today),
      label: String(today.getFullYear()),
    };
  }

  return {
    from: isoDate(startOfMonth(today)),
    to: isoDate(today),
    label: today.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  };
}

export const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "this-quarter", label: "This quarter" },
  { key: "this-year", label: "This year" },
  { key: "custom", label: "Custom dates" },
];
