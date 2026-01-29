/**
 * Currency Utilities for Decimal-based monetary operations
 * 
 * Using Prisma.Decimal for exact precision with real money.
 * All monetary values are stored as Decimal in dollars (e.g., 10000.00 = $10,000)
 */

import { Prisma } from '@vault/database';

// ============================================================================
// CREATION & CONVERSION
// ============================================================================

/**
 * Create a Decimal from various input types
 */
export const decimal = (value: string | number | Prisma.Decimal): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
};

/**
 * Create zero Decimal
 */
export const zero = (): Prisma.Decimal => {
  return new Prisma.Decimal(0);
};

/**
 * Convert Decimal to number for JSON serialization
 */
export const toNumber = (value: Prisma.Decimal | string | number): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return value.toNumber();
};

/**
 * Convert number to Decimal from JSON
 */
export const fromNumber = (value: number): Prisma.Decimal => {
  return new Prisma.Decimal(value);
};

// ============================================================================
// ARITHMETIC OPERATIONS
// ============================================================================

/**
 * Add two Decimal values
 */
export const add = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): Prisma.Decimal => {
  const decimalA = decimal(a);
  const decimalB = decimal(b);
  return decimalA.plus(decimalB);
};

/**
 * Subtract b from a
 */
export const subtract = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): Prisma.Decimal => {
  const decimalA = decimal(a);
  const decimalB = decimal(b);
  return decimalA.minus(decimalB);
};

/**
 * Multiply two Decimal values
 */
export const multiply = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): Prisma.Decimal => {
  const decimalA = decimal(a);
  const decimalB = decimal(b);
  return decimalA.times(decimalB);
};

/**
 * Divide a by b
 */
export const divide = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): Prisma.Decimal => {
  const decimalA = decimal(a);
  const decimalB = decimal(b);
  return decimalA.dividedBy(decimalB);
};

/**
 * Get absolute value
 */
export const abs = (value: Prisma.Decimal | string | number): Prisma.Decimal => {
  return decimal(value).abs();
};

/**
 * Round to specified decimal places
 */
export const round = (
  value: Prisma.Decimal | string | number, 
  decimalPlaces: number = 2,
  roundingMode: Prisma.Decimal.Rounding = Prisma.Decimal.ROUND_HALF_UP
): Prisma.Decimal => {
  return decimal(value).toDecimalPlaces(decimalPlaces, roundingMode);
};

/**
 * Floor to specified decimal places
 */
export const floor = (value: Prisma.Decimal | string | number, decimalPlaces: number = 2): Prisma.Decimal => {
  return decimal(value).toDecimalPlaces(decimalPlaces, Prisma.Decimal.ROUND_DOWN);
};

/**
 * Ceiling to specified decimal places
 */
export const ceil = (value: Prisma.Decimal | string | number, decimalPlaces: number = 2): Prisma.Decimal => {
  return decimal(value).toDecimalPlaces(decimalPlaces, Prisma.Decimal.ROUND_UP);
};

// ============================================================================
// COMPARISON OPERATIONS
// ============================================================================

/**
 * Check if a > b
 */
export const isGreaterThan = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): boolean => {
  return decimal(a).greaterThan(decimal(b));
};

/**
 * Check if a >= b
 */
export const isGreaterThanOrEqual = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): boolean => {
  return decimal(a).greaterThanOrEqualTo(decimal(b));
};

/**
 * Check if a < b
 */
export const isLessThan = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): boolean => {
  return decimal(a).lessThan(decimal(b));
};

/**
 * Check if a <= b
 */
export const isLessThanOrEqual = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): boolean => {
  return decimal(a).lessThanOrEqualTo(decimal(b));
};

/**
 * Check if a === b
 */
export const isEqual = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): boolean => {
  return decimal(a).equals(decimal(b));
};

/**
 * Check if value is zero
 */
export const isZero = (value: Prisma.Decimal | string | number): boolean => {
  return decimal(value).isZero();
};

/**
 * Check if value is positive
 */
export const isPositive = (value: Prisma.Decimal | string | number): boolean => {
  return decimal(value).isPositive();
};

/**
 * Check if value is negative
 */
export const isNegative = (value: Prisma.Decimal | string | number): boolean => {
  return decimal(value).isNegative();
};

/**
 * Get minimum of two values
 */
export const min = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): Prisma.Decimal => {
  return isLessThan(a, b) ? decimal(a) : decimal(b);
};

/**
 * Get maximum of two values
 */
export const max = (a: Prisma.Decimal | string | number, b: Prisma.Decimal | string | number): Prisma.Decimal => {
  return isGreaterThan(a, b) ? decimal(a) : decimal(b);
};

// ============================================================================
// DISPLAY FORMATTING
// ============================================================================

/**
 * Format Decimal as currency string
 * @param value Decimal, string, or number to format
 * @param options Formatting options
 */
export const formatCurrency = (
  value: Prisma.Decimal | string | number,
  options?: {
    showSign?: boolean;
    compact?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string => {
  const dec = decimal(value);
  const absValue = dec.abs();
  
  if (options?.compact) {
    const num = absValue.toNumber();
    let formatted: string;
    
    if (num >= 1000000) {
      formatted = `${(num / 1000000).toFixed(1)}m`;
    } else if (num >= 1000) {
      formatted = `${(num / 1000).toFixed(1)}k`;
    } else {
      formatted = absValue.toFixed(options.maximumFractionDigits ?? 2);
    }
    
    const sign = dec.isNegative() ? '-' : (options?.showSign ? '+' : '');
    return `${sign}$${formatted}`;
  }
  
  const minDigits = options?.minimumFractionDigits ?? 2;
  const maxDigits = options?.maximumFractionDigits ?? 2;
  
  const formatted = absValue.toFixed(maxDigits, Prisma.Decimal.ROUND_HALF_UP);
  const sign = dec.isNegative() ? '-' : (options?.showSign ? '+' : '');
  
  return `${sign}$${formatted}`;
};

/**
 * Format Decimal as percentage
 */
export const formatPercent = (
  value: Prisma.Decimal | string | number,
  decimalPlaces: number = 2,
  showSign?: boolean
): string => {
  const dec = decimal(value);
  const sign = dec.isNegative() ? '-' : (showSign && dec.isPositive() ? '+' : '');
  return `${sign}${dec.abs().toFixed(decimalPlaces)}%`;
};

// ============================================================================
// FEE CALCULATIONS
// ============================================================================

/**
 * Calculate fee from basis points
 * @param amount Amount to calculate fee on
 * @param feeBps Fee in basis points (e.g., 100 = 1%)
 */
export const calculateFee = (amount: Prisma.Decimal | string | number, feeBps: number): Prisma.Decimal => {
  const feeRate = decimal(feeBps).dividedBy(10000);
  return floor(multiply(decimal(amount), feeRate));
};

/**
 * Calculate amount after fee deduction
 */
export const afterFee = (amount: Prisma.Decimal | string | number, feeBps: number): Prisma.Decimal => {
  const fee = calculateFee(amount, feeBps);
  return subtract(decimal(amount), fee);
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a value is a valid monetary amount
 */
export const isValidAmount = (value: unknown): boolean => {
  try {
    const dec = decimal(value as string | number);
    return dec.isFinite() && !dec.isNaN() && dec.greaterThanOrEqualTo(0);
  } catch {
    return false;
  }
};

/**
 * Ensure non-negative
 */
export const ensurePositive = (value: Prisma.Decimal, fieldName: string): Prisma.Decimal => {
  if (value.isNegative()) {
    throw new Error(`${fieldName} must be non-negative`);
  }
  return value;
};
