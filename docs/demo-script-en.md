# International demo script (English) · ~4:00

Format: screen recording of the real application with voice-over. Nothing
here is staged data presented as a live result — every claim below matches
code that exists and was verified in this session (`tsc --noEmit`, `eslint`,
`npm test` 214/214, `next build`, and a manual pass in a real browser).
Timings are a guide, not a contract: official hackathon duration/format
requirements have not been confirmed yet, so don't lock this to an exact
length before checking them.

Demo cases come from `data/demo-cases.json` (fully synthetic: test card
number, `example.com` domains, 555-range phone numbers — see its own
`note` field) and load with one click from "New analysis" / "Nuevo análisis".

**Before recording:** window at 1440×900, clear history, English selected
from the language switch so the audience sees it happen, not just hears
about it.

---

## 0:00 – 0:20 · The problem

> "A text says your account will be blocked in two hours. A call says they're
> holding your son and dictates an account number. Digital fraud doesn't
> usually fail because of weak technology — it fails because nobody has
> thirty seconds to verify.
>
> XIBALBÁ is thirty seconds, in two languages, from wherever you are."

## 0:20 – 0:45 · Switching language, live

> *(Click the language switch, ES → EN, on any screen.)*
>
> "Spanish and English are both complete — not a partial translation layer.
> The interface, the five agents, the Guardian, results, history and the
> international help directory all switch immediately, and it stays on
> reload."

## 0:45 – 1:05 · Meet the Guardian

> *(Open the Guardian panel. Let it sit in its idle state for a second —
> breathing, blinking, eyes tracking the cursor.)*
>
> "This is EL GUARDIÁN: a Maya jaguar built in obsidian, jade and turquoise.
> It isn't a video loop — every state you'll see corresponds to something
> actually happening in the system: idle, listening, thinking, speaking,
> alert, and 'secure.' If the microphone isn't open, it never claims to be
> listening — that's enforced in code, not just in the script."
>
> *(Press the microphone button if the browser supports Web Speech API; if
> not, type the question instead and say so on camera.)*
>
> "You can ask it about an investigation in your own words. If voice input
> isn't available in this browser, text always is — nothing here requires
> voice to work."

## 1:05 – 2:00 · The core demonstration: a real analysis

> *(New analysis → case "Llamada: 'no cuelgue' y una cuenta dictada" →
> "Analyze on this device only." No cloud consent: this runs locally.)*
>
> "This is a virtual-kidnapping call. Watch what happens without sending
> anything to a server."
>
> *(Point at the verdict light.)*
>
> "Red. High confidence. Eight confirmed signals out of forty-six checks
> actually executed — not a fixed number, the real count for this input.
>
> Two are critical: *insists you don't hang up or tell anyone*, and *claims
> to be holding a family member*. EL GUARDIÁN called CAMAZOTZ for the voice
> signals, then also called VUCUB CAMÉ the moment it found a bank account in
> the transcript — and it explains why it did, in the agent panel."
>
> *(Scroll to the evidence "The account does not belong to the bank the
> message names.")*
>
> "Here's something no human ear catches on a call: the voice says one bank,
> and the account's own routing digits resolve to a different one. The
> first digits of a Mexican CLABE identify the institution, and the check
> digit is verified arithmetically. The number is shown masked — XIBALBÁ
> never stores it in full."

## 2:00 – 2:30 · What it refuses to claim

> *(Point at the limitation text attached to that same evidence, then
> "Pending checks.")*
>
> "Every piece of evidence carries its own limitation, written plainly:
> *this is not proof of fraud by itself — someone can legitimately ask for a
> deposit to a different bank.*
>
> And below it, what was **not** verified: who called, from what number,
> who owns the account. That's why a phone call can never show green here.
> A tool that overstates what it found trains people to stop trusting it."
>
> *(Load "Control: un mensaje normal" and analyze.)*
>
> "A normal message doesn't turn red — it shows gray, 'not enough
> information.' Green only appears when the content is fully exhausted and
> AI interpretation agrees. Absence of signals is never treated as proof of
> safety."

## 2:30 – 3:00 · The Help Center and international directory

> *(Click the permanent "Urgent help" button, visible on every screen, then
> open the Global Shield.)*
>
> "This button is real and always on screen — not a mockup. It opens
> contextual guidance by incident type: financial fraud, phishing,
> extortion, impersonation, cybercrime. Pick one and you get concrete next
> steps, like changing a password through the real site instead of a link,
> or who not to pay a second time."
>
> *(Select a country — Mexico, the US or the UK are the ones with two
> independent sources behind them today — and show the official agency
> entry.)*
>
> "Every contact here ships with its real source and the date it was
> checked. A country without verified data shows 'pending,' honestly — it
> is never hidden or filled in with something invented. Coverage today is
> five countries, three fully verified, two still under review; that's a
> known limitation, not a secret one."

## 3:00 – 3:25 · Privacy and history

> *(Menu → History.)*
>
> "History stores the **result**, not the content: the verdict, the
> signals, and a short excerpt with every number masked. It lives in your
> browser, only if you opt in with this checkbox.
>
> The microphone is never used in the background. Calls are never recorded.
> Nothing you didn't paste yourself is read."

## 3:25 – 4:00 · Technical close

> *(Main panel, logo.)*
>
> "Next.js 15, React 19, hybrid inference through Firebase AI Logic —
> on-device first, cloud as fallback — App Check verified server-side
> against Firebase's real JWKS, and 214 automated tests passing alongside a
> clean production build.
>
> XIBALBÁ doesn't tell you that you're safe. It tells you what it found,
> what it could not verify, and lets you decide with that in hand."

---

## Notes for whoever records this

- **Don't say** "detects fraud" or "protects you from scams": the tool
  surfaces signals in content you give it. Keep that register if you
  improvise.
- If App Check / Gemini aren't configured in the environment you record on,
  the button will read "Analyze on this device only" and the badge "AI ·
  NOT CONFIGURED." **That's fine for this script** — it proves the
  deterministic core doesn't depend on the cloud. Say so on camera instead
  of hiding it; see `docs/despliegue.md` for what's needed to light up the
  cloud path.
- Don't promise a specific video length or language requirement to a judge
  before checking the hackathon's own rules — this script is written to be
  trimmed, not to be the one fixed cut.
- If asked about audio transcription: it is only attempted with explicit
  consent, and when no engine is available the status shows "pending" —
  text is never fabricated.
- If asked why only five countries: say it plainly — each entry requires a
  real search with two independent sources before it can be marked
  "verified," and that work is still in progress, country by country.
