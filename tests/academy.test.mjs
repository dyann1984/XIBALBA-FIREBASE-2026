import test from "node:test";
import assert from "node:assert/strict";
import { ACADEMY_LESSONS, ACADEMY_QUIZ } from "../lib/academy/lessons.ts";

test("XIBALBA Academy contiene lecciones y quiz bilingues completos", () => {
  assert.ok(ACADEMY_LESSONS.length >= 4);
  for (const lesson of ACADEMY_LESSONS) {
    assert.ok(lesson.titleEs && lesson.titleEn && lesson.summaryEs && lesson.summaryEn);
  }
  assert.ok(ACADEMY_QUIZ.length >= 2);
  for (const q of ACADEMY_QUIZ) {
    assert.equal(q.optionsEs.length, q.optionsEn.length);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < q.optionsEs.length);
  }
});
