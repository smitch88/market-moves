import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@vault/database";

// Only allow in development
const isDev = process.env.NODE_ENV === "development";
const IMPERSONATE_COOKIE = "dev-impersonate-twitter-id";

export async function GET() {
  if (!isDev) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    const cookieStore = await cookies();
    const twitterId = cookieStore.get(IMPERSONATE_COOKIE)?.value;

    if (!twitterId) {
      return NextResponse.json({ active: false, user: null });
    }

    const user = await prisma.user.findFirst({
      where: { twitterSubject: twitterId },
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        twitterSubject: true,
        role: true,
        balance: true,
      },
    });

    if (!user) {
      // Clear invalid cookie
      const response = NextResponse.json({ active: false, user: null });
      response.cookies.delete(IMPERSONATE_COOKIE);
      return response;
    }

    return NextResponse.json({ active: true, user });
  } catch (error) {
    console.error("Error getting impersonation state:", error);
    return NextResponse.json({ error: "Failed to get state" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isDev) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { twitterId } = body;

    if (!twitterId) {
      return NextResponse.json({ error: "Twitter ID required" }, { status: 400 });
    }

    // Find or create user with this Twitter ID
    let user = await prisma.user.findFirst({
      where: { twitterSubject: twitterId },
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        twitterSubject: true,
        role: true,
        balance: true,
      },
    });

    // If user doesn't exist, create a dev user
    if (!user) {
      const newUser = await prisma.user.create({
        data: {
          privyUserId: `dev-${twitterId}`,
          twitterSubject: twitterId,
          handle: `dev_user_${twitterId.slice(-6)}`,
          name: `Dev User ${twitterId.slice(-6)}`,
          balance: 10000,
        },
        select: {
          id: true,
          handle: true,
          name: true,
          profileImageUrl: true,
          twitterSubject: true,
          role: true,
          balance: true,
        },
      });
      user = newUser;
    }

    // Set impersonation cookie
    const response = NextResponse.json({ active: true, user });
    response.cookies.set(IMPERSONATE_COOKIE, twitterId, {
      httpOnly: true,
      secure: false, // Dev only
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("Error starting impersonation:", error);
    return NextResponse.json({ error: "Failed to impersonate" }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isDev) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const response = NextResponse.json({ active: false, user: null });
  response.cookies.delete(IMPERSONATE_COOKIE);
  return response;
}
