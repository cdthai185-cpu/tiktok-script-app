// Catch-all proxy: mọi request /api/* được forward sang BACKEND_URL.
// Chạy server-side trong Next.js → process.env.BACKEND_URL runtime guaranteed.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://tiktok-cdt-backend.onrender.com"
    : "http://127.0.0.1:8001");

async function proxy(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const target = `${BACKEND_URL}/${path.join("/")}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    if (k === "host" || k === "connection") return;
    headers.set(k, v);
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : await req.arrayBuffer(),
    redirect: "manual",
  };

  try {
    const res = await fetch(target, init);
    const respHeaders = new Headers(res.headers);
    respHeaders.delete("content-encoding");
    respHeaders.delete("transfer-encoding");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: respHeaders,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ detail: `Proxy failed: ${(e as Error).message}`, target }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
