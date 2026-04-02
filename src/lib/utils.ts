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
  const romanNumerals = new Set(['I','II','III','IV','V','VI','VII','VIII','IX','X']);
  const lowerWords = new Set([
    'de','do','da','dos','das','e','em','no','na','nos','nas',
    'por','para','com','sem','sob','sobre','entre','até','ao','aos','à','às',
  ]);
  return text.split(/\s+/).map((word, i) => {
    const upper = word.toUpperCase();
    if (romanNumerals.has(upper)) return upper;
    const lower = word.toLowerCase();
    if (i > 0 && lowerWords.has(lower)) return lower;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export function formatCpf(value: string | null | undefined): string {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}
