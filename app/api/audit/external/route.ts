// Auditoría externa de un dominio: DNS y RDAP sobre registros públicos.
//
// Runtime Node, no Edge: el adaptador WHOIS previsto para «.mx» necesita
// sockets TCP, que Edge no ofrece.
//
// LO QUE ESTA RUTA SÍ COMPRUEBA
//   · Que la petición venga del propio origen (sec-fetch-site + origin), lo
//     que cierra el uso cruzado desde otro sitio.
//   · Que traiga una cabecera de App Check con forma de JWT.
//   · Un límite de solicitudes por minuto, global y por cliente.
//   · Que el host recibido sea un dominio válido y enrutable.
//
// LO QUE NO COMPRUEBA, Y CONVIENE SABERLO
//   La firma del token de App Check NO se verifica criptográficamente. Hacerlo
//   exige `firebase-admin` y una clave de cuenta de servicio, es decir, una
//   credencial nueva que no está autorizada en este proyecto. Mientras eso no
//   exista, la cabecera solo demuestra que el cliente la envió, no que sea
//   legítima: la protección real de esta ruta es el mismo origen y el límite
//   de solicitudes. Está documentado en docs/plan-dns-rdap.md y no debe
//   presentarse como App Check aplicado en el servidor.
//
// PRIVACIDAD
//   No se registra la dirección IP ni el host consultado. El limitador usa un
//   resumen irreversible y truncado de la IP, solo en memoria y por un minuto.

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { runExternalAudit } from "@/lib/external";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024;
const JWT_SHAPE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

/** Sal de proceso: hace que el resumen no sea reversible entre reinicios. */
const SALT = createHash("sha256").update(String(process.hrtime.bigint())).digest("hex");

function rateKeyFor(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "local";
  return createHash("sha256").update(`${SALT}:${ip}`).digest("hex").slice(0, 16);
}

function deny(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}

export async function POST(request: Request) {
  const url = new URL(request.url);

  // Mismo origen. Sin esto, cualquier página podría usar esta ruta como proxy.
  if (
    request.headers.get("sec-fetch-site") !== "same-origin" ||
    request.headers.get("origin") !== url.origin
  ) {
    return deny(403, "Petición rechazada: debe originarse en la misma aplicación.");
  }

  const appCheck =
    request.headers.get("x-firebase-appcheck") ?? request.headers.get("X-Firebase-AppCheck");
  if (!appCheck || !JWT_SHAPE.test(appCheck)) {
    return deny(401, "Falta la credencial de App Check o no tiene el formato esperado.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return deny(413, "La petición excede el tamaño admitido.");

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

  return NextResponse.json(
    {
      indicators: audit.indicators,
      resolved: audit.resolved,
      dns: audit.dns ? { status: audit.dns.status, source: audit.dns.source, reason: audit.dns.reason ?? null } : null,
      registration: audit.registration
        ? {
            status: audit.registration.status,
            source: audit.registration.source,
            reason: audit.registration.reason ?? null,
          }
        : null,
    },
    {
      headers: {
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
