import Anthropic from "@anthropic-ai/sdk";

export const config = { runtime: "edge" };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TEXT_CHARS = 60000;
const MAX_IMAGES = 2;
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ClientImage = { media_type: string; data: string };
type ClientTurn = { role: "user" | "assistant"; content: string };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Protección opcional: si APP_ACCESS_CODE está configurado en Vercel,
  // solo responden las peticiones que traigan el mismo código.
  const accessCode = process.env.APP_ACCESS_CODE;
  if (accessCode && req.headers.get("x-access-code") !== accessCode) {
    return jsonResponse({ error: "forbidden" }, 403);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "missing_api_key" }, 500);
  }

  let body: { turns?: string | ClientTurn[]; images?: ClientImage[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "bad_json" }, 400);
  }

  const rawTurns = body.turns;
  const turns: ClientTurn[] =
    typeof rawTurns === "string"
      ? [{ role: "user", content: rawTurns }]
      : Array.isArray(rawTurns)
        ? rawTurns
        : [];
  if (
    turns.length === 0 ||
    turns[0].role !== "user" ||
    turns[turns.length - 1].role !== "user" ||
    turns.some(
      (t) =>
        (t.role !== "user" && t.role !== "assistant") ||
        typeof t.content !== "string" ||
        t.content.length === 0,
    ) ||
    turns.reduce((n, t) => n + t.content.length, 0) > MAX_TEXT_CHARS
  ) {
    return jsonResponse({ error: "bad_turns" }, 400);
  }

  const images = (body.images ?? []).slice(0, MAX_IMAGES);
  if (
    images.some(
      (im) =>
        !ALLOWED_MEDIA.includes(im.media_type) ||
        typeof im.data !== "string" ||
        im.data.length > 3_000_000,
    )
  ) {
    return jsonResponse({ error: "bad_image" }, 400);
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t, i) => {
    if (i === turns.length - 1 && images.length > 0) {
      return {
        role: t.role,
        content: [
          ...images.map(
            (im): Anthropic.Beta.BetaImageBlockParam => ({
              type: "image",
              source: {
                type: "base64",
                media_type: im.media_type as "image/jpeg",
                data: im.data,
              },
            }),
          ),
          { type: "text", text: t.content },
        ],
      };
    }
    return { role: t.role, content: t.content };
  });

  const stream = client.beta.messages.stream({
    model: "claude-opus-5",
    max_tokens: 8000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n[[refused]]"));
        }
      } catch (err) {
        let marker = "[[error]]";
        if (err instanceof Anthropic.RateLimitError) marker = "[[rate_limited]]";
        else if (err instanceof Anthropic.AuthenticationError) marker = "[[auth]]";
        else if (err instanceof Anthropic.BadRequestError) marker = "[[bad_request]]";
        controller.enqueue(encoder.encode("\n\n" + marker));
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
