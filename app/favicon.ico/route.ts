import { NextResponse } from "next/server";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/xibalba-logo.jpg", request.url), 307);
}
