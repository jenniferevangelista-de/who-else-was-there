# Ghost Hunt pitch: spec

GOAL: a judge finishes knowing the idea (a missing pulse), that all seven signals have a job, and that the claims were measured.
OUTPUT: HyperFrames, 1920 x 1080, 30 fps.
TIME: 112 s, set by the voice in `timeline.json`.
LOOK: the app's own world. Ground #1a0f2b. Ink #f6f0ff. Pink #ff86b8 for the missing pulse, mint #9af5c8 for measured data. Display Cormorant italic 600 at 80-150 px, body Fredoka at 28 px or more, scope numbers VT323.
OBJECTS: Wisp (the app's own ghost, mouth driven by the voice), the real screens, the real detector panel, the heart and the still heart.
MOTION: enter with power3.out, 0.42 s. One hero move per beat. Line charts draw in 1.4 s. Count-ups 1.2-1.4 s.
SHOTS: hook, idea, tape, board, seven, live, cite, scans, rules, breaks, consent, end. Timing per sentence is in `timeline.json`.
BANNED: chiado or any noise-based effect (only sine tones), KPI cards in a row, a logo in a corner, numbers typed by hand, any claim of medical use or of Presage accuracy.
QA: every number comes from `demo/measured.json` through `make.py`, which asserts the figures the voice says. Sample numbers are tagged on screen.
