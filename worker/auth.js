

const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas
const MAX_ATTEMPTS_PER_WINDOW = 8;
const ATTEMPT_WINDOW_SECONDS = 10 * 60; // 10 minutos

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Compara dos arrays de bytes en tiempo constante. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derivePbkdf2(password, saltBytes, iterations, lengthBits = 256) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    lengthBits
  );
  return new Uint8Array(derived);
}

/**
 * Verifica usuario + contraseña contra el registro guardado en KV.
 * Devuelve el nombre de usuario normalizado si es válido, o null.
 */
export async function verifyCredentials(env, username, password) {
  const key = "user:" + username.trim().toLowerCase();
  const raw = await env.USERS.get(key);
  if (!raw) return null;

  let record;
  try { record = JSON.parse(raw); } catch { return null; }

  const salt = b64ToBytes(record.salt);
  const expectedHash = b64ToBytes(record.hash);
  const derived = await derivePbkdf2(password, salt, record.iterations, expectedHash.length * 8);

  return timingSafeEqual(derived, expectedHash) ? key.replace(/^user:/, "") : null;
}

/** Limita intentos de login por IP. Devuelve true si se permite continuar. */
export async function checkRateLimit(env, ip) {
  const key = "tries:" + ip;
  const raw = await env.LOGIN_TRIES.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= MAX_ATTEMPTS_PER_WINDOW) return false;
  await env.LOGIN_TRIES.put(key, String(count + 1), { expirationTtl: ATTEMPT_WINDOW_SECONDS });
  return true;
}

export async function clearRateLimit(env, ip) {
  await env.LOGIN_TRIES.delete("tries:" + ip);
}

/** Crea una sesión y devuelve el token opaco (para poner en la cookie). */
export async function createSession(env, username) {
  const token = randomToken(32);
  const now = Date.now();
  const record = {
    username,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
  await env.SESSIONS.put("session:" + token, JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

/** Valida una cookie de sesión entrante. Devuelve { username } o null. */
export async function getSession(env, request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)mdm_session=([^;]+)/);
  if (!match) return null;
  const raw = await env.SESSIONS.get("session:" + match[1]);
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (record.expiresAt < Date.now()) return null;
  return { username: record.username, token: match[1] };
}

export async function destroySession(env, token) {
  if (token) await env.SESSIONS.delete("session:" + token);
}

export function sessionCookie(token, { clear = false } = {}) {
  const maxAge = clear ? 0 : SESSION_TTL_SECONDS;
  const value = clear ? "deleted" : token;
  return [
    `mdm_session=${value}`,
    "Path=/aula",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ].join("; ");
}
