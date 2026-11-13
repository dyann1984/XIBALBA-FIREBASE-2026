"use client";
import { useState } from "react";
import { diagnoseLocalAppCheck } from "@/lib/firebase";

export default function DiagnosticPage() {
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  if (process.env.NODE_ENV !== "development") return null;
  async function check() {
    setBusy(true);
    try { setResult(await diagnoseLocalAppCheck()); } finally { setBusy(false); }
  }
  return <main style={{ padding: "2rem", maxWidth: "48rem" }}>
    <h1>Diagnóstico local de App Check</h1>
    <p>Comprueba el intercambio del token de esta sesión sin mostrarlo ni enviar contenido a Gemini.</p>
    <button onClick={check} disabled={busy}>{busy ? "Comprobando…" : "Comprobar App Check"}</button>
    <p role="status">{result}</p>
  </main>;
}
