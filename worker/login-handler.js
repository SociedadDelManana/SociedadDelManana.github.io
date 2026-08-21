
import * as auth from "./auth.js";

export async function handleLoginRoutes(request, env, url) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (url.pathname === "/aula/api/login" && request.method === "POST") {
    const allowed = await auth.checkRateLimit(env, ip);
    if (!allowed) {
      return json({ ok: false, error: "rate_limited" }, 429);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "bad_request" }, 400);
    }

    const { username, password } = body || {};
    if (!username || !password) {
      return json({ ok: false, error: "missing_fields" }, 400);
    }

    const validUser = await auth.verifyCredentials(env, username, password);
    if (!validUser) {
      return json({ ok: false, error: "invalid_credentials" }, 401);
    }

    await auth.clearRateLimit(env, ip);
    const token = await auth.createSession(env, validUser);

    return json(
      { ok: true, redirect: "/aula/panel" },
      200,
      { "Set-Cookie": auth.sessionCookie(token) }
    );
  }

  if (url.pathname === "/aula/api/logout" && request.method === "POST") {
    const session = await auth.getSession(env, request);
    if (session) await auth.destroySession(env, session.token);
    return json({ ok: true }, 200, { "Set-Cookie": auth.sessionCookie(null, { clear: true }) });
  }

  if (url.pathname === "/aula/api/me" && request.method === "GET") {
    const session = await auth.getSession(env, request);
    if (!session) return json({ ok: false }, 401);
    return json({ ok: true, username: session.username });
  }

  return json({ ok: false, error: "not_found" }, 404);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
