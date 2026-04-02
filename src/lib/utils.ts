import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWorkerCode(code: number | string | null | undefined): string {
  if (code == null) return '-';
  const n = Number(code);
  if (isNaN(n)) return String(code);
  return n < 10 ? `0${n}` : String(n);
}

export function normalizeName(text: string | null | undefined): string {
  if (!text) return '-';
  return text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function formatCpf(value: string | null | undefined): string {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}
