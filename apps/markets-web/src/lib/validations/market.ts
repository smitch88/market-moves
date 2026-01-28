import { z } from "zod";

/**
 * Schema for resolving a market
 */
export const resolveMarketSchema = z.object({
  outcomeIndex: z.number().int().min(0).max(1),
});

export type ResolveMarketInput = z.infer<typeof resolveMarketSchema>;

/**
 * Schema for creating a market (admin)
 */
export const createMarketSchema = z.object({
  eventId: z.string().min(1),
  question: z.string().min(10).max(500),
  outcomes: z.array(z.string().min(1)).length(2),
  outcomeColors: z.array(z.string()).length(2).optional(),
  detailsMarkdown: z.string().optional(),
  closesAt: z.string().datetime().optional(),
  seed0: z.number().int().min(0).optional(),
  seed1: z.number().int().min(0).optional(),
  feeBps: z.number().int().min(0).max(10000).optional(),
});

export type CreateMarketInput = z.infer<typeof createMarketSchema>;

/**
 * Schema for updating a market (admin)
 */
export const updateMarketSchema = z.object({
  question: z.string().min(10).max(500).optional(),
  outcomes: z.array(z.string().min(1)).length(2).optional(),
  outcomeColors: z.array(z.string()).length(2).optional(),
  detailsMarkdown: z.string().optional(),
  closesAt: z.string().datetime().optional(),
  seed0: z.number().int().min(0).optional(),
  seed1: z.number().int().min(0).optional(),
  feeBps: z.number().int().min(0).max(10000).optional(),
});

export type UpdateMarketInput = z.infer<typeof updateMarketSchema>;
