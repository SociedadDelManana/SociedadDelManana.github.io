(() => {
  "use strict";

  const API = {
    me: "/aula/api/me",
    logout: "/aula/api/logout",
    list: "/aula/api/expedientes",
    item: (id) => `/aula/api/expedientes/${id}`,
  };

  // ---------- Definición de las secciones repetibles ----------
  // Cada sección se guarda en el backend como un arreglo de objetos.
  const SECTIONS = [
    { key: "antecedentes", label: "Antecedentes", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "detalle", label: "Detalle", type: "text", wide: true },
    ]},
    { key: "alergias", label: "Alergias", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "detalle", label: "Detalle", type: "text", wide: true },
    ]},
    { key: "medicamentos", label: "Medicamentos", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "medicamento", label: "Medicamento", type: "text" },
        { name: "dosis", label: "Dosis", type: "text" },
        { name: "frecuencia", label: "Frecuencia", type: "text" },
    ]},
    { key: "signos_vitales", label: "Signos vitales", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "presion_arterial", label: "Presión arterial", type: "text" },
        { name: "temperatura", label: "Temperatura (°C)", type: "text" },
        { name: "frecuencia_cardiaca", label: "Frec. cardíaca (lpm)", type: "text" },
        { name: "frecuencia_respiratoria", label: "Frec. respiratoria (rpm)", type: "text" },
        { name: "saturacion_o2", label: "Saturación O2 (%)", type: "text" },
        { name: "peso", label: "Peso (kg)", type: "text" },
        { name: "talla", label: "Talla (cm)", type: "text" },
    ]},
    { key: "consultas", label: "Consultas", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "motivo", label: "Motivo", type: "text" },
        { name: "notas", label: "Notas", type: "textarea", wide: true },
    ]},
    { key: "diagnosticos", label: "Diagnósticos", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "diagnostico", label: "Diagnóstico", type: "text" },
        { name: "notas", label: "Notas", type: "textarea", wide: true },
    ]},
    { key: "tratamientos", label: "Tratamientos", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "tratamiento", label: "Tratamiento", type: "text" },
        { name: "notas", label: "Notas", type: "textarea", wide: true },
    ]},
    { key: "seguimientos", label: "Seguimientos", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "notas", label: "Notas", type: "textarea", wide: true },
    ]},
    { key: "actividades", label: "Actividades donde fue atendido", fields: [
        { name: "fecha", label: "Fecha", type: "date" },
        { name: "actividad", label: "Actividad", type: "text" },
        { name: "lugar", label: "Lugar", type: "text" },
    ]},
  ];

  const PERSONAL_FIELDS = [
    { name: "nombre", label: "Nombre", type: "text", required: true },
    { name: "sexo", label: "Sexo", type: "select", options: ["", "Femenino", "Masculino", "Otro"] },
    { name: "edad", label: "Edad", type: "number" },
    { name: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date" },
    { name: "dui", label: "DUI", type: "text" },
    { name: "consulta_por", label: "Consulta / consultó por", type: "text", wide: true },
  ];

  // ---------- Estado ----------
  let currentUser = null;
  let expedientes = [];       // resumen para la lista
  let activeId = null;        // id del expediente abierto
  let activeRecord = null;    // registro completo cargado
  let mode = "view";          // "view" | "edit" | "new"
  let draft = null;           // datos en edición

  // ---------- Referencias DOM ----------
  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const userChip = document.getElementById("userChip");
  const logoutBtn = document.getElementById("logoutBtn");
  const logoImg = document.getElementById("logoImg");
  const logoSlot = document.getElementById("logoSlot");
  const searchInput = document.getElementById("searchInput");
  const newBtn = document.getElementById("newBtn");
  const listScroll = document.getElementById("listScroll");
  const listEmpty = document.getElementById("listEmpty");
  const expedienteList = document.getElementById("expedienteList");
  const detailEmpty = document.getElementById("detailEmpty");
  const detailContent = document.getElementById("detailContent");
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmBody = document.getElementById("confirmBody");
  const confirmCancel = document.getElementById("confirmCancel");
  const confirmAccept = document.getElementById("confirmAccept");
  const toast = document.getElementById("toast");

  logoImg.addEventListener("error", () => logoSlot.classList.add("no-logo"), { once: true });

  // ---------- Utilidades ----------
  function showToast(message, kind) {
    toast.textContent = message;
    toast.classList.toggle("error", kind === "error");
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function emptyDraft() {
    const d = { id: null };
    for (const f of PERSONAL_FIELDS) d[f.name] = "";
    for (const s of SECTIONS) d[s.key] = [];
    return d;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (res.status === 401) {
      redirectToLogin();
      throw new Error("unauthorized");
    }
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    if (!res.ok || !data || data.ok === false) {
      const err = (data && data.error) || `http_${res.status}`;
      throw new Error(err);
    }
    return data;
  }

  function redirectToLogin() {
    window.location.href = "/aula/";
  }

  // ---------- Sesión ----------
  async function checkSession() {
    try {
      const data = await api(API.me);
      currentUser = data.username;
      userChip.textContent = currentUser;
      gate.classList.add("hidden");
      app.classList.remove("hidden");
      await loadList();
    } catch {
      redirectToLogin();
    }
  }

  logoutBtn.addEventListener("click", async () => {
    try { await api(API.logout, { method: "POST" }); } catch { /* seguimos igual */ }
    redirectToLogin();
  });

  // ---------- Lista ----------
  async function loadList() {
    try {
      const data = await api(API.list);
      expedientes = data.expedientes || [];
      renderList();
    } catch (err) {
      listEmpty.textContent = "No se pudo cargar la lista de expedientes.";
      listEmpty.classList.remove("hidden");
    }
  }

  function renderList() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = expedientes.filter((e) =>
      !q || e.nombre.toLowerCase().includes(q) || (e.dui || "").toLowerCase().includes(q)
    );

    expedienteList.innerHTML = "";
    if (filtered.length === 0) {
      listEmpty.textContent = expedientes.length === 0
        ? "Aún no hay expedientes. Crea el primero con “+ Nuevo”."
        : "Sin resultados para tu búsqueda.";
      listEmpty.classList.remove("hidden");
      return;
    }
    listEmpty.classList.add("hidden");

    for (const e of filtered) {
      const li = document.createElement("li");
      li.className = "expediente-item" + (e.id === activeId ? " active" : "");
      li.innerHTML = `
        <div class="expediente-item-name">${escapeHtml(e.nombre)}</div>
        <div class="expediente-item-meta">
          ${e.edad != null && e.edad !== "" ? `<span>${escapeHtml(e.edad)} años</span>` : ""}
          ${e.dui ? `<span>DUI ${escapeHtml(e.dui)}</span>` : ""}
        </div>`;
      li.addEventListener("click", () => openExpediente(e.id));
      expedienteList.appendChild(li);
    }
  }

  searchInput.addEventListener("input", renderList);

  newBtn.addEventListener("click", () => {
    activeId = null;
    activeRecord = null;
    mode = "new";
    draft = emptyDraft();
    renderList();
    renderDetail();
  });

  // ---------- Abrir un expediente ----------
  async function openExpediente(id) {
    activeId = id;
    mode = "view";
    renderList();
    detailEmpty.classList.add("hidden");
    detailContent.classList.remove("hidden");
    detailContent.innerHTML = `<p style="color:var(--text-low)">Cargando expediente…</p>`;
    try {
      const data = await api(API.item(id));
      activeRecord = data.expediente;
      draft = null;
      renderDetail();
    } catch {
      showToast("No se pudo cargar el expediente.", "error");
    }
  }

  // ---------- Render del detalle (enrutador de modo) ----------
  function renderDetail() {
    if (mode === "new") {
      detailEmpty.classList.add("hidden");
      detailContent.classList.remove("hidden");
      detailContent.innerHTML = renderForm(draft, true);
      wireForm(true);
      return;
    }
    if (!activeRecord) {
      detailEmpty.classList.remove("hidden");
      detailContent.classList.add("hidden");
      return;
    }
    detailEmpty.classList.add("hidden");
    detailContent.classList.remove("hidden");
    if (mode === "edit") {
      detailContent.innerHTML = renderForm(draft, false);
      wireForm(false);
    } else {
      detailContent.innerHTML = renderView(activeRecord);
      wireView();
    }
  }

  // ---------- Vista de solo lectura ----------
  function renderView(rec) {
    const personalHtml = PERSONAL_FIELDS.map((f) => `
      <div class="info-field">
        <label>${escapeHtml(f.label)}</label>
        <div class="info-value">${escapeHtml(rec[f.name]) || "—"}</div>
      </div>`).join("");

    const sectionsHtml = SECTIONS.map((s) => {
      const items = rec[s.key] || [];
      const entriesHtml = items.length
        ? items.map((item) => `
            <div class="entry-card">
              <div class="entry-card-fields">
                ${s.fields.map((f) => `
                  <div>
                    <span class="ef-label">${escapeHtml(f.label)}</span>
                    ${escapeHtml(item[f.name]) || "—"}
                  </div>`).join("")}
              </div>
            </div>`).join("")
        : `<p class="section-empty-hint">Sin registros.</p>`;

      return `
        <div class="section-block">
          <h3 class="section-block-title">${escapeHtml(s.label)} <span class="section-count">${items.length}</span></h3>
          ${entriesHtml}
        </div>`;
    }).join("");

    return `
      <div class="detail-header">
        <h1>${escapeHtml(rec.nombre)}</h1>
        <div class="detail-header-actions">
          <button type="button" class="btn-ghost" id="editBtn">Editar</button>
          <button type="button" class="btn-danger" id="deleteBtn">Eliminar</button>
        </div>
      </div>
      <p class="detail-subline">Actualizado ${new Date(rec.updated_at).toLocaleString("es-SV")}</p>
      <div class="info-grid">${personalHtml}</div>
      ${sectionsHtml}
    `;
  }

  function wireView() {
    document.getElementById("editBtn").addEventListener("click", () => {
      mode = "edit";
      draft = JSON.parse(JSON.stringify(activeRecord));
      renderDetail();
    });
    document.getElementById("deleteBtn").addEventListener("click", () => {
      openConfirm(activeRecord);
    });
  }

  // ---------- Formulario (crear / editar) ----------
  function fieldInput(f, value) {
    const val = escapeHtml(value ?? "");
    if (f.type === "select") {
      const opts = f.options.map((o) =>
        `<option value="${escapeHtml(o)}" ${o === value ? "selected" : ""}>${o || "—"}</option>`).join("");
      return `<select name="${f.name}">${opts}</select>`;
    }
    if (f.type === "textarea") {
      return `<textarea name="${f.name}">${val}</textarea>`;
    }
    return `<input type="${f.type}" name="${f.name}" value="${val}" ${f.required ? "required" : ""}>`;
  }

  function renderForm(d, isNew) {
    const personalHtml = PERSONAL_FIELDS.map((f) => `
      <div class="field" style="${f.wide ? "grid-column: 1 / -1;" : ""}">
        <label>${escapeHtml(f.label)}${f.required ? " *" : ""}</label>
        ${fieldInput(f, d[f.name])}
      </div>`).join("");

    const sectionsHtml = SECTIONS.map((s) => renderSectionEditor(s, d[s.key] || [])).join("");

    return `
      <form id="expedienteForm">
        <div class="detail-header">
          <h1>${isNew ? "Nuevo expediente" : escapeHtml(d.nombre || "Editar expediente")}</h1>
          <div class="detail-header-actions">
            <button type="button" class="btn-ghost" id="cancelBtn">Cancelar</button>
          </div>
        </div>
        <p class="detail-subline">Información personal</p>
        <div class="info-grid" id="personalGrid">${personalHtml}</div>
        <div id="sectionsWrap">${sectionsHtml}</div>
        <div class="form-actions">
          <button type="button" class="btn-ghost" id="cancelBtn2">Cancelar</button>
          <button type="submit" class="btn-primary" id="saveBtn">Guardar expediente</button>
        </div>
      </form>
    `;
  }

  function renderSectionEditor(section, items) {
    const rows = items.map((item, idx) => renderEntryRow(section, item, idx)).join("");
    return `
      <div class="section-block" data-section="${section.key}">
        <h3 class="section-block-title">${escapeHtml(section.label)} <span class="section-count">${items.length}</span></h3>
        <div class="entries-wrap">${rows}</div>
        <button type="button" class="btn-add-entry" data-add="${section.key}">+ Agregar registro</button>
      </div>`;
  }

  function renderEntryRow(section, item, idx) {
    const fieldsHtml = section.fields.map((f) => `
      <div>
        <label style="font-family:var(--font-mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text-low);display:block;margin-bottom:4px;">${escapeHtml(f.label)}</label>
        ${f.type === "textarea"
          ? `<textarea data-field="${f.name}">${escapeHtml(item[f.name])}</textarea>`
          : `<input type="${f.type}" data-field="${f.name}" value="${escapeHtml(item[f.name])}">`}
      </div>`).join("");

    return `
      <div class="entry-card" data-idx="${idx}">
        <div class="entry-card-view">
          <div class="entry-card-edit-grid" style="flex:1;">${fieldsHtml}</div>
          <button type="button" class="entry-remove-btn" data-remove="${idx}" title="Eliminar registro">✕</button>
        </div>
      </div>`;
  }

  function wireForm(isNew) {
    const form = document.getElementById("expedienteForm");

    document.getElementById("cancelBtn").addEventListener("click", cancelEdit);
    document.getElementById("cancelBtn2").addEventListener("click", cancelEdit);

    function cancelEdit() {
      if (isNew) {
        mode = "view";
        activeId = null;
        activeRecord = null;
        renderDetail();
      } else {
        mode = "view";
        renderDetail();
      }
    }

    // Botones "agregar registro" por sección
    form.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-add");
        syncDraftFromForm(form);
        draft[key].push({});
        renderDetail();
      });
    });

    // Botones "eliminar registro"
    form.querySelectorAll(".section-block").forEach((block) => {
      const key = block.getAttribute("data-section");
      block.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", () => {
          syncDraftFromForm(form);
          const idx = Number(btn.getAttribute("data-remove"));
          draft[key].splice(idx, 1);
          renderDetail();
        });
      });
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      syncDraftFromForm(form);

      if (!draft.nombre || !draft.nombre.trim()) {
        showToast("El nombre es obligatorio.", "error");
        return;
      }

      const saveBtn = document.getElementById("saveBtn");
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando…";

      try {
        if (isNew) {
          const res = await api(API.list, { method: "POST", body: JSON.stringify(draft) });
          showToast("Expediente creado.");
          await loadList();
          await openExpediente(res.id);
        } else {
          await api(API.item(activeId), { method: "PUT", body: JSON.stringify(draft) });
          showToast("Expediente actualizado.");
          await loadList();
          await openExpediente(activeId);
        }
      } catch {
        showToast("No se pudo guardar el expediente.", "error");
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar expediente";
      }
    });
  }

  // Lee los campos actualmente visibles en el DOM y los vuelca en `draft`,
  // para no perder lo que el usuario escribió al re-renderizar (agregar/quitar filas).
  function syncDraftFromForm(form) {
    for (const f of PERSONAL_FIELDS) {
      const el = form.querySelector(`#personalGrid [name="${f.name}"]`);
      if (el) draft[f.name] = el.value;
    }
    for (const s of SECTIONS) {
      const block = form.querySelector(`.section-block[data-section="${s.key}"]`);
      if (!block) continue;
      const rows = Array.from(block.querySelectorAll(".entry-card"));
      draft[s.key] = rows.map((row) => {
        const item = {};
        row.querySelectorAll("[data-field]").forEach((input) => {
          item[input.getAttribute("data-field")] = input.value;
        });
        return item;
      });
    }
  }

  // ---------- Confirmación de borrado ----------
  let pendingDelete = null;

  function openConfirm(rec) {
    pendingDelete = rec;
    confirmBody.textContent = `¿Eliminar el expediente de ${rec.nombre}? Esta acción no se puede deshacer.`;
    confirmDialog.classList.remove("hidden");
  }

  confirmCancel.addEventListener("click", () => {
    pendingDelete = null;
    confirmDialog.classList.add("hidden");
  });

  confirmAccept.addEventListener("click", async () => {
    if (!pendingDelete) return;
    const rec = pendingDelete;
    confirmDialog.classList.add("hidden");
    try {
      await api(API.item(rec.id), { method: "DELETE" });
      showToast("Expediente eliminado.");
      if (activeId === rec.id) {
        activeId = null;
        activeRecord = null;
        mode = "view";
        renderDetail();
      }
      await loadList();
    } catch {
      showToast("No se pudo eliminar el expediente.", "error");
    }
    pendingDelete = null;
  });

  // ---------- Arranque ----------
  checkSession();
})();
