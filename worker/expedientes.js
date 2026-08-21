import * as auth from "./auth.js";

// Secciones repetibles del expediente. Cada una se guarda como un arreglo
// JSON de entradas dentro de su columna en D1.
export const LIST_FIELDS = [
  "antecedentes",
  "alergias",
  "medicamentos",
  "signos_vitales",
  "consultas",
  "diagnosticos",
  "tratamientos",
  "seguimientos",
  "actividades",
];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function normalizeListField(value) {
  if (!Array.isArray(value)) return [];
  // Cada entrada debe ser un objeto plano; se descarta cualquier otra cosa.
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function rowToExpediente(row) {
  const out = { ...row };
  for (const field of LIST_FIELDS) {
    try {
      out[field] = JSON.parse(row[field] || "[]");
    } catch {
      out[field] = [];
    }
  }
  return out;
}

function sanitizeText(value, max = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function handleExpedientesRoutes(request, env, url) {
  // Toda esta ruta exige una sesión válida (cookie mdm_session httpOnly).
  const session = await auth.getSession(env, request);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);

  const parts = url.pathname.split("/").filter(Boolean); // ["aula","api","expedientes", ":id"?]
  const id = parts[3] || null;

  // ---------- LISTAR ----------
  if (!id && request.method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT id, nombre, sexo, edad, fecha_nacimiento, dui, consulta_por, updated_at
       FROM expedientes ORDER BY updated_at DESC`
    ).all();
    return json({ ok: true, expedientes: results });
  }

  // ---------- CREAR ----------
  if (!id && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "bad_request" }, 400);
    }

    const nombre = sanitizeText(body.nombre, 200);
    if (!nombre) return json({ ok: false, error: "missing_nombre" }, 400);

    const now = Date.now();
    const record = {
      id: crypto.randomUUID(),
      nombre,
      sexo: sanitizeText(body.sexo, 30),
      edad: Number.isFinite(Number(body.edad)) ? Number(body.edad) : null,
      fecha_nacimiento: sanitizeText(body.fecha_nacimiento, 20),
      dui: sanitizeText(body.dui, 20),
      consulta_por: sanitizeText(body.consulta_por, 500),
      created_by: session.username,
      created_at: now,
      updated_at: now,
    };

    const lists = {};
    for (const field of LIST_FIELDS) lists[field] = JSON.stringify(normalizeListField(body[field]));

    await env.DB.prepare(
      `INSERT INTO expedientes
        (id, nombre, sexo, edad, fecha_nacimiento, dui, consulta_por,
         antecedentes, alergias, medicamentos, signos_vitales, consultas,
         diagnosticos, tratamientos, seguimientos, actividades,
         created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        record.id,
        record.nombre,
        record.sexo,
        record.edad,
        record.fecha_nacimiento,
        record.dui,
        record.consulta_por,
        lists.antecedentes,
        lists.alergias,
        lists.medicamentos,
        lists.signos_vitales,
        lists.consultas,
        lists.diagnosticos,
        lists.tratamientos,
        lists.seguimientos,
        lists.actividades,
        record.created_by,
        record.created_at,
        record.updated_at
      )
      .run();

    return json({ ok: true, id: record.id });
  }

  // ---------- OBTENER UNO ----------
  if (id && request.method === "GET") {
    const row = await env.DB.prepare("SELECT * FROM expedientes WHERE id = ?").bind(id).first();
    if (!row) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, expediente: rowToExpediente(row) });
  }

  // ---------- ACTUALIZAR ----------
  if (id && request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "bad_request" }, 400);
    }

    const existing = await env.DB.prepare("SELECT id FROM expedientes WHERE id = ?").bind(id).first();
    if (!existing) return json({ ok: false, error: "not_found" }, 404);

    const nombre = sanitizeText(body.nombre, 200);
    if (!nombre) return json({ ok: false, error: "missing_nombre" }, 400);

    const lists = {};
    for (const field of LIST_FIELDS) lists[field] = JSON.stringify(normalizeListField(body[field]));

    await env.DB.prepare(
      `UPDATE expedientes SET
         nombre=?, sexo=?, edad=?, fecha_nacimiento=?, dui=?, consulta_por=?,
         antecedentes=?, alergias=?, medicamentos=?, signos_vitales=?, consultas=?,
         diagnosticos=?, tratamientos=?, seguimientos=?, actividades=?, updated_at=?
       WHERE id=?`
    )
      .bind(
        nombre,
        sanitizeText(body.sexo, 30),
        Number.isFinite(Number(body.edad)) ? Number(body.edad) : null,
        sanitizeText(body.fecha_nacimiento, 20),
        sanitizeText(body.dui, 20),
        sanitizeText(body.consulta_por, 500),
        lists.antecedentes,
        lists.alergias,
        lists.medicamentos,
        lists.signos_vitales,
        lists.consultas,
        lists.diagnosticos,
        lists.tratamientos,
        lists.seguimientos,
        lists.actividades,
        Date.now(),
        id
      )
      .run();

    return json({ ok: true });
  }

  // ---------- BORRAR ----------
  if (id && request.method === "DELETE") {
    const existing = await env.DB.prepare("SELECT id FROM expedientes WHERE id = ?").bind(id).first();
    if (!existing) return json({ ok: false, error: "not_found" }, 404);
    await env.DB.prepare("DELETE FROM expedientes WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return json({ ok: false, error: "not_found" }, 404);
}
