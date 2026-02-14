import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { githubFetch } from "@/lib/github/client";

async function proxyToGitHub(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Extract the path after /api/github/
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/github\//, "");
  const search = url.search;

  const res = await githubFetch(`${path}${search}`, session.github_token, {
    method: request.method,
    body: request.method !== "GET" ? await request.text() : undefined,
    headers:
      request.method !== "GET"
        ? { "Content-Type": "application/json" }
        : undefined,
  });

  const text = await res.text();

  try {
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "text/plain" },
    });
  }
}

export const GET = proxyToGitHub;
export const POST = proxyToGitHub;
export const PUT = proxyToGitHub;
export const DELETE = proxyToGitHub;
