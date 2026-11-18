import { casLoginUrl, originForRequest } from "@/lib/cas";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return NextResponse.redirect(casLoginUrl(originForRequest(request.url)));
}
