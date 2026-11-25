"use client";

import { useState } from "react";
import { BookOpenCheck, CheckCircle2, GraduationCap, XCircle } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import { ACADEMY_LESSONS, ACADEMY_QUIZ } from "@/lib/academy/lessons";

export default function Academy({ onTryLab }: { onTryLab: () => void }) {
  const { lang } = useI18n();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answeredCount = Object.keys(answers).length;
  const correctCount = ACADEMY_QUIZ.filter((q) => answers[q.id] === q.correctIndex).length;

  return (
    <div className="academy-view">
      <div className="academy-grid">
        {ACADEMY_LESSONS.map((lesson) => (
          <article key={lesson.id} className="academy-card">
            <div className="eyebrow">{lesson.agent}</div>
            <h3>{lang === "en" ? lesson.titleEn : lesson.titleEs}</h3>
            <p>{lang === "en" ? lesson.summaryEn : lesson.summaryEs}</p>
            <small>
              <b>{lang === "en" ? "Red flag:" : "Señal clave:"}</b>{" "}
              {lang === "en" ? lesson.redFlagEn : lesson.redFlagEs}
            </small>
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
