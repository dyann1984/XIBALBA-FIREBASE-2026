"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, CheckCircle2, GraduationCap, XCircle } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import { ACADEMY_LESSONS, ACADEMY_QUIZ } from "@/lib/academy/lessons";

const STORAGE_KEY = "xibalba-academy-v1";
const PATHS = [
  { id: "children", es: "Niños", en: "Children", lessons: ["phishing-domain", "identity-ai", "qr-traps"] },
  { id: "teens", es: "Adolescentes", en: "Teens", lessons: ["identity-ai", "extortion", "phishing-domain", "qr-traps"] },
  { id: "adults", es: "Adultos", en: "Adults", lessons: ["phishing-domain", "otp-isolation", "qr-traps", "jobs", "extortion"] },
  { id: "seniors", es: "Adultos mayores", en: "Older adults", lessons: ["otp-isolation", "extortion", "identity-ai", "qr-traps"] },
  { id: "business", es: "Empresas", en: "Businesses", lessons: ["phishing-domain", "identity-ai", "jobs", "otp-isolation", "guaranteed-yield"] },
];

export default function Academy({ onTryLab }: { onTryLab: () => void }) {
  const { lang } = useI18n();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const [path, setPath] = useState("adults");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
    if (!active) return;
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (stored && typeof stored === "object") {
        if (Array.isArray(stored.completed)) setCompleted(stored.completed.filter((id: unknown) => typeof id === "string" && ACADEMY_LESSONS.some((lesson) => lesson.id === id)));
        if (stored.answers && typeof stored.answers === "object") setAnswers(stored.answers);
        if (PATHS.some((item) => item.id === stored.path)) setPath(stored.path);
      }
    } catch { /* Storage is optional. */ }
    setLoaded(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed, answers, path })); } catch { /* Session remains usable. */ }
  }, [loaded, completed, answers, path]);
  const answeredCount = Object.keys(answers).length;
  const correctCount = ACADEMY_QUIZ.filter((q) => answers[q.id] === q.correctIndex).length;
  const selectedPath = PATHS.find((item) => item.id === path) ?? PATHS[0];
  const xp = completed.length * 10 + correctCount * 20;
  const diploma = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(26);
    doc.text("XIBALBÁ ACADEMY", 148, 45, { align: "center" });
    doc.setFontSize(18);
    doc.text(lang === "en" ? "Certificate of participation" : "Diploma de participación", 148, 75, { align: "center" });
    doc.setFontSize(12);
    doc.text(lang === "en" ? `Learning path: ${selectedPath.en}` : `Ruta de aprendizaje: ${selectedPath.es}`, 148, 100, { align: "center" });
    doc.text(lang === "en" ? `${completed.length} lessons marked complete; quiz ${correctCount}/${ACADEMY_QUIZ.length}.` : `${completed.length} lecciones completadas; evaluación ${correctCount}/${ACADEMY_QUIZ.length}.`, 148, 115, { align: "center" });
    doc.text(lang === "en" ? "Participation only — not an official certification." : "Solo participación; no constituye una certificación oficial.", 148, 145, { align: "center" });
    doc.save("xibalba-academy.pdf");
  };

  return (
    <div className="academy-view">
      <section className="academy-card">
        <label htmlFor="academy-path">{lang === "en" ? "Learning path" : "Ruta de aprendizaje"}</label>{" "}
        <select id="academy-path" value={path} onChange={(event) => setPath(event.target.value)}>
          {PATHS.map((item) => <option key={item.id} value={item.id}>{lang === "en" ? item.en : item.es}</option>)}
        </select>
        <p>{xp} XP · {lang === "en" ? "Level" : "Nivel"} {1 + Math.floor(xp / 50)} · {completed.length >= 3 ? (lang === "en" ? "Badge: Guardian learner" : "Insignia: aprendiz del Guardián") : (lang === "en" ? "Complete 3 lessons to earn a badge" : "Completa 3 lecciones para obtener una insignia")}</p>
        <p className="notice">{lang === "en" ? "Guardian: pause, verify through a trusted channel, and never share a verification code." : "Guardián: detente, verifica por un canal confiable y nunca compartas un código de verificación."}</p>
        <button type="button" className="export-btn" onClick={() => { if (window.confirm(lang === "en" ? "Reset your Academy progress on this device?" : "¿Reiniciar el progreso de Academy en este dispositivo?")) { setCompleted([]); setAnswers({}); } }}>{lang === "en" ? "Reset progress" : "Reiniciar progreso"}</button>{" "}
        {selectedPath.lessons.every((id) => completed.includes(id)) && answeredCount === ACADEMY_QUIZ.length && <button type="button" className="export-btn" onClick={() => void diploma()}>{lang === "en" ? "Download participation diploma" : "Descargar diploma de participación"}</button>}
      </section>
      <div className="academy-grid">
        {ACADEMY_LESSONS.filter((lesson) => selectedPath.lessons.includes(lesson.id)).map((lesson) => (
          <article key={lesson.id} className="academy-card">
            <div className="eyebrow">{lesson.agent}</div>
            <h3>{lang === "en" ? lesson.titleEn : lesson.titleEs}</h3>
            <p>{lang === "en" ? lesson.summaryEn : lesson.summaryEs}</p>
            <small>
              <b>{lang === "en" ? "Red flag:" : "Señal clave:"}</b>{" "}
              {lang === "en" ? lesson.redFlagEn : lesson.redFlagEs}
            </small>
            <p><button type="button" className="export-btn" onClick={() => setCompleted((prev) => prev.includes(lesson.id) ? prev.filter((id) => id !== lesson.id) : [...prev, lesson.id])}>{completed.includes(lesson.id) ? (lang === "en" ? "Completed ✓" : "Completada ✓") : (lang === "en" ? "Mark complete" : "Marcar completada")}</button></p>
          </article>
        ))}
      </div>

      <section
        className="academy-panel"
        aria-label={lang === "en" ? "XIBALBÁ Academy quick quiz" : "Cuestionario rápido de XIBALBÁ Academy"}
      >
        <div className="sos-head">
          <div>
            <div className="eyebrow">
              <GraduationCap size={14} /> XIBALBÁ ACADEMY
            </div>
            <h3>
              {lang === "en" ? "Practice: spot the scam" : "Práctica: detecta el engaño"}
            </h3>
          </div>
          <span className="sos-progress">
            <BookOpenCheck size={14} /> {correctCount}/{ACADEMY_QUIZ.length}
          </span>
        </div>

        {ACADEMY_QUIZ.map((q) => {
          const picked = answers[q.id];
          const options = lang === "en" ? q.optionsEn : q.optionsEs;
          const isCorrect = picked === q.correctIndex;
          return (
            <div key={q.id} className="academy-card" style={{ marginTop: 12 }}>
              <strong>{lang === "en" ? q.promptEn : q.promptEs}</strong>
              <div className="academy-quiz-options">
                {options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`academy-opt ${picked === idx ? "selected" : ""}`}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {picked !== undefined && (
                <p className="notice" style={{ marginTop: 8 }}>
                  {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{" "}
                  {lang === "en" ? q.explanationEn : q.explanationEs}
                </p>
              )}
            </div>
          );
        })}

        {answeredCount === ACADEMY_QUIZ.length && (
          <div className="sos-authority">
            <span>
              {lang === "en"
                ? `Completed ${correctCount}/${ACADEMY_QUIZ.length}. Ready to test real cases in the lab.`
                : `Completado ${correctCount}/${ACADEMY_QUIZ.length}. Ya puedes probar casos sintéticos en el laboratorio.`}
            </span>
            <button type="button" className="export-btn" onClick={onTryLab}>
              {lang === "en" ? "Open Forensic Lab" : "Ir al Laboratorio Forense"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
