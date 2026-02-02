import { prisma, FeatureFlagStatus, UserRole } from "@vault/database";

// Type for the user object we accept (minimal fields needed)
interface UserContext {
  id: string;
  role: UserRole;
}

// Cache for feature flags (refreshed every 30 seconds)
let flagCache: Map<string, FeatureFlagStatus> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Refresh the feature flag cache
 */
async function refreshCache(): Promise<void> {
  const flags = await prisma.featureFlag.findMany({
    select: {
      key: true,
      status: true,
    },
  });
  
  flagCache = new Map(flags.map(f => [f.key, f.status]));
  cacheTimestamp = Date.now();
}

/**
 * Get flag status from cache or database
 */
async function getFlagStatus(key: string): Promise<FeatureFlagStatus | null> {
  // Refresh cache if stale
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    await refreshCache();
  }
  
  // If flag exists in cache, return it
  if (flagCache.has(key)) {
    return flagCache.get(key)!;
  }
  
  // Flag not found in cache, try fetching directly (might be newly created)
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { status: true },
  });
  
  if (flag) {
    flagCache.set(key, flag.status);
    return flag.status;
  }
  
  return null;
}

/**
 * Check if a feature is enabled for a given user
 * Returns true if:
 * - Flag is ON
 * - Flag is ADMIN_ONLY and user is admin
 * Returns false if:
 * - Flag is OFF
 * - Flag doesn't exist (fail closed)
 * - Flag is ADMIN_ONLY and user is not admin
 */
export async function isFeatureEnabled(
  key: string,
  user?: UserContext | null
): Promise<boolean> {
  const status = await getFlagStatus(key);
  
  if (!status) {
    // Flag doesn't exist - fail closed (feature disabled)
    console.warn(`[FeatureFlag] Unknown flag: ${key}`);
    return false;
  }
  
  switch (status) {
    case FeatureFlagStatus.ON:
      return true;
    
    case FeatureFlagStatus.OFF:
      return false;
    
    case FeatureFlagStatus.ADMIN_ONLY:
      return user?.role === UserRole.ADMIN;
    
    default:
      return false;
  }
}

/**
 * Get all feature flags (for admin panel)
 */
export async function getAllFeatureFlags() {
  return prisma.featureFlag.findMany({
    orderBy: { name: 'asc' },
  });
}

/**
 * Get a single feature flag by key
 */
export async function getFeatureFlag(key: string) {
  return prisma.featureFlag.findUnique({
    where: { key },
  });
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(data: {
  key: string;
  name: string;
  description?: string;
  status?: FeatureFlagStatus;
}) {
  const flag = await prisma.featureFlag.create({
    data: {
      key: data.key,
      name: data.name,
      description: data.description,
      status: data.status ?? FeatureFlagStatus.OFF,
    },
  });
  
  // Update cache
  flagCache.set(flag.key, flag.status);
  
  return flag;
}

/**
 * Update a feature flag's status
 */
export async function updateFeatureFlag(
  key: string,
  data: {
    name?: string;
    description?: string;
    status?: FeatureFlagStatus;
  }
) {
  const flag = await prisma.featureFlag.update({
    where: { key },
    data,
  });
  
  // Update cache
  if (data.status !== undefined) {
    flagCache.set(flag.key, flag.status);
  }
  
  return flag;
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(key: string) {
  const flag = await prisma.featureFlag.delete({
    where: { key },
  });
  
  // Remove from cache
  flagCache.delete(key);
  
  return flag;
}

/**
 * Invalidate the cache (useful after bulk updates)
 */
export function invalidateFeatureFlagCache(): void {
  cacheTimestamp = 0;
}

// Feature flag keys as constants for type safety
export const FeatureFlags = {
  DAILY_SPIN: 'daily_spin',
} as const;

export type FeatureFlagKey = typeof FeatureFlags[keyof typeof FeatureFlags];

