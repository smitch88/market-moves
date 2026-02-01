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
  // First try to find by handle (case-insensitive)
  let referrer = await prisma.user.findFirst({
    where: { 
      handle: { equals: code, mode: "insensitive" },
    },
    select: {
      name: true,
      handle: true,
      profileImageUrl: true,
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
      },
    });
  }

  return referrer;
}

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  
  const referrer = await findReferrer(code);

  const referrerName = referrer?.name || referrer?.handle || "A friend";
  const handleDisplay = referrer?.handle ? `@${referrer.handle}` : "";

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
          backgroundColor: "#0a0a0a",
          position: "relative",
        }}
      >
        {/* Subtle gradient background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(251, 44, 54, 0.15) 0%, transparent 50%)",
            display: "flex",
          }}
        />
        
        {/* Grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            display: "flex",
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent 0%, #FB2C36 50%, transparent 100%)",
            display: "flex",
          }}
        />
        
        {/* Content container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "60px",
            position: "relative",
          }}
        >
          {/* Vault Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "48px",
            }}
          >
            <svg width="48" height="33" viewBox="0 0 256 176" fill="none">
              <path d="M93.4336 175.732C97.0227 175.732 99.5158 172.159 98.2773 168.79L37.5634 3.64839C36.8169 1.61786 34.8831 0.268494 32.7197 0.268494L5.1656 0.268494C1.53421 0.268494 -0.961436 3.91952 0.357148 7.30305L64.7138 172.445C65.4862 174.427 67.3953 175.732 69.5223 175.732H93.4336Z" fill="#C7010E"/>
              <path d="M162.413 175.732C158.823 175.732 156.33 172.159 157.569 168.79L218.283 3.64839C219.029 1.61786 220.963 0.268494 223.126 0.268494L250.835 0.268494C254.424 0.268494 256.917 3.84132 255.678 7.20994L194.965 172.352C194.218 174.382 192.284 175.732 190.121 175.732H162.413Z" fill="#FB2C36"/>
              <path d="M115.968 175.732C112.379 175.732 109.886 172.159 111.124 168.79L171.838 3.64839C172.584 1.61786 174.518 0.268494 176.682 0.268494L204.39 0.268494C207.979 0.268494 210.472 3.84132 209.234 7.20994L148.52 172.352C147.773 174.382 145.839 175.732 143.676 175.732H115.968Z" fill="#FB2C36"/>
              <path d="M157.942 0.268494C161.531 0.268494 164.024 3.8421 162.786 7.21071L102.072 172.352C101.325 174.382 99.3919 175.731 97.2288 175.732H69.5204C65.9314 175.732 63.4388 172.158 64.6773 168.789L113.351 36.3932H60.6001C58.4197 36.393 56.4755 35.022 55.7418 32.9687L46.5242 7.16536C45.3239 3.8046 47.8164 0.268714 51.385 0.268494H157.942Z" fill="#FB2C36"/>
            </svg>
            <span style={{ color: "white", fontSize: "32px", fontWeight: "600", marginLeft: "16px", letterSpacing: "-0.02em" }}>
              Vault777Markets
            </span>
          </div>

          {/* User avatar */}
          {referrer?.profileImageUrl ? (
            <img
              src={referrer.profileImageUrl}
              width={100}
              height={100}
              style={{
                borderRadius: "50px",
                border: "3px solid rgba(251, 44, 54, 0.5)",
                marginBottom: "24px",
              }}
            />
          ) : (
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50px",
                background: "linear-gradient(135deg, #FB2C36 0%, #C7010E 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                border: "3px solid rgba(251, 44, 54, 0.5)",
              }}
            >
              <span style={{ color: "white", fontSize: "40px", fontWeight: "600" }}>
                {referrerName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Name and handle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <span
              style={{
                color: "white",
                fontSize: "42px",
                fontWeight: "600",
                marginBottom: "8px",
                letterSpacing: "-0.02em",
              }}
            >
              {referrerName}
            </span>
            {handleDisplay && (
              <span
                style={{
                  color: "#71717a",
                  fontSize: "22px",
                }}
              >
                {handleDisplay}
              </span>
            )}
          </div>

          {/* Invitation text */}
          <span
            style={{
              color: "#FB2C36",
              fontSize: "24px",
              fontWeight: "500",
              marginBottom: "40px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Invited you to join
          </span>

          {/* Bonus box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(251, 44, 54, 0.1)",
              border: "1px solid rgba(251, 44, 54, 0.3)",
              borderRadius: "12px",
              padding: "20px 40px",
            }}
          >
            <span style={{ color: "white", fontSize: "22px", fontWeight: "600" }}>
              Get <span style={{ color: "#FB2C36" }}>10,000 MP</span> Bonus
            </span>
          </div>

          {/* Footer text */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
              marginTop: "40px",
            }}
          >
            <span style={{ color: "#52525b", fontSize: "16px" }}>
              Predict • Trade • Win
            </span>
          </div>
        </div>

        {/* Bottom URL bar */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#52525b", fontSize: "18px" }}>
            markets.vault777.com
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
