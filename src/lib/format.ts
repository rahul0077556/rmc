import { format, parseISO } from "date-fns";

export const inr = (value: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export const inrCompact = (value: number): string => {
  if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return inr(value);
};

export const num = (value: number): string => new Intl.NumberFormat("en-IN").format(value);

export const cum = (value: number): string => `${num(Math.round(value * 10) / 10)} cum`;

export const dt = (value?: string): string => {
  if (!value || value === "-" || value === "—") return "—";
  try {
    const parsed = parseISO(value);
    if (isNaN(parsed.getTime())) return value;
    return format(parsed, "dd MMM, HH:mm");
  } catch {
    return value || "—";
  }
};

export const day = (value?: string): string => {
  if (!value || value === "-" || value === "—") return "—";
  try {
    const parsed = value.length > 10 ? parseISO(value) : new Date(`${value}T00:00:00`);
    if (isNaN(parsed.getTime())) return value;
    return format(parsed, "dd MMM yyyy");
  } catch {
    return value || "—";
  }
};

export const timeOnly = (value?: string): string => {
  if (!value || value === "-" || value === "—") return "—";
  try {
    const parsed = parseISO(value);
    if (isNaN(parsed.getTime())) return value;
    return format(parsed, "HH:mm");
  } catch {
    return value || "—";
  }
};

export const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
