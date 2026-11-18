import { startCasSession } from "@/lib/cas-session";
import { casCallbackUrl, originForRequest, validateCasTicket } from "@/lib/cas";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = originForRequest(request.url);
  const ticket = new URL(request.url).searchParams.get("ticket") ?? "";
  const email = await validateCasTicket(ticket, casCallbackUrl(origin));
  if (!email) return NextResponse.redirect(new URL("/?error=cas", origin));

  const session = await startCasSession(email);
  if ("error" in session) return NextResponse.redirect(new URL(`/?error=${session.error}`, origin));
  return NextResponse.redirect(new URL(session.next, origin));
}
