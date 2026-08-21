import { handleLoginRoutes } from "../worker/login-handler.js";
import { handleExpedientesRoutes } from "../worker/expedientes.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Rutas de expedientes (necesitan D1 configurado — ver EXPEDIENTES.md)
    if (url.pathname.startsWith("/aula/api/expedientes")) {
      return handleExpedientesRoutes(request, env, url);
    }

    // Rutas de login / sesión (necesitan los KV namespaces — ver README.md)
    if (url.pathname.startsWith("/aula/api/")) {
      return handleLoginRoutes(request, env, url);
    }

    // Todo lo demás (index.html, login.css, panel/, imágenes, etc.)
    // lo sirve automáticamente Cloudflare desde la carpeta ./public
    return env.ASSETS.fetch(request);
  },
};
