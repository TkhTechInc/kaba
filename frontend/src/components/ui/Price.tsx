"use client";

import { formatPriceWithCurrency } from "@/lib/format-number";
import { cn } from "@/lib/utils";

export interface PriceProps {
  /** Amount to display */
  amount: number;
  /** Currency code (NGN, XOF, USD, etc.) */
  currency: string;
  /** Optional suffix (e.g. " / month") */
  suffix?: string;
  /** Decimal places (default: 2) */
  decimals?: number;
  /** Additional class names */
  className?: string;
  /** Render as different element (default: span) */
  as?: "span" | "strong" | "p";
}

/**
 * Consistent price display across the app. Handles currency position:
 * - Prefix (NGN, GHS, USD): "₦5,000.00"
 * - Suffix (XOF, XAF, EUR): "2 500,00 XOF"
 */
export function Price({
  amount,
  currency,
  suffix = "",
  decimals = 2,
  className,
  as: Component = "span",
}: PriceProps) {
  const formatted = formatPriceWithCurrency(amount, currency, suffix, decimals);
  return <Component className={cn("tabular-nums", className)}>{formatted}</Component>;
}
