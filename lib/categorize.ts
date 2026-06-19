// Auto-categorization engine. Given an expense description / merchant, suggest a
// spending category by matching keywords. Pure and deterministic — the first
// rule whose keyword appears in the text wins. Falls back to "Other".

export type CategoryDef = { name: string; color: string };

// The canonical set of spending categories with chart colors. Order here is also
// the default display/priority order.
export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: "Groceries", color: "#10b981" },
  { name: "Dining", color: "#f59e0b" },
  { name: "Transport", color: "#3b82f6" },
  { name: "Housing", color: "#6366f1" },
  { name: "Utilities", color: "#0ea5e9" },
  { name: "Shopping", color: "#ec4899" },
  { name: "Entertainment", color: "#8b5cf6" },
  { name: "Subscriptions", color: "#a855f7" },
  { name: "Health", color: "#ef4444" },
  { name: "Travel", color: "#14b8a6" },
  { name: "Insurance", color: "#64748b" },
  { name: "Personal", color: "#f97316" },
  { name: "Education", color: "#84cc16" },
  { name: "Other", color: "#94a3b8" },
];

export const FALLBACK_CATEGORY = "Other";

export function categoryColor(name: string): string {
  return DEFAULT_CATEGORIES.find((c) => c.name === name)?.color ?? "#94a3b8";
}

// Keyword rules, checked top to bottom. Keep the most specific merchants before
// generic words so e.g. "uber eats" hits Dining before "uber" hits Transport.
const RULES: { category: string; keywords: string[] }[] = [
  { category: "Dining", keywords: ["uber eats", "ubereats", "doordash", "grubhub", "postmates", "restaurant", "cafe", "coffee", "starbucks", "dunkin", "mcdonald", "chipotle", "pizza", "taco", "burger", "grill", "diner", "bakery", "bar &", "pub", "deli", "sushi", "panera", "wendy", "subway"] },
  { category: "Groceries", keywords: ["grocery", "supermarket", "whole foods", "trader joe", "safeway", "kroger", "aldi", "costco", "publix", "wegmans", "sprouts", "food market", "h-e-b", "heb"] },
  { category: "Subscriptions", keywords: ["netflix", "spotify", "hulu", "disney+", "disney plus", "hbo", "max ", "youtube premium", "apple music", "icloud", "prime video", "patreon", "subscription", "audible", "nytimes", "new york times"] },
  { category: "Transport", keywords: ["uber", "lyft", "shell", "chevron", "exxon", "mobil", "bp ", "gas station", "fuel", "parking", "transit", "metro", "subway fare", "toll", "amtrak", "car wash", "76 "] },
  { category: "Travel", keywords: ["airline", "flight", "airfare", "hotel", "airbnb", "vrbo", "delta", "united air", "american air", "southwest", "expedia", "booking.com", "marriott", "hilton", "resort"] },
  { category: "Utilities", keywords: ["electric", "water bill", "gas bill", "internet", "comcast", "xfinity", "verizon", "at&t", "t-mobile", "spectrum", "utility", "power company", "pg&e", "con ed"] },
  { category: "Health", keywords: ["pharmacy", "cvs", "walgreens", "doctor", "dental", "dentist", "clinic", "hospital", "medical", "gym", "fitness", "planet fitness", "copay", "optometr"] },
  { category: "Entertainment", keywords: ["movie", "cinema", "amc", "regal", "concert", "ticketmaster", "steam", "playstation", "xbox", "nintendo", "game", "theater", "bowling", "museum"] },
  { category: "Shopping", keywords: ["amazon", "ebay", "etsy", "walmart", "target", "best buy", "apple store", "nike", "adidas", "ikea", "home depot", "lowe", "macy", "nordstrom", "clothing", "mall"] },
  { category: "Insurance", keywords: ["insurance", "geico", "allstate", "progressive", "state farm", "liberty mutual"] },
  { category: "Personal", keywords: ["salon", "haircut", "barber", "spa", "nails", "cosmetic", "beauty"] },
  { category: "Education", keywords: ["tuition", "udemy", "coursera", "textbook", "bookstore", "school", "university", "course"] },
  { category: "Housing", keywords: ["rent", "mortgage", "hoa", "landlord", "property mgmt"] },
];

/** Suggest a category name from a free-text description. Never returns null. */
export function suggestCategory(description: string): string {
  const text = description.toLowerCase();
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.category;
    }
  }
  return FALLBACK_CATEGORY;
}
