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

export const dt = (value?: string): string => (value ? format(parseISO(value), "dd MMM, HH:mm") : "—");

export const day = (value?: string): string =>
  value ? format(value.length > 10 ? parseISO(value) : new Date(`${value}T00:00:00`), "dd MMM yyyy") : "—";

export const timeOnly = (value?: string): string => (value ? format(parseISO(value), "HH:mm") : "—");

export const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
