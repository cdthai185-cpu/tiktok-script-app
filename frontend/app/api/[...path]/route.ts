// Catch-all proxy: mọi request /api/* → BACKEND_URL.
// Server-side, process.env.BACKEND_URL runtime guaranteed.

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://tiktok-cdt-backend.onrender.com"
    : "http://127.0.0.1:8001");

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { path } = await ctx.params;
    const url = new URL(req.url);
    const target = `${BACKEND_URL}/${path.join("/")}${url.search}`;

    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      const kl = k.toLowerCase();
      if (kl === "host" || kl === "connection" || kl === "content-length") return;
      headers[k] = v;
    });

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const body = hasBody ? await req.arrayBuffer() : undefined;

    const res = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    const respText = await res.text();
    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      const kl = k.toLowerCase();
      if (kl === "content-encoding" || kl === "transfer-encoding" || kl === "content-length") return;
      respHeaders[k] = v;
    });
    if (!respHeaders["content-type"]) respHeaders["content-type"] = "application/json";

    return new Response(respText, {
      status: res.status,
      statusText: res.statusText,
      headers: respHeaders,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[api proxy] error:", msg, "BACKEND_URL=", BACKEND_URL);
    return new Response(
      JSON.stringify({ detail: `Proxy error: ${msg}`, backend: BACKEND_URL }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}

export async function GET(req: Request, ctx: Ctx) {
  return handle(req, ctx);
}
export async function POST(req: Request, ctx: Ctx) {
  return handle(req, ctx);
}
export async function PUT(req: Request, ctx: Ctx) {
  return handle(req, ctx);
}
export async function PATCH(req: Request, ctx: Ctx) {
  return handle(req, ctx);
}
export async function DELETE(req: Request, ctx: Ctx) {
  return handle(req, ctx);
}
