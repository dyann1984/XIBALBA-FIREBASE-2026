"use client";
import { useState } from "react";
import { diagnoseFirebaseStack, type FirebaseDiagnostics } from "@/lib/firebase";

const STAGE_LABEL: Record<keyof FirebaseDiagnostics["detail"], string> = {
  sdkAvailable: "1. SDK disponible",
  serviceConfigured: "2. Servicio configurado",
  authSuccessful: "3. Autenticación exitosa (App Check)",
  realCallExecuted: "4. Llamada real ejecutada (Gemini)",
  realResponseObtained: "5. Respuesta real obtenida",
  cloudCallVerified: "6. Llamada forzada a la nube (ONLY_IN_CLOUD)",
  persistenceConfirmed: "7. Persistencia confirmada (Firestore)",
};
const STAGE_ICON: Record<string, string> = { ok: "✔", fallo: "✖", "no-aplica": "—", pendiente: "…" };

export default function DiagnosticClient() {
  const [result, setResult] = useState<FirebaseDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(withRealCall: boolean) {
    setBusy(true);
    try {
      setResult(
        await diagnoseFirebaseStack(
          withRealCall ? "Responde únicamente con la palabra OK." : undefined,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "48rem" }}>
      <h1>Diagnóstico real de Firebase / Gemini</h1>
      <p>
        Comprueba por separado cada etapa: ninguna se infiere de otra. La
        llamada real a Gemini es opcional y envía un texto de prueba fijo, no
        contenido de la persona.
      </p>
      <button onClick={() => check(false)} disabled={busy} style={{ marginRight: 8 }}>
        {busy ? "Comprobando…" : "Comprobar sin llamar a Gemini"}
      </button>
      <button onClick={() => check(true)} disabled={busy}>
        {busy ? "Comprobando…" : "Comprobar con una llamada real a Gemini"}
      </button>
      {result && (
        <dl style={{ marginTop: "1.5rem" }}>
          {(Object.keys(STAGE_LABEL) as (keyof FirebaseDiagnostics["detail"])[]).map((key) => (
            <div key={key} style={{ marginBottom: "1rem" }}>
              <dt style={{ fontWeight: 600 }}>
                {STAGE_ICON[result[key]]} {STAGE_LABEL[key]} — {result[key]}
              </dt>
              <dd style={{ margin: 0, opacity: 0.8 }}>{result.detail[key]}</dd>
            </div>
          ))}
        </dl>
      )}
    </main>
  );
}
