import { NextResponse, type NextRequest } from "next/server";

// Every admin page, server action and the media preview route sit behind this gate, so the admin token
// the server uses on a moderator's behalf is only ever exercised by someone who has signed in.
// ponytail: one shared HTTP Basic login (user "admin", ADMIN_PASSWORD). Swap for Entra ID sign-in with roles (TRD 2.9).

const USER = "admin";

/** Constant-time string comparison, so response timing doesn't leak the password. */
function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function proxy(request: NextRequest) {
  const password = process.env["ADMIN_PASSWORD"];
  // Fail closed: no password configured means no access.
  if (!password) return new NextResponse("Admin is locked: set ADMIN_PASSWORD in the repo .env.", { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const split = decoded.indexOf(":");
    if (split > 0 && safeEqual(decoded.slice(0, split), USER) && safeEqual(decoded.slice(split + 1), password)) {
      return NextResponse.next();
    }
  }
  return new NextResponse("Sign in required.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Roar admin", charset="UTF-8"' } });
}
