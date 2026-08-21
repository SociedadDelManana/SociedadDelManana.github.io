(() => {
  "use strict";

  // Endpoint real de autenticación. Lo implementa el Worker (ver /worker/auth.js).
  // Aquí NUNCA se guardan usuarios ni contraseñas: solo se llama al backend.
  const LOGIN_ENDPOINT = "/aula/api/login";

  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const statusMsg = document.getElementById("statusMsg");
  const submitBtn = document.getElementById("submitBtn");
  const toggleBtn = document.getElementById("toggleVisibility");
  const logoImg = document.getElementById("logoImg");
  const logoSlot = document.getElementById("logoSlot");
  const bg = document.getElementById("bg");

  // Si aún no han puesto el logo en assets/logo.png, se muestra un
  // placeholder circular con las iniciales en vez de un ícono roto.
  logoImg.addEventListener("error", () => {
    logoSlot.classList.add("no-logo");
  }, { once: true });

  // Igual para el fondo: si assets/fondo.jpg no existe, se mantiene el
  // degradado clínico definido en login.css (no rompe el diseño).
  (() => {
    const probe = new Image();
    probe.onerror = () => {
      bg.style.backgroundImage = "";
    };
    probe.src = "assets/fondo.jpg";
  })();

  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.setAttribute("aria-pressed", String(isPassword));
    toggleBtn.setAttribute("aria-label", isPassword ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  function setStatus(message, kind) {
    statusMsg.textContent = message || "";
    statusMsg.classList.toggle("ok", kind === "ok");
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      setStatus("Completa usuario y contraseña.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // permite que el backend fije la cookie de sesión httpOnly
        body: JSON.stringify({ username, password }),
      });

      let data = null;
      try { data = await response.json(); } catch (_) { /* respuesta vacía */ }

      if (response.ok && data && data.ok) {
        setStatus("Acceso verificado. Redirigiendo…", "ok");
        window.location.href = data.redirect || "/aula/panel";
        return;
      }

      if (response.status === 401) {
        setStatus("Usuario o contraseña incorrectos.");
      } else if (response.status === 429) {
        setStatus("Demasiados intentos. Espera un momento antes de volver a intentar.");
      } else {
        setStatus("No se pudo iniciar sesión. Intenta de nuevo en unos minutos.");
      }
    } catch (err) {
      setStatus("Sin conexión con el servidor. Verifica tu red e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  });
})();
