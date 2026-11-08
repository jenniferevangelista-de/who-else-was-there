// Presage SmartSpectra in the renderer. Two jobs:
//  1. scanVideo: play a recording (whole frame, or a cropped region) through the SDK and collect a scan
//  2. live: the investigator's own camera during the séance
// Frames go to the SDK in this app's main process and are never stored. Telemetry is off.

import { SmartSpectraSDK, breathingMetrics, MetricType } from "@smartspectra/node-sdk/renderer";
import { decodeMetrics } from "@smartspectra/node-sdk/messages";
import { sampleFromMetrics, tsToNumber } from "../../src/signals.js";

const METRICS = [...breathingMetrics, MetricType?.PULSE_RATE ?? 15, MetricType?.TALKING ?? 13];

async function makeSdk() {
  const apiKey = await window.pod?.key();
  if (!apiKey) throw new Error("No PRESAGE_API_KEY in this computer's environment.");
  return new SmartSpectraSDK({ apiKey, requestedMetrics: METRICS, enableTelemetry: false, enableAccumulatedOutput: false });
}

/** Collect samples from an SDK into a scan, timing every reading with `clock()` seconds. */
function collector(sdk, clock) {
  const scan = { t0: clock(), t1: clock(), pulse: [], breathing: [], trace: [], talking: [], validation: [] };
  let originUs = null, originT = null;
  const at = (ts) => {
    const us = tsToNumber(ts);
    if (originUs === null) { originUs = us; originT = clock(); }
    return Math.round((originT + (us - originUs) / 1e6) * 100) / 100;
  };
  sdk.on("validationStatus", (code, ts) => scan.validation.push({ t: at(ts), code }));
  sdk.on("metrics", (buf) => {
    const m = decodeMetrics(buf);
    if (!m || m instanceof Uint8Array) return;
    const s = sampleFromMetrics(m, 0);
    const tNow = clock();
    if (s.pulse !== undefined) scan.pulse.push({ t: tNow, v: s.pulse, conf: s.pulseConf });
    if (s.breathing !== undefined) scan.breathing.push({ t: tNow, v: s.breathing, conf: s.breathingConf });
    if (s.talking !== undefined) scan.talking.push({ t: tNow, on: s.talking });
    for (const p of m.breathing?.upperTrace ?? []) {
      const t = at(p.timestamp);
      if (!scan.trace.length || t > scan.trace[scan.trace.length - 1].t) scan.trace.push({ t, v: p.value });
    }
    scan.t1 = tNow;
  });
  return scan;
}

/**
 * Play `video` from `from` to `to` seconds through the SDK. With `region` ({x,y,w,h} in 0..1) only that
 * part of the frame is sent, enlarged, so a small face in a corner can be read on its own.
 */
export async function scanVideo(video, { from = 0, to = video.duration, region = null, onTick } = {}) {
  const sdk = await makeSdk();
  const canvas = document.createElement("canvas");
  const vw = video.videoWidth, vh = video.videoHeight;
  const r = region ?? { x: 0, y: 0, w: 1, h: 1 };
  const scale = Math.min(4, 720 / (vh * r.h));
  canvas.width = Math.round(vw * r.w * scale); canvas.height = Math.round(vh * r.h * scale);
  const ctx = canvas.getContext("2d");
  let draw = true;
  const pump = () => { if (!draw) return; ctx.drawImage(video, vw * r.x, vh * r.y, vw * r.w, vh * r.h, 0, 0, canvas.width, canvas.height); video.requestVideoFrameCallback(pump); };
  sdk.useMediaStream(canvas.captureStream(30));
  const scan = collector(sdk, () => video.currentTime);
  scan.region = region;
  let failed = null;
  sdk.on("error", (code, message) => { failed = `${code}: ${message}`; });
  video.currentTime = from; video.muted = true;
  await video.play();
  video.requestVideoFrameCallback(pump);
  await sdk.start();
  await new Promise((resolve) => {
    const tick = () => {
      onTick?.(video.currentTime, scan);
      if (failed || video.ended || video.currentTime >= to) return resolve();
      setTimeout(tick, 250);
    };
    tick();
  });
  draw = false; video.pause();
  await sdk.stop().catch(() => {});
  sdk.destroy();
  if (failed) throw new Error(failed);
  scan.t0 = from; scan.t1 = Math.min(to, video.currentTime);
  return scan;
}

/** The investigator's own camera, live. Returns a handle; `stop()` releases the camera. */
export async function live({ onStream, onSample, onTrace, onValidation, onStatus, onError } = {}) {
  const sdk = await makeSdk();
  const t0 = performance.now();
  const scan = collector(sdk, () => (performance.now() - t0) / 1000);
  sdk.on("streamAvailable", (s) => onStream?.(s));
  sdk.on("validationStatus", (code, ts, hint) => onValidation?.(code, hint));
  sdk.on("processingStatus", (s) => onStatus?.(s));
  // Without this, a bad key (kAuthenticationFailed) or a camera failure after start() would leave the scope on WARMING UP forever.
  sdk.on("error", (code, message, retryable) => onError?.(code, message, retryable));
  sdk.on("metrics", () => {
    const p = scan.pulse.at(-1), b = scan.breathing.at(-1), k = scan.talking.at(-1);
    onSample?.({ pulse: p?.conf >= 50 ? p.v : null, breathing: b?.conf >= 50 ? b.v : null, talking: !!k?.on });
    onTrace?.(scan.trace);
  });
  await sdk.start();
  return { scan, async stop() { await sdk.stop().catch(() => {}); sdk.destroy(); } };
}
