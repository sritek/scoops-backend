/**
 * Custom Discount Calculation Utilities
 *
 * This module provides utility functions for calculating custom discounts
 * on student fee structures. Custom discounts can be either percentage-based
 * or fixed amount discounts.
 *
 * @module fees/discount-calculation
 */

/**
 * Discount type for custom student discounts
 */
export type CustomDiscountType = "percentage" | "fixed_amount";

/**
 * Calculate the custom discount amount based on discount type and gross amount.
 *
 * For percentage discounts:
 * - Calculates the percentage of the gross amount
 * - Uses Math.round() for rounding to nearest integer (paise)
 *
 * For fixed amount discounts:
 * - Returns the discount value, capped at the gross amount
 * - Ensures discount never exceeds the gross amount
 *
 * @param discountType - The type of discount: "percentage" or "fixed_amount"
 * @param discountValue - The discount value (0-100 for percentage, positive integer for fixed)
 * @param grossAmount - The gross fee amount in paise (must be positive)
 * @returns The calculated discount amount in paise (always >= 0 and <= grossAmount)
 *
 * @example
 * // Percentage discount: 10% of 50000 paise = 5000 paise
 * calculateCustomDiscountAmount("percentage", 10, 50000) // returns 5000
 *
 * @example
 * // Fixed amount discount: 3000 paise from 50000 paise
 * calculateCustomDiscountAmount("fixed_amount", 3000, 50000) // returns 3000
 *
 * @example
 * // Fixed amount capped at gross: 60000 paise discount on 50000 paise gross
 * calculateCustomDiscountAmount("fixed_amount", 60000, 50000) // returns 50000
 */
export function calculateCustomDiscountAmount(
  discountType: CustomDiscountType,
  discountValue: number,
  grossAmount: number,
): number {
  // Handle edge cases
  if (grossAmount <= 0) {
    return 0;
  }

  if (discountValue <= 0) {
    return 0;
  }

  if (discountType === "percentage") {
    // Cap percentage at 100 to ensure discount doesn't exceed gross
    const cappedPercentage = Math.min(discountValue, 100);
    // Calculate percentage and round to nearest integer (paise)
    return Math.round((grossAmount * cappedPercentage) / 100);
  }

  // Fixed amount - cap at gross amount to ensure non-negative net
  return Math.min(discountValue, grossAmount);
}

/**
 * Calculate the net amount after applying scholarships and custom discount.
 *
 * The formula is: netAmount = grossAmount - scholarshipAmount - customDiscountAmount
 *
 * The result is always capped at 0 (non-negative) to ensure the net amount
 * never goes below zero even if combined discounts exceed the gross amount.
 *
 * @param grossAmount - The gross fee amount in paise
 * @param scholarshipAmount - The total scholarship discount in paise (default: 0)
 * @param customDiscountAmount - The custom discount amount in paise (default: 0)
 * @returns The net payable amount in paise (always >= 0)
 *
 * @example
 * // Basic calculation: 50000 - 5000 - 2000 = 43000
 * calculateNetAmount(50000, 5000, 2000) // returns 43000
 *
 * @example
 * // Discounts exceed gross: 50000 - 30000 - 25000 = 0 (capped)
 * calculateNetAmount(50000, 30000, 25000) // returns 0
 *
 * @example
 * // No discounts: 50000 - 0 - 0 = 50000
 * calculateNetAmount(50000) // returns 50000
 */
export function calculateNetAmount(
  grossAmount: number,
  scholarshipAmount: number = 0,
  customDiscountAmount: number = 0,
): number {
  // Ensure non-negative result
  return Math.max(0, grossAmount - scholarshipAmount - customDiscountAmount);
}
