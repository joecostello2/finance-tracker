// Money helpers. Balances are stored as Prisma Decimal in the DB; we convert to
// plain numbers at the server/client boundary (Decimals aren't serializable to
// Client Components) and format for display here.

/** Convert a Prisma Decimal (or string/number) to a JS number. */
export function toNumber(value: { toString(): string } | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency = "USD"): string {
  let fmt = formatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    formatters.set(currency, fmt);
  }
  return fmt.format(amount);
}

/** Compact form for large headline numbers, e.g. $1.2M. */
export function formatMoneyCompact(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: Math.abs(amount) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(amount) >= 100_000 ? 1 : 2,
  }).format(amount);
}

/** Account types whose balance counts as a liability (debt) rather than an asset. */
export const LIABILITY_ACCOUNT_TYPES = new Set(["CREDIT_CARD"]);
