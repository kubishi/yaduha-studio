import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const provider = body.provider || "anthropic";
  const stream = body.stream !== false; // default true

  // Client-provided key (from localStorage) takes priority, then server env
  const clientKey = request.headers.get("x-llm-api-key");
  const serverAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const serverOpenaiKey = process.env.OPENAI_API_KEY;

  if (provider === "openai") {
    const apiKey = clientKey || serverOpenaiKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No OpenAI API key. Add one in Account settings." },
        { status: 503 }
      );
    }
    return proxyOpenAI(apiKey, body, stream);
  }

  // Default: Anthropic
  const apiKey = clientKey || serverAnthropicKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Anthropic API key. Add one in Account settings." },
      { status: 503 }
    );
  }
  return proxyAnthropic(apiKey, body, stream);
}

async function proxyAnthropic(
  apiKey: string,
  body: Record<string, unknown>,
  stream: boolean
) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: body.model || "claude-sonnet-4-5-20250929",
      max_tokens: body.max_tokens || 4096,
      system: body.system,
      messages: body.messages,
      stream,
      ...(body.tools ? { tools: body.tools } : {}),
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json(
      { error: `Anthropic API error: ${error}` },
      { status: res.status }
    );
  }

  if (stream) {
    return new NextResponse(res.body, { headers: SSE_HEADERS });
  }

  // Non-streaming response
  const data = await res.json();

  // When tools are in play, return the full Anthropic response so
  // the client can see tool_use blocks and stop_reason
  if (body.tools) {
    return NextResponse.json(data);
  }

  // Simple text extraction when no tools
  const text = data.content
    ?.filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return NextResponse.json({ text });
}

async function proxyOpenAI(
  apiKey: string,
  body: Record<string, unknown>,
  stream: boolean
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: body.model || "gpt-4o",
      max_tokens: body.max_tokens || 4096,
      messages: [
        ...(body.system
          ? [{ role: "system", content: body.system }]
          : []),
        ...(body.messages as { role: string; content: string }[]),
      ],
      stream,
      ...(body.tools ? { tools: body.tools } : {}),
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json(
      { error: `OpenAI API error: ${error}` },
      { status: res.status }
    );
  }

  if (stream) {
    return new NextResponse(res.body, { headers: SSE_HEADERS });
  }

  // Non-streaming response
  const data = await res.json();

  if (body.tools) {
    return NextResponse.json(data);
  }

  const text = data.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ text });
}
