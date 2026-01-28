import { z } from "zod";

/**
 * Schema for admin balance adjustment
 */
export const adjustBalanceSchema = z.object({
  delta: z.number().int(), // Can be positive or negative
  reason: z.string().min(1).max(500),
});

export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
