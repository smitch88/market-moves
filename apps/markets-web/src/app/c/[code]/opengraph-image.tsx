import { ImageResponse } from "next/og";
import { prisma } from "@vault/database";

export const runtime = "nodejs";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Helper to find captain by handle first, then by referral code
async function findCaptain(code: string) {
  // First try to find by handle (case-insensitive)
  let kol = await prisma.user.findFirst({
    where: {
      handle: { equals: code, mode: "insensitive" },
      isKOL: true,
    },
    select: {
      name: true,
      handle: true,
      profileImageUrl: true,
      bannerImageUrl: true,
      _count: {
        select: {
          followers: true,
        },
      },
    },
  });

  // Fall back to referral code lookup
  if (!kol) {
    kol = await prisma.user.findFirst({
      where: {
        referralCode: code,
        isKOL: true,
      },
      select: {
        name: true,
        handle: true,
        profileImageUrl: true,
        bannerImageUrl: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
    });
  }

  return kol;
}

// Default banner image URL
const DEFAULT_BANNER = "https://markets.vault777.com/vault777markets.png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  
  const kol = await findCaptain(code);

  const captainName = kol?.name || kol?.handle || "Captain";
  const handleDisplay = kol?.handle ? `@${kol.handle}` : "";
  const followerCount = kol?._count.followers || 0;
  const bannerUrl = kol?.bannerImageUrl || DEFAULT_BANNER;

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
        {kol?.bannerImageUrl && (
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
            background: kol?.bannerImageUrl 
              ? "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.8) 100%)"
              : "transparent",
            display: "flex",
          }}
        />
        
        {/* Background pattern (only when no banner) */}
        {!kol?.bannerImageUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: "radial-gradient(circle at 25% 25%, rgba(234, 179, 8, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)",
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
          {/* Captain badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.1) 100%)",
              border: "2px solid #eab308",
              borderRadius: "24px",
              padding: "8px 24px",
              marginBottom: "24px",
            }}
          >
            <span style={{ fontSize: "24px", marginRight: "8px" }}>⚓</span>
            <span style={{ color: "#eab308", fontSize: "20px", fontWeight: "bold" }}>CAPTAIN</span>
          </div>

          {/* User avatar with captain border */}
          {kol?.profileImageUrl ? (
            <div style={{ position: "relative", display: "flex" }}>
              <img
                src={kol.profileImageUrl}
                width={140}
                height={140}
                style={{
                  borderRadius: "70px",
                  border: "5px solid #eab308",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "70px",
                background: "linear-gradient(135deg, #eab308 0%, #f59e0b 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "5px solid #eab308",
              }}
            >
              <span style={{ color: "white", fontSize: "56px", fontWeight: "bold" }}>
                {captainName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Captain name */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: "24px",
            }}
          >
            <span
              style={{
                color: "white",
                fontSize: "52px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              {captainName}
            </span>
            {handleDisplay && (
              <span
                style={{
                  color: "#a1a1aa",
                  fontSize: "26px",
                  marginBottom: "12px",
                }}
              >
                {handleDisplay}
              </span>
            )}
            
            {/* Team size */}
            {followerCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: "8px",
                }}
              >
                <span style={{ color: "#8b5cf6", fontSize: "22px", marginRight: "8px" }}>👥</span>
                <span style={{ color: "#a1a1aa", fontSize: "22px" }}>
                  {followerCount} team member{followerCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* CTA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "linear-gradient(135deg, #eab308 0%, #f59e0b 100%)",
              borderRadius: "16px",
              padding: "16px 40px",
              marginTop: "32px",
            }}
          >
            <span style={{ color: "#0a0a0a", fontSize: "28px", fontWeight: "bold" }}>
              Join My Team!
            </span>
          </div>

          {/* Vault777 branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "32px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "12px",
              }}
            >
              <span style={{ color: "white", fontSize: "22px", fontWeight: "bold" }}>V</span>
            </div>
            <span style={{ color: "#a1a1aa", fontSize: "24px" }}>
              Vault<span style={{ color: "#8b5cf6" }}>777</span> Markets
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
