import { NextResponse } from "next/server";
import { prisma } from "@vault/database";

// Only allow in development
const isDev = process.env.NODE_ENV === "development";

export async function GET() {
  if (!isDev) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        twitterSubject: true,
        role: true,
        balance: true,
      },
      orderBy: [
        { role: "desc" }, // Admins first
        { createdAt: "desc" },
      ],
      take: 50,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching dev users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
