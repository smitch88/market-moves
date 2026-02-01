import { ImageResponse } from "next/og";
import { prisma } from "@vault/database";

export const runtime = "nodejs";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Helper to find referrer by handle first, then by referral code
async function findReferrer(code: string) {
  // First try to find by handle (case-insensitive) - users with handles always have referral codes
  let referrer = await prisma.user.findFirst({
    where: { 
      handle: { equals: code, mode: "insensitive" },
    },
    select: {
      name: true,
      handle: true,
      profileImageUrl: true,
      bannerImageUrl: true,
    },
  });

  // Fall back to referral code lookup
  if (!referrer) {
    referrer = await prisma.user.findUnique({
      where: { referralCode: code },
      select: {
        name: true,
        handle: true,
        profileImageUrl: true,
        bannerImageUrl: true,
      },
    });
  }

  return referrer;
}

// Default banner image URL
const DEFAULT_BANNER = "https://markets.vault777.com/vault777markets.png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  
  const referrer = await findReferrer(code);

  const referrerName = referrer?.name || referrer?.handle || "A friend";
  const handleDisplay = referrer?.handle ? `@${referrer.handle}` : "";
  const bannerUrl = referrer?.bannerImageUrl || DEFAULT_BANNER;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
          position: "relative",
        }}
      >
        {/* Banner image as background (if user has one) */}
        {referrer?.bannerImageUrl && (
          <img
            src={bannerUrl}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.3,
            }}
          />
        )}
        
        {/* Dark overlay for readability */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: referrer?.bannerImageUrl 
              ? "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.8) 100%)"
              : "transparent",
            display: "flex",
          }}
        />
        
        {/* Background pattern (only when no banner) */}
        {!referrer?.bannerImageUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: "radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)",
              display: "flex",
            }}
          />
        )}
        
        {/* Content container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "40px",
            position: "relative",
          }}
        >
          {/* Vault777 Logo/Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "30px",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "16px",
              }}
            >
              <span style={{ color: "white", fontSize: "32px", fontWeight: "bold" }}>V</span>
            </div>
            <span style={{ color: "white", fontSize: "36px", fontWeight: "bold" }}>
              Vault<span style={{ color: "#8b5cf6" }}>777</span> Markets
            </span>
          </div>

          {/* User avatar */}
          {referrer?.profileImageUrl ? (
            <img
              src={referrer.profileImageUrl}
              width={120}
              height={120}
              style={{
                borderRadius: "60px",
                border: "4px solid #8b5cf6",
                marginBottom: "24px",
              }}
            />
          ) : (
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "60px",
                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                border: "4px solid #8b5cf6",
              }}
            >
              <span style={{ color: "white", fontSize: "48px", fontWeight: "bold" }}>
                {referrerName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Invitation text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                color: "white",
                fontSize: "48px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              {referrerName}
            </span>
            {handleDisplay && (
              <span
                style={{
                  color: "#a1a1aa",
                  fontSize: "24px",
                  marginBottom: "16px",
                }}
              >
                {handleDisplay}
              </span>
            )}
            <span
              style={{
                color: "#8b5cf6",
                fontSize: "32px",
                fontWeight: "600",
              }}
            >
              invited you to join!
            </span>
          </div>

          {/* Bonus badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(139, 92, 246, 0.2)",
              border: "2px solid #8b5cf6",
              borderRadius: "16px",
              padding: "16px 32px",
              marginTop: "32px",
            }}
          >
            <span style={{ color: "#8b5cf6", fontSize: "24px", marginRight: "12px" }}>🎁</span>
            <span style={{ color: "white", fontSize: "24px", fontWeight: "600" }}>
              Get 10,000 MP Bonus
            </span>
          </div>

          {/* Features */}
          <div
            style={{
              display: "flex",
              gap: "40px",
              marginTop: "32px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ color: "#22c55e", fontSize: "20px", marginRight: "8px" }}>💰</span>
              <span style={{ color: "#a1a1aa", fontSize: "20px" }}>$10K Virtual Credits</span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ color: "#3b82f6", fontSize: "20px", marginRight: "8px" }}>📈</span>
              <span style={{ color: "#a1a1aa", fontSize: "20px" }}>Trade Predictions</span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ color: "#f59e0b", fontSize: "20px", marginRight: "8px" }}>🏆</span>
              <span style={{ color: "#a1a1aa", fontSize: "20px" }}>Win Rewards</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
