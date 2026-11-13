import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV !== "development" || url.hostname !== "localhost" ||
      request.headers.get("host") !== url.host || origin !== url.origin ||
      request.headers.get("sec-fetch-site") !== "same-origin" ||
      request.headers.get("x-xibalba-local-debug") !== "1") {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const token = process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN;
  if (!token) return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
}
