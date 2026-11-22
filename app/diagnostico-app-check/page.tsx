import DiagnosticClient from "./DiagnosticClient";

/**
 * Habilitado en local (NODE_ENV=development) y en cualquier despliegue de
 * Vercel que NO sea producción (`VERCEL_ENV` es "preview" o "development").
 * `VERCEL_ENV` lo inyecta Vercel automáticamente en cada entorno sin
 * configuración manual, así que esta página queda disponible en toda vista
 * previa (necesaria para diagnosticar App Check/Gemini ahí, ver
 * `docs/app-check-diagnostico-sesion-finalizacion.md`) y sigue bloqueada en
 * producción real.
 */
function diagnosticsAllowed(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const vercelEnv = process.env.VERCEL_ENV;
  return typeof vercelEnv === "string" && vercelEnv !== "production";
}

export default function DiagnosticPage() {
  if (!diagnosticsAllowed()) return null;
  return <DiagnosticClient />;
}
