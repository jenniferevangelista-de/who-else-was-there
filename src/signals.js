// Turn one decoded SmartSpectra `metrics` payload into the plain numbers the app uses.
// Pure: no SDK import, so it runs in tests with a hand-written payload.

/** Long | number | bigint | null -> number of microseconds (or null). */
export function tsToNumber(ts) {
  if (ts === null || ts === undefined) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts === "bigint") return Number(ts);
  if (typeof ts.toNumber === "function") return ts.toNumber();
  if (typeof ts.low === "number" && typeof ts.high === "number") return ts.high * 4294967296 + (ts.low >>> 0);
  const n = Number(ts);
  return Number.isFinite(n) ? n : null;
}

const last = (arr) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);

/**
 * @param {object} m decoded Metrics
 * @param {number} t0Us session origin in microseconds (first timestamp seen)
 * @returns {{ t:number|null, pulse?:number, pulseConf?:number, breathing?:number,
 *   breathingConf?:number, talking?:boolean, trace:{t:number,v:number}[] }}
 */
export function sampleFromMetrics(m, t0Us = 0) {
  const out = { t: null, trace: [] };
  if (!m || typeof m !== "object") return out;
  const sec = (ts) => (tsToNumber(ts) - t0Us) / 1e6;
  const times = [];

  const p = last(m.cardio?.pulseRate);
  if (p && Number.isFinite(p.value)) {
    out.pulse = p.value; out.pulseConf = p.confidence ?? 0; times.push(sec(p.timestamp));
  }
  const b = last(m.breathing?.rate);
  if (b && Number.isFinite(b.value)) {
    out.breathing = b.value; out.breathingConf = b.confidence ?? 0; times.push(sec(b.timestamp));
  }
  const talk = last(m.face?.talking);
  if (talk) { out.talking = !!talk.detected; times.push(sec(talk.timestamp)); }

  for (const s of m.breathing?.upperTrace ?? []) {
    if (Number.isFinite(s.value)) out.trace.push({ t: sec(s.timestamp), v: s.value });
  }
  for (const s of out.trace) times.push(s.t);

  const ok = times.filter(Number.isFinite);
  out.t = ok.length ? Math.max(...ok) : null;
  return out;
}

/** First timestamp in a payload, used as the session origin. */
export function firstTimestampUs(m) {
  const c = [m?.cardio?.pulseRate?.[0], m?.breathing?.rate?.[0], m?.breathing?.upperTrace?.[0], m?.face?.talking?.[0]];
  for (const x of c) if (x && x.timestamp != null) return tsToNumber(x.timestamp);
  return null;
}
