// The report screen, and the same report as a file the person can choose to save. HTML strings only, so it also runs in tests.

const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CHECK = {
  0: ["Face ready", "Rosto pronto"], 1: ["No face found", "Nenhum rosto"], 2: ["More than one face", "Mais de um rosto"], 3: ["Face not centered", "Rosto fora do centro"],
  4: ["Face size out of range", "Tamanho do rosto fora da faixa"], 5: ["Too dark", "Escuro demais"], 6: ["Too bright", "Claro demais"], 7: ["Chest not visible", "Peito fora da imagem"],
  10: ["Camera tuning", "Ajustando a câmera"], 11: ["Frame rate too low", "Poucos quadros por segundo"], 12: ["Too much motion", "Movimento demais"], 13: ["Face too close", "Rosto perto demais"],
  14: ["Face too far", "Rosto longe demais"], 15: ["Face too high", "Rosto alto demais"], 16: ["Face too low", "Rosto baixo demais"], 17: ["Not facing the camera", "Rosto virado para o lado"],
};

export const REPORT_CSS = `
.rp { --rp-ink:#f6eefc; --rp-muted:#c8b7dc; --rp-rule:#ffffff22; --rp-gold:#e8c27a; --rp-line:#86efc4; --rp-panel:#ffffff0c; --rp-bg:#1d112c; color:var(--rp-ink); line-height:1.35; }
.rp * { box-sizing:border-box; }
.rp h2, .rp h3, .rp p { margin:0; }
.rp-card { background:var(--rp-bg); border:1px solid #e8c27a55; border-radius:16px; padding:16px 20px; }
.rp-head { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; }
.rp-kicker { font-size:12px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:var(--rp-gold); }
.rp-result-label { font-size:13px; color:var(--rp-muted); margin-top:6px; }
.rp-result { display:inline-block; font-family:var(--f-title, Georgia, serif); font-size:31px; line-height:1.1; font-weight:700; letter-spacing:2.5px; color:var(--rp-line); border:4px solid currentColor; border-radius:10px; padding:7px 18px; margin:2px 0 7px !important; transform:rotate(-1deg); }
.rp-result.warn { color:#ff7f96; }
.rp-result.maybe { color:var(--rp-gold); }
.rp-sub { color:var(--rp-muted); font-size:15px; }
.rp-badge { flex:none; font-size:12px; font-weight:700; border:1px solid var(--rp-line); color:var(--rp-line); border-radius:999px; padding:5px 12px; }
.rp-badge.sim { border-color:var(--rp-gold); color:var(--rp-gold); }
.rp-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:12px 0; }
.rp-stat { background:var(--rp-panel); border:1px solid var(--rp-rule); border-radius:12px; padding:8px 12px; }
.rp-stat b { display:block; font-size:32px; line-height:1.05; font-variant-numeric:tabular-nums; }
.rp-stat b small { font-size:14px; font-weight:500; color:var(--rp-muted); }
.rp-stat span { display:block; font-size:13px; font-weight:600; }
.rp-stat i { display:block; font-size:12px; font-style:normal; color:var(--rp-muted); }
.rp-cols { display:grid; grid-template-columns:1.25fr 1fr; gap:14px; }
.rp-chart { position:relative; margin-bottom:8px; }
.rp-chart h3, .rp-h { font-size:14px; font-weight:700; margin-bottom:2px; }
.rp-chart svg { display:block; width:100%; height:auto; overflow:visible; }
.rp-empty { color:var(--rp-muted); font-size:14px; padding:8px 0; }
.rp-tip { position:absolute; top:18px; transform:translateX(-50%); background:#f6eefc; color:#241538; border-radius:8px; padding:3px 8px; font-size:12px; font-weight:700; white-space:nowrap; pointer-events:none; }
.rp-cross { position:absolute; top:22px; bottom:22px; width:1px; background:#ffffff88; pointer-events:none; }
.rp table { width:100%; border-collapse:collapse; font-size:13.5px; }
.rp th { text-align:left; font-size:12px; color:var(--rp-muted); font-weight:600; padding:3px 8px 3px 0; border-bottom:1px solid var(--rp-rule); }
.rp td { padding:4px 8px 4px 0; border-bottom:1px solid #ffffff12; vertical-align:top; }
.rp td.n { font-variant-numeric:tabular-nums; white-space:nowrap; }
.rp code { font:12.5px Consolas, ui-monospace, monospace; color:#ffc4da; }
.rp-foot { color:var(--rp-muted); font-size:12.5px; margin-top:10px !important; }
.rp-title { font-size:27px; font-style:italic; margin-top:2px !important; }
.rp-tech { color:var(--rp-muted); font-size:13.5px; margin-top:8px !important; }
.rp-diagnosis { margin-top:8px; padding-top:6px; border-top:1px solid var(--rp-rule); }
.rp-cat { display:flex; gap:14px; align-items:baseline; margin:2px 0 12px; }
.rp-cat h2 { font-size:26px; font-style:italic; flex:none; }
.rp-stack { display:grid; gap:12px; align-content:start; }
.rp-file { display:block; margin:14px 0; }
`;

function chart(series, { title, unit, empty, marks = [], tr }) {
  if (series.length < 2) return `<div class="rp-chart"><h3>${title}</h3><p class="rp-empty">${empty}</p></div>`;
  const W = 560, H = 112, L = 34, R = 10, T = 8, B = 20;
  const vs = series.map((p) => p.v), lo = Math.floor(Math.min(...vs) - 3), hi = Math.ceil(Math.max(...vs) + 3);
  const t0 = series[0].t, t1 = Math.max(series.at(-1).t, t0 + 1);
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R), y = (v) => H - B - ((v - lo) / (hi - lo)) * (H - T - B);
  let d = "";
  series.forEach((p, i) => { d += `${i === 0 || p.t - series[i - 1].t > 6 ? "M" : "L"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`; });
  const grid = [lo, Math.round((lo + hi) / 2), hi].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#ffffff1c"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#c8b7dc">${v}</text>`).join("");
  const ticks = [t0, (t0 + t1) / 2, t1].map((t, i) => `<text x="${x(t)}" y="${H - 5}" text-anchor="${["start", "middle", "end"][i]}" font-size="11" fill="#c8b7dc">${mmss(t)}</text>`).join("");
  const dots = marks.filter((m) => m.t >= t0 && m.t <= t1).map((m) => m.line
    ? `<line x1="${x(m.t)}" x2="${x(m.t)}" y1="${T}" y2="${H - B}" stroke="#e8c27a" stroke-dasharray="3 3"/><text x="${x(m.t) + 4}" y="${T + 9}" font-size="11" fill="#e8c27a">${m.label}</text>`
    : `<circle cx="${x(m.t)}" cy="${y(m.v)}" r="5" fill="#ff7f96" stroke="#1d112c" stroke-width="2"><title>${m.label}</title></circle>`).join("");
  const data = esc(JSON.stringify({ unit, xs: series.map((p) => +(((x(p.t)) / W) * 100).toFixed(2)), ts: series.map((p) => mmss(p.t)), vs }));
  return `<div class="rp-chart" data-chart="${data}"><h3>${title}</h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${grid}${ticks}<path d="${d}" fill="none" stroke="#86efc4" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg></div>`;
}

export function reportHTML(r, lang = "en") {
  const tr = (en, pt) => (lang === "pt" ? pt : en);
  const video = r.source === "video", pick = (cam, vid) => (video ? vid : cam);
  const n = (v, d = 0) => (v === null || v === undefined ? "--" : Number(v).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }));
  const when = r.when ? new Date(r.when).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
  const stat = (big, unit, label, note) => `<div class="rp-stat"><b>${big}${unit ? ` <small>${unit}</small>` : ""}</b><span>${label}</span><i>${note}</i></div>`;
  const EVENT = { first_pulse: tr("First confident heartbeat", "Primeiro batimento confiável"), held_breath: pick(tr("You held your breath", "Você prendeu a respiração"), tr("Breath held", "Respiração presa")), pulse_jump: pick(tr("Your pulse jumped", "Seu pulso disparou"), tr("Pulse jumped", "Pulso disparou")), glass_stopped: tr("The glass stopped", "O copo parou") };
  const shown = r.timeline.slice(0, 8), hiddenRows = r.timeline.length - shown.length;
  const verdict = {
    none: ["", tr("NO SPIRIT DETECTED IN THIS VIDEO", "SEM ESPÍRITO DETECTADO NO VÍDEO"), pick(tr(`One face and one heartbeat: yours. A ghost reads 0 bpm. You read ${n(r.pulse.median)}.`, `Um rosto e um batimento: o seu. Um fantasma marca 0 bpm. Você marcou ${n(r.pulse.median)}.`), tr(`No second face stayed in the frame, and the heartbeat read around ${n(r.pulse.median)} bpm. A ghost reads 0.`, `Nenhum segundo rosto ficou no quadro, e o batimento ficou por volta de ${n(r.pulse.median)} bpm. Um fantasma marca 0.`))],
    second_face: ["warn", tr("POSSIBLE SPIRIT: A SECOND FACE IN THIS VIDEO", "POSSÍVEL ESPÍRITO: UM SEGUNDO ROSTO NO VÍDEO"), pick(tr(`The detector saw more than one face in ${n(r.spirit.secondFacePct)}% of its checks. Was someone behind you?`, `O detector viu mais de um rosto em ${n(r.spirit.secondFacePct)}% das checagens. Tinha alguém atrás de você?`), tr(`The detector saw more than one face in ${n(r.spirit.secondFacePct)}% of its checks. Who else was there?`, `O detector viu mais de um rosto em ${n(r.spirit.secondFacePct)}% das checagens. Quem mais estava lá?`))],
    inconclusive: ["maybe", tr("INCONCLUSIVE: NO SIGNAL WE CAN TRUST", "INCONCLUSIVO: SEM SINAL CONFIÁVEL"), tr("The detector never got a pulse it could trust this time. More light and less movement usually help.", "Desta vez o detector não conseguiu um pulso confiável. Mais luz e menos movimento costumam ajudar.")],
  }[r.spirit.result];
  const marks = [...r.jumps.map((j) => ({ t: j.t, v: j.to, label: tr(`Pulse jumped ${j.rise} bpm`, `Pulso subiu ${j.rise} bpm`) })), ...(r.glassAt === null ? [] : [{ t: r.glassAt, line: true, label: tr("glass stopped", "copo parou") }])];

  const resultBlock = `<div class="rp-result-label">${pick(tr("Result", "Resultado"), tr("Our diagnosis", "Nosso diagnóstico"))}</div><h2 class="rp-result ${verdict[0]}">${verdict[1]}</h2><p class="rp-sub">${verdict[2]}</p>`;
  const signals = [
    [tr("Pulse", "Pulso"), "cardio.pulseRate", n(r.pulse.readings), tr("The heart and the detector", "O coração e o detector")],
    [tr("Breathing rate", "Respiração"), "breathing.rate", n(r.breathing.readings), tr("Breaths per minute", "Respirações por minuto")],
    [tr("Chest movement", "Movimento do peito"), "breathing.upperTrace", n(r.chestPoints), tr("Moves the glass, finds held breaths", "Move o copo e acha respiração presa")],
    [tr("Talking", "Fala"), "face.talking", n(r.talkingSamples), tr("The glass waits while you speak", "O copo espera você falar")],
    [tr("Blinks", "Piscadas"), "face.blinking", n(r.blinks), tr("The figure moves only when you blink", "A figura só anda quando você pisca")],
    [tr("Facial expression", "Expressão facial"), "face.expression", n(r.expressions.reduce((a, e) => a + e.count, 0)), tr("Becomes an evidence card", "Vira cartão de prova")],
    [tr("Face checks", "Checagens do rosto"), "validationStatus", n(r.checksTotal), tr("Light, distance, second face", "Luz, distância, segundo rosto")],
  ];
  const rules = [
    [tr("Prize category", "Categoria"), "Most Creative or Delightful Use"],
    [pick(tr("Live signal", "Sinal ao vivo"), tr("Signal", "Sinal")), pick(tr("From your own camera, in this session.", "Da sua própria câmera, nesta sessão."), tr("Read from the video you chose, in this session.", "Lido do vídeo que você escolheu, nesta sessão."))],
    [tr("Consent", "Consentimento"), pick(tr("Rules first. The camera starts only when you press the button, video only.", "Regras primeiro. A câmera só liga quando você aperta o botão, só vídeo."), tr("You confirmed everyone in the video agreed to be read.", "Você confirmou que todos no vídeo concordaram com a leitura."))],
    [tr("Storage", "Armazenamento"), tr("No frames or video saved. This report leaves memory only if you press Save.", "Nenhum quadro ou vídeo é salvo. Este relatório só sai da memória se você apertar Salvar.")],
    [tr("Telemetry", "Telemetria"), tr("SDK telemetry off in the code. No language model called.", "Telemetria do SDK desligada no código. Nenhum modelo de linguagem é chamado.")],
    [tr("Not medical", "Não é médico"), tr("A game. No diagnosis, treatment or health advice.", "Um jogo. Sem diagnóstico, tratamento ou conselho de saúde.")],
  ];

  return `<style>${REPORT_CSS}</style>
  <div class="tabs" role="tablist"><button class="tab on" data-tab="session" role="tab">${pick(tr("Your session", "Sua sessão"), tr("Your video", "Seu vídeo"))}</button><button class="tab" data-tab="made" role="tab">${tr("How it was made", "Como foi feito")}</button></div>
  <div class="rp" id="reportBody">
  <div class="rp-card" data-pane="session">
    <div class="rp-head"><div><div class="rp-kicker">${pick(tr("Ghost Detector · session report", "Detector de Fantasma · relatório da sessão"), tr("Ghost Detector · video report", "Detector de Fantasma · relatório do vídeo"))}</div>
      ${video ? `<h2 class="rp-title">${tr("What the detector read in your video", "O que o detector leu no seu vídeo")}</h2>` : resultBlock}</div>
      <div class="rp-badge ${r.simulated ? "sim" : ""}">${r.simulated ? tr("SIMULATED · no Presage key", "SIMULADO · sem chave Presage") : tr("REAL READING · Presage SmartSpectra", "LEITURA REAL · Presage SmartSpectra")}</div></div>
    <div class="rp-stats">
      ${stat(n(r.pulse.median), "bpm", pick(tr("Your heartbeat", "Seu batimento"), tr("Heartbeat", "Batimento")), r.pulse.median === null ? tr("no confident reading", "sem leitura confiável") : tr(`from ${n(r.pulse.min)} to ${n(r.pulse.max)}`, `de ${n(r.pulse.min)} a ${n(r.pulse.max)}`))}
      ${stat(n(r.breathing.median), "/min", pick(tr("Your breathing", "Sua respiração"), tr("Breathing", "Respiração")), r.breathing.median === null ? tr("no confident reading", "sem leitura confiável") : tr(`from ${n(r.breathing.min)} to ${n(r.breathing.max)}`, `de ${n(r.breathing.min)} a ${n(r.breathing.max)}`))}
      ${stat(n(r.blinks), "", tr("Blinks", "Piscadas"), r.blinksPerMin === null ? "" : tr(`${n(r.blinksPerMin)} per minute`, `${n(r.blinksPerMin)} por minuto`))}
      ${stat(n(r.longestHold, 1), "s", tr("Longest held breath", "Maior respiração presa"), tr(`${n(r.held.length)} detected`, `${n(r.held.length)} detectada${r.held.length === 1 ? "" : "s"}`))}
      ${stat(mmss(r.seconds), "", pick(tr("Session length", "Duração da sessão"), tr("Video length", "Duração do vídeo")), r.pulse.firstAt === null ? "" : tr(`pulse found at ${mmss(r.pulse.firstAt)}`, `pulso achado em ${mmss(r.pulse.firstAt)}`))}
    </div>
    <div class="rp-cols">
      <div>${chart(r.pulse.series, { title: tr("Heartbeat (bpm)", "Batimento (bpm)"), unit: "bpm", empty: tr("No confident pulse readings.", "Nenhuma leitura confiável de pulso."), marks, tr })}
        ${chart(r.breathing.series, { title: tr("Breaths per minute", "Respirações por minuto"), unit: "/min", empty: tr("No confident breathing readings.", "Nenhuma leitura confiável de respiração."), tr })}</div>
      <div class="rp-stack"><div><div class="rp-h">${tr("What happened", "O que aconteceu")}</div>
        <table><thead><tr><th>${tr("When", "Quando")}</th><th>${tr("Event", "Evento")}</th><th>${tr("Value", "Valor")}</th></tr></thead><tbody>
        ${shown.map((e) => `<tr><td class="n">${mmss(e.t)}</td><td>${EVENT[e.kind]}</td><td class="n">${e.value === null ? "" : `${n(e.value, 1)} ${e.unit}`}</td></tr>`).join("") || `<tr><td colspan="3">${tr("Nothing yet.", "Nada ainda.")}</td></tr>`}
        ${hiddenRows > 0 ? `<tr><td colspan="3">${tr(`and ${n(hiddenRows)} more`, `e mais ${n(hiddenRows)}`)}</td></tr>` : ""}</tbody></table></div>
        <p class="rp-sub">${r.expressions.length ? `${pick(tr("Most often on your face (game reading):", "O que mais apareceu no seu rosto (leitura de jogo):"), tr("Most often on a face (game reading):", "O que mais apareceu no rosto (leitura de jogo):"))} <b>${esc(r.expressions[0].name)}</b>. ` : ""}${r.talkingPct === null ? "" : pick(tr(`You were talking ${n(r.talkingPct)}% of the time.`, `Você falou em ${n(r.talkingPct)}% do tempo.`), tr(`Someone was talking ${n(r.talkingPct)}% of the time.`, `Alguém falou em ${n(r.talkingPct)}% do tempo.`))}${r.glassAt === null ? "" : ` ${r.jumpedAfterGlass ? tr("Your pulse jumped right after the glass stopped.", "Seu pulso disparou logo depois que o copo parou.") : tr("Your pulse held steady after the glass stopped.", "Seu pulso ficou firme depois que o copo parou.")}`}</p></div>
    </div>
    ${video ? `<p class="rp-tech">${tr("Detected by", "Detectado por")} <b>Presage SmartSpectra</b> (<code>@smartspectra/node-sdk 3.4.0</code>): ${tr("pulse, breathing, chest movement, talking, blinks, expressions and face checks.", "pulso, respiração, movimento do peito, fala, piscadas, expressões e checagens do rosto.")}</p><div class="rp-diagnosis">${resultBlock}</div>` : ""}
    <p class="rp-foot">${when ? `${when}. ` : ""}${pick(tr("Estimated by an ordinary camera for a game: not a medical measurement.", "Estimativa feita por uma câmera comum, para um jogo: não é medição médica."), tr("Estimated from an ordinary video for a game: not a medical measurement.", "Estimativa feita a partir de um vídeo comum, para um jogo: não é medição médica."))}</p>
  </div>

  <div class="rp-card" data-pane="made" hidden>
    <div class="rp-kicker">${tr("Prize category we are entering", "Categoria em que estamos concorrendo")}</div>
    <div class="rp-cat"><h2>Most Creative or Delightful Use</h2><p class="rp-sub">${tr("The most original, playful, or unexpected use of SmartSpectra.", "O uso mais original, divertido ou inesperado do SmartSpectra.")}</p></div>
    <div class="rp-stats">
      ${stat(n(r.sdkResponses), "", tr("SDK responses", "Respostas do SDK"), tr("this session", "nesta sessão"))}
      ${stat(n(r.pulse.maxConf), "%", tr("Best pulse confidence", "Melhor confiança do pulso"), r.pulse.meanConf === null ? "" : tr(`average ${n(r.pulse.meanConf)}%`, `média ${n(r.pulse.meanConf)}%`))}
      ${stat(n(r.pulse.confident), "", tr("Confident pulses", "Pulsos confiáveis"), tr(`of ${n(r.pulse.readings)} readings`, `de ${n(r.pulse.readings)} leituras`))}
      ${stat(n(r.readyPct), "%", tr("Frames ready", "Quadros prontos"), tr(`${n(r.checksTotal)} face checks`, `${n(r.checksTotal)} checagens`))}
      ${stat(n(r.sdkErrors), "", tr("SDK errors", "Erros do SDK"), tr("this session", "nesta sessão"))}
    </div>
    <div class="rp-cols" style="grid-template-columns:1.15fr 1fr">
      <div><table><thead><tr><th>${tr("Signal", "Sinal")}</th><th>${tr("Presage field", "Campo Presage")}</th><th>${tr("Count", "Total")}</th><th>${tr("What it does", "O que faz")}</th></tr></thead><tbody>
        ${signals.map(([a, b, c, d]) => `<tr><td>${a}</td><td><code>${b}</code></td><td class="n">${c}</td><td>${d}</td></tr>`).join("")}</tbody></table>
        <p class="rp-foot"><code>@smartspectra/node-sdk 3.4.0</code> · <code>sdk.useMediaStream()</code> · <code>decodeMetrics()</code> · <code>enableTelemetry: false</code></p></div>
      <div class="rp-stack"><table><thead><tr><th>${tr("Challenge", "Desafio")}</th><th>${tr("In this app", "Neste app")}</th></tr></thead><tbody>${rules.map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join("")}</tbody></table>
      ${r.checks.length ? `<table><thead><tr><th>${tr("Face check", "Checagem")}</th><th>${tr("Count", "Total")}</th><th>%</th></tr></thead><tbody>${r.checks.slice(0, 4).map((c) => `<tr><td>${CHECK[c.code] ? tr(...CHECK[c.code]) : `#${c.code}`}</td><td class="n">${n(c.count)}</td><td class="n">${c.pct}%</td></tr>`).join("")}</tbody></table>` : ""}</div>
    </div>
  </div>
  </div>`;
}

/** Tabs and the hover readout on the charts. */
export function bindReport(el, onChange) {
  el.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    el.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
    el.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
    onChange?.();
  }));
  el.querySelectorAll("[data-chart]").forEach((box) => {
    const { unit, xs, ts, vs } = JSON.parse(box.dataset.chart);
    const svg = box.querySelector("svg"), tip = document.createElement("div"), cross = document.createElement("div");
    tip.className = "rp-tip"; cross.className = "rp-cross"; tip.hidden = cross.hidden = true; box.append(cross, tip);
    svg.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect(), at = ((e.clientX - r.left) / r.width) * 100;
      let i = 0; xs.forEach((x, k) => { if (Math.abs(x - at) < Math.abs(xs[i] - at)) i = k; });
      tip.hidden = cross.hidden = false; tip.style.left = cross.style.left = `${xs[i]}%`; tip.textContent = `${ts[i]} · ${Math.round(vs[i] * 10) / 10} ${unit}`;
    });
    svg.addEventListener("mouseleave", () => { tip.hidden = cross.hidden = true; });
  });
}

/** Written only when the person presses Save: both tabs in one page, numbers and words, no script. */
export function reportFile(body, title) {
  const copy = body.cloneNode(true);
  copy.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = false; p.removeAttribute("hidden"); p.classList.add("rp-file"); });
  copy.querySelectorAll(".rp-tip, .rp-cross").forEach((n) => n.remove());
  copy.querySelectorAll("[data-chart]").forEach((n) => n.removeAttribute("data-chart"));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${REPORT_CSS} body{margin:0;padding:24px;background:#140b20;font-family:Segoe UI,system-ui,sans-serif} .rp{max-width:1180px;margin:0 auto} @media(max-width:800px){.rp-cols,.rp-stats{grid-template-columns:1fr 1fr} .rp-cols{grid-template-columns:1fr}}</style></head><body>${copy.outerHTML}</body></html>`;
}
