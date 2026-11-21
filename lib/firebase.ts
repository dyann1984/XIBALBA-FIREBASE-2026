import { getApp, getApps, initializeApp } from "firebase/app";
import { CustomProvider, getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { getFirestore } from "firebase/firestore";

// Variables de entorno pegadas en paneles como Vercel a veces arrastran un
// BOM (U+FEFF) u otros espacios invisibles al inicio/final del valor. Firebase
// construye nombres de recurso como "projects/<id>/apps/<id>" con estos
// valores tal cual; un BOM en medio de esa cadena produce un 400
// "Invalid resource name" en App Check que parece un problema de consola
// cuando en realidad es un valor sucio. Se normaliza aquí, en el único lugar
// donde se leen, para que no importa cómo se cargó la variable.
function clean(value: string | undefined): string | undefined {
  return value?.replace(/[﻿​-‍⁠]/g, "").trim() || undefined;
}
const config = {
  apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};
const siteKey = clean(process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY);
function localDebugEnabled() {
  return process.env.NODE_ENV === "development" && typeof window !== "undefined" &&
    window.location.hostname === "localhost" && process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG === "true";
}
let localDebugReady = false;
export function isConfigured() { return Object.values(config).every(Boolean) && (localDebugEnabled() ? localDebugReady : Boolean(siteKey)); }
let services: ReturnType<typeof createServices> | undefined;
function createServices() {
  const debug = localDebugEnabled();
  if (!isConfigured()) throw new Error("Falta configurar Firebase y App Check.");
  const app = getApps().length ? getApp() : initializeApp(config);
  // The SDK replaces this provider with its debug exchange when debug mode is active.
  // If that ever fails, do not issue an unverified token.
  const provider = debug ? new CustomProvider({ getToken: async () => { throw new Error("App Check debug no está activo."); } }) : new ReCaptchaEnterpriseProvider(siteKey!);
  const appCheck = initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, inCloudParams: { model: "gemini-3.5-flash-lite" } });
  return { model, firestore: getFirestore(app), appCheck };
}
export function getServices() { return services ??= createServices(); }
let debugPreparation: Promise<void> | undefined;
async function prepareLocalDebug(): Promise<void> {
  if (!localDebugEnabled() || localDebugReady) return;
  debugPreparation ??= (async () => {
    const response = await fetch('/api/app-check-debug', { method: 'POST', cache: 'no-store', headers: { 'X-Xibalba-Local-Debug': '1' } });
    if (!response.ok) throw new Error('Falta configurar el token privado de depuración local.');
    const data: { token?: unknown } = await response.json();
    if (typeof data.token !== 'string' || !data.token) throw new Error('Falta configurar el token privado de depuración local.');
    (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = data.token;
    localDebugReady = true;
  })().catch(error => { debugPreparation = undefined; throw error; });
  return debugPreparation;
}
export async function diagnoseLocalAppCheck(): Promise<string> {
  if (!localDebugEnabled()) return "Diagnóstico disponible únicamente en localhost y modo debug de desarrollo.";
  try {
    await prepareLocalDebug();
    await getToken(getServices().appCheck, true);
    return "App Check entregó un token válido al SDK. El intercambio terminó correctamente.";
  } catch (error) {
    const e = error as { code?: string; customData?: { httpStatus?: number | string } };
    const status = Number(e?.customData?.httpStatus);
    if (e?.code === "appCheck/fetch-status-error" && status === 403)
      return "App Check rechazó el intercambio (HTTP 403). El SDK no indica si el token no está autorizado u otra política rechazó la solicitud; consulta la respuesta en Red.";
    if (e?.code === "appCheck/throttled") return "App Check limitó temporalmente los intentos. Espera antes de reintentar.";
    if (e?.code === "appCheck/fetch-network-error") return "No se pudo conectar con App Check. Comprueba la red.";
    return "No se obtuvo un token de App Check. Comprueba la configuración local y la conexión.";
  }
}
export async function initializeLocalDebug() { if (localDebugEnabled()) { await prepareLocalDebug(); if (isConfigured()) getServices(); } }

export type StageStatus = "ok" | "fallo" | "no-aplica" | "pendiente";

/** Diagnóstico granular: cada etapa se comprueba por separado, nunca se
 * infiere una de otra. "SDK disponible" no implica "servicio configurado";
 * "autenticación exitosa" no implica "respuesta real obtenida". */
export type FirebaseDiagnostics = {
  sdkAvailable: StageStatus;
  serviceConfigured: StageStatus;
  authSuccessful: StageStatus;
  realCallExecuted: StageStatus;
  realResponseObtained: StageStatus;
  persistenceConfirmed: StageStatus;
  detail: {
    sdkAvailable?: string;
    serviceConfigured?: string;
    authSuccessful?: string;
    realCallExecuted?: string;
    realResponseObtained?: string;
    persistenceConfirmed?: string;
  };
};

/** `includeModelCall`: la llamada real a Gemini envía `sampleText`, así que
 * se deja fuera por defecto — quien la pida debe aceptarlo explícitamente,
 * igual que el consentimiento de IA del resto de la aplicación. */
export async function diagnoseFirebaseStack(
  sampleText?: string,
): Promise<FirebaseDiagnostics> {
  const detail: FirebaseDiagnostics["detail"] = {};
  const result: FirebaseDiagnostics = {
    sdkAvailable: "ok",
    serviceConfigured: "pendiente",
    authSuccessful: "pendiente",
    realCallExecuted: "pendiente",
    realResponseObtained: "pendiente",
    persistenceConfirmed: "no-aplica",
    detail,
  };
  detail.sdkAvailable = "El paquete firebase se importó y ejecutó sin lanzar un error de carga.";

  // En localhost con modo debug, "configurado" depende de haber obtenido ya
  // el token de depuración — por eso se prepara ANTES de preguntar, no
  // después. Preguntar primero reportaría "fallo" en la primera visita de
  // cada pestaña, aunque la configuración sea correcta.
  try {
    await initializeLocalDebug();
  } catch {
    /* Si falla, isConfigured() lo refleja igual más abajo. */
  }

  if (!isConfigured()) {
    result.serviceConfigured = "fallo";
    detail.serviceConfigured = "Faltan variables NEXT_PUBLIC_FIREBASE_* o la clave de App Check.";
    result.authSuccessful = "pendiente";
    result.realCallExecuted = "pendiente";
    result.realResponseObtained = "pendiente";
    detail.persistenceConfirmed =
      "No aplica: ningún código del proyecto lee ni escribe en Firestore todavía (las reglas deniegan todo acceso a propósito).";
    return result;
  }
  result.serviceConfigured = "ok";
  detail.serviceConfigured = "initializeApp() y la configuración de App Check se completaron.";

  try {
    await initializeLocalDebug();
    await getToken(getServices().appCheck, true);
    result.authSuccessful = "ok";
    detail.authSuccessful = "App Check entregó un token real al SDK (debug local o reCAPTCHA Enterprise, según el entorno).";
  } catch (error) {
    result.authSuccessful = "fallo";
    detail.authSuccessful = error instanceof Error ? error.message : "No se obtuvo un token de App Check.";
    result.realCallExecuted = "pendiente";
    result.realResponseObtained = "pendiente";
    detail.persistenceConfirmed =
      "No aplica: ningún código del proyecto lee ni escribe en Firestore todavía (las reglas deniegan todo acceso a propósito).";
    return result;
  }

  if (!sampleText) {
    detail.realCallExecuted = "No se pidió una llamada real a Gemini (se necesita el contenido de prueba explícito).";
    detail.persistenceConfirmed =
      "No aplica: ningún código del proyecto lee ni escribe en Firestore todavía (las reglas deniegan todo acceso a propósito).";
    return result;
  }

  try {
    const { model } = getServices();
    const response = await model.generateContent(sampleText);
    result.realCallExecuted = "ok";
    detail.realCallExecuted = `generateContent() se ejecutó. Ruta de inferencia: ${response.response.inferenceSource ?? "no informada por el SDK"}.`;
    const text = response.response.text();
    if (text && text.trim()) {
      result.realResponseObtained = "ok";
      detail.realResponseObtained = `Respuesta real recibida (${text.length} caracteres).`;
    } else {
      result.realResponseObtained = "fallo";
      detail.realResponseObtained = "La llamada se ejecutó pero el modelo devolvió una respuesta vacía.";
    }
  } catch (error) {
    result.realCallExecuted = "fallo";
    detail.realCallExecuted = error instanceof Error ? error.message : "La llamada a Gemini falló.";
    result.realResponseObtained = "pendiente";
  }

  detail.persistenceConfirmed =
    "No aplica: ningún código del proyecto lee ni escribe en Firestore todavía (las reglas deniegan todo acceso a propósito). getFirestore() se inicializa, pero no se usa.";
  return result;
}
export async function localAvailability(): Promise<string> {
  const api = (globalThis as typeof globalThis & { LanguageModel?: { availability: () => Promise<string> } }).LanguageModel;
  // Devuelve una clave, no una frase: la interfaz la traduce al idioma
  // elegido. Los valores propios del navegador (`available`, `downloadable`,
  // `downloading`, `unavailable`) se dejan pasar tal cual y también tienen
  // traducción; cualquier otro se muestra como desconocido.
  if (!api) return "unsupported";
  try { return (await api.availability()) || "unknown"; } catch { return "error"; }
}
