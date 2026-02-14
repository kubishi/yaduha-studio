import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

export async function GET(request: NextRequest) {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured (missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET)" },
      { status: 500 }
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenText = await tokenRes.text();

  if (!tokenRes.ok) {
    console.error("GitHub token exchange failed:", tokenRes.status, tokenText);
    return NextResponse.json(
      { error: "GitHub token exchange failed", status: tokenRes.status, body: tokenText },
      { status: 502 }
    );
  }

  let tokenData: { error?: string; error_description?: string; access_token?: string };
  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    console.error("GitHub returned non-JSON:", tokenText.slice(0, 200));
    return NextResponse.json(
      { error: "GitHub returned non-JSON response", body: tokenText.slice(0, 200) },
      { status: 502 }
    );
  }

  if (tokenData.error) {
    return NextResponse.json(
      { error: tokenData.error_description || tokenData.error },
      { status: 400 }
    );
  }

  // Get user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "yaduha-studio",
    },
  });

  if (!userRes.ok) {
    const userText = await userRes.text();
    console.error("GitHub user fetch failed:", userRes.status, userText);
    return NextResponse.json(
      { error: "Failed to fetch GitHub user", body: userText.slice(0, 200) },
      { status: 502 }
    );
  }

  const user = await userRes.json();

  // Create session JWT
  const jwt = await createSession({
    github_token: tokenData.access_token!,
    github_user: user.login,
  });

  const response = NextResponse.redirect(new URL("/repos", request.url));
  response.cookies.set(sessionCookieOptions(jwt));
  return response;
}
