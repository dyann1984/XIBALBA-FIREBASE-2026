"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { analyze, analyzeLocally, describeAgents, modelTranscriber, modelImageText, type AnalysisResult } from "@/lib/analysis/analyze";
import { errorKey } from "@/lib/analysis/errors";
import { type AgentKind } from "@/lib/analysis/guardian";
import { AGENT_NAMES, type AgentEvent } from "@/lib/analysis/coordinator";
import { recognizeImageText, type PreparedImage, type OcrResult } from "@/lib/analysis/images";
import { TRANSCRIPTION_PENDING, releaseAudio, transcribeAudio, type PreparedAudio, type Transcription } from "@/lib/analysis/audio";
import Guardian from "@/components/Guardian";
import AgentOperationsBoard from "@/components/AgentOperationsBoard";
import InvestigationMap from "@/components/InvestigationMap";
import GlobalShield from "@/components/GlobalShield";
import HelpButton from "@/components/HelpButton";
import RiskVerdict from "@/components/RiskVerdict";
import EvidenceList from "@/components/EvidenceList";
import ImageAttachments from "@/components/ImageAttachments";
import AudioAttachment from "@/components/AudioAttachment";
import { useI18n } from "@/components/LanguageProvider";
import { LANG_LABEL, LANG_TAG, type Lang } from "@/lib/i18n";
import { Activity, ArrowDownLeft, ArrowRight, AudioLines, BookOpen, ChevronDown, CircleHelp, Clock3, Download, Eye, Fingerprint, FlaskConical, Globe2, LayoutDashboard, Link2, LockKeyhole, Menu, MessageSquareText, Network, ScanLine, Shield, ShieldAlert, ShieldCheck, Sparkles, Trash2, WalletCards, X } from "lucide-react";
import { agents, type Agent } from "@/lib/agents";
import demoData from "@/data/demo-cases.json";
import { append as appendHistory, clear as clearStoredHistory, describeWhen, load as loadStoredHistory, save as saveStoredHistory, summarize, HISTORY_LIMIT, type HistoryEntry } from "@/lib/history";
import { extractUrls } from "@/lib/analysis/audit";
import { extractPhoneNumbers } from "@/lib/analysis/phone";
import { correlateIncidents } from "@/lib/analysis/correlation";
import { buildReportData, formatReportMarkdown } from "@/lib/analysis/report";
import type { Translate } from "@/lib/i18n";

const icons: Record<string, typeof Shield> = { voice: AudioLines, message: MessageSquareText, wallet: WalletCards, link: Link2, shield: ShieldCheck };
type Section = "inicio" | "analizar" | "agentes" | "historial" | "mapa" | "escudo" | "privacidad";
type DemoCase = { id: string; title: string; kind: string; agent: string; expect: string; text: string };
const demoCases = (demoData as { cases: DemoCase[] }).cases;
/** Clave del permiso explícito para conservar el historial en este navegador. */
const HISTORY_CONSENT_KEY = "xibalba.historial.permiso.v1";
/** `localStorage` puede no existir o estar bloqueado (modo privado). */
function browserStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
function newId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}
/** Claves del diccionario para el tipo de análisis guardado en el historial. */
const KIND_KEY: Record<string, "kindMessage" | "kindUrl" | "kindCall" | "kindFinance"> = {
  message: "kindMessage",
  url: "kindUrl",
  transcripcion: "kindCall",
  financiero: "kindFinance",
};
const LIGHT_KEY = { verde: "lightVerde", amarillo: "lightAmarillo", rojo: "lightRojo", gris: "lightGris" } as const;
const RISK_KEY = { alto: "riskAlto", medio: "riskMedio", bajo: "riskBajo", "no concluyente": "riskNinguno" } as const;
const CONFIDENCE_KEY = { alta: "confidenceAlta", media: "confidenceMedia", baja: "confidenceBaja" } as const;
/** Estados que informa el modelo local del navegador, más los nuestros. */
const AVAILABILITY_KEY: Record<string, "availabilityUnsupported" | "availabilityError" | "availabilityAvailable" | "availabilityDownloadable" | "availabilityDownloading" | "availabilityUnavailable" | "availabilityUnknown"> = {
  unsupported: "availabilityUnsupported",
  error: "availabilityError",
  available: "availabilityAvailable",
  downloadable: "availabilityDownloadable",
  downloading: "availabilityDownloading",
  unavailable: "availabilityUnavailable",
  unknown: "availabilityUnknown",
};

/** Una línea del historial. Muestra el resultado, no el contenido analizado. */
function HistoryRow({ entry, t, lang }: { entry: HistoryEntry; t: Translate; lang: Lang }) {
 const kindKey = KIND_KEY[entry.kind];
 return <li className={`history-row hist-${entry.light}`}>
  <span className="history-light" aria-hidden="true"/>
  <div className="history-main">
   <div className="history-top"><b>{kindKey ? t("history", kindKey) : t("verdict", "metricRisk")}</b><span className="history-verdict">{t("verdict", LIGHT_KEY[entry.light])} · {t("verdict", RISK_KEY[entry.riskLevel])}</span><time dateTime={entry.at}>{describeWhen(entry.at, LANG_TAG[lang])}</time></div>
   <p className="history-preview">{entry.preview ? `«${entry.preview}»` : t("history", "noText")}</p>
   <p className="history-meta">{t("history", "meta", { signals: entry.signals, confidence: t("verdict", CONFIDENCE_KEY[entry.confidence]), run: entry.checksRun, total: entry.checksTotal })}{entry.hadAttachments ? ` · ${t("history", "withAttachments")}` : ""}{entry.agents.length ? ` · ${entry.agents.map(id => AGENT_NAMES[id] ?? id).join(" · ")}` : ""}</p>
   {entry.topSignals.length ? <p className="history-signals">{entry.topSignals.join(" · ")}</p> : null}
  </div>
 </li>;
}

export default function Dashboard() {
 const { t, lang, setLang } = useI18n();
 const [kind, setKind] = useState<AgentKind>("message"); const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [availability, setAvailability] = useState("");
 const [outcome, setOutcome] = useState<AnalysisResult | null>(null);
 const [ocr, setOcr] = useState<OcrResult | null>(null);
 const [ocrEdited, setOcrEdited] = useState(false);
 const [stage, setStage] = useState("");
 const [events, setEvents] = useState<AgentEvent[]>([]);
 const [images, setImages] = useState<PreparedImage[]>([]);
 const [audio, setAudio] = useState<PreparedAudio | null>(null);
 // Consentimiento propio del audio: aceptar el envío de texto e imágenes no
 // autoriza a enviar la voz de una llamada, que puede incluir a un tercero.
 const [audioConsent, setAudioConsent] = useState(false);
 const [transcription, setTranscription] = useState<Transcription | null>(null);
 const [configured, setConfigured] = useState(false);
 const [section, setSection] = useState<Section>("inicio"); const [selected, setSelected] = useState<Agent | null>(null); const [input, setInput] = useState(""); const [menu, setMenu] = useState(false);
 // Historial: vive en memoria mientras la pestaña está abierta. Solo se copia a
 // este navegador si la persona lo autoriza, y nunca sale del dispositivo.
 const [history, setHistory] = useState<HistoryEntry[]>([]);
 const [keepHistory, setKeepHistory] = useState(false);
 const [historyQuery, setHistoryQuery] = useState("");
 const [historyLightFilter, setHistoryLightFilter] = useState<"" | "verde" | "amarillo" | "rojo" | "gris">("");
 // Pestañas del laboratorio forense en móvil: en escritorio las tres áreas se
 // muestran a la vez, así que este estado solo decide qué área queda visible
 // bajo el ancho en que la pantalla deja de tener espacio para las tres.
 const [labTab, setLabTab] = useState<"evidence" | "investigation" | "evaluation">("evidence");
 // Detección real de la capacidad de OCR del navegador, no un dato inventado:
 // la API nativa de reconocimiento de texto, o el respaldo WASM que siempre
 // está disponible porque se sirve desde el propio origen.
 const [ocrCapability, setOcrCapability] = useState<"checking" | "native" | "wasm">("checking");
 useEffect(() => {
  let active = true;
  queueMicrotask(() => { if (active) setOcrCapability("TextDetector" in window ? "native" : "wasm"); });
  return () => { active = false; };
 }, []);
 // Importado de forma dinámica: el SDK de Firebase no debe formar parte del
 // fragmento de JS de la portada (ver lib/analysis/analyze.ts y docs/rendimiento.md).
 useEffect(() => { void import("@/lib/firebase").then(({ initializeLocalDebug, isConfigured, localAvailability }) => { void initializeLocalDebug().catch(() => {}).finally(() => setConfigured(isConfigured())); void localAvailability().then(setAvailability); }); }, []);
 // Se lee después del montaje: en el servidor no hay `localStorage` y el
 // historial guardado no debe formar parte del HTML renderizado.
 useEffect(() => {
  let active = true;
  queueMicrotask(() => {
   if (!active) return;
   const store = browserStorage();
   if (!store) return;
   let allowed = false;
   try { allowed = store.getItem(HISTORY_CONSENT_KEY) === "1"; } catch { allowed = false; }
   if (!allowed) return;
   setKeepHistory(true);
   setHistory(loadStoredHistory(store));
  });
  return () => { active = false; };
 }, []);
 /** Extrae huellas seguras (dominios, prefijos telefónicos, IDs de señales) para correlación local. */
 const fingerprintsOf = (result: AnalysisResult, analysed: string) => {
  const domains = [...new Set(extractUrls(analysed).map(u => { try { return new URL(u).hostname; } catch { return ""; } }).filter(Boolean))];
  const phonePrefixes = [...new Set(extractPhoneNumbers(analysed).map(p => p.prefix))];
  const signalIds = [...new Set(result.audit.indicators.filter(i => i.status === "sospechoso").map(i => i.id))];
  return { domains, phonePrefixes, signalIds };
 };
 /** Guarda el resultado del análisis, nunca el contenido completo. */
 const record = (result: AnalysisResult, analysed: string, attachments: boolean) => {
  const fp = fingerprintsOf(result, analysed);
  const entry = summarize({ kind, text: analysed, hadAttachments: attachments, ...fp, risk: result.risk, contributing: result.contributing, source: result.source }, newId());
  setHistory(previous => { const next = appendHistory(previous, entry); if (keepHistory) saveStoredHistory(browserStorage(), next); return next; });
 };
 const downloadFile = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
 };
 const currentCorrelation = outcome ? correlateIncidents(fingerprintsOf(outcome, input), history.slice(1)) : { relatedEntries: [], campaigns: [] };
 const exportReport = (format: "md" | "json") => {
  if (!outcome) return;
  const data = buildReportData(outcome, currentCorrelation, lang);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") downloadFile(JSON.stringify(data, null, 2), `xibalba-report-${stamp}.json`, "application/json");
  else downloadFile(formatReportMarkdown(data), `xibalba-report-${stamp}.md`, "text/markdown;charset=utf-8");
 };
 const allowHistory = (value: boolean) => {
  setKeepHistory(value);
  const store = browserStorage();
  if (!store) return;
  try { if (value) store.setItem(HISTORY_CONSENT_KEY, "1"); else store.removeItem(HISTORY_CONSENT_KEY); } catch { /* sin almacenamiento el historial se queda en memoria */ }
  if (value) saveStoredHistory(store, history); else clearStoredHistory(store);
 };
 const forgetHistory = () => { setHistory([]); clearStoredHistory(browserStorage()); };
 const clearResult = () => { setOutcome(null); setError(""); setOcr(null); setOcrEdited(false); setStage(""); setEvents([]); setLabTab("evidence"); };
 // Corrección manual del OCR: la persona edita el texto reconocido sin volver
 // a tocar la imagen. `submitText` reutiliza este texto en vez de repetir el
 // OCR mientras `ocrEdited` sea verdadero.
 const editOcrText = (value: string) => { setOcr(previous => previous ? { ...previous, text: value, status: value.trim() ? "available" : "empty" } : previous); setOcrEdited(true); setOutcome(null); setError(""); setEvents([]); setStage(""); };
 const retryOcr = () => { setOcrEdited(false); setOcr(null); };
 // Al cambiar de tipo se libera el audio: solo CAMAZOTZ lo usa y mantenerlo en
 // memoria sin que la interfaz lo muestre sería guardarlo a espaldas de la persona.
 const dropAudio = () => { if (audio) releaseAudio(audio); setAudio(null); setAudioConsent(false); setTranscription(null); };
 /** Carga un caso de demostración. Son textos inventados: ver `data/demo-cases.json`. */
 const loadDemo = (demo: DemoCase) => { const next = demo.kind as AgentKind; setKind(next); if (next !== "transcripcion") dropAudio(); setInput(demo.text); clearResult(); };
 /** Nombre legible del motor que respondió, en el idioma de la interfaz. */
 const sourceLabel = (source: string | null) => source === "on_device" ? t("guardian", "sourceLocal") : source === "in_cloud" ? t("guardian", "sourceCloud") : source ? t("guardian", "sourceUnknown") : t("app", "aiUnverified");
 // Hay algo que analizar en cuanto exista texto, una imagen o un audio. Antes
 // las imágenes no contaban y el botón quedaba deshabilitado con una captura
 // ya adjunta, sin decir por qué.
 const hasImages = images.length > 0;
 const hasContent = Boolean(input.trim()) || hasImages || Boolean(audio);
 const imageOnly = hasImages && !input.trim() && !audio;
 const [quickInput, setQuickInput] = useState("");
 const submitText = async (overrideText?: string, overrideKind?: AgentKind) => {
  if (busy) return;
  const activeKind = overrideKind ?? kind;
  const activeInput = overrideText ?? input;
  setBusy(true); setError(""); setOutcome(null); setEvents([]);
  // En móvil, donde solo cabe un área del laboratorio a la vez, se sigue el
  // trabajo real: primero la investigación en curso y, al terminar, la
  // evaluación. En escritorio las tres áreas ya están visibles y esto no
  // cambia nada.
  setLabTab("investigation");
  try {
   // 1. Transcripción de audio y lectura OCR de imágenes: dos E/S
   //    independientes entre sí, así que se ejecutan en paralelo en vez de
   //    esperarse una a la otra. El estado se conserva tal cual: sin motor o
   //    sin consentimiento queda «pendiente» y no se inventa texto.
   setStage(lang === "en" ? "Preparing evidence" : "Preparando evidencia");
   const mayTranscribe = Boolean(consent && audioConsent && configured);
   const activeImages = overrideText ? [] : images;
   const shouldTranscribe = Boolean(audio && !overrideText);
   const shouldOcr = Boolean(activeImages.length && activeKind !== "url");
   const [state, ocrFromImages] = await Promise.all([
    shouldTranscribe
     ? transcribeAudio(audio!, { consent: mayTranscribe, generate: mayTranscribe ? modelTranscriber : undefined })
     : Promise.resolve<Transcription | null>(null),
    shouldOcr
     ? (ocrEdited && ocr ? Promise.resolve(ocr) : recognizeImageText(activeImages))
     : Promise.resolve<OcrResult | null>(null),
   ]);
   setTranscription(state);
   // 2. El texto analizado es lo que escribió la persona y, si existe, la
   //    transcripción automática, señalada como tal para no pasar por cita.
   const recognised = state?.status === "disponible" && state.text ? state.text : "";
   let ocrResult = ocrFromImages;
   let ocrSource: 'model' | 'native' | 'tesseract' = ocrResult?.source ?? 'native';
   if (ocrResult && ocrResult.status !== 'available' && consent && configured) {
    setStage(lang === "en" ? "Reading images with the consented model" : "Leyendo imágenes con el modelo autorizado");
    try {
     const modelText = await modelImageText(activeImages.map(image => ({ mimeType: image.mimeType, data: image.base64 })));
     if (modelText) { ocrResult = { text: modelText, status: 'available' }; ocrSource = 'model'; }
    } catch { /* La falta de lectura permanece explícita. */ }
   }
   const baseText = [activeInput.trim(), recognised && `[Transcripción automática del audio adjunto]\n${recognised}`].filter(Boolean).join("\n\n");
   const ocrPrefix = "[Texto reconocido automáticamente en la imagen; puede contener errores]\n";
   const ocrExcerpt = ocrResult?.text.slice(0, Math.max(0, 6000 - baseText.length - ocrPrefix.length - 2));
   setOcr(ocrResult ? { ...ocrResult, source: ocrSource, text: ocrExcerpt ?? "", status: ocrExcerpt ? ocrResult.status : "empty" } : null);
   const text = activeKind === "url" ? activeInput : [baseText, ocrExcerpt && `${ocrPrefix}${ocrExcerpt}`].filter(Boolean).join("\n\n");
   const activeAudio = overrideText ? null : audio;
   const payload = {
    kind: activeKind, text, lang,
    images: activeImages.map(image => ({ mimeType: image.mimeType, data: image.base64, name: image.name, size: image.size, width: image.width, height: image.height, ocrTextAvailable: ocrSource !== 'model' && activeImages.length === 1 && Boolean(ocrExcerpt) })),
    audio: activeAudio ? { name: activeAudio.name, mimeType: activeAudio.mimeType, size: activeAudio.size, durationSeconds: activeAudio.durationSeconds } : null,
    transcription: activeAudio ? (state ?? TRANSCRIPTION_PENDING) : undefined,
    containsOcr: Boolean(ocrExcerpt),
    onEvent: (event: AgentEvent) => setEvents(previous => [...previous, event]),
   };
   const attachments = Boolean(activeImages.length || activeAudio);
   setStage(lang === "en" ? "Running coordinated audit" : "Ejecutando auditoría coordinada");
   // Sin consentimiento o sin configuración, la auditoría local se ejecuta igual.
   if (!consent || !configured) { const local = analyzeLocally(payload); setOutcome(local); record(local, text, attachments); setLabTab("evaluation"); return; }
   void import("@/lib/firebase").then(({ getServices }) => getServices().model.initializeDeviceModel().catch(() => {}));
   const result = await analyze(payload);
   setOutcome(result); record(result, text, attachments); setLabTab("evaluation");
  } catch (e) { setError(t("errors", errorKey(e))); setLabTab("evidence"); } finally { setBusy(false); }
 };
 const submit = () => submitText();
 const runQuickScan = async () => {
  const trimmed = quickInput.trim();
  if (!trimmed) return;
  const inferredKind: AgentKind = /^https?:\/\//i.test(trimmed) ? "url" : "message";
  setKind(inferredKind);
  setInput(trimmed);
  setSection("analizar");
  await submitText(trimmed, inferredKind);
 };
 const go = (s: Section) => { setSection(s); setSelected(null); setMenu(false); };
 const nav: { id: Section; icon: typeof Shield }[] = [{id:"inicio",icon:LayoutDashboard},{id:"analizar",icon:ScanLine},{id:"agentes",icon:Sparkles},{id:"historial",icon:Clock3},{id:"mapa",icon:Network},{id:"escudo",icon:ShieldCheck},{id:"privacidad",icon:Fingerprint}];
 /** Textos de cada agente, tomados del diccionario y no del módulo en español. */
 const agentText = (agent: Agent) => ({
  role: t("agents", `${agent.id}Role` as "camazotzRole"),
  description: t("agents", `${agent.id}Description` as "camazotzDescription"),
  works: t("agents", `${agent.id}Works` as "camazotzWorks"),
  pending: t("agents", `${agent.id}Pending` as "camazotzPending"),
 });
 const otherLang: Lang = lang === "es" ? "en" : "es";
 // Filtro de historial: busca solo sobre lo que ya se guarda (vista previa,
 // agentes, señales), nunca sobre el contenido completo, que no se conserva.
 const filteredHistory = history.filter(entry => {
  if (historyLightFilter && entry.light !== historyLightFilter) return false;
  const query = historyQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = [entry.preview, ...entry.agents.map(id => AGENT_NAMES[id] ?? id), ...entry.topSignals].join(" ").toLowerCase();
  return haystack.includes(query);
 });
 // Métricas reales del Command Center: derivadas del historial de esta
 // sesión, nunca inventadas. Sin historial, cada contador queda en 0.
 const riskCounts = { verde: 0, amarillo: 0, rojo: 0, gris: 0 };
 for (const entry of history) riskCounts[entry.light] += 1;
 const agentActivity = agents.map(agent => ({
  agent,
  count: history.reduce((total, entry) => total + ((entry.agents as readonly string[]).includes(agent.id) ? 1 : 0), 0),
 }));
 const highRiskRecent = history.filter(entry => entry.light === "rojo").slice(0, 3);
 const OCR_LABEL = { checking: { es: "Comprobando…", en: "Checking…" }, native: { es: "Detector nativo del navegador", en: "Native browser detector" }, wasm: { es: "WASM local (Tesseract)", en: "Local WASM (Tesseract)" } } as const;
 const AI_LOCAL_LABEL = availability ? t("analyze", AVAILABILITY_KEY[availability] ?? "availabilityUnknown") : t("analyze", "availabilityChecking");
 return <div className="shell"><aside className={`sidebar ${menu ? "open" : ""}`}><div className="brand"><Image src="/xibalba-logo.jpg" alt="XIBALBÁ AI" width={172} height={112} priority/><span>{t("app","tagline")}</span></div><div className="side-label">{t("app","menu")}</div><nav>{nav.map(({id,icon: Icon}) => <button key={id} className={section===id ? "nav active" : "nav"} onClick={() => go(id)}><Icon size={17}/>{t("nav",id)}{section===id && <span className="nav-dot"/>}</button>)}</nav><div className="side-bottom"><div className="side-card"><ShieldCheck size={22}/><strong>{t("app","sideCardTitle")}</strong><p>{t("app","sideCardText")}</p><button onClick={() => go("privacidad")}>{t("app","sideCardCta")} <ArrowRight size={13}/></button></div><div className="side-footer"><span className="status-dot"/> MVP <span>·</span> {t("app","sideFooter")}</div></div></aside>
 <main><header className="topbar"><button className="menu-button" aria-label={menu ? t("app","closeMenu") : t("app","openMenu")} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button><div className="breadcrumb">{t("app","breadcrumb")} <span>/</span> <b>{t("nav",section)}</b></div><div className="top-actions"><span className="system-status"><i/> {t("app","aiPrefix")} · {outcome?.source ? sourceLabel(outcome.source).toUpperCase() : configured ? t("app","aiUnverified") : t("app","aiUnconfigured")}</span><button className="language" onClick={() => setLang(otherLang)} aria-label={`${LANG_LABEL[lang]}. ${t("app","languageCurrent")}. ${t("app","language")}: ${LANG_LABEL[otherLang]}`}><Globe2 size={15}/> {LANG_LABEL[lang]} <ChevronDown size={13}/></button><span className="avatar"><Shield size={16}/></span></div></header>
 <div className="content">{section === "inicio" && <><div className="welcome"><div><div className="eyebrow"><span/> {t("home","eyebrow")}</div><h1>{t("home","title")} <em>{t("home","titleEm")}</em></h1><p>{t("home","subtitle")}</p></div><div className="date-tag"><ShieldCheck size={16}/> {t("home","dateTag")}</div></div>
 <section className="command-strip" aria-label={lang === "en" ? "Investigation status" : "Estado de investigaciones"}><div><small>{lang === "en" ? "ACTIVE INVESTIGATION" : "INVESTIGACIÓN ACTIVA"}</small><strong>{busy ? (lang === "en" ? "Processing" : "En proceso") : (lang === "en" ? "None" : "Ninguna")}</strong></div><div><small>{lang === "en" ? "CASES IN HISTORY" : "CASOS EN HISTORIAL"}</small><strong>{history.length}</strong></div><div><small>{lang === "en" ? "LATEST RESULT" : "ÚLTIMO RESULTADO"}</small><strong>{history[0] ? t("verdict", RISK_KEY[history[0].riskLevel]) : "—"}</strong></div><button className="text-link" onClick={() => go("historial")}>{lang === "en" ? "View history" : "Ver historial"} <ArrowRight size={15}/></button></section>
 <section className="ops-status-grid" aria-label={lang === "en" ? "Platform status" : "Estado de la plataforma"}>
  <div className="ops-status-card">
   <div className="ops-status-head"><ScanLine size={15}/> {lang === "en" ? "OCR" : "OCR"}</div>
   <strong>{OCR_LABEL[ocrCapability][lang]}</strong>
   <small>{lang === "en" ? "Runs on-device; images never leave your browser." : "Corre en el dispositivo; las imágenes no salen del navegador."}</small>
  </div>
  <div className="ops-status-card">
   <div className="ops-status-head"><Sparkles size={15}/> {lang === "en" ? "AI inference" : "Inferencia de IA"}</div>
   <strong>{lang === "en" ? "Local" : "Local"}: {AI_LOCAL_LABEL}</strong>
   <small>{lang === "en" ? "Cloud" : "Nube"}: {configured ? (lang === "en" ? "configured" : "configurada") : (lang === "en" ? "not configured" : "no configurada")}</small>
  </div>
  <div className="ops-status-card">
   <div className="ops-status-head"><ShieldAlert size={15}/> {lang === "en" ? "Incident summary" : "Resumen de incidentes"}</div>
   {history.length ? <div className="ops-risk-bars">
    <span className="ops-risk-bar ops-risk-rojo" style={{ flexGrow: riskCounts.rojo || 0.001 }} title={`${riskCounts.rojo}`}/>
    <span className="ops-risk-bar ops-risk-amarillo" style={{ flexGrow: riskCounts.amarillo || 0.001 }} title={`${riskCounts.amarillo}`}/>
    <span className="ops-risk-bar ops-risk-verde" style={{ flexGrow: riskCounts.verde || 0.001 }} title={`${riskCounts.verde}`}/>
    <span className="ops-risk-bar ops-risk-gris" style={{ flexGrow: riskCounts.gris || 0.001 }} title={`${riskCounts.gris}`}/>
   </div> : <small>{lang === "en" ? "No analyses yet this session." : "Sin análisis todavía en esta sesión."}</small>}
   <small>{lang === "en" ? `${riskCounts.rojo} high · ${riskCounts.amarillo} medium · ${riskCounts.verde} clean · ${riskCounts.gris} inconclusive` : `${riskCounts.rojo} alto · ${riskCounts.amarillo} medio · ${riskCounts.verde} limpio · ${riskCounts.gris} no concluyente`}</small>
  </div>
  <div className="ops-status-card ops-status-cta">
   <div className="ops-status-head"><LayoutDashboard size={15}/> {lang === "en" ? "Forensic lab" : "Laboratorio forense"}</div>
   <small>{lang === "en" ? "Evidence, agent activity and risk evaluation in one workspace." : "Evidencia, actividad de agentes y evaluación de riesgo en un solo espacio."}</small>
   <button type="button" className="text-link" onClick={() => go("analizar")}>{lang === "en" ? "Open lab" : "Abrir laboratorio"} <ArrowRight size={14}/></button>
  </div>
 </section>
 {highRiskRecent.length > 0 && <section className="ops-alerts" role="alert" aria-label={lang === "en" ? "Relevant alerts" : "Alertas relevantes"}>
  <ShieldAlert size={16}/>
  <span>{lang === "en" ? `${highRiskRecent.length} high-risk result(s) in your recent history.` : `${highRiskRecent.length} resultado(s) de riesgo alto en tu historial reciente.`}</span>
  <button type="button" className="text-link" onClick={() => go("historial")}>{lang === "en" ? "Review" : "Revisar"} <ArrowRight size={13}/></button>
 </section>}
 <section className="hero"><div className="hero-copy"><div className="hero-kicker"><span className="pulse"/> {t("home","heroKicker")}</div><h2>{t("home","heroTitle")}<br/><em>{t("home","heroTitleEm")}</em></h2><p>{t("home","heroText")}</p><button className="primary" onClick={() => go("analizar")}><ScanLine size={17}/> {t("home","heroCta")} <ArrowRight size={16}/></button><div className="hero-note"><LockKeyhole size={13}/> {t("home","heroNote")}</div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><Image src="/xibalba-logo.jpg" alt="" width={330} height={235} priority/></div><div className="hero-index">01 / 05 <span>✦</span></div></section>
 <section className="panel quick-scan" aria-label={t("home","quickTitle")}><div className="quick-scan-head"><div className="eyebrow"><span/> {t("home","quickTitle")}</div><button type="button" className="text-link" onClick={() => setQuickInput(demoCases[0]?.text ?? "")}><FlaskConical size={13}/> {t("home","quickSample")}</button></div><div className="quick-scan-row"><input type="text" value={quickInput} onChange={e => setQuickInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && quickInput.trim()) void runQuickScan(); }} placeholder={t("home","quickPlaceholder")} aria-label={t("home","quickPlaceholder")} /><button type="button" className="primary" disabled={!quickInput.trim() || busy} onClick={() => void runQuickScan()}><ScanLine size={16}/> {t("home","quickCta")}</button></div></section>
 <div className="section-title"><div><div className="eyebrow muted">{t("home","agentsEyebrow")}</div><h2>{t("home","agentsTitle")} <span>✦</span></h2><p>{t("home","agentsText")}</p></div><button className="text-link" onClick={() => go("agentes")}>{t("home","agentsCta")} <ArrowRight size={15}/></button></div><div className="agent-grid">{agentActivity.map(({ agent: a, count }, i) => {const Icon=icons[a.icon]; const text=agentText(a); return <button className="agent-card" key={a.id} onClick={() => {setSection("agentes");setSelected(a)}}><div className="agent-top"><div className={`agent-icon ${a.color}`}><Icon size={22}/></div>{count > 0 ? <span className="agent-activity-badge">{lang === "en" ? `${count}× this session` : `${count}× esta sesión`}</span> : <span>0{i+1}</span>}</div><h3>{a.name}</h3><div className="role">{text.role}</div><p>{text.description}</p><div className="card-link">{t("home","agentCardCta")} <ArrowRight size={14}/></div></button>})}</div>
 <div className="lower-grid"><section className="panel activity"><div className="panel-head"><div><div className="eyebrow muted">{t("home","activityEyebrow")}</div><h2>{t("home","activityTitle")}</h2></div><button className="text-link" onClick={()=>go("historial")}>{t("home","activityCta")} <ArrowRight size={14}/></button></div>{history.length ? <ul className="history-list compact">{history.slice(0,3).map(entry => <HistoryRow key={entry.id} entry={entry} t={t} lang={lang}/>)}</ul> : <div className="empty-row"><div className="empty-icon"><Clock3 size={20}/></div><div><strong>{t("home","emptyTitle")}</strong><p>{t("home","emptyText")}</p></div><ArrowRight size={17}/></div>}</section><section className="panel privacy-panel"><div className="privacy-icon"><Fingerprint size={25}/></div><div><div className="eyebrow muted">{t("home","privacyEyebrow")}</div><h2>{t("home","privacyTitle")}</h2><p>{t("home","privacyText")}</p><button className="text-link" onClick={()=>go("privacidad")}>{t("home","privacyCta")} <ArrowRight size={14}/></button></div></section></div></>}
 {section === "analizar" && <div className="inner-page"><div className="eyebrow"><span/> {t("analyze","eyebrow")}</div><h1>{t("analyze","title")} <em>{t("analyze","titleEm")}</em></h1><p className="lead">{t("analyze","lead")}</p>
<div className="lab-tabs" role="tablist" aria-label={lang === "en" ? "Forensic lab areas" : "Áreas del laboratorio forense"}>
 <button type="button" role="tab" aria-selected={labTab === "evidence"} className={labTab === "evidence" ? "lab-tab active" : "lab-tab"} onClick={() => setLabTab("evidence")}>{lang === "en" ? "A · Evidence" : "A · Evidencia"}</button>
 <button type="button" role="tab" aria-selected={labTab === "investigation"} className={labTab === "investigation" ? "lab-tab active" : "lab-tab"} onClick={() => setLabTab("investigation")}>{lang === "en" ? "B · Investigation" : "B · Investigación"}{busy && <span className="lab-tab-dot" aria-hidden="true"/>}</button>
 <button type="button" role="tab" aria-selected={labTab === "evaluation"} className={labTab === "evaluation" ? "lab-tab active" : "lab-tab"} onClick={() => setLabTab("evaluation")}>{lang === "en" ? "C · Evaluation" : "C · Evaluación"}</button>
</div>
<div className="workspace lab-grid"><div className={`panel form-panel lab-area lab-area-evidence ${labTab === "evidence" ? "lab-area-active" : ""}`}><div className="panel-head"><div><h2>{t("analyze","panelTitle")}</h2><p>{t("analyze","panelText")}</p></div><ScanLine className="cyan-text" size={22}/></div><label htmlFor="kind">{t("analyze","kindLabel")}</label><select id="kind" disabled={busy} value={kind} onChange={e=>{const next=e.target.value as AgentKind;setKind(next);if(next!=="transcripcion")dropAudio();clearResult();}}><option value="message">{t("analyze","kindMessage")}</option><option value="url">{t("analyze","kindUrl")}</option><option value="transcripcion">{t("analyze","kindCall")}</option><option value="financiero">{t("analyze","kindFinance")}</option></select><p className="notice">{kind==="transcripcion"?t("analyze","noticeCall"):kind==="financiero"?t("analyze","noticeFinance"):t("analyze","noticeDefault")}</p><div className="field-label">{t("analyze","demoLabel")}</div><div className="demo-row">{/* `aria-label` repite el texto visible a propósito: sin él, el nombre
     accesible del botón pasaba a ser el `title` —el resultado esperado— y
     quien usa lector de pantalla oía la explicación en lugar del nombre
     del caso. El `title` se queda para la ayuda emergente al pasar el ratón. */}
{demoCases.map(demo => <button key={demo.id} type="button" className="demo-chip" disabled={busy} aria-label={demo.title} title={demo.expect} onClick={()=>loadDemo(demo)}><FlaskConical size={13}/> {demo.title}</button>)}</div><p className="notice">{t("analyze","demoNotice")}{t("analyze","demoLanguageNote") ? ` ${t("analyze","demoLanguageNote")}` : ""}</p><label htmlFor="content">{t("analyze","contentLabel")}</label><textarea id="content" disabled={busy} value={input} onChange={e=>{setInput(e.target.value);clearResult();}} placeholder={kind==="url"?t("analyze","placeholderUrl"):kind==="transcripcion"?t("analyze","placeholderCall"):kind==="financiero"?t("analyze","placeholderFinance"):t("analyze","placeholderMessage")}/><label htmlFor="photo">{t("analyze","imagesLabel")}</label><ImageAttachments images={images} onChange={next=>{setImages(next);clearResult();}} disabled={busy} onError={setError}/>{imageOnly && <p className="notice">{consent && configured ? t("images","onlyImageAi") : t("images","onlyImageLocal")}</p>}
{ocr && <div className="ocr-evidence"><strong>OCR {ocr.source === "model" ? "· AI" : (lang === "en" ? "· browser" : "· navegador")} · {ocr.status === "available" ? (lang === "en" ? "Text recognized" : "Texto reconocido") : (lang === "en" ? "Reading incomplete" : "Lectura incompleta")}{ocrEdited && <span className="ocr-edited-badge"> {t("analyze","ocrEditedBadge")}</span>}</strong><label className="ocr-correction-label" htmlFor="ocr-correction">{t("analyze","ocrCorrectionLabel")}</label><textarea id="ocr-correction" className="ocr-correction" disabled={busy} value={ocr.text} onChange={e => editOcrText(e.target.value)} placeholder={t("analyze","ocrCorrectionEmpty")}/><small>{ocr.text ? (lang === "en" ? "Automatic or model transcription may contain errors or invented text. Only the text shown here is analysed; verify it against the image." : "La transcripción automática o del modelo puede contener errores o texto inventado. Solo se analiza el texto mostrado aquí; compáralo con la imagen.") : t("analyze","ocrCorrectionEmpty")}</small><div className="ocr-correction-actions"><small>{t("analyze","ocrCorrectionHint")}</small>{ocrEdited && <button type="button" className="text-link" disabled={busy} onClick={retryOcr}>{t("analyze","ocrRetry")}</button>}</div></div>}
{kind==="transcripcion" && <><label htmlFor="audio">{t("analyze","audioLabel")}</label><AudioAttachment audio={audio} transcription={transcription} onChange={next=>{setAudio(next);setTranscription(null);clearResult();}} disabled={busy} onError={setError}/></>}<div className="form-foot"><span><LockKeyhole size={14}/> {t("analyze","footPrivacy")}</span><span>{t("analyze","chars",{n:input.length})}</span></div><label className="consent"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);clearResult();}}/> {t("analyze","consent")}</label>{audio && <label className="consent"><input type="checkbox" checked={audioConsent} onChange={e=>{setAudioConsent(e.target.checked);setTranscription(null);clearResult();}}/> {t("analyze","audioConsent")}</label>}<button className="primary" disabled={busy || !hasContent} onClick={submit}><ScanLine size={17}/> {busy ? t("analyze","submitBusy") : consent && configured ? t("analyze","submitAi") : t("analyze","submitLocal")} <ArrowRight size={16}/></button>{!hasContent && <p className="notice">{t("analyze","needContent")}</p>}<p className="notice">{!configured ? t("analyze","statusNotConfigured") : consent ? t("analyze","statusConsent") : t("analyze","statusLocal")} {t("analyze","historyNote")}</p>{error && <p role="alert" className="notice error-notice">{error}</p>}</div>
<div className={`panel lab-area lab-area-investigation ${labTab === "investigation" ? "lab-area-active" : ""}`} aria-live="polite">
  <div className="eyebrow">{lang === "en" ? "B · INVESTIGATION DESK" : "B · MESA DE INVESTIGACIÓN"}</div>
  {(busy || outcome || ocr || events.length > 0) && <div className="investigation" aria-live="polite">{busy && <p><Activity size={15}/> {stage}</p>}<AgentOperationsBoard events={events} executed={outcome?.executed ?? []} busy={busy} lang={lang}/>{(busy || events.length > 0) && <div className="agent-status-grid">{agents.map(agent => { const records = events.filter(event => event.agent === agent.id); const latest = records.at(-1); return <div className="agent-status" key={agent.id}><b>{agent.name}</b><small>{agentText(agent).role}</small><span>{!latest ? (busy ? (lang === "en" ? "Not started" : "Sin iniciar") : (lang === "en" ? "Not used" : "No participó")) : latest.phase === "queued" ? (lang === "en" ? "Queued" : "En cola") : latest.phase === "started" ? (busy ? (lang === "en" ? "Running" : "En ejecución") : (lang === "en" ? "Interrupted" : "Interrumpido")) : latest.phase === "error" ? "Error" : (lang === "en" ? "Completed" : "Completado")}</span></div>; })}</div>}{events.length > 0 && <details className="timeline"><summary>{lang === "en" ? "Execution timeline" : "Cronología de ejecución"}</summary><ol>{events.map((event, index) => <li key={index}><b>{AGENT_NAMES[event.agent]}</b> · {event.task} · {event.phase === "queued" ? (lang === "en" ? "queued" : "en cola") : event.phase === "started" ? (lang === "en" ? "started" : "inició") : event.phase === "completed" ? (lang === "en" ? "completed" : "completó") : "error"}{event.elapsedMs !== undefined && <> · {event.elapsedMs.toFixed(1)} ms</>}{event.findings !== undefined && <> · {event.findings} {lang === "en" ? "indicators" : "indicadores"}</>}</li>)}</ol><small>{lang === "en" ? "The coordinator encloses the specialist tasks; durations must not be added together." : "La coordinación incluye las tareas especializadas; sus tiempos no deben sumarse."}</small></details>}{outcome && <div className="investigation-agents">{outcome.executed.map((id, index) => { const findings = outcome.attributed.filter(item => item.agents.includes(id)); return <div className="investigation-agent" key={id}><div><b>{String(index + 1).padStart(2, "0")} · {AGENT_NAMES[id]}</b><span>{lang === "en" ? "Completed" : "Completado"}</span></div><p>{id === "guardian" ? (lang === "en" ? "Merged evidence and calculated combined risk." : "Fusionó la evidencia y calculó el riesgo combinado.") : findings.length ? findings.map(item => item.indicator).join(" · ") : (lang === "en" ? "No findings attributed." : "Sin hallazgos atribuidos.")}</p>{findings.slice(0, 2).map(item => <small key={item.id}>{item.evidence}</small>)}</div>; })}</div>}</div>}
</div>
<div className={`panel result-panel lab-area lab-area-evaluation ${labTab === "evaluation" ? "lab-area-active" : ""}`} aria-live="polite">
  <div className="eyebrow">C · {outcome ? `${t("analyze","agentsEyebrow")} · ${describeAgents(outcome.contributing.length ? outcome.contributing : outcome.selection.agents)}` : t("analyze","resultEyebrow")}</div>
  {outcome ? <><RiskVerdict risk={outcome.risk}/>{(currentCorrelation.campaigns.length > 0 || currentCorrelation.relatedEntries.length > 0) && <div className="correlation-box"><div className="eyebrow">{t("analyze","correlationTitle")}</div>{currentCorrelation.relatedEntries.length > 0 && <p className="notice">{t("analyze","correlationRelated",{n:currentCorrelation.relatedEntries.length})}</p>}{currentCorrelation.campaigns.map(c => <div key={c.id} className="campaign-chip"><strong>{lang==="en"?c.nameEn:c.nameEs}</strong><span>{lang==="en"?c.descriptionEn:c.descriptionEs}</span></div>)}</div>}<div className="export-row"><button type="button" className="export-btn" onClick={()=>exportReport("md")}><Download size={14}/> {t("analyze","exportMd")}</button><button type="button" className="export-btn" onClick={()=>exportReport("json")}><Download size={14}/> {t("analyze","exportJson")}</button></div><ul className="agent-reasons">{outcome.selection.agents.map(id=><li key={id}><b>{AGENT_NAMES[id]}</b> · {t("agentReasons",outcome.selection.reasons[id])}{id !== "guardian" && !outcome.contributing.includes(id) && ` ${t("analyze","noContribution")}`}</li>)}</ul><EvidenceList audit={outcome.audit} assessment={outcome.assessment} aiError={outcome.aiError}/></>
   : <><div className="result-icon"><ShieldAlert size={30}/></div><h2 className="risk-indicator risk-gris">● {t("analyze","resultEmptyTitle")}</h2><p>{t("analyze","resultEmptyText")}</p><div className="risk-pills"><span>{t("verdict","lightVerde")}</span><span>{t("verdict","lightAmarillo")}</span><span>{t("verdict","lightRojo")}</span><span>{t("verdict","lightGris")}</span></div></>}
  <div className="inference"><Activity size={16}/> {t("analyze","engine")}: <b>{sourceLabel(outcome?.source ?? null).toUpperCase()}</b> · {t("analyze","aiLocal")}: {availability ? t("analyze", AVAILABILITY_KEY[availability] ?? "availabilityUnknown") : t("analyze","availabilityChecking")}</div>
 </div></div>
 <div className="lab-jaguar"><Guardian outcome={outcome} busy={busy} error={error} consent={consent} configured={configured}/></div>
 </div>}
 {section === "agentes" && <div className="inner-page"><div className="eyebrow"><span/> {t("agentsPage","eyebrow")}</div><h1>{t("agentsPage","title")} <em>{t("agentsPage","titleEm")}</em></h1><p className="lead">{t("agentsPage","lead")}</p><div className="agent-grid large">{agents.map((a,i)=>{const Icon=icons[a.icon];const text=agentText(a);return <button className={`agent-card ${selected?.id===a.id?"selected":""}`} key={a.id} onClick={()=>setSelected(a)}><div className="agent-top"><div className={`agent-icon ${a.color}`}><Icon size={22}/></div><span>0{i+1}</span></div><h3>{a.name}</h3><div className="role">{text.role}</div><p>{text.description}</p><div className="card-link">{t("agentsPage","cardCta")} <ArrowRight size={14}/></div></button>})}</div>{selected && <div className="panel detail"><div><div className="eyebrow muted">{t("agentsPage","detailEyebrow")}</div><h2>{selected.name}</h2><p>{agentText(selected).description}</p><h3 className="detail-sub"><ShieldCheck size={15}/> {t("agentsPage","works")}</h3><p>{agentText(selected).works}</p><h3 className="detail-sub"><CircleHelp size={15}/> {t("agentsPage","pending")}</h3><p>{agentText(selected).pending}</p></div><button className="text-link" onClick={()=>go("analizar")}>{t("agentsPage","goAnalyze")} <ArrowRight size={15}/></button></div>}</div>}
 {section === "historial" && <div className="inner-page"><div className="eyebrow"><span/> {t("history","eyebrow")}</div><h1>{t("history","title")} <em>{t("history","titleEm")}</em></h1><p className="lead">{t("history","lead",{limit:HISTORY_LIMIT})}</p>
 <div className="panel history-panel"><div className="panel-head"><div><h2>{history.length ? t("history","count",{n:history.length}) : t("history","empty")}</h2><p>{keepHistory ? t("history","storedNote") : t("history","sessionNote")}</p></div>{history.length ? <button className="text-link danger-link" onClick={forgetHistory}><Trash2 size={14}/> {t("history","clear")}</button> : null}</div>
  <label className="consent"><input type="checkbox" checked={keepHistory} onChange={e=>allowHistory(e.target.checked)}/> {t("history","consent")}</label>
  {history.length > 0 && <div className="history-filters">
   <input type="search" className="history-search" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} placeholder={lang === "en" ? "Search by preview, agent or signal…" : "Buscar por vista previa, agente o señal…"} aria-label={lang === "en" ? "Search history" : "Buscar en el historial"}/>
   <div className="history-filter-chips">
    {(["", "rojo", "amarillo", "verde", "gris"] as const).map(light => <button key={light || "all"} type="button" className={historyLightFilter === light ? "history-filter-chip active" : "history-filter-chip"} onClick={() => setHistoryLightFilter(light)}>{light ? t("verdict", LIGHT_KEY[light]) : (lang === "en" ? "All" : "Todos")}</button>)}
   </div>
  </div>}
  {history.length ? (filteredHistory.length ? <ul className="history-list">{filteredHistory.map(entry => <HistoryRow key={entry.id} entry={entry} t={t} lang={lang}/>)}</ul> : <p className="notice">{lang === "en" ? "No history entries match this filter." : "Ningún elemento del historial coincide con este filtro."}</p>)
   : <div className="empty-row"><div className="empty-icon"><Clock3 size={20}/></div><div><strong>{t("history","emptyTitle")}</strong><p>{t("history","emptyText")}</p></div><button className="text-link" onClick={()=>go("analizar")}>{t("history","emptyCta")} <ArrowRight size={15}/></button></div>}
  <p className="notice">{t("history","note")}</p></div></div>}
 {section === "mapa" && <div className="inner-page"><div className="eyebrow"><span/> {t("map","eyebrow")}</div><h1>{t("map","title")} <em>{t("map","titleEm")}</em></h1><p className="lead">{t("map","lead")}</p><div className="panel"><InvestigationMap history={history} lang={lang}/></div></div>}
 {section === "escudo" && <div className="inner-page"><div className="eyebrow"><span/> {t("globalShield","eyebrow")}</div><h1>{t("globalShield","title")} <em>{t("globalShield","titleEm")}</em></h1><p className="lead">{t("globalShield","lead")}</p><div className="panel"><GlobalShield/></div></div>}
 {section === "privacidad" && <div className="inner-page"><div className="eyebrow"><span/> {t("privacy","eyebrow")}</div><h1>{t("privacy","title")} <em>{t("privacy","titleEm")}</em></h1><p className="lead">{t("privacy","lead")}</p><div className="privacy-grid"><div className="panel info-card"><LockKeyhole/><h2>{t("privacy","card1Title")}</h2><p>{t("privacy","card1Text")}</p></div><div className="panel info-card"><Eye/><h2>{t("privacy","card2Title")}</h2><p>{t("privacy","card2Text")}</p></div><div className="panel info-card"><BookOpen/><h2>{t("privacy","card3Title")}</h2><p>{t("privacy","card3Text")}</p></div></div></div>}
 <footer><span>© 2026 XIBALBÁ AI <i>✦</i> {t("app","footerLeft")}</span><span>{t("app","footerRight")} <ArrowDownLeft size={13}/></span></footer></div></main><HelpButton onOpenDirectory={() => go("escudo")}/></div>;
}
