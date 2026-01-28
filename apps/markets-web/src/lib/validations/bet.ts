import { z } from "zod";

/**
 * Schema for placing a bet
 */
export const placeBetSchema = z.object({
  marketId: z.string().min(1),
  outcomeIndex: z.number().int().min(0).max(1),
  amount: z.number().positive().int(),
});

export type PlaceBetInput = z.infer<typeof placeBetSchema>;

/**
 * Schema for cancelling a bet (admin)
 */
export const cancelBetSchema = z.object({
  reason: z.string().optional(),
});

export type CancelBetInput = z.infer<typeof cancelBetSchema>;
