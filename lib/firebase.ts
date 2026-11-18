import { getApp, getApps, initializeApp } from "firebase/app";
import { CustomProvider, getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
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
export async function localAvailability(): Promise<string> {
  const api = (globalThis as typeof globalThis & { LanguageModel?: { availability: () => Promise<string> } }).LanguageModel;
  // Devuelve una clave, no una frase: la interfaz la traduce al idioma
  // elegido. Los valores propios del navegador (`available`, `downloadable`,
  // `downloading`, `unavailable`) se dejan pasar tal cual y también tienen
  // traducción; cualquier otro se muestra como desconocido.
  if (!api) return "unsupported";
  try { return (await api.availability()) || "unknown"; } catch { return "error"; }
}
