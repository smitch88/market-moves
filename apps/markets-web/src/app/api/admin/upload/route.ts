import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { requireAdmin } from "@vault/auth";

/**
 * POST /api/admin/upload
 * 
 * Upload a file to Vercel Blob storage.
 * Requires admin authentication.
 * 
 * Query params:
 * - filename: Original filename
 * - folder: Optional folder path (e.g., "events", "markets", "logos")
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const folder = searchParams.get("folder") || "uploads";

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    if (!request.body) {
      return NextResponse.json(
        { error: "File body is required" },
        { status: 400 }
      );
    }

    // Sanitize filename
    const sanitizedFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .toLowerCase();

    // Create path with folder
    const pathname = `${folder}/${sanitizedFilename}`;

    // Upload to Vercel Blob
    const blob = await put(pathname, request.body, {
      access: "public",
      addRandomSuffix: true, // Prevent overwrites and ensure unique URLs
    });

    return NextResponse.json({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      contentType: blob.contentType,
      contentDisposition: blob.contentDisposition,
    });
  } catch (error) {
    console.error("Upload error:", error);

    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/upload
 * 
 * Delete a file from Vercel Blob storage.
 * 
 * Query params:
 * - url: The blob URL to delete
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Verify the URL is from our blob store
    if (!url.includes("blob.vercel-storage.com")) {
      return NextResponse.json(
        { error: "Invalid blob URL" },
        { status: 400 }
      );
    }

    await del(url);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);

    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

// Required for handling file uploads
export const runtime = "nodejs";
