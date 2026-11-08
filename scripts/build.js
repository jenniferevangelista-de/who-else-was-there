// Bundles the preload (Node/CommonJS, Electron external) and the renderer (browser IIFE).
import { build } from "esbuild";
const common = { bundle: true, logLevel: "warning", legalComments: "none" };
await build({ ...common, entryPoints: ["app/preload.cjs"], outfile: "dist/preload.cjs", platform: "node", format: "cjs", external: ["electron"] });
await build({ ...common, entryPoints: ["app/renderer/app.js"], outfile: "dist/app.js", platform: "browser", format: "iife" });
console.log("built dist/preload.cjs and dist/app.js");
