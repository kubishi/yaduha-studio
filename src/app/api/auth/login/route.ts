import { NextResponse } from "next/server";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;

export async function GET() {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: "repo",
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
}
