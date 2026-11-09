---
title: "Ghost Hunt · Who Else Was There? Every face has a heartbeat. Except one."
published: false
tags: devchallenge, presagechallenge, webdev, javascript
---

*This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/devteam/join-the-presage-smartspectra-sdk-challenge-3000-in-prizes-across-10-winners-1370).*

## What I Built

Most camera-vitals apps measure the pulse that is there. **Ghost Hunt** hunts for the pulse that is missing.

Marina was about to go out. At the door, a feeling hit her so hard she couldn't breathe, and she stayed home. She lives alone and saw nothing, but the hallway camera was on. Three tiny ghost hunters point a new instrument at her tape, the Ghost Detector. Living faces beat. The face that does not is the case.

Then the spirit answers on a board that moves only when **you** breathe out. Luna believes. Dr. Bigotes doubts. Xochi writes it all down. And then it is your turn: the detector reads you, live, or a video you bring.

![Nine screens of the app](https://raw.githubusercontent.com/jenniferevangelista-de/who-else-was-there/main/docs/preview_sheet.jpg)

It is a desktop app in Electron, in English and Portuguese, with original music and voices.

## Demo

**Demo, with the live signal:** VIDEO_DEMO_LINK

**Pitch:** VIDEO_PITCH_LINK

No login is needed. Without a Presage key the app opens on sample numbers, and every sample screen is tagged. With a key, The Room reads your camera live.

## Code

{% github jenniferevangelista-de/who-else-was-there %}

Setup is in the README. The SDK integration is in `app/renderer/presage.js`.

## How It Responds to Human Signals

Seven SmartSpectra signals, and each one has a job in the game.

![Signal map](https://raw.githubusercontent.com/jenniferevangelista-de/who-else-was-there/main/docs/charts/07_signal_map.png)

- **Pulse** (`cardio.pulseRate`) drives the heart and the detector line, in real time. Readings under 50% confidence do not count.
- **Chest movement** (`breathing.upperTrace`) moves the séance glass when you breathe out, and finds a held breath.
- **Talking** (`face.talking`) makes the glass wait while you speak.
- **Blinks** (`face.blinking`) are the only thing that moves the figure in the Room.
- **Breathing rate** (`breathing.rate`) and **expression** (`face.expression`) become your numbers and your evidence cards.
- **Validation status** (`validationStatus`) turns "multiple faces" into *a second face*, and poor light into "unreadable". A badly lit face is never called a ghost.

One rule keeps the spirit honest: **cite or vanish**. There is no language model. Every line the spirit says must cite a measured card, and every number in it must match that card, or the line is not said.

![Architecture](https://raw.githubusercontent.com/jenniferevangelista-de/who-else-was-there/main/docs/architecture.png)

### Measured, including where it breaks

The computer vision belongs to Presage, and I treat it as an instrument. My layer is signal processing and rules, so I tested those the way a detector should be tested: **19,000 synthetic scans with a known answer**, from fixed seeds, reproducible with `npm run benchmark`. They test my logic, not Presage's accuracy.

![1,000 correct verdicts](https://raw.githubusercontent.com/jenniferevangelista-de/who-else-was-there/main/docs/charts/01_verdicts.png)

Living faces called a ghost: **0 of 400**. Then I pushed the noise up until the rules failed, because that is the useful part.

![Pulse stress test](https://raw.githubusercontent.com/jenniferevangelista-de/who-else-was-there/main/docs/charts/04_stress_pulse.png)

With 9 bpm or more of reading noise, the pulse-jump rule starts raising false alarms. The README lists every limit I found.

## Prize Categories

**Most Creative or Delightful Use.** The discovery here is a heartbeat that never comes, your own breath moves the glass on the board, and the blink is a jump scare with rules.

## Consent and Data Handling

- **Camera consent:** a rules screen comes first. The camera turns on only when you press a button, a pill at the top right turns it off at any time, and the microphone is never requested.
- **Other people's videos:** the file picker stays locked until you confirm that everyone in the recording agreed.
- **Storage and retention:** no frames saved and no video recorded. Readings live in memory and vanish when the app closes. A report is written only if you press Save, with numbers and words only.
- **Sharing:** the app has no server of its own and sends nothing to one.
- **The SDK:** frames are handed to Presage SmartSpectra inside the app, which uses your API key and Presage's authenticated channel. Presage's public documentation does not say where frames are processed, so I do not claim on-device processing. See Presage's Telemetry and Privacy page and Privacy Policy.
- **SDK telemetry:** switched off (`enableTelemetry: false`).
- **Deletion:** close the app and the readings are gone. Delete a saved report like any file.
- **AI services:** none at run time.
- **Not medical:** this is a game. It does not diagnose, treat or monitor anyone.

Built with AI coding assistance. The story, design decisions and testing direction are mine.
