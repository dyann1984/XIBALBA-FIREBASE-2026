import test from "node:test";
import assert from "node:assert/strict";
import {
  ACADEMY_LESSONS,
  ACADEMY_PATHS,
  ACADEMY_QUIZ,
  recommendedLessonsFor,
} from "../lib/academy/lessons.ts";

test("XIBALBA Academy tiene contenido diferenciado para las 5 rutas y quiz bilingues", () => {
  assert.equal(ACADEMY_PATHS.length, 5);
  for (const path of ACADEMY_PATHS) {
    const lessons = ACADEMY_LESSONS.filter((l) => l.paths.includes(path.id));
    assert.ok(lessons.length >= 2, `${path.id} debe tener al menos 2 lecciones`);
  }
  for (const lesson of ACADEMY_LESSONS) {
    assert.ok(lesson.titleEs && lesson.titleEn && lesson.summaryEs && lesson.summaryEn);
  }
  assert.ok(ACADEMY_QUIZ.length >= 2);
  for (const q of ACADEMY_QUIZ) {
    assert.equal(q.optionsEs.length, q.optionsEn.length);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < q.optionsEs.length);
  }
});

test("recommendedLessonsFor relaciona indicadores reales de fraude con lecciones relevantes", () => {
  const phishing = recommendedLessonsFor(["url-marca-en-subdominio", "urgencia-tiempo"]);
  assert.ok(phishing.some((l) => l.id === "phishing-domain"));

  const extortion = recommendedLessonsFor(["llamada-no-cuelgue"]);
  assert.ok(extortion.some((l) => l.id === "otp-isolation" || l.id === "seniors-grandparent"));
});
