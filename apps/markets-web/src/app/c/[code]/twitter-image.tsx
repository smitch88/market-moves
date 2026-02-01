// Re-export the OG image for Twitter
export { default, size, contentType } from "./opengraph-image";

// Must be explicitly defined (can't be re-exported for Next.js static analysis)
export const runtime = "nodejs";
