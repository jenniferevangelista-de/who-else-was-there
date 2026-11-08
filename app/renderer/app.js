// Ghost Hunt: Who Else Was There? The story, one screen at a time.
import { buildEvidence, validationRuns, heldBreaths, pulseJumps } from "../../src/evidence.js";
import { answer, reading, QUESTIONS, spiritFor, matchQuestion, roomEvidence } from "../../src/spirit.js";
import { sampleScans, SAMPLE_CASE } from "../../src/sample.js";
import { sampleMonth, monthTotals, NIGHT_LABEL } from "../../src/nights.js";
import { createScope, scopeHTML } from "./scope.js";
import { drawScene, marinaFace, shadowFace } from "./scene.js";
import { voice } from "./voice.js";
import { boardHTML, spell } from "./board.js";
import * as presage from "./presage.js";
import { sound } from "./sound.js";
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
  mode: "replay", info: null, i: 0, seen: new Set(),
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
const say = (who, text, cites = []) => `
  <div class="say ${who}"><img src="img/${who === "xochi" ? "xochi" : who === "bigotes" ? "bigotes" : "luna"}.svg" alt="">
  <div class="bubble"><span class="who">${{ luna: "Luna · the medium", bigotes: "Dr. Bigotes · the skeptic", xochi: "Xochi · the night watch" }[who]}</span>${text}
  ${cites.length ? `<span class="muted" style="font-size:13px"> · cites ${cites.join(", ")}</span>` : ""}</div></div>`;

function heartBadge(el, { x, y, bpm, dead }) {
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
  b.querySelector("img").style.animation = !dead && bpm ? `thump ${60 / bpm}s ease-in-out infinite` : "none";
  return b;
}

// ------------------------------------------------------------------ the tape (replay canvas or real video)
function tapeHTML() {
  return `<div class="tape" id="tape">
    ${state.mode === "replay" ? `<canvas class="scene" width="1280" height="720"></canvas>` : `<video playsinline muted></video>`}
    <div class="overlay"><div class="rec"><i></i>REC · HALLWAY</div><div class="stamp" id="stamp">NOV 02 · 21:43:00</div>
    <div class="privacy">faces of the living are blurred</div><div class="flashlight" hidden></div></div>
    <button class="torch" title="Flashlight">🔦</button></div>
    <div class="timeline" id="timeline"><div class="head" id="head"></div></div>`;
}
function playTape({ until, onTime, rate = 1 }) {
  // replay: draws the sample scene; live: plays the client's video
  return new Promise((resolve) => {
    const start = performance.now(), from = state.tapeT ?? 0;
    const cvs = $("#tape canvas"), ctx = cvs?.getContext("2d");
    const step = () => {
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
    beam.style.setProperty("--x", e.clientX - b.left + "px"); beam.style.setProperty("--y", e.clientY - b.top + "px");
  });
  // scrub: when the tape is not playing, click the timeline to look at any second
  $("#timeline", el)?.addEventListener("click", (e) => {
    if (state.playing) return;
    const b = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - b.left) / b.width) * state.duration;
    showFrame(el, t);
  });
}
function showFrame(el, t) {
  state.tapeT = t;
  const cvs = $("#tape canvas", el);
  if (cvs) drawScene(cvs.getContext("2d"), cvs.width, cvs.height, t);
  if (state.video) state.video.currentTime = t;
  $("#stamp", el).textContent = `NOV 02 · 21:43:${String(Math.floor(t)).padStart(2, "0")}`;
  $("#head", el).style.left = (t / state.duration) * 100 + "%";
  const src = state.scans?.full ?? sampleScans().full;
  const p = [...src.pulse].reverse().find((q) => q.t <= t && q.conf >= 50);
  heartBadge($("#tape .overlay", el), { ...marinaFace(t), bpm: p?.v });
}

function markTimeline(evidence) {
  const tl = $("#timeline"); if (!tl) return;
  for (const e of evidence) {
    if (e.kind === "living") continue;
    const d = document.createElement("div"); d.className = `tick ${e.kind}`;
    d.style.left = (e.t0 / state.duration) * 100 + "%"; d.style.width = Math.max(0.8, ((e.t1 - e.t0) / state.duration) * 100) + "%";
    d.title = `${e.id} · ${KIND[e.kind].name}`; tl.append(d);
  }
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
  st.textContent = "SEARCHING"; msg("The scope is running. Looking for faces in the frame…", 8); sound.beep(520, 90, 0.04);
  await sleep(1700); if (!alive()) return;
  msg("One face with a pulse: Marina. Still looking…", 18); sound.beep(880, 80, 0.05); heartBadge(ov, { ...marinaFace(from + 4), bpm: 74 });
  await sleep(1400); if (!alive()) return;
  tape.classList.remove("sweeping"); place(from + 4); box.style.display = ""; box.classList.add("found"); box.querySelector(".tag").textContent = "second face";
  st.textContent = "LOCKED ON"; msg("A second face, right behind her. Locking the scope on it…", 28); sound.sting();
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
  $("#pointNotes", el).innerHTML = `<div class="cliff" style="padding:0"><div class="line" style="font-size:40px">A face.<br><em>0 beats per minute.</em></div>
    <p class="sub">The scope watched it for ${Math.round(verdict.t1 - verdict.t0)} seconds. It never breathed. <b>And it was standing right behind her.</b></p></div>`;
  state.flat = true; updateNav();
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
  { id: "cold", chapter: "Cold open", next: "Open the case →", html: () => `
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

  { id: "title", chapter: "The crew",
    enter(el) {
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
        <div class="member" data-intro="luna" data-line="Shhh… I'm Luna. I open the board, and I believe in everything. Almost." role="button" tabindex="0"><div class="halo"><img src="img/luna.svg" alt="Luna"></div><b>Luna</b><span>the medium · opens the board</span></div>
        <div class="member" data-intro="bigotes" data-line="Dr. Bigotes. I believe in data. Show me a pulse and I'll show you a person." role="button" tabindex="0"><div class="halo"><img src="img/bigotes.svg" alt="Dr. Bigotes"></div><b>Dr. Bigotes</b><span>the skeptic · checks the scope</span></div>
        <div class="member" data-intro="xochi" data-line="I'm Xochi. I keep watch all night and write down only what the scope saw." role="button" tabindex="0"><div class="halo"><img src="img/xochi.svg" alt="Xochi"></div><b>Xochi</b><span>the night watch · writes it down</span></div>
      </div>
      <div id="introSay" style="max-width:640px;margin:14px auto 0;text-align:left"><p class="muted" style="text-align:center">Tap a hunter to say hello.</p></div>
    </div>` },

  { id: "consent", chapter: "Before we hunt", next: "I understand →", html: () => `
    <div class="grid2">
      <div class="card consent">
        <div class="kicker">Before we hunt</div><h2>The rules of the house</h2>
        <ul>
          <li><b>The camera is yours.</b> It turns on only when you press a button, and the pill at the top right turns it off at any moment.</li>
          <li><b>Nothing is recorded.</b> No frames are saved. Readings live in memory and vanish when you close the app.</li>
          <li><b>Faces of the living are blurred</b> on every screen, including yours.</li>
          <li><b>Only bring tapes where everyone agreed to be in them.</b> The scope reads the people in a video, so they get a say.</li>
          <li><b>This is a game, not a medical device.</b> A pulse here is a story clue. It says nothing about anyone's body.</li>
          <li>Presage's SDK runs on this computer; it contacts Presage only to check the app's key. Its usage telemetry is switched off.</li>
        </ul>
      </div>
      <div class="card dark">
        <div class="kicker">The new instrument</div><h2 style="color:var(--mint)">Pulse-o-Scope</h2>
        <p>Point it at a face in a recording. Presage SmartSpectra reads the tiny colour changes a heartbeat makes in the skin.</p>
        ${scopeHTML("scopeDemo")}
        <p class="muted" style="margin-top:12px">Living faces make the line beat. Photos, masks and screens make it lie flat.</p>
      </div>
    </div>`,
    enter(el) { const s = createScope($("#scopeDemo canvas", el)); s.set(68); $("#scopeDemo [data-bpm]", el).textContent = "68"; $("#scopeDemo [data-state]", el).textContent = "DEMO";
      setTimeout(() => { if (!document.body.contains(el)) return; s.flatline(); $("#scopeDemo", el).classList.add("flat"); $("#scopeDemo [data-bpm]", el).textContent = "0"; $("#scopeDemo [data-state]", el).textContent = "PHOTO"; }, 4000); } },

  { id: "case", chapter: "The case", next: "Play the tape →", html: () => `
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
        <p class="muted">She sent it at 7:12 in the morning. The tape came with it.</p>
        <button class="btn-soft" id="playMsg" style="color:var(--cream)">▶ Hear it again</button>
      </div>
    </div>`,
    enter(el) {
      voice.say(MARINA_LINE);
      $("#playMsg", el).addEventListener("click", () => { voice.clear(); voice.say(MARINA_LINE); });
    } },

  { id: "dare", chapter: "Do you dare?", next: "Enter the Room →", html: () => `
    <div class="dare-wrap">
      <img src="img/wisp.svg" alt="" style="width:110px">
      <div class="cliff" style="padding:6px 0 0"><div class="line">Do you <em>dare?</em></div>
      <p class="sub">That was Marina's hallway. Now try it yourself.</p></div>
      <div class="grid2 dare-cards">
        <div class="card dark">
          <div class="kicker">Bring your own tape</div><h2>Who else was in yours?</h2>
          <p class="muted">The scope reads every face in it, and Luna opens the board. Was it a spirit? The crew will never agree.</p>
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
      $("#goRoom", el).addEventListener("click", () => go(state.i + 1));
      $("#tapeAgree", el).addEventListener("change", (e) => { $("#ownTape", el).disabled = !e.target.checked; $("#ownTapeBtn", el).classList.toggle("locked-btn", !e.target.checked); });
      $("#ownTape", el).addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (!state.liveSdk) return toast("Reading your own tape needs the Presage key on this computer. Add it and reopen the app.", 6000);
        state.ownTape = URL.createObjectURL(f); state.mode = "live"; state.evidence = []; state.scans = null; toast(`Loaded ${f.name}. The scope is reading it.`);
        go(SCREENS.findIndex((s) => s.id === "tape"));
      });
    } },

  { id: "calendar", chapter: "The haunting map", next: "Open November 2 →", html: () => {
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
        <div class="card" style="margin-top:18px" id="nightNote">${say("xochi", "I kept watch every night. It only moves when the lights go out. Pick a square before it stops.")}</div>
      </div>
    </div>`; },
    enter(el) {
      const m = sampleMonth();
      // Story art, not data: a figure that crosses the month one blackout at a time and stops on the night of the case.
      const cells = [...el.querySelectorAll(".night")], wrap = $("#calWrap", el), stalker = $("#stalker", el);
      const target = cells.findIndex((c) => c.dataset.date === "2026-11-02");
      cells.forEach((c, i) => { c.style.setProperty("--near", Math.max(0, 1 - Math.abs(i - target) / 16).toFixed(2)); c.style.animationDelay = `${(i * 0.37) % 5}s`; });
      const stand = (i) => { const c = cells[i], w = wrap.getBoundingClientRect(), b = c.getBoundingClientRect(); stalker.style.left = `${b.left - w.left + b.width / 2}px`; stalker.style.top = `${b.bottom - w.top}px`; stalker.style.height = `${b.height * 1.5}px`; stalker.classList.add("on"); };
      const arrive = () => cells[target].classList.add("arrived");
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setTimeout(() => { stand(target); arrive(); }, 300); }
      else {
        let at = Math.max(0, target - 21);
        setTimeout(() => stand(at), 400);
        const hop = setInterval(() => {
          if (!document.body.contains(el)) return clearInterval(hop);
          at = Math.min(target, at + 3 + Math.floor(Math.random() * 2));
          wrap.classList.add("blackout"); sound.beep(62, 320, 0.09);
          setTimeout(() => { stand(at); }, 90);
          setTimeout(() => { wrap.classList.remove("blackout"); if (at === target) arrive(); }, 240);
          if (at === target) clearInterval(hop);
        }, 2300);
      }
      el.querySelectorAll(".night").forEach((b) => b.addEventListener("click", () => {
        el.querySelectorAll(".night.sel").forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
        const n = m.find((x) => x.date === b.dataset.date);
        const who = n.kind === "no_pulse" ? "luna" : n.kind === "visitor" ? "bigotes" : "xochi";
        const text = n.kind === "no_pulse" ? `${n.note} Two faces. One heartbeat. <b>Who else was there?</b>`
          : n.note ?? (n.kind === "empty" ? "She was out. The hallway stayed dark." : n.kind === "locked" ? "Not opened yet." : "Just Marina, coming home. One face, one pulse.");
        $("#nightNote", el).innerHTML = say(who, text) + (n.caseId ? `<button class="btn-main" id="openCase">Open the tape of November 2</button>` : "");
        $("#openCase", el)?.addEventListener("click", () => go(state.i + 1));
      }));
      setTimeout(() => el.querySelector('[data-date="2026-11-02"]')?.focus(), 300);
    } },

  { id: "tape", chapter: "The tape", next: "Point the scope →", canNext: () => state.tapeDone, html: () => `
    <div class="grid2">
      <div>${tapeHTML()}</div>
      <div>${scopeHTML("scopeTape", "PULSE-O-SCOPE · WHOLE FRAME")}
        <div class="card" style="margin-top:16px" id="tapeNotes">${say("bigotes", "Hmph. I'll watch her pulse. Ghosts don't have one, people do.")}</div></div>
    </div>`,
    async enter(el) {
      state.tapeDone = false; state.tapeT = 0; updateNav(); wireTape(el);
      const scope = createScope($("#scopeTape canvas", el));
      if (state.mode !== "replay") {
        state.video = $("#tape video", el); state.video.src = state.ownTape || state.info.caseVideo;
        await new Promise((r) => state.video.addEventListener("loadedmetadata", r, { once: true }));
        state.duration = state.video.duration;
      } else state.duration = SAMPLE_CASE.durationSec;
      $("#scopeTape [data-state]", el).textContent = state.mode === "replay" ? "SAMPLE" : "READING";
      // the tape plays once while the SDK reads the whole frame
      let full = null;
      const scanning = fullScan().then((s) => (full = s)).catch((e) => toast(e.message, 6000));
      const tapeTape = $("#tape .overlay", el);
      const sample = sampleScans().full;
      let warned = false;
      await playTape({
        until: state.mode === "replay" ? SAMPLE_CASE.shadowInAt + 4 : state.duration,
        onTime: (t) => {
          const src = full ?? sample;
          const p = [...src.pulse].reverse().find((q) => q.t <= t && q.conf >= 50);
          if (p) { scope.set(p.v); $("#scopeTape [data-bpm]", el).textContent = Math.round(p.v); }
          heartBadge(tapeTape, { ...marinaFace(t), bpm: p?.v });
          const two = src.validation.find((v) => Math.abs(v.t - t) < 0.5)?.code === 2;
          if (two && !warned) {
            warned = true; sound.sting();
            $("#tapeNotes", el).innerHTML = say("bigotes", `Wait. Presage just reported <b>two faces</b> in the frame. At ${fmt(t)}.`) + say("luna", "Marina said she lives alone.");
          }
        },
      });
      await scanning;
      state.scans = { full: full ?? sample, regions: [] };
      state.tapeDone = true; updateNav();
      markTimeline(buildEvidence(state.scans));
      toast("Tip: click the timeline to look at any second. 🔦 turns on the flashlight.", 4500);
      $("#tapeNotes", el).insertAdjacentHTML("beforeend", `<p class="cliff" style="padding:10px 0"><span class="line" style="font-size:34px">Who is the <em>second face</em>?</span></p>`);
    } },

  { id: "point", chapter: "Point the scope", next: "Open the evidence →", canNext: () => state.flat, html: () => `
    <div class="grid2">
      <div>${tapeHTML()}${state.mode === "replay" ? "" : `<p class="muted">Click the spot you want the scope to read, then press the button.</p>`}</div>
      <div>${scopeHTML("scopePoint", "PULSE-O-SCOPE · ONE SPOT")}
        <div class="card" style="margin-top:16px" id="pointNotes">${say("xochi", "The scope needs a face to find a heartbeat. Let it work.")}
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
      box.innerHTML = `<span class="tag">scope target</span>`; place(); ov.append(box);
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
            <p class="sub">The scope watched it for ${Math.round(verdict.t1 - verdict.t0)} seconds. It never breathed.</p></div>`;
        } else {
          $("#pointNotes", el).innerHTML = say("bigotes", verdict ? `The scope says: ${KIND[verdict.kind].name.toLowerCase()}.` : "Too short to say anything. Try a spot with a face.");
        }
        state.flat = true; updateNav();
      });
    } },

  { id: "locker", chapter: "The evidence", next: "Summon it →", html: () => `
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
    } },

  { id: "prep", chapter: "Your turn", next: "Open the board →", html: () => `
    <div class="grid2">
      <div class="card">
        <div class="kicker">The séance needs a living hand</div><h2>Yours.</h2>
        <p class="lead">The glass moves only when <b>you breathe out</b>. It stops while you talk. The scope reads you, live, the same way it read the tape.</p>
        <p class="muted">You will see yourself here, blurred, and nothing is saved. You can turn it off at the top right at any moment; the board then moves on a slow timer instead.</p>
        <div class="row"><button class="btn-main mint" id="camOn">Turn my camera on</button><button class="btn-soft" id="noCam">Play without a camera</button></div>
        <div class="scanstat" id="liveStat" style="margin-top:14px" hidden><div class="msg" id="liveMsg"></div><div class="bar"><div class="fill"></div></div></div>
      </div>
      <div>${scopeHTML("scopeMe", "PULSE-O-SCOPE · YOU, LIVE")}
        <div class="tape" style="margin-top:16px;aspect-ratio:16/10"><video id="me" playsinline muted style="filter:blur(18px) saturate(.8)"></video>
          <img id="mePh" src="img/wisp.svg" alt="" style="position:absolute;left:50%;top:50%;width:110px;transform:translate(-50%,-50%);opacity:.5">
          <div class="overlay" id="meOv"><div class="rec"><i></i>YOU · LIVE</div><div class="privacy">your face is blurred</div></div></div>
        <div class="breath-meter" style="margin-top:12px">breath <div class="bar"><div class="fill" id="breathFill"></div></div><span id="talkFlag"></span></div>
      </div>
    </div>`,
    enter(el) {
      const scope = createScope($("#scopeMe canvas", el));
      $("#camOn", el).addEventListener("click", () => startLive(el, scope));
      $("#noCam", el).addEventListener("click", () => { cameraOff(); state.noCam = true; toast("No camera: the glass will drift on its own."); });
    } },

  { id: "board", chapter: "The séance", next: "Read the dossier →", html: () => {
    const sp = spiritFor(state.evidence);
    return `
    ${sp ? `<div class="card spirit-card"><div class="kicker">${sp.archetype} · cites ${sp.cites.join(", ")}</div>
      <h2 style="margin:2px 0">${sp.name}</h2><p style="margin:0">${sp.story} <i class="muted">Its goal: ${sp.goal}.</i></p></div>` : ""}
    <div class="grid2" style="margin-top:18px;grid-template-columns:2fr 1fr">
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
        <form id="askForm" class="row" style="gap:10px;flex-wrap:nowrap"><input id="askText" class="ask" placeholder="Type a question, in your words…" autocomplete="off"><button class="btn-main" style="padding:10px 20px">Ask</button></form>
        <div class="questions" id="qs" style="margin-top:12px">${QUESTIONS.map((q) => `<button class="q" data-q="${q.id}">${q.text}</button>`).join("")}</div>
        <p class="hush" id="hush"></p>
        <div id="answers"></div>
      </div>
    </div>`; },
    enter(el) {
      const ask = async (qid, label) => {
        el.querySelectorAll(".q, #askForm button").forEach((x) => (x.disabled = true));
        const a = qid ? answer(qid, state.evidence) : { board: "NO", cites: [], luna: "The glass will not move for that.", bigotes: "Nothing measured answers it. Try asking who, why, where, or if it is alive." };
        $("#spell", el).textContent = "";
        $("#hush", el).textContent = state.live ? "Breathe out slowly. Stay silent." : "The glass is moving.";
        await spell($(".board", el), a.board, { nextExhale: () => waitExhale(), isSilent: () => !state.talking, onChar: (t) => { $("#spell", el).textContent = t; sound.beep(520 + t.length * 20, 110, 0.03); } });
        $("#hush", el).textContent = "";
        $("#answers", el).innerHTML = `<p class="muted" style="margin:6px 0">“${label}”</p>` + say("luna", a.luna, a.cites) + say("bigotes", a.bigotes, a.cites);
        el.querySelectorAll(".q, #askForm button").forEach((x) => (x.disabled = false));
        if (qid === "where") toast("It did not use the door.", 4000);
        if (qid === "bye") await finale(el);
      };
      el.querySelectorAll(".q").forEach((b) => b.addEventListener("click", () => ask(b.dataset.q, b.textContent)));
      $("#askForm", el).addEventListener("submit", (e) => { e.preventDefault(); const t = $("#askText", el).value.trim(); if (t) ask(matchQuestion(t), t); });
    } },

  { id: "dossier", chapter: "Xochi's dossier", next: "Close the case →",
    enter(el) { $("#dl", el)?.addEventListener("click", downloadDossier); }, html: () => `
    <div class="card">
      <div class="kicker">Xochi's dossier · ${state.ownTape ? "Your tape" : "Case 01 · The Door"}</div><h2>What we know, and what we don't</h2>
      ${reading(state.evidence).map((l) => say(l.who, l.text, l.cites)).join("")}
      ${say("xochi", `${state.mode === "replay" ? "These numbers are samples." : "The measurements are real."} The spirit is fiction. ${state.ownTape ? "What you felt is yours." : "Marina stayed home, and that is the part that matters."}`)}
      ${state.ownTape ? "" : `<p class="cliff" style="padding:6px 0 0"><span class="line" style="font-size:30px">The front door never opened. <em>So where did it go?</em></span></p>`}
      <div class="row" style="margin-top:10px"><button class="btn-main" id="dl">Download Xochi's dossier</button>
      <span class="muted">${state.mode === "replay" ? "These are sample numbers. " : ""}Nothing from this session was saved unless you download it.</span></div>
    </div>` },

  { id: "room", chapter: "The Room", next: "How it was tested →", html: () => `
    <div class="grid2">
      <div class="card dark">
        <div class="kicker">Case 03 · The Room · your camera, live</div><h2>Now the scope reads you</h2>
        <p>Turn your camera on and sit still. The Pulse-o-Scope finds your pulse and your breath, the same way it read Marina. Then ask the room's spirit a question and <b>stay still while the glass stops</b>.</p>
        <p class="muted">If your pulse jumps right after the glass stops, the game will notice. That is the only trick: it is your own heartbeat.</p>
        <div class="row"><button class="btn-main mint" id="roomOn">Turn my camera on</button><button class="btn-soft" id="roomAsk" disabled>Is someone here?</button></div>
        <div class="scanstat" id="liveStat" style="margin-top:14px" hidden><div class="msg" id="liveMsg"></div><div class="bar"><div class="fill"></div></div></div>
        <div id="roomNotes" style="margin-top:12px">${say("xochi", "I will write down what the scope sees. Nothing else.")}</div>
      </div>
      <div>${scopeHTML("scopeRoom", "PULSE-O-SCOPE · YOU, LIVE")}
        <div class="locker" id="roomEv" style="margin-top:16px"></div></div>
    </div>`,
    enter(el) {
      const scope = createScope($("#scopeRoom canvas", el));
      $("#roomOn", el).addEventListener("click", async () => {
        await startLive(el, scope, "#scopeRoom");
        $("#roomAsk", el).disabled = false;
        state.roomTimer = setInterval(() => {
          if (!document.body.contains(el)) return clearInterval(state.roomTimer);
          const src = state.live?.scan ?? state.fakeScan; if (!src) return;
          const ev = roomEvidence(src, heldBreaths, pulseJumps);
          $("#roomEv", el).innerHTML = ev.map((e) => `<div class="ev"><span class="id">${e.id}</span><div class="kind">${{ you_alive: "You, alive", you_held_breath: "You held your breath", you_jumped: "Your pulse jumped" }[e.kind]}</div><div class="val">${e.value}<small style="font-size:20px"> ${e.unit}</small></div><div class="src">${state.liveSdk ? "" : "SIMULATED · "}${e.measuredBy}</div></div>`).join("");
          const jump = ev.filter((e) => e.kind === "you_jumped").at(-1);
          if (jump && state.glassStoppedAt && jump.t0 >= state.glassStoppedAt && jump.t0 - state.glassStoppedAt < 8 && !state.roomScared) {
            state.roomScared = true; document.body.classList.add("lightsout");
            $("#roomNotes", el).innerHTML = `<div class="cliff" style="padding:6px 0"><div class="line" style="font-size:44px"><em>That wasn't part of the game.</em></div></div>` + say("bigotes", `Your pulse rose ${jump.value} bpm, ${Math.round(jump.t0 - state.glassStoppedAt)} seconds after the glass stopped. That was you.`, [jump.id]);
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

  { id: "tested", chapter: "How it was tested", next: "Start again ↺", html: () => {
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

  { id: "end", chapter: "Case open", next: "Do you dare? →", html: () => state.ownTape ? `
    <div class="cliff">
      <img src="img/wisp.svg" alt="" style="width:120px">
      <div class="line">Your tape is read.</div>
      <div class="line"><em>Was it a spirit?</em></div>
      <p class="sub">The scope only knows what it measured. The rest is yours.</p>
    </div>` : `
    <div class="cliff">
      <img src="img/wisp.svg" alt="" style="width:120px">
      <div class="line">It left the frame at ${fmt(SAMPLE_CASE.shadowOutAt)}.</div>
      <div class="line"><em>The front door never opened.</em></div>
      <p class="sub">The next morning Marina sent us a second tape. In it, the shadow is outside her bedroom.</p>
      <p class="sub" style="font-size:18px">Case 02 · coming soon</p>
    </div>` },
];
const ORDER = ["cold", "title", "consent", "case", "calendar", "tape", "point", "locker", "prep", "board", "dossier", "end", "dare", "room", "tested"];
SCREENS.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
const MARINA_LINE = "It was the night of November 2nd. Bag ready, keys in my hand, coat on. Everything was fine. Then I got to the door and this feeling hit me, so strong I couldn't breathe. Stay home. I took my coat off and I stayed. I live alone, and I saw nothing. But the hallway camera was on. Can you look?";

// ------------------------------------------------------------------ the end of the séance: I AM HERE, and the glass breaks
async function finale(el) {
  const a = answer("return", state.evidence);
  if (a.vanished) return;
  el.querySelectorAll(".q, #askForm button, #askText").forEach((x) => (x.disabled = true));
  $("#answers", el).innerHTML = say("luna", "Wait… before you go. <i>Will you come back?</i>");
  await sleep(1800);
  $("#hush", el).textContent = "Nobody is breathing. The glass is moving on its own.";
  $("#spell", el).textContent = "";
  await spell($(".board", el), a.board, { onChar: (t) => { $("#spell", el).textContent = t; sound.beep(300 - t.length * 12, 160, 0.04); } });
  $("#hush", el).textContent = "";
  await sleep(600);
  // the glass breaks
  const board = $(".board", el), glass = $(".planchette", el);
  const r = glass.getBoundingClientRect(), b = board.getBoundingClientRect();
  const cx = r.left - b.left + r.width / 2, cy = r.top - b.top + r.height / 2;
  glass.style.visibility = "hidden";
  sound.crash();
  document.body.classList.add("shake", "flash");
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
  await sleep(1800);
  $("#answers", el).innerHTML = `<div class="cliff" style="padding:10px 0"><div class="line" style="font-size:40px">The glass is broken.</div>
    <div class="line" style="font-size:40px"><em>The board is yours now.</em></div>
    <p class="sub" style="font-size:17px">${a.luna} <span class="muted">· cites ${a.cites.join(", ")}</span></p></div>`;
  toast("The crew ran away. Read Xochi's dossier, if you dare.", 4000);
}

// ------------------------------------------------------------------ live camera (the investigator)
async function startLive(el, scope, sel = "#scopeMe") {
  // The camera may already be on from an earlier screen: point the readings at this screen's scope.
  state.view = { scope, sel };
  const st0 = document.querySelector(`${sel} [data-state]`);
  if (state.live || state.fakeLive) { if (st0) st0.textContent = state.live ? "WARMING UP" : "SIMULATED"; return; }
  const stat = $("#liveStat"), say_ = (m, wait) => { if (!stat) return; stat.hidden = false; stat.classList.toggle("waiting", !!wait); $("#liveMsg").textContent = m; if (!wait) stat.querySelector(".fill").style.width = "100%"; };
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
    state.live = await presage.live({
      onStream: (s) => { const v = $("#me"); if (v) { v.srcObject = s; v.play(); $("#mePh")?.remove(); } say_("Camera on. Sit still and look at the screen: the scope is finding your pulse, usually 15 to 20 seconds.", true); },
      onSample: ({ pulse, talking }) => {
        state.talking = talking; $("#talkFlag") && ($("#talkFlag").textContent = talking ? "you're talking · the glass waits" : "");
        const { scope: sc, sel: at } = state.view;
        if (pulse && !found) { found = true; sound.chime(); say_("Got you. That heartbeat is yours."); }
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
      onValidation: (code, hint) => { if (code && hint) toast(hint, 1800); },
      onError: (code, message) => {
        console.error("SmartSpectra error", code, message);
        const st = document.querySelector(`${state.view.sel} [data-state]`); if (st) st.textContent = "ERROR";
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
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  a.download = "xochi-dossier.txt"; a.click();
  toast("Dossier saved. It holds numbers and words only.");
}

// ------------------------------------------------------------------ navigation
const SECTIONS = [
  { name: "Welcome", ids: ["cold", "title", "consent"] },
  { name: "The Map", ids: ["case", "calendar"] },
  { name: "The Tape", ids: ["tape", "point", "locker"] },
  { name: "The Séance", ids: ["prep", "board", "dossier"] },
  { name: "The end", ids: ["end"] },
  { name: "Do you dare?", ids: ["dare", "room"] },
  { name: "How it was tested", ids: ["tested"] },
];
function updateNav() {
  const s = SCREENS[state.i];
  $("#next").textContent = s.next ?? "Next →";
  $("#next").disabled = s.canNext ? !s.canNext() : false;
  $("#back").style.visibility = state.i ? "visible" : "hidden";
  $("#where").textContent = `${s.chapter} · ${state.i + 1} of ${SCREENS.length}`;
  const cur = SECTIONS.find((g) => g.ids.includes(s.id));
  $("#chapters").innerHTML = SECTIONS.map((g) => {
    const first = SCREENS.findIndex((x) => x.id === g.ids[0]);
    const reached = g.ids.some((id) => state.seen.has(SCREENS.findIndex((x) => x.id === id)));
    return `<button class="chip ${g === cur ? "on" : reached ? "seen" : ""}" data-i="${first}" ${reached || g === cur ? "" : "disabled"}>${g.name}</button>`;
  }).join("");
  $("#chapters").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => go(+b.dataset.i)));
}
function go(i) {
  if (i < 0 || i >= SCREENS.length) i = 0;
  if (i >= SCREENS.findIndex((x) => x.id === "locker") && !state.evidence.length) state.evidence = buildEvidence(sampleScans());
  state.seen.add(state.i); state.i = i; voice.clear();
  const stage = $("#stage"); stage.innerHTML = "";
  const sec = document.createElement("section"); sec.className = "screen on"; sec.innerHTML = SCREENS[i].html();
  stage.append(sec);
  updateNav();
  SCREENS[i].enter?.(sec);
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
  $("#soundPill").addEventListener("click", () => { const on = sound.toggle(); if (!on) voice.clear(); $("#soundPill").textContent = on ? "🔊 Sound on" : "🔇 Sound off"; $("#soundPill").setAttribute("aria-pressed", on); if (on) sound.chime(); });
  $("#next").addEventListener("click", () => go(state.i + 1));
  $("#back").addEventListener("click", () => go(state.i - 1));
  document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" && !$("#next").disabled) go(state.i + 1); if (e.key === "ArrowLeft") go(state.i - 1); });
  const start = new URLSearchParams(location.search).get("screen");
  go(start ? Math.max(0, SCREENS.findIndex((s) => s.id === start)) : 0);
}
boot();
