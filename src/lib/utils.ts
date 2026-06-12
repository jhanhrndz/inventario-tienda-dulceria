import { db } from './db';

/**
 * Generates a unique UUID v4.
 */
export function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formats a number to currency ($ MXN / generic)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

/**
 * Formats a timestamp to a readable local date
 */
export function formatDate(timestamp: number, includeTime = false): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(date);
}

/**
 * Gets a clean 3-letter prefix from a category name (e.g., Chocolates -> CHO)
 */
export function getCategoryPrefix(categoryName: string): string {
  const cleanName = categoryName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove emojis, punctuation, etc.
    .trim()
    .toUpperCase();
  
  if (!cleanName) return 'GEN';
  
  // Replace spaces to get initials or first 3 letters
  const lettersOnly = cleanName.replace(/\s+/g, '');
  const prefix = lettersOnly.slice(0, 3);
  return prefix.padEnd(3, 'X');
}

/**
 * Generates the next internal code for products based on category name/prefix (e.g. CHO-001, CHO-002, etc.)
 */
export async function generateNextInternalCode(categoryId: string): Promise<string> {
  if (!categoryId) return 'GEN-001';
  
  try {
    const category = await db.categories.get(categoryId);
    const categoryName = category ? category.name : 'General';
    const prefix = `${getCategoryPrefix(categoryName)}-`;

    const products = await db.products.toArray();
    let maxNumber = 0;

    for (const p of products) {
      if (p.internal_code && p.internal_code.toUpperCase().startsWith(prefix)) {
        const numPart = p.internal_code.substring(prefix.length);
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    const nextNumber = maxNumber + 1;
    const paddedNumber = String(nextNumber).padStart(3, '0');
    return `${prefix}${paddedNumber}`;
  } catch (error) {
    console.error('Error generating internal code:', error);
    return 'GEN-001';
  }
}

/**
 * Safe helper to extract message from any caught error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

