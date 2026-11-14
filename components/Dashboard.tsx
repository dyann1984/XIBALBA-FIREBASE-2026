"use client";
import { useEffect, useState } from "react";
import { getServices, initializeLocalDebug, isConfigured, localAvailability } from "@/lib/firebase";
import { analyze, analyzeLocally, describeAgents, describeSource, explainError, modelTranscriber, type AnalysisResult } from "@/lib/analysis/analyze";
import { type AgentKind } from "@/lib/analysis/guardian";
import { AGENT_NAMES } from "@/lib/analysis/coordinator";
import type { PreparedImage } from "@/lib/analysis/images";
import { TRANSCRIPTION_PENDING, releaseAudio, transcribeAudio, type PreparedAudio, type Transcription } from "@/lib/analysis/audio";
import Guardian from "@/components/Guardian";
import RiskVerdict from "@/components/RiskVerdict";
import EvidenceList from "@/components/EvidenceList";
import ImageAttachments from "@/components/ImageAttachments";
import AudioAttachment from "@/components/AudioAttachment";
import { Activity, ArrowDownLeft, ArrowRight, AudioLines, BookOpen, ChevronDown, CircleHelp, Clock3, Eye, Fingerprint, FlaskConical, Globe2, LayoutDashboard, Link2, LockKeyhole, Menu, MessageSquareText, ScanLine, Shield, ShieldAlert, ShieldCheck, Sparkles, Trash2, WalletCards, X } from "lucide-react";
import { agents, type Agent } from "@/lib/agents";
import demoData from "@/data/demo-cases.json";
import { append as appendHistory, clear as clearStoredHistory, describeKind, describeWhen, load as loadStoredHistory, save as saveStoredHistory, summarize, HISTORY_LIMIT, type HistoryEntry } from "@/lib/history";
const icons: Record<string, typeof Shield> = { voice: AudioLines, message: MessageSquareText, wallet: WalletCards, link: Link2, shield: ShieldCheck };
type Section = "inicio" | "analizar" | "agentes" | "historial" | "privacidad";
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
const LIGHT_WORD: Record<string, string> = { rojo: "Rojo", amarillo: "Amarillo", verde: "Verde", gris: "Gris" };
/** Una línea del historial. Muestra el resultado, no el contenido analizado. */
function HistoryRow({ entry }: { entry: HistoryEntry }) {
 return <li className={`history-row hist-${entry.light}`}>
  <span className="history-light" aria-hidden="true"/>
  <div className="history-main">
   <div className="history-top"><b>{describeKind(entry.kind)}</b><span className="history-verdict">{LIGHT_WORD[entry.light] ?? "Gris"} · {entry.riskLevel}</span><time dateTime={entry.at}>{describeWhen(entry.at)}</time></div>
   <p className="history-preview">{entry.preview ? `«${entry.preview}»` : "Sin texto: solo se auditó el archivo adjunto."}</p>
   <p className="history-meta">{entry.signals} señal(es) comprobada(s) · confianza {entry.confidence} · {entry.checksRun}/{entry.checksTotal} comprobaciones{entry.hadAttachments ? " · con adjuntos" : ""}{entry.agents.length ? ` · ${entry.agents.map(id => AGENT_NAMES[id] ?? id).join(" · ")}` : ""}</p>
   {entry.topSignals.length ? <p className="history-signals">{entry.topSignals.join(" · ")}</p> : null}
  </div>
 </li>;
}
export default function Dashboard() {
 const [kind, setKind] = useState<AgentKind>("message"); const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [availability, setAvailability] = useState("Comprobando");
 const [outcome, setOutcome] = useState<AnalysisResult | null>(null);
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
 useEffect(() => { void initializeLocalDebug().catch(() => {}).finally(() => setConfigured(isConfigured())); void localAvailability().then(setAvailability); }, []);
 // Se lee después del montaje: en el servidor no hay `localStorage` y el
 // historial guardado no debe formar parte del HTML renderizado.
 useEffect(() => {
  const store = browserStorage();
  if (!store) return;
  let allowed = false;
  try { allowed = store.getItem(HISTORY_CONSENT_KEY) === "1"; } catch { allowed = false; }
  if (!allowed) return;
  setKeepHistory(true);
  setHistory(loadStoredHistory(store));
 }, []);
 /** Guarda el resultado del análisis, nunca el contenido completo. */
 const record = (result: AnalysisResult, analysed: string, attachments: boolean) => {
  const entry = summarize({ kind, text: analysed, hadAttachments: attachments, risk: result.risk, contributing: result.contributing, source: result.source }, newId());
  setHistory(previous => { const next = appendHistory(previous, entry); if (keepHistory) saveStoredHistory(browserStorage(), next); return next; });
 };
 const allowHistory = (value: boolean) => {
  setKeepHistory(value);
  const store = browserStorage();
  if (!store) return;
  try { if (value) store.setItem(HISTORY_CONSENT_KEY, "1"); else store.removeItem(HISTORY_CONSENT_KEY); } catch { /* sin almacenamiento el historial se queda en memoria */ }
  if (value) saveStoredHistory(store, history); else clearStoredHistory(store);
 };
 const forgetHistory = () => { setHistory([]); clearStoredHistory(browserStorage()); };
 const clearResult = () => { setOutcome(null); setError(""); };
 // Al cambiar de tipo se libera el audio: solo CAMAZOTZ lo usa y mantenerlo en
 // memoria sin que la interfaz lo muestre sería guardarlo a espaldas de la persona.
 const dropAudio = () => { if (audio) releaseAudio(audio); setAudio(null); setAudioConsent(false); setTranscription(null); };
 /** Carga un caso de demostración. Son textos inventados: ver `data/demo-cases.json`. */
 const loadDemo = (demo: DemoCase) => { const next = demo.kind as AgentKind; setKind(next); if (next !== "transcripcion") dropAudio(); setInput(demo.text); clearResult(); };
 const submit = async () => {
  if (busy) return;
  setBusy(true); setError(""); setOutcome(null);
  try {
   // 1. Transcripción, solo si hay audio. El estado se conserva tal cual: sin
   //    motor o sin consentimiento queda «pendiente» y no se inventa texto.
   const mayTranscribe = Boolean(consent && audioConsent && configured);
   let state: Transcription | null = null;
   if (audio) {
    state = await transcribeAudio(audio, { consent: mayTranscribe, generate: mayTranscribe ? modelTranscriber : undefined });
   }
   setTranscription(state);
   // 2. El texto analizado es lo que escribió la persona y, si existe, la
   //    transcripción automática, señalada como tal para no pasar por cita.
   const recognised = state?.status === "disponible" && state.text ? state.text : "";
   const text = kind === "url" ? input : [input.trim(), recognised && `[Transcripción automática del audio adjunto]\n${recognised}`].filter(Boolean).join("\n\n");
   const payload = {
    kind, text,
    images: images.map(image => ({ mimeType: image.mimeType, data: image.base64, name: image.name, size: image.size, width: image.width, height: image.height })),
    audio: audio ? { name: audio.name, mimeType: audio.mimeType, size: audio.size, durationSeconds: audio.durationSeconds } : null,
    transcription: audio ? (state ?? TRANSCRIPTION_PENDING) : undefined,
   };
   const attachments = Boolean(images.length || audio);
   // Sin consentimiento o sin configuración, la auditoría local se ejecuta igual.
   if (!consent || !configured) { const local = analyzeLocally(payload); setOutcome(local); record(local, text, attachments); return; }
   void getServices().model.initializeDeviceModel().catch(() => {});
   const result = await analyze(payload);
   setOutcome(result); record(result, text, attachments);
  } catch (e) { setError(explainError(e)); } finally { setBusy(false); }
 };
 const go = (s: Section) => { setSection(s); setSelected(null); setMenu(false); };
 const nav: { id: Section; label: string; icon: typeof Shield }[] = [{id:"inicio",label:"Panel principal",icon:LayoutDashboard},{id:"analizar",label:"Nuevo análisis",icon:ScanLine},{id:"agentes",label:"Agentes IA",icon:Sparkles},{id:"historial",label:"Historial",icon:Clock3},{id:"privacidad",label:"Privacidad",icon:Fingerprint}];
 return <div className="shell"><aside className={`sidebar ${menu ? "open" : ""}`}><div className="brand"><img src="/xibalba-logo.jpg" alt="XIBALBÁ AI, logo oficial"/><span>INTELIGENCIA DE PROTECCIÓN</span></div><div className="side-label">MENÚ PRINCIPAL</div><nav>{nav.map(({id,label,icon: Icon}) => <button key={id} className={section===id ? "nav active" : "nav"} onClick={() => go(id)}><Icon size={17}/>{label}{section===id && <span className="nav-dot"/>}</button>)}</nav><div className="side-bottom"><div className="side-card"><ShieldCheck size={22}/><strong>Tu seguridad importa</strong><p>Antes de compartir información, verifica las señales.</p><button onClick={() => go("privacidad")}>Conocer más <ArrowRight size={13}/></button></div><div className="side-footer"><span className="status-dot"/> MVP <span>·</span> AUDITORÍA LOCAL ACTIVA</div></div></aside>
 <main><header className="topbar"><button className="menu-button" aria-label={menu ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button><div className="breadcrumb">ESPACIO DE PROTECCIÓN <span>/</span> <b>{nav.find(n=>n.id===section)?.label}</b></div><div className="top-actions"><span className="system-status"><i/> {outcome?.source ? `IA · ${describeSource(outcome.source).toUpperCase()}` : configured ? "IA · SIN VERIFICAR" : "IA · SIN CONFIGURAR"}</span><button className="language" aria-label="Idioma actual: español"><Globe2 size={15}/> ES <ChevronDown size={13}/></button><span className="avatar"><Shield size={16}/></span></div></header>
 <div className="content">{section === "inicio" && <><div className="welcome"><div><div className="eyebrow"><span/> CENTRO DE INTELIGENCIA DIGITAL</div><h1>Tu tranquilidad comienza <em>aquí.</em></h1><p>Detecta señales de fraude y toma decisiones con confianza.</p></div><div className="date-tag"><ShieldCheck size={16}/> TU CENTRO DE PROTECCIÓN</div></div>
 <section className="hero"><div className="hero-copy"><div className="hero-kicker"><span className="pulse"/> PROTECCIÓN INTELIGENTE</div><h2>Ante la duda,<br/><em>analiza primero.</em></h2><p>Un mensaje, una llamada o una oferta sospechosa. Nuestros agentes están diseñados para ayudarte a identificar las señales.</p><button className="primary" onClick={() => go("analizar")}><ScanLine size={17}/> Iniciar análisis <ArrowRight size={16}/></button><div className="hero-note"><LockKeyhole size={13}/> Diseñado pensando en tu privacidad</div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><img src="/xibalba-logo.jpg" alt="Logo oficial de XIBALBÁ AI"/></div><div className="hero-index">01 / 05 <span>✦</span></div></section>
 <div className="section-title"><div><div className="eyebrow muted">TU EQUIPO DE PROTECCIÓN</div><h2>Conoce a tus guardianes <span>✦</span></h2><p>Inteligencia especializada para cada tipo de amenaza.</p></div><button className="text-link" onClick={() => go("agentes")}>Ver todos los agentes <ArrowRight size={15}/></button></div><div className="agent-grid">{agents.map((a, i) => {const Icon=icons[a.icon]; return <button className="agent-card" key={a.id} onClick={() => {setSection("agentes");setSelected(a)}}><div className="agent-top"><div className={`agent-icon ${a.color}`}><Icon size={22}/></div><span>0{i+1}</span></div><h3>{a.name}</h3><div className="role">{a.role}</div><p>{a.description}</p><div className="card-link">CONOCER AGENTE <ArrowRight size={14}/></div></button>})}</div>
 <div className="lower-grid"><section className="panel activity"><div className="panel-head"><div><div className="eyebrow muted">ACTIVIDAD RECIENTE</div><h2>Tu historial de análisis</h2></div><button className="text-link" onClick={()=>go("historial")}>Ver historial <ArrowRight size={14}/></button></div>{history.length ? <ul className="history-list compact">{history.slice(0,3).map(entry => <HistoryRow key={entry.id} entry={entry}/>)}</ul> : <div className="empty-row"><div className="empty-icon"><Clock3 size={20}/></div><div><strong>Aún no hay análisis en esta sesión</strong><p>Cada análisis que hagas aparecerá aquí con su semáforo. El contenido no se guarda: solo el resultado.</p></div><ArrowRight size={17}/></div>}</section><section className="panel privacy-panel"><div className="privacy-icon"><Fingerprint size={25}/></div><div><div className="eyebrow muted">DISEÑADO PARA PROTEGERTE</div><h2>Tu privacidad es primero.</h2><p>El historial guarda el resultado, no el contenido, y solo se conserva en tu dispositivo si tú lo autorizas.</p><button className="text-link" onClick={()=>go("privacidad")}>Más sobre privacidad <ArrowRight size={14}/></button></div></section></div></>}
 {section === "analizar" && <div className="inner-page"><div className="eyebrow"><span/> CENTRO DE ANÁLISIS</div><h1>Analiza antes de <em>actuar.</em></h1><p className="lead">Pega un mensaje, enlace o transcripción para preparar tu consulta.</p><div className="workspace"><div className="panel form-panel"><div className="panel-head"><div><h2>Nuevo análisis</h2><p>Comparte solo la información necesaria.</p></div><ScanLine className="cyan-text" size={22}/></div><label htmlFor="kind">TIPO DE CONTENIDO</label><select id="kind" disabled={busy} value={kind} onChange={e=>{const next=e.target.value as AgentKind;setKind(next);if(next!=="transcripcion")dropAudio();clearResult();}}><option value="message">Mensaje · IXBALANQUÉ</option><option value="url">URL · HUN CAMÉ</option><option value="transcripcion">Llamada o transcripción · CAMAZOTZ</option><option value="financiero">Depósito, crédito o inversión · VUCUB CAMÉ</option></select><p className="notice">{kind==="transcripcion"?"Escribe lo que recuerdes de la llamada o adjunta el audio. EL GUARDIÁN añadirá otros agentes si el texto menciona dinero, cuentas o enlaces.":kind==="financiero"?"Pega el mensaje con la cuenta, el cobro, el crédito o la oferta de inversión. La CLABE y la tarjeta se verifican con su dígito de control, lo que no demuestra que la cuenta sea legítima ni de quién es.":"EL GUARDIÁN elige los agentes según lo que encuentre en el contenido, no solo según este tipo."}</p><div className="field-label">CASOS DE DEMOSTRACIÓN</div><div className="demo-row">{/* `aria-label` repite el texto visible a propósito: sin él, el nombre
     accesible del botón pasaba a ser el `title` —el resultado esperado— y
     quien usa lector de pantalla oía la explicación en lugar del nombre
     del caso. El `title` se queda para la ayuda emergente al pasar el ratón. */}
{demoCases.map(demo => <button key={demo.id} type="button" className="demo-chip" disabled={busy} aria-label={demo.title} title={demo.expect} onClick={()=>loadDemo(demo)}><FlaskConical size={13}/> {demo.title}</button>)}</div><p className="notice">Textos inventados para la demostración. Ninguna cuenta, teléfono ni dominio corresponde a algo real; los enlaces usan <code>example.com</code>, reservado para documentación.</p><label htmlFor="content">CONTENIDO A REVISAR</label><textarea id="content" disabled={busy} value={input} onChange={e=>{setInput(e.target.value);clearResult();}} placeholder={kind==="url"?"https://ejemplo-sospechoso.com/..." : kind==="transcripcion"?"«Buenas tardes, le llamo del departamento de seguridad de su banco…»" : kind==="financiero"?"«Deposita a esta CLABE y en 48 horas recibes el triple…»" : "Pega aquí un mensaje o enlace sospechoso..."}/><label htmlFor="photo">IMÁGENES OPCIONALES · JPEG O PNG</label><ImageAttachments images={images} onChange={next=>{setImages(next);clearResult();}} disabled={busy} onError={setError}/>{kind==="transcripcion" && <><label htmlFor="audio">AUDIO OPCIONAL DE LA LLAMADA</label><AudioAttachment audio={audio} transcription={transcription} onChange={next=>{setAudio(next);setTranscription(null);clearResult();}} disabled={busy} onError={setError}/></>}<div className="form-foot"><span><LockKeyhole size={14}/> El historial guarda el resultado, no el contenido.</span><span>{input.length} caracteres</span></div><label className="consent"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);clearResult();}}/> Acepto que el contenido y las imágenes puedan enviarse a Firebase y Gemini para la interpretación de IA cuando la inferencia local no esté disponible. Sin esta casilla solo se ejecuta la auditoría local.</label>{audio && <label className="consent"><input type="checkbox" checked={audioConsent} onChange={e=>{setAudioConsent(e.target.checked);setTranscription(null);clearResult();}}/> Acepto además que este audio se envíe al modelo para intentar transcribirlo. Confirmo que participé en la conversación y que puedo compartir su contenido. Sin esta casilla el audio no sale del dispositivo y la transcripción queda pendiente.</label>}<button className="primary" disabled={busy || (!input.trim() && !audio)} onClick={submit}><ScanLine size={17}/> {busy ? "Analizando…" : consent && configured ? "Analizar contenido" : "Auditar solo en este dispositivo"} <ArrowRight size={16}/></button><p className="notice">{!configured ? "Firebase y App Check no están configurados: la interpretación de IA no está disponible y solo se ejecutará la auditoría local." : consent ? "La conexión se verificará al completar una solicitud." : "La auditoría determinista se ejecuta en el dispositivo sin consentimiento adicional."} En el historial solo se guarda el resultado del análisis.</p>{error && <p role="alert" className="notice error-notice">{error}</p>}</div><div className="panel result-panel" aria-live="polite">
  <div className="eyebrow">{outcome ? `AGENTES · ${describeAgents(outcome.contributing.length ? outcome.contributing : outcome.selection.agents)}` : "RESULTADO"}</div>
  {outcome ? <><RiskVerdict risk={outcome.risk}/><ul className="agent-reasons">{outcome.selection.agents.map(id=><li key={id}><b>{AGENT_NAMES[id]}</b> · {outcome.selection.reasons[id]}{id !== "guardian" && !outcome.contributing.includes(id) && " No encontró nada que aportar en este contenido."}</li>)}</ul><EvidenceList audit={outcome.audit} assessment={outcome.assessment} aiError={outcome.aiError}/></>
   : <><div className="result-icon"><ShieldAlert size={30}/></div><h2 className="risk-indicator risk-gris">● Sin evaluación concluyente</h2><p>Aquí verás el semáforo, el nivel de riesgo, la confianza de la evaluación, la cobertura de la auditoría y cada evidencia separada por origen.</p><div className="risk-pills"><span>VERDE</span><span>AMARILLO</span><span>ROJO</span><span>GRIS</span></div></>}
  <div className="inference"><Activity size={16}/> Motor: <b>{describeSource(outcome?.source ?? null).toUpperCase()}</b> · IA local: {availability}</div>
 </div></div><Guardian outcome={outcome} busy={busy} error={error} consent={consent} configured={configured}/></div>}
 {section === "agentes" && <div className="inner-page"><div className="eyebrow"><span/> INTELIGENCIA ESPECIALIZADA</div><h1>Un equipo, <em>cinco guardianes.</em></h1><p className="lead">Cada agente tiene una misión en la prevención de estafas digitales.</p><div className="agent-grid large">{agents.map((a,i)=>{const Icon=icons[a.icon];return <button className={`agent-card ${selected?.id===a.id?"selected":""}`} key={a.id} onClick={()=>setSelected(a)}><div className="agent-top"><div className={`agent-icon ${a.color}`}><Icon size={22}/></div><span>0{i+1}</span></div><h3>{a.name}</h3><div className="role">{a.role}</div><p>{a.description}</p><div className="card-link">VER MISIÓN <ArrowRight size={14}/></div></button>})}</div>{selected && <div className="panel detail"><div><div className="eyebrow muted">MISIÓN DEL AGENTE</div><h2>{selected.name}</h2><p>{selected.description}</p><h3 className="detail-sub"><ShieldCheck size={15}/> Lo que hace hoy</h3><p>{selected.works}</p><h3 className="detail-sub"><CircleHelp size={15}/> Lo que no puede hacer</h3><p>{selected.pending}</p></div><button className="text-link" onClick={()=>go("analizar")}>Ir al área de análisis <ArrowRight size={15}/></button></div>}</div>}
 {section === "historial" && <div className="inner-page"><div className="eyebrow"><span/> ACTIVIDAD RECIENTE</div><h1>Tu <em>historial.</em></h1><p className="lead">El resultado de tus análisis, no su contenido. Se conservan los {HISTORY_LIMIT} más recientes.</p>
 <div className="panel history-panel"><div className="panel-head"><div><h2>{history.length ? `${history.length} análisis en esta sesión` : "Aún no hay análisis"}</h2><p>{keepHistory ? "Se guarda en este navegador, en tu dispositivo. Nunca se envía a ningún servidor." : "Se conserva mientras esta pestaña esté abierta. Al cerrarla se pierde."}</p></div>{history.length ? <button className="text-link danger-link" onClick={forgetHistory}><Trash2 size={14}/> Borrar historial</button> : null}</div>
  <label className="consent"><input type="checkbox" checked={keepHistory} onChange={e=>allowHistory(e.target.checked)}/> Guardar el historial en este navegador para encontrarlo la próxima vez. Se almacena solo en tu dispositivo: fecha, tipo, semáforo, nivel, confianza, cobertura y las señales principales, más un fragmento corto del texto con todo número de cuatro o más dígitos enmascarado. Al desmarcar esta casilla se borra lo guardado.</label>
  {history.length ? <ul className="history-list">{history.map(entry => <HistoryRow key={entry.id} entry={entry}/>)}</ul>
   : <div className="empty-row"><div className="empty-icon"><Clock3 size={20}/></div><div><strong>Nada registrado todavía</strong><p>Haz un análisis y su resultado aparecerá aquí.</p></div><button className="text-link" onClick={()=>go("analizar")}>Nuevo análisis <ArrowRight size={15}/></button></div>}
  <p className="notice">No se guarda ninguna imagen ni ningún audio, ni el texto completo. El historial por usuario en la nube requiere Firebase Authentication y todavía no está implementado: las reglas de Firestore siguen denegando todo acceso.</p></div></div>}
 {section === "privacidad" && <div className="inner-page"><div className="eyebrow"><span/> TU INFORMACIÓN IMPORTA</div><h1>Privacidad por <em>diseño.</em></h1><p className="lead">La confianza empieza con claridad sobre el uso de tu información.</p><div className="privacy-grid"><div className="panel info-card"><LockKeyhole/><h2>Control de información</h2><p>El historial guarda el resultado del análisis, no el contenido: un fragmento corto con los números enmascarados, el semáforo y las señales. Nada de eso sale de tu dispositivo. Con tu consentimiento, el contenido puede procesarse en el dispositivo o enviarse a Firebase y Gemini en la nube para la interpretación de IA.</p></div><div className="panel info-card"><Eye/><h2>Transparencia</h2><p>La inferencia y App Check requieren configuración y una solicitud exitosa para verificarse; hasta entonces el indicador dice «sin verificar». El historial por usuario en la nube no está implementado y las reglas de Firestore deniegan todo.</p></div><div className="panel info-card"><BookOpen/><h2>Uso responsable</h2><p>La plataforma no accede a llamadas, WhatsApp ni redes sociales. Solo se prevé analizar contenido proporcionado voluntariamente.</p></div></div></div>}
 <footer><span>© 2026 XIBALBÁ AI <i>✦</i> INTELIGENCIA PARA PROTEGERTE</span><span>HECHO PARA UN MUNDO MÁS SEGURO <ArrowDownLeft size={13}/></span></footer></div></main></div>;
}


