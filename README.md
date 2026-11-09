# Ghost Hunt · Who Else Was There?

**Every face in this video has a heartbeat. Except one.**

A cute, spooky ghost hunt built on the [Presage SmartSpectra SDK](https://smartspectra.presagetech.com/docs). Most camera-vitals apps measure the pulse that is there. This one hunts for the pulse that is **missing**.

A client was about to go out when a feeling at the door made her stay. She never saw what stood behind her. Three tiny ghost hunters point a new instrument, the Ghost Detector, at her hallway tape. Living faces beat. The face that does not is the case. Then the spirit answers on a board that moves only when **you** breathe out, and the crew never agrees on what it meant.

Entry for the DEV Presage SmartSpectra SDK Challenge, category **Most Creative or Delightful Use**.

[![ci](https://github.com/jenniferevangelista-de/who-else-was-there/actions/workflows/ci.yml/badge.svg)](https://github.com/jenniferevangelista-de/who-else-was-there/actions/workflows/ci.yml)

![Nine screens of the app](docs/preview_sheet.jpg)

> **What is real and what is story.** Marina's case is a drawn story, and every screen in it is tagged *sample data*. The Room and "Bring your own video" run through the real SDK, and their numbers are tagged as real readings. Without a key the whole app still opens, on samples.

## What makes it different

| | |
|---|---|
| **Absence is the signal** | A face present with no valid pulse is the plot. A face too dark to read is "unreadable", never a ghost. |
| **Seven SDK signals, each with a job** | Pulse, breathing rate, chest trace, talking, blinking, expression and validation status all change what happens. |
| **Your body is the controller** | The séance glass moves on your exhale, read from the live chest trace. Start talking and it waits. |
| **Cite or vanish** | No language model. Every spirit line must cite a measured card, and every number must match it, or the line is not said. |
| **Consent is part of the game** | A rules screen first, and tapes stay locked until you confirm everyone in them agreed. |

## How it uses Presage SmartSpectra

![Signal map](docs/charts/07_signal_map.png)

| Signal | SDK field | What the game does with it |
|---|---|---|
| Pulse | `cardio.pulseRate` with confidence | Drives the heart and the detector line. Readings under 50% confidence do not count. |
| Breathing rate | `breathing.rate` | Your breaths per minute in the Room and in your report. |
| Chest movement | `breathing.upperTrace` | Moves the glass on the exhale. A flat stretch of 3 s or more becomes "held breath". |
| Talking | `face.talking` | The glass waits while you speak. |
| Blinks | `face.blinking` | The figure in the Room moves only when you blink. |
| Expression | `face.expression` | Your strongest stable expression becomes an evidence card. |
| Face checks | `validationStatus` | Multiple faces becomes "a second face". Poor light turns a verdict into "unreadable". |

The integration is in [`app/renderer/presage.js`](app/renderer/presage.js): `sdk.useMediaStream()`, `decodeMetrics`, `enableTelemetry: false`. The Proof tab in the app counts SDK responses and readings as they arrive.

## Architecture

![Architecture](docs/architecture.png)

- `src/signals.js` decodes one SDK payload into plain numbers.
- `src/evidence.js` gates by confidence and builds numbered evidence cards.
- `src/spirit.js` holds the templates, and `citeOrVanish()` decides whether a line may be said.
- `app/renderer/` holds the screens, the detector, the board, the report, the voices and the music.

## Machine learning and data science, without overclaiming

**The computer vision belongs to Presage.** Reading a pulse from pixels is what the SDK does, and this project treats it as an instrument. We trained no model of our own, and the app makes 0 language model calls.

**Our layer is signal processing and measurement.** The rules in `src/evidence.js` were tested the way a detector should be: with planted answers, confidence intervals, and a deliberate search for where they break.

`npm run benchmark` runs **19,000 synthetic scans with a known answer** from fixed seeds, so anyone gets the same numbers. These test this app's logic, not Presage's accuracy, and no person is in them.

![Verdict matrix](docs/charts/01_verdicts.png)

Living faces called a ghost: **0 of 400**.

| Held breath | Pulse jump |
|---|---|
| ![Held breath](docs/charts/02_held_breath.png) | ![Pulse jump](docs/charts/03_pulse_jump.png) |

### Where it breaks

A test that only shows wins proves little, so the stress grid pushes noise until the rules fail.

| Pulse noise | Chest noise |
|---|---|
| ![Pulse stress](docs/charts/04_stress_pulse.png) | ![Breath stress](docs/charts/05_stress_breath.png) |

![Known limit](docs/charts/06_known_limit.png)

**Known limits, stated plainly**

- At exactly 3 s, the held-breath rule fires only 31 to 74 times in 200, depending on noise. It is reliable from 4 s.
- With 9 bpm or more of reading noise, the pulse-jump rule raises false alarms (154 of 200 at 9 bpm, 200 of 200 from 12 bpm).
- A living person whose pulse stays under the confidence gate in good light is called "no pulse". That is the honest limit of reading absence, and it is one reason this is a game and never a health tool.
- Marina's tape is drawn. The SDK has been run here on a live camera and on a recording with no people in it, and has not been benchmarked on portraits or masks.

## Run it yourself (Windows, macOS Apple Silicon, Linux x64)

You need Node.js 22.12 or newer. Live readings need a Presage API key from [physiology.presagetech.com](https://physiology.presagetech.com).

```bash
git clone https://github.com/jenniferevangelista-de/who-else-was-there
cd who-else-was-there
npm install
npm start
```

**Without a key** the app opens in replay mode: sample numbers, no camera, every screen visible. No login is needed.

**With a key**, set `PRESAGE_API_KEY` in your environment before `npm start`. Then open **The Room** to read your camera, or **Bring your own video** to read a recording. The key is read from the environment by the main process and is never written to disk.

```bash
npm test                         # 36 unit tests
npm run benchmark                # writes demo/measured.json
python scripts/make_charts.py    # redraws every chart from it (needs matplotlib)
```

## Consent and Data Handling

- **Camera consent:** the rules are shown before the hunt. The camera turns on only when you press a button, and the pill at the top right turns it off at any time. Video only; the microphone is never requested.
- **Tapes you bring:** the file picker stays locked until you confirm that everyone in the recording agreed to be in it and to have it read.
- **Storage and retention:** the app saves no frames and records no video. Readings live in memory and vanish when the app closes. A dossier or session report is written only if you press Download or Save; each holds numbers and words, no images.
- **Display:** the live preview appears only on the screen of the person in front of the camera.
- **Sharing:** the app sends nothing to any server of its own, and it has none.
- **The SDK:** frames are handed to Presage SmartSpectra inside the app, which is initialised with your API key and uses Presage's authenticated channel. Presage's public documentation does not say where frames are processed, so this project does not claim on-device processing. See Presage's [Telemetry and Privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy) page and Privacy Policy for the SDK's own requests and retention.
- **SDK telemetry:** switched off (`enableTelemetry: false`). By Presage's documentation that aggregate telemetry excludes frames and measured values.
- **Deletion:** close the app and the readings are gone. Delete a downloaded dossier like any file.
- **AI services:** none at run time. The spirit's answers are templates that must cite measured evidence.
- This is a game, not a medical device. It does not diagnose, treat or monitor anyone.

## Credits

Characters Luna, Dr. Bigotes and Xochi come from [Witching Hour](https://github.com/jenniferevangelista-de/witching-hour) by the same author. Fonts: Fredoka, Cormorant Garamond, VT323 (SIL Open Font License). MIT licensed.
