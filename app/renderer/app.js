// Ghost Hunt: Who Else Was There? The story, one screen at a time.
import { buildEvidence, validationRuns } from "../../src/evidence.js";
import { answer, reading, QUESTIONS } from "../../src/spirit.js";
import { sampleScans, SAMPLE_CASE } from "../../src/sample.js";
import { sampleMonth, monthTotals, NIGHT_LABEL } from "../../src/nights.js";
import { createScope, scopeHTML } from "./scope.js";
import { drawScene, marinaFace, portraitFace } from "./scene.js";
import { boardHTML, spell } from "./board.js";
import * as presage from "./presage.js";

const $ = (s, r = document) => r.querySelector(s);
const ORN = `<svg class="ornament" viewBox="0 0 220 18" aria-hidden="true"><path d="M0 9h86M134 9h86" stroke="currentColor" stroke-width="1"/><path d="M110 2c-6 0-9 4-9 7s3 7 9 7 9-4 9-7-3-7-9-7zM96 9c-4-4-8-4-10 0 2 4 6 4 10 0zM124 9c4-4 8-4 10 0-2 4-6 4-10 0z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="110" cy="9" r="2" fill="currentColor"/></svg>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (t) => `0:${String(Math.floor(t)).padStart(2, "0")}`;
const KIND = {
  living: { name: "A living witness", icon: "img/heart.svg" },
  second_face: { name: "A second face", icon: "img/wisp.svg" },
  no_pulse: { name: "A face with no pulse", icon: "img/heart-still.svg" },
  only_shadow: { name: "A shape with no face", icon: "img/wisp.svg" },
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
    <div class="privacy">faces of the living are blurred</div></div></div>
    <div class="timeline" id="timeline"><div class="head" id="head"></div></div>`;
}
function playTape({ until, onTime }) {
  // replay: draws the sample scene; live: plays the client's video
  return new Promise((resolve) => {
    const start = performance.now(), from = state.tapeT ?? 0;
    const cvs = $("#tape canvas"), ctx = cvs?.getContext("2d");
    const step = () => {
      const t = state.mode === "replay" ? from + (performance.now() - start) / 1000 : state.video.currentTime;
      if (ctx) drawScene(ctx, cvs.width, cvs.height, t);
      $("#stamp").textContent = `NOV 02 · 21:43:${String(Math.floor(t)).padStart(2, "0")}`;
      $("#head").style.left = (t / state.duration) * 100 + "%";
      onTime?.(t);
      state.tapeT = t;
      if (t >= until || !document.body.contains($("#tape"))) return resolve(t);
      requestAnimationFrame(step);
    };
    if (state.mode !== "replay") { state.video.currentTime = from; state.video.play(); }
    step();
  }).then((t) => { if (state.video) state.video.pause(); return t; });
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
      setTimeout(() => { ecg.flatline(); $("#c2", el).style.cssText = "opacity:1;transition:opacity 1.2s"; }, 3200);
    } },

  { id: "title", chapter: "The crew", html: () => `
    <div style="text-align:center">
            <div class="kicker" style="color:var(--gold);letter-spacing:6px;font-size:16px">GHOST HUNT</div>
      <h1>Who Else <span class="accent">Was There?</span></h1>
      ${ORN}
      <p class="lead center">Three tiny ghost hunters. One new instrument, built on Presage SmartSpectra: it reads a heartbeat from any face in a video.<br>
      Living faces beat. <b style="color:var(--danger)">The ones that don't are the case.</b></p>
      <div class="crew" style="margin-top:22px">
        <div class="member"><div class="halo"><img src="img/luna.svg" alt="Luna"></div><b>Luna</b><span>the medium · opens the board</span></div>
        <div class="member"><div class="halo"><img src="img/bigotes.svg" alt="Dr. Bigotes"></div><b>Dr. Bigotes</b><span>the skeptic · checks the scope</span></div>
        <div class="member"><div class="halo"><img src="img/xochi.svg" alt="Xochi"></div><b>Xochi</b><span>the night watch · writes it down</span></div>
      </div>
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
        <div class="kicker">Case 01 · The Coat · a message from Marina</div>
        <h2>"Something told me to stay."</h2>
        <p class="lead">"It was the night of November 2nd. Bag ready, keys in my hand, coat on. I got to the door and I just… couldn't. I walked back and hung the coat up again. I live alone. The hallway camera was on. Can you look?"</p>
        <p class="muted">Marina is a character, and her tape is staged for this demo with everyone's consent. The readings on the next screens are ${state.mode === "replay" ? "<b>sample numbers</b> until the staged tape is measured" : "measured from that tape by Presage SmartSpectra"}.</p>
        ${say("luna", "A woman alone, a door she couldn't open. Let's see who else was in that hallway.")}
      </div>
      <div class="card dark" style="text-align:center">
        <img src="img/wisp.svg" alt="" style="width:140px;margin:10px auto;display:block">
        <p class="lead">Bring your own tape?</p>
        <p class="muted">Only recordings where everyone agreed to be in them.</p>
        <label class="btn-main ghost" style="display:inline-block">Choose a video<input type="file" accept="video/*" id="ownTape" class="sr"></label>
      </div>
    </div>`,
    enter(el) {
      $("#ownTape", el).addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (!state.liveSdk) return toast("Bringing a tape needs the Presage key on this computer. Replay mode uses Marina's sample.");
        state.ownTape = URL.createObjectURL(f); state.mode = "live"; toast(`Loaded ${f.name}. Press Play the tape.`);
      });
    } },

  { id: "calendar", chapter: "The haunting map", next: "Open November 2 →", html: () => {
    const m = sampleMonth(), tot = monthTotals(m);
    const first = (new Date(m[0].date + "T00:00:00Z").getUTCDay() + 6) % 7;   // Monday first
    const icon = (n) => n.kind === "locked" ? "🔒" : n.kind === "empty" ? "<span style='opacity:.7'>☾</span>"
      : [...Array(n.livingFaces)].map(() => '<img src="img/heart.svg" alt="">').join("") + (n.stillFaces ? '<img src="img/heart-still.svg" alt="">' : "");
    return `
    <div class="grid2" style="grid-template-columns:1.5fr 1fr">
      <div class="card dark">
        <div class="kicker">The haunting map · Marina's hallway camera · ${state.mode === "replay" ? "sample month" : "your tapes"}</div>
        <h2>Thirty nights, one clip each</h2>
        <div class="cal" style="margin-top:14px">
          ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => `<div class="dow">${d}</div>`).join("")}
          ${'<div></div>'.repeat(first)}
          ${m.map((n) => `<button class="night ${n.kind}" data-date="${n.date}" aria-label="${n.date}: ${NIGHT_LABEL[n.kind]}">
            <span class="d">${+n.date.slice(8)}${n.date.slice(5, 7) === "11" ? "<small style='font-size:12px'> Nov</small>" : ""}</span>
            <span class="faces">${icon(n)}</span>
            ${n.caseId ? '<span class="tag">case 01</span>' : n.date === "2026-11-03" ? '<span class="tag">case 02</span>' : ""}</button>`).join("")}
        </div>
        <div class="legend"><span><i style="background:#ffffff14"></i>one living face</span><span><i style="background:#ff86b833"></i>a visitor, alive</span>
          <span><i style="background:#ff668088"></i>a face with no pulse</span><span><i style="background:#ffffff06"></i>nobody</span><span>🔒 not opened yet</span></div>
      </div>
      <div>
        <div class="card dark" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:22px 16px">
          <div class="stat"><b>${tot.opened}</b><span>nights read</span></div>
          <div class="stat"><b>${tot.livingFaces}</b><span>living faces</span></div>
          <div class="stat"><b style="color:var(--danger)">${tot.stillFaces}</b><span>with no pulse</span></div>
        </div>
        <div class="card" style="margin-top:18px" id="nightNote">${say("xochi", "I kept watch every night. Pick a square. One of them is not like the others.")}</div>
      </div>
    </div>`; },
    enter(el) {
      const m = sampleMonth();
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
      state.tapeDone = false; state.tapeT = 0; updateNav();
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
        until: state.mode === "replay" ? SAMPLE_CASE.coatOffAt + 4 : state.duration,
        onTime: (t) => {
          const src = full ?? sample;
          const p = [...src.pulse].reverse().find((q) => q.t <= t && q.conf >= 50);
          if (p) { scope.set(p.v); $("#scopeTape [data-bpm]", el).textContent = Math.round(p.v); }
          heartBadge(tapeTape, { ...marinaFace(t), bpm: p?.v });
          const two = src.validation.find((v) => Math.abs(v.t - t) < 0.5)?.code === 2;
          if (two && !warned) {
            warned = true;
            $("#tapeNotes", el).innerHTML = say("bigotes", `Wait. Presage just reported <b>two faces</b> in the frame. At ${fmt(t)}.`) + say("luna", "Marina said she lives alone.");
          }
        },
      });
      await scanning;
      state.scans = { full: full ?? sample, regions: [] };
      state.tapeDone = true; updateNav();
      $("#tapeNotes", el).insertAdjacentHTML("beforeend", `<p class="cliff" style="padding:10px 0"><span class="line" style="font-size:34px">Who is the <em>second face</em>?</span></p>`);
    } },

  { id: "point", chapter: "Point the scope", next: "Open the evidence →", canNext: () => state.flat, html: () => `
    <div class="grid2">
      <div>${tapeHTML()}<p class="muted">Click the spot you want the scope to read. The crew suggests the wall behind the coat stand.</p></div>
      <div>${scopeHTML("scopePoint", "PULSE-O-SCOPE · ONE SPOT")}
        <div class="card" style="margin-top:16px" id="pointNotes">${say("xochi", "Pick a spot. The scope needs about fifteen seconds of a face to find a heartbeat.")}
          <button class="btn-main mint" id="scanBtn">Read the wall behind the coat</button></div></div>
    </div>`,
    enter(el) {
      state.flat = false; updateNav();
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
      const cvs = $("#tape canvas", el); if (cvs) drawScene(cvs.getContext("2d"), cvs.width, cvs.height, SAMPLE_CASE.coatOffAt + 4);
      $("#scanBtn", el).addEventListener("click", async (ev) => {
        ev.target.disabled = true;
        $("#scopePoint [data-state]", el).textContent = "LISTENING";
        // read the spot while the second face was in frame (or the whole tape if the SDK never saw two faces)
        const two = state.mode === "replay" ? null : validationRuns(state.scans.full.validation, 2, 1)[0];
        const from = state.mode === "replay" ? SAMPLE_CASE.coatOffAt : two?.t0 ?? 0;
        const to = state.mode === "replay" ? SAMPLE_CASE.coatBackAt : two?.t1 ?? state.duration;
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
      <div class="kicker">Evidence locker · every card measured by Presage SmartSpectra</div>
      <h2>What the tape says</h2>
      <div class="locker" style="margin-top:18px">${state.evidence.map((e) => `
        <div class="ev ${e.kind}"><span class="id">${e.id}</span>
          <div class="row" style="gap:10px"><img src="${KIND[e.kind].icon}" alt="" style="width:34px"><span class="kind">${KIND[e.kind].name}</span></div>
          <div class="val">${e.value}<small style="font-size:20px"> ${e.unit}</small></div>
          <div class="when">${fmt(e.t0)}${e.t1 !== e.t0 ? " to " + fmt(e.t1) : ""}</div>
          <div class="src">${state.mode === "replay" ? "SAMPLE · " : ""}${e.measuredBy}</div></div>`).join("")}</div>
      <div style="margin-top:18px">${reading(state.evidence).slice(1, 4).map((l) => say(l.who, l.text, l.cites)).join("")}</div>
    </div>` },

  { id: "prep", chapter: "Your turn", next: "Open the board →", html: () => `
    <div class="grid2">
      <div class="card">
        <div class="kicker">The séance needs a living hand</div><h2>Yours.</h2>
        <p class="lead">The glass moves only when <b>you breathe out</b>. It stops while you talk. The scope reads you, live, the same way it read the tape.</p>
        <p class="muted">Your camera image is blurred on screen and never saved. You can turn it off at the top right at any moment; the board then moves on a slow timer instead.</p>
        <div class="row"><button class="btn-main mint" id="camOn">Turn my camera on</button><button class="btn-soft" id="noCam">Play without a camera</button></div>
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

  { id: "board", chapter: "The séance", next: "Read the dossier →", html: () => `
    <div class="grid2">
      <div>${boardHTML()}<div class="spell" id="spell"></div></div>
      <div class="card dark">
        <div class="kicker">Ask it something</div>
        <div class="questions" id="qs">${QUESTIONS.map((q) => `<button class="q" data-q="${q.id}">${q.text}</button>`).join("")}</div>
        <p class="hush" id="hush"></p>
        <div id="answers"></div>
      </div>
    </div>`,
    enter(el) {
      el.querySelectorAll(".q").forEach((b) => b.addEventListener("click", async () => {
        el.querySelectorAll(".q").forEach((x) => (x.disabled = true));
        const a = answer(b.dataset.q, state.evidence);
        $("#spell", el).textContent = "";
        $("#hush", el).textContent = state.live ? "Breathe out slowly. Stay silent." : "The glass is moving.";
        await spell($(".board", el), a.board, {
          nextExhale: () => waitExhale(), isSilent: () => !state.talking,
          onChar: (s) => ($("#spell", el).textContent = s),
        });
        $("#hush", el).textContent = "";
        $("#answers", el).innerHTML = say("luna", a.luna, a.cites) + say("bigotes", a.bigotes, a.cites);
        el.querySelectorAll(".q").forEach((x) => (x.disabled = false));
        b.disabled = true;
        if (b.dataset.q === "where") toast("Under the coat. It is still there.", 4000);
      }));
    } },

  { id: "dossier", chapter: "Xochi's dossier", next: "One more thing →", html: () => `
    <div class="card">
      <div class="kicker">Xochi's dossier · Case 01 · The Coat</div><h2>What we know, and what we don't</h2>
      ${reading(state.evidence).map((l) => say(l.who, l.text, l.cites)).join("")}
      ${say("xochi", "The measurements are real. The spirit is fiction. Marina stayed home, and that is the part that matters.")}
      <p class="muted">${state.mode === "replay" ? "These are sample numbers. " : ""}Nothing from this session was saved. Close the app and it is gone.</p>
    </div>` },

  { id: "end", chapter: "Case open", next: "Start again ↺", html: () => `
    <div class="cliff">
      <img src="img/wisp.svg" alt="" style="width:120px">
      <div class="line">She hung the coat back at ${fmt(SAMPLE_CASE.coatBackAt)}.</div>
      <div class="line"><em>She covered it.</em></div>
      <p class="sub">The next morning Marina sent us a second tape. In it, the coat is on the floor.</p>
      <p class="sub" style="font-size:18px">Case 02 · coming soon · bring your own tape on the case screen</p>
    </div>` },
];

// ------------------------------------------------------------------ live camera (the investigator)
async function startLive(el, scope) {
  if (!state.liveSdk) {   // no key: a gentle simulated breath, clearly labelled
    camUI(false);
    toast("Replay mode: no Presage key on this computer, so your camera stays off and the breath is simulated.", 5000);
    let ph = 0;
    state.fakeLive = setInterval(() => { ph += 0.05; const v = (Math.sin(ph) + 1) / 2; const f = document.getElementById("breathFill"); if (f) f.style.width = v * 100 + "%"; if (v < 0.05) state.lastExhale = performance.now(); }, 50);
    scope.set(70); $("#scopeMe [data-state]").textContent = "SIMULATED";
    return;
  }
  try {
    camUI(true);
    state.live = await presage.live({
      onStream: (s) => { const v = $("#me"); if (v) { v.srcObject = s; v.play(); $("#mePh")?.remove(); } },
      onSample: ({ pulse, talking }) => {
        state.talking = talking; $("#talkFlag") && ($("#talkFlag").textContent = talking ? "you're talking · the glass waits" : "");
        if (pulse) { scope.set(pulse); const b = $("#scopeMe [data-bpm]"); if (b) b.textContent = Math.round(pulse); }
        const st = $("#scopeMe [data-state]"); if (st) st.textContent = pulse ? "LIVE" : "WARMING UP";
      },
      onTrace: (trace) => {
        const recent = trace.slice(-60); if (recent.length < 5) return;
        const vs = recent.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs);
        const level = hi > lo ? (vs.at(-1) - lo) / (hi - lo) : 0.5;
        const f = $("#breathFill"); if (f) f.style.width = level * 100 + "%";
        if (level < 0.15) state.lastExhale = performance.now();
      },
      onValidation: (code, hint) => { if (code && hint) toast(hint, 1800); },
    });
  } catch (e) { camUI(false); toast(e.message, 6000); }
}
async function waitExhale() {
  if (!state.live && !state.fakeLive) return sleep(900);
  const asked = performance.now();
  while (state.lastExhale < asked) { await sleep(80); if (performance.now() - asked > 6000) break; }
}

// ------------------------------------------------------------------ navigation
function updateNav() {
  const s = SCREENS[state.i];
  $("#next").textContent = s.next ?? "Next →";
  $("#next").disabled = s.canNext ? !s.canNext() : false;
  $("#back").style.visibility = state.i ? "visible" : "hidden";
  $("#where").textContent = `${s.chapter} · ${state.i + 1} of ${SCREENS.length}`;
  $("#chapters").innerHTML = SCREENS.map((x, i) => `<button class="chap ${i === state.i ? "on" : state.seen.has(i) ? "seen" : ""}" aria-label="${x.chapter}" data-i="${i}" ${state.seen.has(i) || i === state.i ? "" : "disabled"}></button>`).join("");
  $("#chapters").querySelectorAll(".chap").forEach((b) => b.addEventListener("click", () => go(+b.dataset.i)));
}
function go(i) {
  if (i < 0 || i >= SCREENS.length) i = 0;
  if (SCREENS[i].id === "locker" && !state.evidence.length) state.evidence = buildEvidence(sampleScans());
  state.seen.add(state.i); state.i = i;
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
  $("#next").addEventListener("click", () => go(state.i + 1));
  $("#back").addEventListener("click", () => go(state.i - 1));
  document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" && !$("#next").disabled) go(state.i + 1); if (e.key === "ArrowLeft") go(state.i - 1); });
  const start = new URLSearchParams(location.search).get("screen");
  go(start ? Math.max(0, SCREENS.findIndex((s) => s.id === start)) : 0);
}
boot();
