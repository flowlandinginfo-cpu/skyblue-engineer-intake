import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtTHB(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(Number(n));
}
