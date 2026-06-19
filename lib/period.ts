// Time-period resolution for spending analytics. Pure; boundaries are computed
// in UTC to line up with how date-only values are stored (midnight UTC).

export type PeriodKey = "this-month" | "last-month" | "last-30" | "last-90" | "this-year";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-30", label: "Last 30 days" },
  { value: "last-90", label: "Last 90 days" },
  { value: "this-year", label: "This year" },
];

export type ResolvedPeriod = {
  key: PeriodKey;
  label: string;
  start: Date;
  end: Date; // exclusive
  prevStart: Date;
  prevEnd: Date; // exclusive
};

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export function resolvePeriod(key: string, now = new Date()): ResolvedPeriod {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const label = PERIOD_OPTIONS.find((p) => p.value === key)?.label ?? "This month";

  switch (key) {
    case "last-month": {
      const start = utc(y, m - 1, 1);
      const end = utc(y, m, 1);
      return { key: key as PeriodKey, label, start, end, prevStart: utc(y, m - 2, 1), prevEnd: start };
    }
    case "last-30": {
      const end = utc(y, m, d + 1);
      const start = utc(y, m, d + 1 - 30);
      const prevStart = utc(y, m, d + 1 - 60);
      return { key: key as PeriodKey, label, start, end, prevStart, prevEnd: start };
    }
    case "last-90": {
      const end = utc(y, m, d + 1);
      const start = utc(y, m, d + 1 - 90);
      const prevStart = utc(y, m, d + 1 - 180);
      return { key: key as PeriodKey, label, start, end, prevStart, prevEnd: start };
    }
    case "this-year": {
      const start = utc(y, 0, 1);
      const end = utc(y + 1, 0, 1);
      return { key: key as PeriodKey, label, start, end, prevStart: utc(y - 1, 0, 1), prevEnd: start };
    }
    case "this-month":
    default: {
      const start = utc(y, m, 1);
      const end = utc(y, m + 1, 1);
      return { key: "this-month", label: "This month", start, end, prevStart: utc(y, m - 1, 1), prevEnd: start };
    }
  }
}
