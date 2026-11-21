// Auditoría externa de un dominio: DNS y RDAP sobre registros públicos.
//
// Runtime Node, no Edge: la verificación de firma usa node:crypto y el
// adaptador WHOIS previsto para «.mx» necesitaría sockets TCP.
//
// AUTENTICACIÓN
//   El token de Firebase App Check se verifica **de verdad**: firma RS256
//   contra el JWKS público de App Check, emisor, audiencia, tipo y caducidad.
//   Véase `lib/security/app-check.ts`. No requiere cuenta de servicio.
//
//   El mismo origen NO es la autenticación. Se comprueba además, como capa
//   anti-CSRF, pero un token de App Check inválido se rechaza venga de donde
//   venga, y un token válido es lo único que concede acceso.
//
// LÍMITES Y PRIVACIDAD
//   Límite de solicitudes por cliente. No se registra la dirección IP ni el
//   dominio consultado: el limitador usa un resumen SHA-256 irreversible y
//   truncado de la IP, con sal de proceso, solo en memoria y por un minuto.
//
// PENDIENTE DOCUMENTADO
//   Protección contra reenvío (tokens de un solo uso). Es una función beta que
//   solo existe en los Admin SDK y exige credenciales administradas. No se
//   simula: un token válido y no caducado puede reutilizarse dentro de su
//   vigencia, y el límite de solicitudes es lo único que acota ese abuso.

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { runExternalAudit, EXTERNAL_AUDITS_ENABLED } from "@/lib/external";
import { verifyAppCheckToken } from "@/lib/security/app-check";
import { readLimitedBody } from "@/lib/security/limited-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024;

/** Sal de proceso: hace que el resumen de la IP no sea reversible ni estable. */
const SALT = createHash("sha256").update(String(process.hrtime.bigint())).digest("hex");

function rateKeyFor(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "local";
  return createHash("sha256").update(`${SALT}:${ip}`).digest("hex").slice(0, 16);
}

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function deny(status: number, message: string) {
  return respond({ error: message }, status);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  // `url.origin` viene de `request.url`, que Next.js puede normalizar a un
  // host interno («localhost») distinto del `Host` real que mandó el
  // cliente (por ejemplo, al servir en 127.0.0.1 o detrás de un proxy). Usar
  // esa normalización rechazaría como CSRF peticiones legítimas del mismo
  // origen; el origen esperado se deriva del encabezado `Host` que el
  // cliente realmente envió.
  const hostHeader = request.headers.get("host");
  const expectedOrigin = hostHeader ? `${url.protocol}//${hostHeader}` : url.origin;

  // Capa anti-CSRF, no autenticación. Se comprueba primero porque es barata.
  if (
    request.headers.get("sec-fetch-site") !== "same-origin" ||
    request.headers.get("origin") !== expectedOrigin
  ) {
    return deny(403, "Petición rechazada: debe originarse en la misma aplicación.");
  }

  // Autenticación real: firma, emisor, audiencia y caducidad del token.
  const verification = await verifyAppCheckToken(request.headers.get("x-firebase-appcheck"));
  if (!verification.ok) {
    // 503 cuando el fallo es del servidor (configuración o claves públicas
    // inalcanzables); 401 cuando el problema es la credencial recibida.
    const serverSide = verification.code === "configuracion" || verification.code === "jwks";
    return deny(serverSide ? 503 : 401, verification.reason);
  }

  const raw = await readLimitedBody(request, MAX_BODY_BYTES);
  if (raw === null) return deny(413, "La petición excede el tamaño admitido.");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return deny(400, "Cuerpo no válido: se esperaba JSON.");
  }
  const host = (payload as { host?: unknown } | null)?.host;
  if (typeof host !== "string" || !host.trim()) {
    return deny(400, "Falta el campo «host».");
  }

  // `runExternalAudit` valida el host, respeta el interruptor
  // XIBALBA_EXTERNAL_AUDITS y nunca lanza: los fallos vuelven como evidencia
  // de clase C (pendiente) o D (error).
  const audit = await runExternalAudit(host, { rateKey: rateKeyFor(request) });

  return respond({
    enabled: EXTERNAL_AUDITS_ENABLED,
    indicators: audit.indicators,
    resolved: audit.resolved,
    dns: audit.dns
      ? { status: audit.dns.status, source: audit.dns.source, reason: audit.dns.reason ?? null }
      : null,
    registration: audit.registration
      ? {
          status: audit.registration.status,
          source: audit.registration.source,
          reason: audit.registration.reason ?? null,
        }
      : null,
  });
}
