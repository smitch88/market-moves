import { PrivyClient } from "@privy-io/server-auth";

const PRIVY_APP_ID = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || "";

if (!PRIVY_APP_ID) {
  console.warn("PRIVY_APP_ID is not set");
}

export const privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

export interface PrivyTokenClaims {
  userId: string;
  sessionId: string;
  appId: string;
}

export async function verifyPrivyToken(
  authToken: string | undefined
): Promise<PrivyTokenClaims | null> {
  if (!authToken) {
    return null;
  }

  try {
    const verifiedClaims = await privyClient.verifyAuthToken(authToken);
    return {
      userId: verifiedClaims.userId,
      sessionId: verifiedClaims.sessionId,
      appId: verifiedClaims.appId,
    };
  } catch (error) {
    console.error("Failed to verify Privy token:", error);
    return null;
  }
}
