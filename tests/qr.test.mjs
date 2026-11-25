import test from "node:test";
import assert from "node:assert/strict";
import { auditQrPayload } from "../lib/analysis/qr.ts";

test("auditQrPayload detecta enlaces QR de phishing con marca suplantada", () => {
  const res = auditQrPayload("https://bbva-mx.validacion-de-cuenta.example.com/acceso");
  assert.equal(res.scheme, "url");
  assert.equal(res.risk, "alto");
  assert.ok(res.extractedUrl);
  assert.ok(res.findingsEs.length > 0 && res.findingsEn.length > 0);
});

test("auditQrPayload advierte sobre acortadores y HTTP sin cifrado", () => {
  const shortRes = auditQrPayload("http://bit.ly/demo123");
  assert.equal(shortRes.scheme, "url");
  assert.equal(shortRes.risk, "medio");
  assert.ok(shortRes.findingsEn.some((f) => /shortener|HTTP/i.test(f)));
});

test("auditQrPayload identifica QR de pago UPI/EMVCo y Wi-Fi", () => {
  const pay = auditQrPayload("upi://pay?pa=demo@bank&am=500");
  assert.equal(pay.scheme, "payment");
  assert.equal(pay.risk, "medio");

  const wifi = auditQrPayload("WIFI:T:WPA;S:AirportFree;P:1234;;");
  assert.equal(wifi.scheme, "wifi");
  assert.equal(wifi.risk, "medio");
});
