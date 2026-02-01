-- Add XP reason for KOL market volume rewards
ALTER TYPE "XPReason" ADD VALUE IF NOT EXISTS 'KOL_MARKET_VOLUME';
