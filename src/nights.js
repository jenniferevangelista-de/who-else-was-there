// The haunting calendar: one square per night of the hallway camera.
// Each night is a short summary of what the Pulse-o-Scope reported for that night's clip:
// how many faces, how many of them showed a pulse. Pure data helpers; the sample month is labelled SAMPLE.

/** What a night square says, from its face counts. */
export function nightKind(n) {
  if (!n || n.locked) return "locked";
  if (n.faces === 0) return "empty";
  if (n.stillFaces > 0) return "no_pulse";
  if (n.faces > 1) return "visitor";
  return "alone";
}

export const NIGHT_LABEL = {
  empty: "nobody in the hallway",
  alone: "one living face",
  visitor: "two faces, both with a pulse",
  no_pulse: "a face with no pulse",
  locked: "tape not opened yet",
};

/** Sample month for Marina's camera, Oct 6 to Nov 4. One clip per night, around 21:40. */
export function sampleMonth() {
  const nights = [];
  const start = new Date(Date.UTC(2026, 9, 6));
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    let n = { date: iso, faces: 1, livingFaces: 1, stillFaces: 0 };
    if ([3, 11, 17, 24].includes(i)) n = { date: iso, faces: 0, livingFaces: 0, stillFaces: 0 };          // she was out
    if (iso === "2026-10-18") n = { date: iso, faces: 2, livingFaces: 2, stillFaces: 0, note: "Her sister visited. Two faces, two pulses." };
    if (iso === "2026-10-31") n = { date: iso, faces: 3, livingFaces: 3, stillFaces: 0, note: "Halloween. Three trick-or-treaters at the door, all alive." };
    if (iso === "2026-11-02") n = { date: iso, faces: 2, livingFaces: 1, stillFaces: 1, caseId: "the-door", note: "The night she did not go out." };
    if (iso === "2026-11-03") n = { date: iso, locked: true, note: "Case 02. It is outside her bedroom." };
    if (iso === "2026-11-04") n = { date: iso, locked: true, note: "Not sent yet." };
    nights.push({ ...n, kind: nightKind(n) });
  }
  return nights;
}

/** Totals for the header line. */
export function monthTotals(nights) {
  const open = nights.filter((n) => !n.locked);
  return {
    nights: nights.length,
    opened: open.length,
    livingFaces: open.reduce((a, n) => a + (n.livingFaces ?? 0), 0),
    stillFaces: open.reduce((a, n) => a + (n.stillFaces ?? 0), 0),
  };
}
