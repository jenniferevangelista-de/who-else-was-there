// Ghost Hunt: Who Else Was There? The story, one screen at a time.
import { buildEvidence, validationRuns, heldBreaths, pulseJumps } from "../../src/evidence.js";
import { answer, reading, QUESTIONS, spiritFor, SPIRIT_KINDS, roomEvidence } from "../../src/spirit.js";
import { sampleScans, SAMPLE_CASE } from "../../src/sample.js";
import { sampleMonth, monthTotals, NIGHT_LABEL } from "../../src/nights.js";
import { createScope, scopeHTML } from "./scope.js";
import { drawScene, marinaFace, shadowFace } from "./scene.js";
import { voice } from "./voice.js";
import { music } from "./music.js";
import { boardHTML, spell } from "./board.js";
import * as presage from "./presage.js";
import { sound } from "./sound.js";
import { L, Lx, getLang, setLang } from "../../src/i18n.js";
import { hoodHTML } from "./hood.js";
import MEASURED from "../../demo/measured.json";

const $ = (s, r = document) => r.querySelector(s);
const ORN = `<svg class="ornament" viewBox="0 0 220 18" aria-hidden="true"><path d="M0 9h86M134 9h86" stroke="currentColor" stroke-width="1"/><path d="M110 2c-6 0-9 4-9 7s3 7 9 7 9-4 9-7-3-7-9-7zM96 9c-4-4-8-4-10 0 2 4 6 4 10 0zM124 9c4-4 8-4 10 0-2 4-6 4-10 0z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="110" cy="9" r="2" fill="currentColor"/></svg>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (t) => `0:${String(Math.floor(t)).padStart(2, "0")}`;
const KIND = {
  living: { name: "A living witness", icon: "img/heart.svg" },
  second_face: { name: "A second face", icon: "img/wisp.svg" },
  no_pulse: { name: "A face with no pulse", icon: "img/heart-still.svg" },
  only_shadow: { name: "A shape with no face", icon: "img/wisp.svg" },
  unreadable: { name: "Too dark to read", icon: "img/wisp.svg" },
  region_alive: { name: "Someone alive in the corner", icon: "img/heart.svg" },
  held_breath: { name: "She held her breath", icon: "img/wisp.svg" },
  pulse_jump: { name: "Her pulse jumped", icon: "img/heart.svg" },
};

const state = {
  mode: "replay", info: null, i: 0, seen: new Set(), hist: [],
  scans: null, evidence: [], video: null, cam: null, live: null, lastExhale: 0, talking: false, consent: false,
};

// ------------------------------------------------------------------ sky
function sky() {
  const s = $("#sky");
  for (let i = 0; i < 70; i++) {
    const d = document.createElement("i"); d.className = "star";
    d.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 4}s`;
    s.append(d);
  }
  for (let i = 0; i < 3; i++) {
    const g = document.createElement("img"); g.src = "img/wisp.svg"; g.className = "drift"; g.alt = "";
    g.style.cssText = `top:${15 + i * 28}%;animation-delay:${-i * 9}s;animation-duration:${26 + i * 6}s`;
    s.append(g);
  }
}
function toast(msg, ms = 2600) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), ms); }

// ------------------------------------------------------------------ camera pill (always visible)
function camUI(on) {
  $("#camPill").classList.toggle("cam-on", on);
  $("#camText").textContent = on ? "Camera on · turn off" : "Camera off";
}
async function cameraOff() {
  if (state.live) { await state.live.stop(); state.live = null; }
  if (state.fakeLive) { clearInterval(state.fakeLive); state.fakeLive = null; }
  camUI(false);
}

// ------------------------------------------------------------------ helpers
const say = (who, text, cites = []) => L(`
  <div class="say ${who}"><img src="img/${who === "xochi" ? "xochi" : who === "bigotes" ? "bigotes" : "luna"}.svg" alt="">
  <div class="bubble"><span class="who">${{ luna: "Luna · the medium", bigotes: "Dr. Bigotes · the skeptic", xochi: "Xochi · the night watch" }[who]}</span>${text}
  ${cites.length ? `<span class="muted" style="font-size:13px"> · cites ${cites.join(", ")}</span>` : ""}</div></div>`);

// "What now?": every step says what can be done next
function nextUp(options, title = "What now?") {
  const box = $("#whatNow");
  box.innerHTML = `<span class="wn-t">${title}</span>` + options.map((o, i) => `<button class="wn ${o.main ? "main" : ""}" data-i="${i}">${o.label}</button>`).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => options[+b.dataset.i].do()));
  box.hidden = false; document.body.classList.add("has-next");
}
function clearNext() { const b = $("#whatNow"); b.hidden = true; b.innerHTML = ""; document.body.classList.remove("has-next"); }
const targetOf = (s) => (typeof s.to === "function" ? s.to() : s.to);
const forward = () => { const s = SCREENS[state.i]; if (s.id === "consent") state.consent = true; const t = targetOf(s); if (t) goTo(t); else go(state.i + 1); };
function goTo(id) {
  if (id === "room" && !state.consent) { state.afterConsent = id; id = "consent"; }   // the rules come before any camera
  go(SCREENS.findIndex((s) => s.id === id));
}

function heartBadge(el, { x, y, bpm, dead, still }) {
  let b = el.querySelector(`[data-badge="${dead ? "dead" : "alive"}"]`);
  if (!b) {
    b = document.createElement("div"); b.dataset.badge = dead ? "dead" : "alive";
    b.className = "badge-heart " + (dead ? "dead" : "alive");
    b.innerHTML = `<img src="img/${dead ? "heart-still" : "heart"}.svg" alt="" style="width:34px;height:34px"><span></span>`;
    el.append(b);
  }
  b.style.left = x * 100 + "%"; b.style.top = (y - 0.1) * 100 + "%";
  b.style.setProperty("--beat", bpm ? `${60 / bpm}s` : "0s");
  b.querySelector("span").textContent = dead ? "0 bpm" : bpm ? `${Math.round(bpm)} bpm` : "…";
  b.querySelector("img").style.animation = !dead && bpm && !still ? `thump ${60 / bpm}s ease-in-out infinite` : "none";
  return b;
}

// ------------------------------------------------------------------ the tape (replay canvas or real video)
function tapeHTML(tools = false) {
  return `<div class="tape" id="tape">
    ${state.mode === "replay" ? `<canvas class="scene" width="1280" height="720"></canvas>` : `<video playsinline muted></video>`}
    <div class="overlay"><div class="rec"><i></i>REC · HALLWAY</div><div class="stamp" id="stamp">NOV 02 · 21:43:00</div>
    <div class="privacy">faces of the living are blurred</div><div class="flashlight" hidden></div></div>
    <button class="torch" title="Flashlight">🔦</button></div>
    <div class="timeline ${tools ? "scrubs" : ""}" id="timeline"><div class="head" id="head"></div></div>
    ${tools ? `<div class="tape-tools" id="tapeTools" hidden><span class="drag-hint">⟷ Drag the marker to move through the recording</span><button class="btn-soft" id="watchAgain">↺ Watch again</button></div>
    <div class="tl-legend" id="tlLegend" hidden></div>` : ""}`;
}
function playTape({ until, onTime, rate = 1 }) {
  // replay: draws the sample scene; live: plays the client's video
  return new Promise((resolve) => {
    const start = performance.now(), from = state.tapeT ?? 0, token = (state.playToken = (state.playToken ?? 0) + 1);
    const cvs = $("#tape canvas"), ctx = cvs?.getContext("2d");
    const step = () => {
      if (token !== state.playToken) { state.playing = false; return resolve(state.tapeT); }   // the marker was grabbed
      const t = state.mode === "replay" ? from + ((performance.now() - start) / 1000) * rate : state.video.currentTime;
      if (ctx) drawScene(ctx, cvs.width, cvs.height, t);
      $("#stamp").textContent = `NOV 02 · 21:43:${String(Math.floor(t)).padStart(2, "0")}`;
      $("#head").style.left = (t / state.duration) * 100 + "%";
      onTime?.(t);
      state.tapeT = t;
      if (t >= until || !document.body.contains($("#tape"))) { state.playing = false; return resolve(t); }
      requestAnimationFrame(step);
    };
    if (state.mode !== "replay") { state.video.currentTime = from; state.video.play(); }
    state.playing = true;
    step();
  }).then((t) => { if (state.video) state.video.pause(); return t; });
}
// the hunter's flashlight: the hallway goes dark and the mouse becomes the beam
function wireTape(el) {
  const tape = $("#tape", el); if (!tape) return;
  const beam = tape.querySelector(".flashlight"), btn = tape.querySelector(".torch");
  btn.addEventListener("click", (e) => { e.stopPropagation(); beam.hidden = !beam.hidden; btn.classList.toggle("on", !beam.hidden); sound.beep(300, 40); });
  tape.addEventListener("mousemove", (e) => {
    const b = tape.getBoundingClientRect();
    const k = screenZoom(tape); beam.style.setProperty("--x", (e.clientX - b.left) / k + "px"); beam.style.setProperty("--y", (e.clientY - b.top) / k + "px");
  });
  // the timeline: press anywhere or drag the marker to move through the recording
  const tl = $("#timeline", el); if (!tl?.classList.contains("scrubs")) return;
  const at = (e) => { const b = tl.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)) * state.duration; };
  let dragging = false;
  tl.addEventListener("pointerdown", (e) => {
    if (!state.tapeDone) return;
    dragging = true; tl.setPointerCapture(e.pointerId); tl.classList.add("grabbed");
    state.playToken = (state.playToken ?? 0) + 1;            // grabbing the marker stops any playback
    if (state.video) state.video.pause();
    showFrame(el, at(e), true);
  });
  tl.addEventListener("pointermove", (e) => { if (dragging) showFrame(el, at(e), true); });
  const drop = () => { if (!dragging) return; dragging = false; tl.classList.remove("grabbed"); showFrame(el, state.tapeT, false); };
  tl.addEventListener("pointerup", drop); tl.addEventListener("pointercancel", drop);
}
/** The reading at second t of the tape: only a recent, confident pulse counts. No reading, no heartbeat. */
function pulseAt(t) {
  const src = state.tapeSrc ?? state.scans?.full ?? sampleScans().full;
  const p = [...src.pulse].reverse().find((q) => q.t <= t && q.conf >= 50);
  return p && t - p.t <= 3.5 ? p.v : null;
}
/** Drive the detector and the heart from second t. They move only while the tape does, at the speed of that second's bpm. */
function beatAt(el, t, moving) {
  const v = pulseAt(t), s = state.tapeScope, bpm = $("#scopeTape [data-bpm]", el), st = $("#scopeTape [data-state]", el);
  heartBadge($("#tape .overlay", el), { ...marinaFace(t), bpm: v ?? undefined, still: !moving });
  if (!s || !bpm) return;
  s.hold(!moving);
  if (v) { s.set(v); bpm.textContent = Math.round(v); st.textContent = moving ? (state.mode === "replay" ? "SAMPLE" : "READING") : "PAUSED"; }
  else { s.idle(); bpm.textContent = "--"; st.textContent = moving ? "NO PULSE YET" : "PAUSED"; }
}
function showFrame(el, t, moving = false) {
  state.tapeT = t;
  const cvs = $("#tape canvas", el);
  if (cvs) drawScene(cvs.getContext("2d"), cvs.width, cvs.height, t);
  if (state.video) state.video.currentTime = t;
  $("#stamp", el).textContent = `NOV 02 · 21:43:${String(Math.floor(t)).padStart(2, "0")}`;
  $("#head", el).style.left = (t / state.duration) * 100 + "%";
  beatAt(el, t, moving);
}

function markTimeline(evidence) {
  const tl = $("#timeline"); if (!tl) return;
  for (const e of evidence) {
    if (e.kind === "living") continue;
    const d = document.createElement("div"); d.className = `tick ${e.kind}`;
    d.style.left = (e.t0 / state.duration) * 100 + "%"; d.style.width = Math.max(0.8, ((e.t1 - e.t0) / state.duration) * 100) + "%";
    d.title = `${e.id} · ${KIND[e.kind].name}`; tl.append(d);
  }
  const leg = $("#tlLegend"); if (!leg) return;
  const NAMES = { second_face: "Two faces in the frame", held_breath: "She held her breath", pulse_jump: "Her pulse jumped", no_pulse: "A face with no pulse", only_shadow: "A shape with no face", unreadable: "Too dark to read", region_alive: "Someone alive in the corner" };
  const items = evidence.filter((e) => NAMES[e.kind]).map((e) => `<span><i class="tick ${e.kind}"></i>${NAMES[e.kind]} <small>${fmt(e.t0)}${e.t1 !== e.t0 ? " to " + fmt(e.t1) : ""}</small></span>`).join("");
  leg.innerHTML = L(`<div class="tl-title">What each part of the bar means</div><div class="tl-items">${items}</div>`);
  leg.hidden = false;
}

// ------------------------------------------------------------------ scanning (real SDK or sample)
async function fullScan(onTick) {
  if (state.mode === "replay") return sampleScans().full;
  return presage.scanVideo(state.video, { onTick });
}
async function regionScan(region, from, to, onTick) {
  if (state.mode === "replay") return { ...sampleScans().regions[0], region };
  return presage.scanVideo(state.video, { region, from, to, onTick });
}

// The sample case runs itself: finds the faces, locks on the one behind her, reads it, and says so at every step.
async function autoScope(el, scope, R, box, ov) {
  const alive = () => document.body.contains(el);
  const msg = (m, pct) => { $("#scanMsg", el).textContent = m; if (pct != null) $("#scanFill", el).style.width = pct + "%"; };
  const place = (t) => { const f = shadowFace(t); Object.assign(box.style, { left: (f.x - R.w / 2) * 100 + "%", top: (f.y - R.h * 0.45) * 100 + "%", width: R.w * 100 + "%", height: R.h * 100 + "%" }); return f; };
  const tape = $("#tape", el), st = $("#scopePoint [data-state]", el), bpm = $("#scopePoint [data-bpm]", el);
  const C = SAMPLE_CASE, until = C.shadowOutAt - 4, from = C.shadowInAt;
  box.style.display = "none"; tape.classList.add("sweeping"); tape.style.cursor = "default";
  st.textContent = "SEARCHING"; msg("The detector is running. Looking for faces in the frame…", 8); sound.beep(520, 90, 0.04);
  await sleep(1700); if (!alive()) return;
  msg("One face with a pulse: Marina. Still looking…", 18); sound.beep(880, 80, 0.05); heartBadge(ov, { ...marinaFace(from + 4), bpm: 74 });
  await sleep(1400); if (!alive()) return;
  tape.classList.remove("sweeping"); place(from + 4); box.style.display = ""; box.classList.add("found"); box.querySelector(".tag").textContent = "second face";
  st.textContent = "LOCKED ON"; msg("A second face, right behind her. Locking the detector on it…", 28); sound.sting();
  await sleep(1500); if (!alive()) return;
  state.tapeT = from; st.textContent = "READING";
  await playTape({ until, rate: 2.4, onTime: (t) => {
    place(t); bpm.textContent = "--";
    const k = (t - from) / (until - from);
    msg(`Analysis running, please wait. Reading its pulse: ${Math.min(100, Math.round(k * 100))}%`, 28 + 72 * k);
    heartBadge(ov, { ...marinaFace(t), bpm: 74 });
  } });
  if (!alive()) return;
  state.scans.regions = [sampleScans().regions[0]];
  state.evidence = buildEvidence(state.scans);
  const verdict = state.evidence.find((e) => e.region), f = place(until);
  scope.flatline(); sound.flat(); $("#scopePoint", el).classList.add("flat"); box.classList.remove("found"); box.classList.add("flat");
  box.querySelector(".tag").textContent = "a face · 0 bpm";
  heartBadge(ov, { x: f.x, y: R.y + R.h + 0.2, dead: true });
  bpm.textContent = "0"; st.textContent = "NO PULSE";
  $("#pointNotes", el).innerHTML = L(`<div class="cliff" style="padding:0"><div class="line" style="font-size:40px">A face.<br><em>0 beats per minute.</em></div>
    <p class="sub">The detector watched it for ${Math.round(verdict.t1 - verdict.t0)} seconds. It never breathed. <b>And it was standing right behind her.</b></p></div>`);
  state.flat = true; updateNav();
  nextUp([{ label: "See all the evidence →", main: true, do: forward }, { label: "↺ Read it again", do: () => go(state.i) }]);
}

// the crew's seats at the board; the mouths are the Witching Hour talking-face overlays
const FACE = {
  xochi: '<g class="jaw" style="transform-origin:120px 137px"><path d="M106 137 Q120 151 134 137 Z" fill="#2a2048" stroke="#2a2048" stroke-width="3" stroke-linejoin="round"/><path d="M114 144 Q120 154 126 144 Z" fill="#ff7a9a"/></g>',
  bigotes: '<g class="jaw" style="transform-origin:120px 134px"><path d="M111 134 Q120 147 129 134 Q120 137 111 134 Z" fill="#2a2048"/><path d="M115 139 Q120 145 125 139 Z" fill="#ff7a9a"/></g>',
  luna: '<defs><radialGradient id="ballpulse"><stop offset="0" stop-color="#e6d4ff" stop-opacity=".95"/><stop offset=".55" stop-color="#a77bff" stop-opacity=".55"/><stop offset="1" stop-color="#a77bff" stop-opacity="0"/></radialGradient></defs><circle class="ball" cx="120" cy="196" r="34" fill="url(#ballpulse)"/>',
};
const seat = (who, name) => `<span class="face ${who}"><img src="img/${who}.svg" alt="${name}"><svg class="talk-layer" viewBox="0 0 240 260" aria-hidden="true">${FACE[who]}</svg></span>`;

// ------------------------------------------------------------------ screens
const SCREENS = [
  { id: "cold", chapter: "Cold open", next: "Meet the crew →", to: "title", html: () => `
    <div class="cliff">
      <canvas class="flatline" id="ecg"></canvas>
      <div class="line" id="c1">Every face in this video has a heartbeat.</div>
      <div class="line" id="c2" style="opacity:0"><em>Except one.</em></div>
      <p class="sub">A ghost hunt where the evidence is a pulse.</p>
    </div>`,
    enter(el) {
      const ecg = createScope($("#ecg", el)); ecg.set(64);
      voice.say("Every face in this video has a heartbeat.");
      setTimeout(() => { if (!document.body.contains(el)) return; ecg.flatline(); sound.flat(); voice.say("Except one."); $("#c2", el).style.cssText = "opacity:1;transition:opacity 1.2s"; }, 3200);
    } },

  { id: "title", chapter: "The crew", next: "Main menu →", to: "menu",
    enter(el) {
      nextUp([{ label: "Main menu →", main: true, do: forward }], "Tap a hunter, or");
      const box = $("#introSay", el);
      el.querySelectorAll("[data-intro]").forEach((m) => {
        const talk = () => { box.innerHTML = say(m.dataset.intro, m.dataset.line); sound.chime(); el.querySelectorAll("[data-intro]").forEach((x) => x.classList.toggle("talking", x === m)); };
        m.addEventListener("click", talk); m.addEventListener("keydown", (e) => e.key === "Enter" && talk());
      });
    },
    html: () => `
    <div style="text-align:center">
            <div class="kicker" style="color:var(--gold);letter-spacing:6px;font-size:16px">GHOST HUNT</div>
      <h1>Who Else <span class="accent">Was There?</span></h1>
      ${ORN}
      <p class="lead center">Three tiny ghost hunters. One new instrument, built on Presage SmartSpectra: it reads a heartbeat from any face in a video.<br>
      Living faces beat. <b style="color:var(--danger)">The ones that don't are the case.</b></p>
      <div class="crew" style="margin-top:22px">
        <div class="member" data-intro="luna" data-line="Quiet… I'm Luna. I open the board, and I believe in everything. Almost." role="button" tabindex="0"><div class="halo"><img src="img/luna.svg" alt="Luna"></div><b>Luna</b><span>the medium · opens the board</span></div>
        <div class="member" data-intro="bigotes" data-line="Dr. Bigotes. I believe in data. Show me a pulse and I'll show you a person." role="button" tabindex="0"><div class="halo"><img src="img/bigotes.svg" alt="Dr. Bigotes"></div><b>Dr. Bigotes</b><span>the skeptic · checks the detector</span></div>
        <div class="member" data-intro="xochi" data-line="I'm Xochi. I keep watch all night and write down only what the detector saw." role="button" tabindex="0"><div class="halo"><img src="img/xochi.svg" alt="Xochi"></div><b>Xochi</b><span>the night watch · writes it down</span></div>
      </div>
      <div id="introSay" style="max-width:640px;margin:14px auto 0;text-align:left"><p class="muted" style="text-align:center">Tap a hunter to say hello.</p></div>
    </div>` },

  { id: "consent", chapter: "Before we hunt", next: "I understand →", to: () => state.afterConsent ?? "menu", html: () => `
    <div class="grid2">
      <div class="card consent">
        <div class="kicker">Before we hunt</div><h2>The rules of the house</h2>
        <ul>
          <li><b>The camera is yours.</b> It turns on only when you press a button, and the pill at the top right turns it off at any moment.</li>
          <li><b>Nothing is recorded.</b> No frames are saved. Readings live in memory and vanish when you close the app.</li>
          <li><b>Faces of the living are blurred</b> on every screen, including yours.</li>
          <li><b>Only bring tapes where everyone agreed to be in them.</b> The detector reads the people in a video, so they get a say.</li>
          <li><b>This is a game, not a medical device.</b> A pulse here is a story clue.</li>
          <li>Presage's SDK runs on this computer; it contacts Presage only to check the app's key. Its usage telemetry is switched off.</li>
        </ul>
      </div>
      <div class="card dark">
        <div class="kicker">The new instrument</div><h2 style="color:var(--mint)">Ghost Detector</h2>
        <p>Point it at a face in a recording. Presage SmartSpectra reads the tiny colour changes a heartbeat makes in the skin.</p>
        ${scopeHTML("scopeDemo")}
        <p class="muted" style="margin-top:12px">Living faces make the line beat. Photos, masks and screens make it lie flat.</p>
      </div>
    </div>`,
    enter(el) { const s = createScope($("#scopeDemo canvas", el)); s.set(68); $("#scopeDemo [data-bpm]", el).textContent = "68"; $("#scopeDemo [data-state]", el).textContent = "DEMO";
      setTimeout(() => { if (!document.body.contains(el)) return; s.flatline(); $("#scopeDemo", el).classList.add("flat"); $("#scopeDemo [data-bpm]", el).textContent = "0"; $("#scopeDemo [data-state]", el).textContent = "PHOTO"; }, 4000); } },

  { id: "case", chapter: "The case", next: "Analyze Marina's video →", to: "tape", html: () => `
    <div class="grid2">
      <div class="card">
        <div class="kicker">Case 01 · The Door · a message from Marina</div>
        <h2>"Something told me to stay."</h2>
        <p class="lead">"It was the night of November 2nd. Bag ready, keys in my hand, coat on. Everything was fine. Then I got to the door and this feeling hit me, so strong I couldn't breathe. <b>Stay home.</b> I took my coat off and I stayed. I live alone, and I saw nothing. But the hallway camera was on. Can you look?"</p>
        <p class="muted">Marina is a character. ${state.mode === "replay" ? "Her tape is drawn for this demo and the readings on the next screens are <b>sample numbers</b>" : "Her tape is staged for this demo with everyone's consent and the readings are measured from it by Presage SmartSpectra"}.</p>
        ${say("luna", "A woman alone, a door she couldn't open. Let's see who else was in that hallway.")}
      </div>
      <div class="card dark" style="text-align:center">
        <img src="img/wisp.svg" alt="" style="width:140px;margin:10px auto;display:block">
        <p class="lead">A voice message from Marina</p>
        <p class="muted">She sent it at 7:12 in the morning, with the video from her hallway camera. The detector will analyze that video next.</p>
        <button class="btn-soft" id="playMsg" style="color:var(--cream)">▶ Hear it again</button>
      </div>
    </div>`,
    enter(el) {
      voice.say(MARINA_LINE);
      $("#playMsg", el).addEventListener("click", () => { voice.clear(); voice.say(MARINA_LINE); });
      nextUp([{ label: "Analyze Marina's video →", main: true, do: forward }, { label: "Main menu", do: () => goTo("menu") }]);
    } },

  { id: "dare", chapter: "Do you dare?", next: "Main menu →", to: "menu", html: () => `
    <div class="dare-wrap">
      <img src="img/wisp.svg" alt="" style="width:110px">
      <div class="cliff" style="padding:6px 0 0"><div class="line">Do you <em>dare?</em></div>
      <p class="sub">That was Marina's hallway. Now try it yourself.</p></div>
      <div class="grid2 dare-cards">
        <div class="card dark">
          <div class="kicker">Bring your own tape</div><h2>Who else was in yours?</h2>
          <p class="muted">The detector reads every face in it, and Luna opens the board. Was it a spirit? The crew will never agree.</p>
          <label class="agree"><input type="checkbox" id="tapeAgree"> Everyone in this recording agreed to be in it and to have it read.</label>
          <label class="btn-main ghost locked-btn" id="ownTapeBtn" style="display:inline-block;margin-top:10px">Choose a video<input type="file" accept="video/*" id="ownTape" class="sr" disabled></label>
        </div>
        <div class="card dark">
          <div class="kicker">Or let it read you</div><h2>Your heart on the table</h2>
          <p class="muted">Your own camera, live and blurred, nothing saved. Ask the room a question and stay very still.</p>
          <button class="btn-main mint" id="goRoom" style="margin-top:10px">Enter the Room</button>
        </div>
      </div>
    </div>`,
    enter(el) {
      voice.say("Do you dare?");
      $("#goRoom", el).addEventListener("click", () => goTo("room"));
      $("#tapeAgree", el).addEventListener("change", (e) => { $("#ownTape", el).disabled = !e.target.checked; $("#ownTapeBtn", el).classList.toggle("locked-btn", !e.target.checked); });
      $("#ownTape", el).addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (!state.liveSdk) return toast("Reading your own tape needs the Presage key on this computer. Add it and reopen the app.", 6000);
        state.ownTape = URL.createObjectURL(f); state.mode = "live"; state.evidence = []; state.scans = null; toast(`Loaded ${f.name}. The detector is reading it.`);
        go(SCREENS.findIndex((s) => s.id === "tape"));
      });
    } },

  { id: "calendar", chapter: "The haunting map", next: "Open November 2 →", to: "case", html: () => {
    const m = sampleMonth(), tot = monthTotals(m);
    const first = (new Date(m[0].date + "T00:00:00Z").getUTCDay() + 6) % 7;   // Monday first
    const icon = (n) => n.kind === "locked" ? "🔒" : n.kind === "empty" ? "<span style='opacity:.7'>☾</span>"
      : [...Array(n.livingFaces)].map(() => '<img src="img/heart.svg" alt="">').join("") + (n.stillFaces ? '<img src="img/heart-still.svg" alt="">' : "");
    return `
    <div class="grid2" style="grid-template-columns:1.5fr 1fr">
      <div class="card dark haunted">
        <div class="kicker">The haunting map · Marina's hallway camera · ${state.mode === "replay" ? "sample month" : "your tapes"}</div>
        <h2>Thirty nights. <span style="color:var(--danger)">Something is getting closer.</span></h2>
        <div class="cal-wrap" id="calWrap"><svg class="scratches" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true"><path d="M40 20l26 90M56 16l24 98M72 18l20 88M300 180l34 96M318 176l30 104M336 182l24 88"/></svg>
        <img class="stalker" id="stalker" src="img/stalker.svg" alt="">
        <div class="cal" style="margin-top:14px">
          ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => `<div class="dow">${d}</div>`).join("")}
          ${'<div></div>'.repeat(first)}
          ${m.map((n) => `<button class="night ${n.kind}" data-date="${n.date}" aria-label="${n.date}: ${NIGHT_LABEL[n.kind]}">
            <span class="d">${+n.date.slice(8)}${n.date.slice(5, 7) === "11" ? "<small style='font-size:12px'> Nov</small>" : ""}</span>
            <span class="faces">${icon(n)}</span>
            ${n.caseId ? '<span class="tag">case 01</span>' : n.date === "2026-11-03" ? '<span class="tag">case 02</span>' : ""}</button>`).join("")}
        </div></div>
        <div class="legend"><span><i style="background:#ffffff14"></i>one living face</span><span><i style="background:#ff86b833"></i>a visitor, alive</span>
          <span><i style="background:#ff668088"></i>a face with no pulse</span><span><i style="background:#ffffff06"></i>nobody</span><span>🔒 not opened yet</span></div>
      </div>
      <div>
        <div class="card dark" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:22px 16px">
          <div class="stat"><b>${tot.opened}</b><span>nights read</span></div>
          <div class="stat"><b>${tot.livingFaces}</b><span>living faces</span></div>
          <div class="stat"><b style="color:var(--danger)">${tot.stillFaces}</b><span>with no pulse</span></div>
        </div>
        <div class="card" style="margin-top:18px" id="nightNote">${say("xochi", "I kept watch every night. Click any night and the detector will analyze it.")}</div>
      </div>
    </div>`; },
    enter(el) {
      const m = sampleMonth();
      // Story art, not data: a figure that glides across the month and stops on the night of the case.
      const cells = [...el.querySelectorAll(".night")], wrap = $("#calWrap", el), stalker = $("#stalker", el);
      const target = cells.findIndex((c) => c.dataset.date === "2026-11-02");
      cells.forEach((c, i) => { c.style.setProperty("--near", Math.max(0, 1 - Math.abs(i - target) / 16).toFixed(2)); });
      const stand = (i) => { const c = cells[i]; stalker.style.left = `${c.offsetLeft + c.offsetWidth / 2}px`; stalker.style.top = `${c.offsetTop + c.offsetHeight}px`; stalker.style.height = `${c.offsetHeight * 1.5}px`; stalker.classList.add("on"); };
      const arrive = () => cells[target].classList.add("arrived");
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setTimeout(() => { stand(target); arrive(); }, 300); }
      else {
        let at = Math.max(0, target - 21);
        setTimeout(() => stand(at), 400);
        const hop = setInterval(() => {
          if (!document.body.contains(el)) return clearInterval(hop);
          at = Math.min(target, at + 3 + Math.floor(Math.random() * 2));
          sound.beep(62, 320, 0.09); stand(at);
          if (at === target) setTimeout(arrive, 1700);
          if (at === target) clearInterval(hop);
        }, 2300);
      }
      const menuOpts = (main) => nextUp([...(main ? [main] : []), { label: "Analyze another night", do: () => { clearNext(); toast("Pick any night on the map."); } }, { label: "Main menu", do: () => goTo("menu") }], "What now?");
      const caseOpt = { label: "Watch the video Marina sent →", main: true, do: () => goTo("case") };
      let busy = false;
      const analyze = async (n, b) => {
        if (busy) return; busy = true; clearNext();
        el.querySelectorAll(".night.sel").forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
        const label = new Date(n.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
        const note = $("#nightNote", el);
        if (n.kind === "locked") {
          note.innerHTML = say("xochi", n.note ?? "Not opened yet."); busy = false; menuOpts(); return;
        }
        note.innerHTML = L(`<div class="scanstat"><div class="msg" id="nMsg">Reading the clip of ${label}…</div><div class="bar"><div class="fill" id="nFill"></div></div></div>`);
        const step = async (m, pct, ms) => { const e = $("#nMsg", el); if (!e) return; e.textContent = L(m); $("#nFill", el).style.width = pct + "%"; sound.beep(600 + pct * 3, 60, 0.03); await sleep(ms); };
        await step(`Reading the clip of ${label}…`, 25, 550);
        await step("Presage is counting the faces…", 60, 700);
        await step("Reading every pulse…", 95, 700);
        if (!document.body.contains(el)) return;
        const bpm = 68 + (parseInt(n.date.slice(8), 10) * 7) % 9;
        const who = n.kind === "no_pulse" ? "luna" : n.kind === "visitor" ? "bigotes" : "xochi";
        const text = n.kind === "no_pulse" ? `${n.note} Two faces. One heartbeat. <b>Who else was there?</b>`
          : n.note ?? (n.kind === "empty" ? "She was out. The hallway stayed dark." : "Just Marina, coming home. One face, one pulse.");
        note.innerHTML = L(`<div class="kicker" style="color:var(--pink-d)">Result · ${label} · sample</div>
          <div class="night-res"><div><b>${n.faces}</b><span>faces</span></div><div><b>${n.livingFaces}</b><span>with a pulse</span></div><div><b style="${n.stillFaces ? "color:var(--danger)" : ""}">${n.stillFaces}</b><span>with no pulse</span></div><div><b>${n.livingFaces ? bpm : "--"}</b><span>bpm</span></div></div>`) + say(who, text);
        if (n.stillFaces) sound.sting();
        busy = false; menuOpts(n.caseId ? caseOpt : null);
      };
      nextUp([{ label: "Open the tape of November 2 →", main: true, do: () => goTo("case") }, { label: "Main menu", do: () => goTo("menu") }], "Click any night to analyze it, or");
      el.querySelectorAll(".night").forEach((b) => b.addEventListener("click", () => analyze(m.find((x) => x.date === b.dataset.date), b)));
      setTimeout(() => el.querySelector('[data-date="2026-11-02"]')?.focus(), 300);
    } },

  { id: "tape", chapter: "The tape", next: "Point the detector →", canNext: () => state.tapeDone, html: () => `
    <div class="grid2">
      <div><div class="an-head"><span class="kicker">Marina's video · November 2 · hallway camera</span><b id="anStatus">Analyzing the video Marina sent…</b></div>${tapeHTML(true)}</div>
      <div>${scopeHTML("scopeTape", "GHOST DETECTOR · WHOLE FRAME")}
        <div class="card" style="margin-top:16px" id="tapeNotes">${say("bigotes", "I'll watch her pulse. Ghosts don't have one, people do.")}</div></div>
    </div>`,
    async enter(el) {
      state.tapeDone = false; state.tapeT = 0; updateNav(); wireTape(el);
      const scope = createScope($("#scopeTape canvas", el));
      state.tapeScope = scope; state.tapeSrc = null;
      if (state.mode !== "replay") {
        state.video = $("#tape video", el); state.video.src = state.ownTape || state.info.caseVideo;
        await new Promise((r) => state.video.addEventListener("loadedmetadata", r, { once: true }));
        state.duration = state.video.duration;
      } else state.duration = SAMPLE_CASE.durationSec;
      $("#scopeTape [data-state]", el).textContent = state.mode === "replay" ? "SAMPLE" : "READING";
      // the tape plays once while the SDK reads the whole frame
      let full = null;
      const scanning = fullScan().then((s) => (full = s)).catch((e) => toast(e.message, 6000));
      const sample = sampleScans().full;
      let warned = false;
      await playTape({
        until: state.duration, rate: state.mode === "replay" ? 1.5 : 1,
        onTime: (t) => {
          const src = full ?? sample;
          state.tapeSrc = src; beatAt(el, t, true);
          const two = src.validation.find((v) => Math.abs(v.t - t) < 0.5)?.code === 2;
          if (two && !warned) {
            warned = true; sound.sting();
            $("#tapeNotes", el).innerHTML = say("bigotes", `Wait. Presage just reported <b>two faces</b> in the frame. At ${fmt(t)}.`) + say("luna", "Marina said she lives alone.");
          }
        },
      });
      await scanning;
      state.scans = { full: full ?? sample, regions: [] };
      if (!document.body.contains(el)) return;
      state.tapeSrc = state.scans.full;
      state.tapeDone = true; updateNav();
      markTimeline(buildEvidence(state.scans));
      beatAt(el, state.tapeT, false);
      $("#tapeTools", el).hidden = false;
      $("#anStatus", el).textContent = "Analysis finished: two faces in the frame, one pulse so far.";
      const replay = async () => {
        state.tapeT = 0;
        await playTape({ until: state.duration, rate: state.mode === "replay" ? 1.5 : 1, onTime: (t) => beatAt(el, t, true) });
        if (document.body.contains(el) && !$("#timeline", el).classList.contains("grabbed")) beatAt(el, state.tapeT, false);
      };
      $("#watchAgain", el).addEventListener("click", replay);
      nextUp([{ label: "↺ Watch the tape again", do: replay }, { label: "Read the second face →", main: true, do: forward }]);
      toast("Tip: drag the marker to look at any second. 🔦 turns on the flashlight.", 4500);
      $("#tapeNotes", el).insertAdjacentHTML("beforeend", L(`<p class="cliff" style="padding:10px 0"><span class="line" style="font-size:34px">Who is the <em>second face</em>?</span></p>`));
    } },

  { id: "point", chapter: "Point the detector", next: "Open the evidence →", canNext: () => state.flat, html: () => `
    <div class="grid2">
      <div><div class="an-head"><span class="kicker">Marina's video · one spot</span><b>Reading the second face on its own</b></div>${tapeHTML()}${state.mode === "replay" ? "" : `<p class="muted">Click the spot you want the detector to read, then press the button.</p>`}</div>
      <div>${scopeHTML("scopePoint", "GHOST DETECTOR · ONE SPOT")}
        <div class="card" style="margin-top:16px" id="pointNotes">${say("xochi", "The detector needs a face to find a heartbeat. Let it work.")}
          ${state.mode === "replay" ? `<div class="scanstat"><div class="msg" id="scanMsg"></div><div class="bar"><div class="fill" id="scanFill"></div></div></div>` : `<button class="btn-main mint" id="scanBtn">Read this spot</button>`}</div></div>
    </div>`,
    enter(el) {
      state.flat = false; updateNav(); wireTape(el);
      state.duration ??= SAMPLE_CASE.durationSec;
      state.scans ??= { full: sampleScans().full, regions: [] };
      const scope = createScope($("#scopePoint canvas", el));
      const R = { ...SAMPLE_CASE.region };
      const tape = $("#tape", el), ov = $("#tape .overlay", el);
      const box = document.createElement("div"); box.className = "scanbox";
      const place = () => Object.assign(box.style, { left: R.x * 100 + "%", top: R.y * 100 + "%", width: R.w * 100 + "%", height: R.h * 100 + "%" });
      box.innerHTML = `<span class="tag">detector target</span>`; place(); ov.append(box);
      tape.addEventListener("click", (e) => {
        const b = tape.getBoundingClientRect();
        R.x = Math.min(1 - R.w, Math.max(0, (e.clientX - b.left) / b.width - R.w / 2));
        R.y = Math.min(1 - R.h, Math.max(0, (e.clientY - b.top) / b.height - R.h / 2)); place();
      });
      tape.style.cursor = "crosshair";
      const cvs = $("#tape canvas", el); if (cvs) drawScene(cvs.getContext("2d"), cvs.width, cvs.height, SAMPLE_CASE.shadowInAt + 4);
      if (state.mode === "replay") { autoScope(el, scope, R, box, ov); return; }
      $("#scanBtn", el).addEventListener("click", async (ev) => {
        ev.target.disabled = true;
        $("#scopePoint [data-state]", el).textContent = "LISTENING";
        // read the spot while the second face was in frame (or the whole tape if the SDK never saw two faces)
        const two = state.mode === "replay" ? null : validationRuns(state.scans.full.validation, 2, 1)[0];
        const from = state.mode === "replay" ? SAMPLE_CASE.shadowInAt : two?.t0 ?? 0;
        const to = state.mode === "replay" ? SAMPLE_CASE.shadowOutAt : two?.t1 ?? state.duration;
        state.tapeT = from;
        let reg;
        const scanning = regionScan({ ...R }, from, to).then((s) => (reg = s)).catch((e) => toast(e.message, 6000));
        await playTape({ until: state.mode === "replay" ? from + 15 : to, onTime: (t) => {
          $("#scopePoint [data-bpm]", el).textContent = "--";
          $("#scopePoint [data-state]", el).textContent = `WATCHED ${Math.round(t - from)} s`;
          heartBadge(ov, { ...marinaFace(t), bpm: 74 });
        } });
        await scanning;
        state.scans.regions = [reg];
        state.evidence = buildEvidence(state.scans);
        const verdict = state.evidence.find((e) => e.region);
        if (verdict?.kind === "no_pulse") {
          scope.flatline(); $("#scopePoint", el).classList.add("flat"); box.classList.add("flat");
          box.querySelector(".tag").textContent = "a face · 0 bpm";
          heartBadge(ov, { x: R.x + R.w / 2, y: R.y + R.h + 0.2, dead: true });
          $("#scopePoint [data-bpm]", el).textContent = "0"; $("#scopePoint [data-state]", el).textContent = "NO PULSE";
          $("#pointNotes", el).innerHTML = `<div class="cliff" style="padding:0"><div class="line" style="font-size:40px">A face.<br><em>0 beats per minute.</em></div>
            <p class="sub">The detector watched it for ${Math.round(verdict.t1 - verdict.t0)} seconds. It never breathed.</p></div>`;
        } else {
          $("#pointNotes", el).innerHTML = say("bigotes", verdict ? `The detector says: ${KIND[verdict.kind].name.toLowerCase()}.` : "Too short to say anything. Try a spot with a face.");
        }
        state.flat = true; updateNav();
      });
    } },

  { id: "locker", chapter: "The evidence", next: "Open the board →", to: "board", html: () => `
    <div class="card dark">
      <div class="kicker">Evidence locker · ${state.mode === "replay" ? "sample numbers, in the shape Presage SmartSpectra reports them" : "every card measured by Presage SmartSpectra"}</div>
      <h2>What the tape says</h2>
      <div class="locker" style="margin-top:18px">${state.evidence.map((e) => `
        <div class="ev ${e.kind}" data-ev="${e.id}" role="button" tabindex="0" title="Show this moment"><span class="id">${e.id}</span>
          <div class="row" style="gap:10px"><img src="${KIND[e.kind].icon}" alt="" style="width:34px"><span class="kind">${KIND[e.kind].name}</span></div>
          <div class="val">${e.value}<small style="font-size:20px"> ${e.unit}</small></div>
          <div class="when">${fmt(e.t0)}${e.t1 !== e.t0 ? " to " + fmt(e.t1) : ""}</div>
          <div class="src">${state.mode === "replay" ? "SAMPLE · " : ""}${e.measuredBy}</div></div>`).join("")}</div>
      <div class="peek" id="peek"><canvas width="640" height="360"></canvas><div id="peekSay">${say("xochi", "Click a card. I will show you that moment of the tape, and the crew will argue about it.")}</div></div>
    </div>`,
    enter(el) {
      const cvs = $("#peek canvas", el), ctx = cvs.getContext("2d");
      const NOTES = {
        living: ["xochi", "Marina, alive the whole time. This is the line every other card is compared to."],
        second_face: ["luna", "Here. The SDK counted two faces, and Marina was the only one breathing."],
        no_pulse: ["bigotes", "Right behind her. A face, and no pulse at all. A mask does that. So does a ghost, says Luna."],
        only_shadow: ["bigotes", "No face in that spot at all. A coat, a shadow."],
        unreadable: ["bigotes", "Too dark to read. I will not call it a ghost."],
        held_breath: ["luna", "She stopped at the door and held her breath. Listening to something."],
        pulse_jump: ["bigotes", "Her pulse climbs. The lamp flickered a moment before. A startle, most likely."],
      };
      const show = (id) => {
        const e = state.evidence.find((x) => x.id === id); if (!e) return;
        const t = e.kind === "living" ? 3 : (e.t0 + e.t1) / 2;
        if (state.mode === "replay" || !state.video) drawScene(ctx, cvs.width, cvs.height, t);
        else { state.video.currentTime = t; state.video.addEventListener("seeked", () => ctx.drawImage(state.video, 0, 0, cvs.width, cvs.height), { once: true }); }
        if (e.region) { const rx = state.mode === "replay" ? shadowFace(t).x - e.region.w / 2 : e.region.x; ctx.strokeStyle = "#ff6680"; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.strokeRect(rx * cvs.width, e.region.y * cvs.height, e.region.w * cvs.width, e.region.h * cvs.height); }
        const [who, text] = NOTES[e.kind];
        $("#peekSay", el).innerHTML = `<div class="kicker" style="color:var(--gold)">${e.id} · ${fmt(e.t0)}</div>` + say(who, text, [e.id]);
        el.querySelectorAll(".ev").forEach((x) => x.classList.toggle("sel", x.dataset.ev === id));
        sound.beep(440, 60);
      };
      el.querySelectorAll("[data-ev]").forEach((c) => { c.addEventListener("click", () => show(c.dataset.ev)); c.addEventListener("keydown", (k) => k.key === "Enter" && show(c.dataset.ev)); });
      show(state.evidence.find((e) => e.kind === "no_pulse")?.id ?? state.evidence[0]?.id);
      nextUp([{ label: "Open the board →", main: true, do: () => goTo("board") }], "Click a card, or");
    } },

  { id: "board", chapter: "The séance", next: "Read the dossier →", to: "dossier", html: () => {
    const sp = spiritFor(state.evidence);
    return `
    ${sp ? `<div class="card spirit-card"><div class="kicker">${sp.archetype} · cites ${sp.cites.join(", ")}</div>
      <h2 style="margin:2px 0">${sp.name}</h2><p style="margin:0">${sp.story} <i class="muted">Its goal: ${sp.goal}.</i></p>
      <div class="kinds"><span>Kinds of spirit:</span>${SPIRIT_KINDS.map((k) => `<i class="${k === sp.archetype ? "on" : ""}">${k}</i>`).join("")}</div></div>` : ""}
    <div class="grid2 board-grid">
      <div class="seance-stage">
        <div class="crew-top">${seat("luna", "Luna")}<span>Luna reads the glass</span></div>
        <div class="crew-left">${seat("bigotes", "Dr. Bigotes")}<i class="candle"></i><span>Dr. Bigotes checks the evidence</span></div>
        ${boardHTML()}
        <div class="crew-right">${seat("xochi", "Xochi")}<i class="candle"></i><span>Xochi keeps watch</span></div>
        <div class="spell" id="spell"></div>
      </div>
      <div class="card dark">
        <div class="kicker">Ask the spirit</div>
        <p class="muted" style="margin-top:0">It speaks only through the glass, three words at most. Every answer must point at a measured moment, or the glass stays still.</p>
        ${state.live ? "" : `<button class="btn-soft" id="useBreath" style="color:var(--cream);margin-bottom:10px">Move it with my breath (camera)</button>`}
        <div class="scanstat" id="liveStat" style="margin-bottom:10px" hidden><div class="msg" id="liveMsg"></div><div class="bar"><div class="fill"></div></div></div>
        <div class="breath-meter" style="margin-bottom:10px">breath <div class="bar"><div class="fill" id="breathFill"></div></div><span id="talkFlag"></span></div>
        <div class="questions" id="qs" style="margin-top:12px">${QUESTIONS.map((q) => `<button class="q" data-q="${q.id}">${q.text}</button>`).join("")}</div>
        <p class="hush" id="hush"></p>
        <div id="answers"></div>
      </div>
    </div>`; },
    enter(el) {
      music.start();
      $("#useBreath", el)?.addEventListener("click", (e) => {
        if (!state.consent) { state.afterConsent = "board"; return goTo("consent"); }
        e.currentTarget.remove(); startLive(el, createScope(document.createElement("canvas")), "#board-has-no-scope");
      });
      const ask = async (qid, label) => {
        el.querySelectorAll(".q").forEach((x) => (x.disabled = true)); clearNext();
        const a = answer(qid, state.evidence);
        $("#spell", el).textContent = "";
        $("#hush", el).textContent = state.live ? "Breathe out slowly. Stay silent." : "The glass is moving.";
        await spell($(".board", el), L(a.board), { nextExhale: () => waitExhale(), isSilent: () => !state.talking, onChar: (t) => { $("#spell", el).textContent = t; sound.beep(520 + t.length * 20, 110, 0.03); } });
        $("#hush", el).textContent = "";
        $("#answers", el).innerHTML = `<p class="muted" style="margin:6px 0">“${label}”</p><div class="glass-said">The glass said: <b>${L(a.board)}</b></div>` + say("luna", a.luna, a.cites) + say("bigotes", a.bigotes, a.cites);
        el.querySelectorAll(".q").forEach((x) => (x.disabled = false));
        if (qid === "bye") return finale(el);
        nextUp([{ label: "Say goodbye to the spirit", do: () => ask("bye", L("Goodbye.")) }, { label: "Read the dossier →", main: true, do: forward }], "Ask another question, or");
        if (qid === "where") toast("It did not use the door.", 4000);
      };
      el.querySelectorAll(".q").forEach((b) => b.addEventListener("click", () => ask(b.dataset.q, b.textContent)));
      nextUp([{ label: "Read the dossier →", do: forward }], "Pick a question, or");
    } },

  { id: "dossier", chapter: "Xochi's dossier", next: "Close the case →", to: "end",
    enter(el) { $("#dl", el)?.addEventListener("click", downloadDossier); nextUp([{ label: "Close the case →", main: true, do: forward }]); }, html: () => `
    <div class="card">
      <div class="kicker">Xochi's dossier · ${state.ownTape ? "Your tape" : "Case 01 · The Door"}</div><h2>What we know, and what we don't</h2>
      ${reading(state.evidence).map((l) => say(l.who, l.text, l.cites)).join("")}
      ${say("xochi", `${state.mode === "replay" ? "These numbers are samples." : "The measurements are real."} The spirit is fiction. ${state.ownTape ? "What you felt is yours." : "Marina stayed home, and that is the part that matters."}`)}
      ${state.ownTape ? "" : `<p class="cliff" style="padding:6px 0 0"><span class="line" style="font-size:30px">The front door never opened. <em>So where did it go?</em></span></p>`}
      <div class="row" style="margin-top:10px"><button class="btn-main" id="dl">Download Xochi's dossier</button>
      <span class="muted">${state.mode === "replay" ? "These are sample numbers. " : ""}Nothing from this session was saved unless you download it.</span></div>
    </div>` },

  { id: "room", chapter: "The Room", next: "Main menu →", to: "menu", html: () => `
    <div class="grid2">
      <div class="card dark">
        <div class="kicker">Case 03 · The Room · your camera, live</div><h2>Now the detector reads you</h2>
        <p>Turn your camera on and sit still. The Ghost Detector finds your pulse and your breath, the same way it read Marina. Then ask the room's spirit a question and <b>stay still while the glass stops</b>.</p>
        <p class="muted">If your pulse jumps right after the glass stops, the game will notice. That is the only trick: it is your own heartbeat.</p>
        <div class="row"><button class="btn-main mint" id="roomOn">Turn my camera on</button><button class="btn-soft" id="roomAsk" disabled>Is someone here?</button></div>
        <div class="scanstat" id="liveStat" style="margin-top:14px" hidden><div class="msg" id="liveMsg"></div><div class="bar"><div class="fill"></div></div></div>
        <div id="roomNotes" style="margin-top:12px">${say("xochi", "I will write down what the detector sees. Nothing else.")}</div>
      </div>
      <div>${scopeHTML("scopeRoom", "GHOST DETECTOR · YOU, LIVE")}
        <div class="tape" style="margin-top:12px;aspect-ratio:16/9"><video id="me" playsinline muted style="width:100%;height:100%;object-fit:contain;filter:blur(11px) brightness(1.35) saturate(.85)"></video>
          <img id="mePh" src="img/wisp.svg" alt="" style="position:absolute;left:50%;top:50%;width:90px;transform:translate(-50%,-50%);opacity:.5">
          <div class="overlay" id="meOv"><div class="rec"><i></i>YOU · LIVE</div><div class="privacy">your face is blurred</div></div></div>
        ${liveChips()}
        <div class="blinker" id="blinker" hidden><img src="img/stalker.svg" alt=""><span>It only moves when you blink.</span></div>
        <div class="locker" id="roomEv" style="margin-top:16px"></div></div>
    </div>`,
    enter(el) {
      const scope = createScope($("#scopeRoom canvas", el));
      nextUp([{ label: "Main menu →", do: () => goTo("menu") }, { label: "See how it was tested →", do: () => goTo("tested") }]);
      $("#roomOn", el).addEventListener("click", async () => {
        await startLive(el, scope, "#scopeRoom");
        $("#roomAsk", el).disabled = false;
        state.roomTimer = setInterval(() => {
          if (!document.body.contains(el)) return clearInterval(state.roomTimer);
          const src = state.live?.scan ?? state.fakeScan; if (!src) return;
          const ev = roomEvidence(src, heldBreaths, pulseJumps);
          if (state.live) $("#blinker", el).hidden = false;
          $("#roomEv", el).innerHTML = ev.map((e) => `<div class="ev"><span class="id">${e.id}</span><div class="kind">${{ you_alive: "You, alive", you_held_breath: "You held your breath", you_jumped: "Your pulse jumped", you_blinked: "You blinked", you_showed: "Your face said" }[e.kind]}</div><div class="val">${e.value}<small style="font-size:20px"> ${e.unit}</small></div><div class="src">${state.liveSdk ? "" : "SIMULATED · "}${e.measuredBy}</div></div>`).join("");
          const jump = ev.filter((e) => e.kind === "you_jumped").at(-1);
          if (jump && state.glassStoppedAt && jump.t0 >= state.glassStoppedAt && jump.t0 - state.glassStoppedAt < 8 && !state.roomScared) {
            state.roomScared = true; document.body.classList.add("lightsout");
            $("#roomNotes", el).innerHTML = `<div class="cliff" style="padding:6px 0"><div class="line" style="font-size:44px"><em>That wasn't part of the game.</em></div></div>`.replace("That wasn't part of the game.", L("That wasn't part of the game.")) + say("bigotes", `Your pulse rose ${jump.value} bpm, ${Math.round(jump.t0 - state.glassStoppedAt)} seconds after the glass stopped. That was you.`, [jump.id]);
            setTimeout(() => document.body.classList.remove("lightsout"), 2500);
          }
        }, 1000);
      });
      $("#roomAsk", el).addEventListener("click", async () => {
        $("#roomNotes", el).innerHTML = say("luna", "Spirit of this room… is someone here with us?");
        await sleep(2500);
        const now = (state.live?.scan ?? state.fakeScan)?.t1 ?? 0;
        state.glassStoppedAt = now; state.roomScared = false;
        $("#roomNotes", el).innerHTML = say("luna", "The glass went to <b>YES</b>, and stopped. Stay very still…");
      });
    } },

  { id: "tested", chapter: "How it was tested", next: "Main menu →", to: "menu", enter() { nextUp([{ label: "Main menu →", main: true, do: () => goTo("menu") }]); }, html: () => {
    const P = MEASURED.planted, R = MEASURED.receipts;
    const pct = (a, b) => Math.round((100 * a) / b) + "%";
    const faceRows = [["living", "A living face, good light"], ["still", "A still face (photo, mask)"], ["shadow", "No face at all"], ["dim_living", "A living face, too dark"], ["dim_still", "A still face, too dark"]];
    return `
    <div class="card dark">
      <div class="kicker">How it was tested · Dr. Bigotes insisted</div><h2>Planted ghosts</h2>
      <p class="muted" style="margin-top:0">${P.what}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0">
        <div class="stat"><b>${R.unit_tests}</b><span>unit tests</span></div>
        <div class="stat"><b>${P.faces.living.called_a_ghost + P.faces.dim_living.called_a_ghost}</b><span>living faces called a ghost, of ${2 * P.runs_per_case}</span></div>
        <div class="stat"><b>${R.frames_saved}</b><span>frames saved</span></div>
        <div class="stat"><b>${R.language_model_calls}</b><span>language model calls</span></div>
      </div>
      <div class="grid2" style="grid-template-columns:1.2fr 1fr">
        <table class="tbl"><thead><tr><th>Planted scan</th><th>Should read</th><th>Read right</th></tr></thead><tbody>
          ${faceRows.map(([k, label]) => `<tr><td>${label}</td><td>${P.faces[k].expected.replace("_", " ")}</td><td><b>${P.faces[k].correct} / ${P.faces[k].runs}</b></td></tr>`).join("")}
        </tbody></table>
        <div>
          <table class="tbl"><thead><tr><th>Breath held for</th><th>Noticed</th></tr></thead><tbody>
            ${Object.entries(P.held_breath).map(([k, v]) => `<tr><td>${k}</td><td>${pct(v.detected, v.runs)}${v.should_detect ? "" : " <span class='muted'>(should stay quiet)</span>"}</td></tr>`).join("")}
          </tbody></table>
          <table class="tbl" style="margin-top:12px"><thead><tr><th>Pulse rise in 6 s</th><th>Noticed</th></tr></thead><tbody>
            ${Object.entries(P.pulse_jump).map(([k, v]) => `<tr><td>${k}</td><td>${pct(v.detected, v.runs)}${v.should_detect ? "" : " <span class='muted'>(should stay quiet)</span>"}</td></tr>`).join("")}
          </tbody></table>
        </div>
      </div>
      ${say("bigotes", "A held breath right at the 3-second line is noticed only some of the time. Below it, never. I would rather miss a gasp than invent one.")}
    </div>`; } },

  { id: "end", chapter: "Case open", next: "Main menu →", to: "menu", enter() { nextUp([{ label: "Try it yourself →", main: true, do: () => goTo("dare") }, { label: "Enter the Room →", do: () => goTo("room") }, { label: "Main menu", do: () => goTo("menu") }]); }, html: () => state.ownTape ? `
    <div class="cliff">
      <img src="img/wisp.svg" alt="" style="width:120px">
      <div class="line">Your tape is read.</div>
      <div class="line"><em>Was it a spirit?</em></div>
      <p class="sub">The detector only knows what it measured. The rest is yours.</p>
    </div>` : `
    <div class="cliff">
      <img src="img/wisp.svg" alt="" style="width:120px">
      <div class="line">It left the frame at ${fmt(SAMPLE_CASE.shadowOutAt)}.</div>
      <div class="line"><em>The front door never opened.</em></div>
      <p class="sub">The next morning Marina sent us a second tape. In it, the shadow is outside her bedroom.</p>
      <p class="sub" style="font-size:18px">Case 02 · coming soon</p>
      <div class="kicker" style="margin-top:22px;color:var(--gold)">The séance is over</div>
      <div class="your-turn">Now it is your turn</div>
    </div>` },
];
const ORDER = ["cold", "title", "menu", "calendar", "case", "tape", "point", "locker", "board", "dossier", "end", "dare", "consent", "room", "tested"];
SCREENS.push({ id: "menu", chapter: "Main menu", next: "Start with the 30 nights →", to: "calendar", enter() { document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.go))); }, html: () => `
    <div class="menu-wrap">
      <div class="kicker" style="text-align:center;color:var(--gold);letter-spacing:5px">MAIN MENU</div>
      <h2 style="text-align:center;margin:4px 0 16px">Where do you want to start?</h2>
      <div class="menu-grid">
        ${[["calendar", "img/heart.svg", "The 30 nights", "Marina's camera, night by night. Click a night and the detector analyzes it.", "Pulse · faces in frame"],
           ["case", "img/heart-still.svg", "Marina's video", "The night of November 2. The video she sent us, analyzed, then the board.", "Pulse · two faces · held breath · one spot"],
           ["room", "img/wisp.svg", "The Room", "Your own camera, live. It reads your heart, your breath and your blinks.", "Live pulse · breathing · blinking · expression"],
           ["dare", "img/stalker.svg", "Bring your own video", "Do you dare? Everyone in it has to agree first.", "The same reading, on your tape"],
           ["tested", "img/bigotes.svg", "How it was tested", "Planted ghosts, and the receipts Dr. Bigotes insisted on.", "Our logic, measured"]]
          .map(([id, img, t, d, tag]) => `<button class="menu-card" data-go="${id}"><img src="${img}" alt=""><b>${t}</b><span>${d}</span><small>${tag}</small></button>`).join("")}
      </div>
    </div>` });
SCREENS.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
const MARINA_LINE = "It was the night of November 2nd. Bag ready, keys in my hand, coat on. Everything was fine. Then I got to the door and this feeling hit me, so strong I couldn't breathe. Stay home. I took my coat off and I stayed. I live alone, and I saw nothing. But the hallway camera was on. Can you look?";

// ------------------------------------------------------------------ the end of the séance: I AM HERE, and the glass breaks
async function finale(el) {
  const a = answer("return", state.evidence);
  if (a.vanished) return;
  el.querySelectorAll(".q").forEach((x) => (x.disabled = true)); clearNext();
  document.body.classList.add("closing"); music.tense();                       // the lights start to close
  $("#answers", el).innerHTML = say("luna", "Wait… before you go. <i>Will you come back?</i>");
  await sleep(1800);
  $("#hush", el).textContent = "Nobody is breathing. The glass is moving on its own.";
  $("#spell", el).textContent = "";
  $("#spell", el).classList.add("blood");
  await spell($(".board", el), L(a.board), { onChar: (t) => { $("#spell", el).textContent = t; sound.beep(300 - t.length * 12, 160, 0.04); } });
  $("#hush", el).textContent = "";
  await sleep(600);
  // the glass breaks
  const board = $(".board", el), glass = $(".planchette", el);
  const r = glass.getBoundingClientRect(), b = board.getBoundingClientRect();
  const cx = r.left - b.left + r.width / 2, cy = r.top - b.top + r.height / 2;
  glass.style.visibility = "hidden";
  sound.crash(); music.stop(true); sound.sting();
  document.body.classList.add("shake", "flash", "redflash");
  board.insertAdjacentHTML("beforeend", `<svg class="cracks" viewBox="0 0 100 100" preserveAspectRatio="none" style="--cx:${(cx / b.width) * 100}%;--cy:${(cy / b.height) * 100}%">
    ${[...Array(9)].map((_, i) => { const ang = (i / 9) * Math.PI * 2 + Math.random() * 0.4, len = 20 + Math.random() * 35; const x0 = (cx / b.width) * 100, y0 = (cy / b.height) * 100;
      const mx = x0 + Math.cos(ang) * len * 0.5 + (Math.random() - 0.5) * 6, my = y0 + Math.sin(ang) * len * 0.5 + (Math.random() - 0.5) * 6;
      return `<path d="M${x0} ${y0} L${mx} ${my} L${x0 + Math.cos(ang) * len} ${y0 + Math.sin(ang) * len}" />`; }).join("")}</svg>`);
  for (let i = 0; i < 16; i++) {
    const sh = document.createElement("i"); sh.className = "shard";
    const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
    sh.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px;--rot:${Math.random() * 720 - 360}deg;--s:${0.5 + Math.random()}`;
    board.append(sh);
  }
  $("#spell", el).classList.add("broken");
  setTimeout(() => document.body.classList.remove("flash"), 260);
  setTimeout(() => document.body.classList.remove("shake"), 700);
  await sleep(900);
  $("#answers", el).innerHTML = say("bigotes", a.bigotes, a.cites);
  await sleep(1700);
  $("#answers", el).insertAdjacentHTML("beforeend", `<div class="scream">RUN! RUN! RUN!</div>`);
  sound.beep(180, 120, 0.06);
  await sleep(500);
  $("#answers", el).insertAdjacentHTML("beforeend", say("luna", "<b>EVERYBODY OUT!</b> Out, out, out!"));
  el.querySelector(".crew-left")?.classList.add("flee-left");
  el.querySelector(".crew-right")?.classList.add("flee-right");
  el.querySelector(".crew-top")?.classList.add("flee-up");
  setTimeout(() => el.querySelector(".board-ghost")?.classList.add("stays"), 1200);   // everyone ran. It did not.
  await sleep(2200);
  if (document.body.contains(el)) goTo("end");
}

// ------------------------------------------------------------------ live camera (the investigator)
const liveChips = () => `<div class="chips"><div><b id="chipBreath">--</b><span>Breaths / min</span></div><div><b id="chipBlink">--</b><span>Blinks</span></div><div><b id="chipFace">--</b><span>Expression</span></div></div>`;
let lastBlinks = 0;
function chips({ breathing, blinks, expression }) {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  if (breathing) set("chipBreath", Math.round(breathing));
  set("chipBlink", blinks ?? "--"); set("chipFace", expression ?? "--");
  const g = document.querySelector("#blinker img");
  if (g && blinks > lastBlinks) { g.style.transform = `scale(${Math.min(2.6, 1 + blinks * 0.14)})`; sound.beep(70, 240, 0.08); }
  lastBlinks = blinks ?? lastBlinks;
}
async function startLive(el, scope, sel = "#scopeMe") {
  // The camera may already be on from an earlier screen: point the readings at this screen's scope.
  state.view = { scope, sel };
  const st0 = document.querySelector(`${sel} [data-state]`);
  if (state.live || state.fakeLive) { if (st0) st0.textContent = state.live ? "WARMING UP" : "SIMULATED"; return; }
  const say_ = (m, wait) => { const stat = $("#liveStat"), msg = $("#liveMsg"); if (!stat || !msg) return; stat.hidden = false; stat.classList.toggle("waiting", !!wait); msg.textContent = m; if (!wait) stat.querySelector(".fill").style.width = "100%"; };   // looked up each time: the person may have moved to another screen
  if (!state.liveSdk) {   // no key: a gentle simulated breath and pulse, clearly labelled
    camUI(false);
    say_("This copy has no Presage key, so your camera stays off and these readings are simulated.");
    const t0 = performance.now(), fake = { t0: 0, t1: 0, pulse: [], trace: [] };
    state.fakeScan = fake;
    let lastP = -1;
    state.fakeLive = setInterval(() => {
      const t = (performance.now() - t0) / 1000, v = (Math.sin(t * 2 * Math.PI / 4.5) + 1) / 2;
      fake.t1 = t; fake.trace.push({ t, v });
      if (Math.floor(t) !== lastP && t > 4) {      // one pulse reading per second; a startle 3 s after the glass stops
        lastP = Math.floor(t);
        const scare = state.glassStoppedAt != null && t > state.glassStoppedAt + 3 ? 12 : 0;
        fake.pulse.push({ t, v: 70 + scare + Math.sin(t) * 0.8, conf: 85 });
        state.view.scope.set(fake.pulse.at(-1).v); const bpm = document.querySelector(`${state.view.sel} [data-bpm]`); if (bpm) bpm.textContent = Math.round(fake.pulse.at(-1).v);
      }
      const f = document.getElementById("breathFill"); if (f) f.style.width = v * 100 + "%";
      if (v < 0.05) state.lastExhale = performance.now();
    }, 50);
    const st = document.querySelector(`${sel} [data-state]`); if (st) st.textContent = "SIMULATED";
    return;
  }
  try {
    camUI(true);
    say_("Starting your camera…", true);
    let found = false;
    const retry = async () => { await cameraOff(); clearNext(); startLive(el, scope, sel); };
    const skip = async () => { await cameraOff(); state.noCam = true; goTo(SCREENS[state.i].id === "board" ? "board" : "menu"); };
    const slow = setTimeout(() => { if (found || !document.body.contains(el)) return; say_("More light on your face helps a lot. You can keep waiting or go on without the camera.", true); nextUp([{ label: "↻ Try again", do: retry }, { label: "Continue without a camera →", do: skip }], "Taking longer than usual."); }, 40000);
    state.live = await presage.live({
      onStream: (s, name) => { const v = $("#me"); if (v) { v.srcObject = s; v.play(); $("#mePh")?.remove(); } if (name) toast(`Using camera: ${name}`, 3500); say_("Camera on. Sit still and look at the screen: the detector is finding your pulse, usually 15 to 20 seconds.", true); },
      onSample: ({ pulse, talking, breathing, blinks, expression }) => {
        chips({ breathing, blinks, expression });
        state.talking = talking; $("#talkFlag") && ($("#talkFlag").textContent = talking ? "you're talking · the glass waits" : "");
        const { scope: sc, sel: at } = state.view;
        if (pulse && !found) {
          found = true; clearTimeout(slow); sound.chime(); say_("Got you. That heartbeat is yours.");
          if (SCREENS[state.i].id === "room") nextUp([{ label: "Is someone here?", main: true, do: () => $("#roomAsk")?.click() }, { label: "Main menu", do: () => goTo("menu") }], "It has your heartbeat. Next:");
        }
        if (pulse) { sc.set(pulse); const b = document.querySelector(`${at} [data-bpm]`); if (b) b.textContent = Math.round(pulse); }
        const st = document.querySelector(`${at} [data-state]`); if (st) st.textContent = pulse ? "LIVE" : "WARMING UP";
      },
      onTrace: (trace) => {
        const recent = trace.slice(-60); if (recent.length < 5) return;
        const vs = recent.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs);
        const level = hi > lo ? (vs.at(-1) - lo) / (hi - lo) : 0.5;
        const f = $("#breathFill"); if (f) f.style.width = level * 100 + "%";
        if (level < 0.15) state.lastExhale = performance.now();
      },
      onValidation: (code, hint) => { if (code && hint) { toast(hint, 1800); if (!found) say_(hint, true); } },
      onError: (code, message) => {
        console.error("SmartSpectra error", code, message);
        const st = document.querySelector(`${state.view.sel} [data-state]`); if (st) st.textContent = "ERROR";
        clearTimeout(slow); state.view.scope.idle();
        say_("Presage could not read you this time. Face a window or a lamp, get a little closer, and try again.");
        nextUp([{ label: "↻ Try again", main: true, do: retry }, { label: "Continue without a camera →", do: skip }], "The detector could not read you.");
        toast(`Presage error ${code}: ${message}`, 8000);
      },
    });
  } catch (e) { camUI(false); toast(e.message, 6000); }
}
async function waitExhale() {
  if (!state.live && !state.fakeLive) return sleep(900);
  const asked = performance.now();
  while (state.lastExhale < asked) { await sleep(80); if (performance.now() - asked > 4000) break; }
}

// ------------------------------------------------------------------ the dossier file (numbers and words only, never images)
function downloadDossier() {
  const ev = state.evidence, sp = spiritFor(ev);
  const lines = [
    `XOCHI'S DOSSIER · Ghost Hunt: Who Else Was There? · ${state.ownTape ? "Your tape" : "Case 01 · The Door"}`,
    state.mode === "replay" ? "SAMPLE NUMBERS (the staged tape has not been measured yet)" : "Measured by Presage SmartSpectra on this computer",
    "", "EVIDENCE",
    ...ev.map((e) => `${e.id}  ${KIND[e.kind].name}: ${e.value} ${e.unit}, ${fmt(e.t0)}${e.t1 !== e.t0 ? " to " + fmt(e.t1) : ""}`),
    "", "THE CREW", ...reading(ev).map((l) => `${l.who.toUpperCase()}: ${l.text} [${l.cites.join(", ")}]`),
    "", sp ? `THE SPIRIT (fiction): ${sp.name}, ${sp.archetype}. ${sp.story}` : "",
    "", `${state.mode === "replay" ? "These numbers are samples." : "The measurements are real."} The spirit is fiction. No frames, images or faces are in this file.`,
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([L(lines.join("\n"))], { type: "text/plain" }));
  a.download = "xochi-dossier.txt"; a.click();
  toast("Dossier saved. It holds numbers and words only.");
}

// ------------------------------------------------------------------ navigation
const SECTIONS = [
  { name: "Main menu", ids: ["menu", "cold", "title"] },
  { name: "The 30 nights", ids: ["calendar"] },
  { name: "Marina's video", ids: ["case", "tape", "point", "locker"] },
  { name: "The Séance", ids: ["board", "dossier", "end"] },
  { name: "Your turn", ids: ["dare", "consent", "room"] },
  { name: "How it was tested", ids: ["tested"] },
];
function updateNav() {
  const s = SCREENS[state.i];
  $("#next").textContent = s.next ?? "Next →";
  $("#next").disabled = s.canNext ? !s.canNext() : false;
  $("#back").style.visibility = state.hist.length ? "visible" : "hidden";
  $("#where").textContent = `${Lx(s.chapter)} · ${state.i + 1} ${getLang() === "pt" ? "de" : "of"} ${SCREENS.length}`;
  const cur = SECTIONS.find((g) => g.ids.includes(s.id));
  $("#chapters").innerHTML = SECTIONS.map((g) => {
    const first = SCREENS.findIndex((x) => x.id === g.ids[0]);
    const reached = g.ids.some((id) => state.seen.has(SCREENS.findIndex((x) => x.id === id)));
    return `<button class="chip ${g === cur ? "on" : reached ? "seen" : ""}" data-id="${g.ids[0]}">${g.name}</button>`;
  }).join("");
  $("#chapters").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.id)));
}
/** The zoom fitScreen gave the current screen: page coordinates are divided by it before being used as lengths inside the screen. */
const screenZoom = (node) => parseFloat(node.closest(".screen")?.style.zoom) || 1;

/** No scrollbars: a screen taller or wider than the window is scaled down until all of it fits. `again` starts over from full size. */
function fitScreen(again) {
  const s = document.querySelector("#stage .screen"); if (!s) return;
  if (again) s.style.zoom = "";
  for (let i = 0; i < 5; i++) {
    const r = Math.min(s.clientHeight / s.scrollHeight, s.clientWidth / s.scrollWidth);
    if (r >= 0.995) break;
    s.style.zoom = Math.max(0.5, (parseFloat(s.style.zoom) || 1) * r * 0.995).toFixed(3);
  }
}
let fitFrame = 0, fitAgain = false;
function scheduleFit(again) {
  fitAgain ||= again;
  if (!fitFrame) fitFrame = requestAnimationFrame(() => { fitFrame = 0; const a = fitAgain; fitAgain = false; fitScreen(a); });
}
const fitWatch = new ResizeObserver(() => scheduleFit(true));

function go(i, isBack) {
  if (i < 0 || i >= SCREENS.length) i = 0;
  if (!isBack && state.started && i !== state.i) state.hist.push(state.i);
  state.started = true;
  document.body.classList.remove("closing", "redflash");
  music.stop(SCREENS[i].id !== "board");
  if (i >= SCREENS.findIndex((x) => x.id === "locker") && !state.evidence.length) state.evidence = buildEvidence(sampleScans());
  state.seen.add(state.i); state.i = i; voice.clear(); clearNext(); state.playToken = (state.playToken ?? 0) + 1;
  const stage = $("#stage"); stage.innerHTML = "";
  const sec = document.createElement("section"); sec.className = "screen on"; sec.innerHTML = L(SCREENS[i].html());
  stage.append(sec);
  updateNav();
  SCREENS[i].enter?.(sec);
  fitScreen(true); fitWatch.disconnect(); fitWatch.observe(sec);
  if (!$("#hood").hidden) $("#hood").innerHTML = hoodHTML(SCREENS[i].id);
}

async function boot() {
  sky();
  state.info = (await window.pod?.info?.()) ?? { replay: true };
  state.liveSdk = !state.info.replay && !!state.info.hasKey;          // the Presage key is on this computer
  state.mode = state.liveSdk && state.info.caseVideo ? "live" : "replay"; // the tape: the real case file, or the drawn sample
  $("#mode").hidden = state.mode !== "replay";
  $("#mode").textContent = state.liveSdk ? "SAMPLE TAPE · LIVE CAMERA" : "SAMPLE DATA";
  $("#camPill").addEventListener("click", cameraOff);
  voice.watch($("#stage"));
  addEventListener("resize", () => scheduleFit(true));
  document.fonts?.ready.then(() => scheduleFit(true));
  $("#stage").addEventListener("load", () => scheduleFit(false), true);                                 // images arriving late
  new MutationObserver(() => scheduleFit(false)).observe($("#stage"), { subtree: true, childList: true, characterData: true }); // answers and results added to a screen
  // Portuguese: anything written on the page after the screen is built (labels, statuses, toasts) goes through the same dictionary
  const translate = (root) => { if (getLang() !== "pt") return; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n = root.nodeType === 3 ? root : w.nextNode(); n; n = root.nodeType === 3 ? null : w.nextNode()) { const v = Lx(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } };
  new MutationObserver((rec) => { for (const r of rec) { if (r.type === "characterData") translate(r.target); else r.addedNodes.forEach(translate); } }).observe(document.body, { subtree: true, childList: true, characterData: true });
  const applyLang = (l, rerender) => {
    setLang(l); document.documentElement.lang = l === "pt" ? "pt-BR" : "en"; try { localStorage.setItem("gh-lang", l); } catch {}
    $("#langEn").classList.toggle("on", l === "en"); $("#langPt").classList.toggle("on", l === "pt");
    $("#privacy").textContent = "🔒 Nothing recorded"; $("#hoodLabel").textContent = "Under the hood";
    $("#soundPill").textContent = sound.on ? "🔊 Sound on" : "🔇 Sound off"; camUI(!!state.live);
    $("#mode").textContent = state.liveSdk ? "SAMPLE TAPE · LIVE CAMERA" : "SAMPLE DATA"; $("#back").textContent = "← Back";
    translate(document.querySelector("header.top")); translate($("#hoodPill")); translate($("#back"));
    if (rerender) go(state.i);
  };
  $("#langEn").addEventListener("click", () => applyLang("en", true));
  $("#langPt").addEventListener("click", () => applyLang("pt", true));
  $("#hoodPill").addEventListener("click", () => { const h = $("#hood"); h.hidden = !h.hidden; $("#hoodPill").setAttribute("aria-expanded", !h.hidden); if (!h.hidden) h.innerHTML = hoodHTML(SCREENS[state.i].id); });
  let saved = "en"; try { saved = localStorage.getItem("gh-lang") || "en"; } catch {}
  applyLang(saved, false);
  $("#soundPill").addEventListener("click", () => { const on = sound.toggle(); if (!on) voice.clear(); $("#soundPill").textContent = on ? "🔊 Sound on" : "🔇 Sound off"; $("#soundPill").setAttribute("aria-pressed", on); if (on) sound.chime(); });
  $("#next").addEventListener("click", forward);
  $("#back").addEventListener("click", () => { if (state.hist.length) go(state.hist.pop(), true); });
  document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" && !$("#next").disabled) forward(); if (e.key === "ArrowLeft" && state.hist.length) go(state.hist.pop(), true); });
  const start = new URLSearchParams(location.search).get("screen");
  go(start ? Math.max(0, SCREENS.findIndex((s) => s.id === start)) : 0);
}
boot();
