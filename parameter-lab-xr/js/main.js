// Parameter Lab XR · main.js
// Entry point: kit setup (header, info, settings, language, theme, PWA), then the XR app (app.js).
// The maths (expr.js, engine.js, presets.js) and the grab controller (grab.js) are classic scripts loaded before this module
// (globals Expr, Engine, Presets, Grab, THREE).
import { initKit, icon, toast, fmtNum, parseNum, niceTicks, showQR } from "../../kit/kit.js";
import STRINGS from "./strings.js";
import { startApp } from "./app.js";

const VERSION = "0.1.0";

const app = { reset: () => {}, share: () => {}, discText: () => {} };
const kit = initKit({
  slug: "parameter-lab-xr",
  name: "Parameter Lab XR",
  version: VERSION,
  strings: STRINGS,
  menu: [
    { icon: "link", label: "menu.share", onClick: () => app.share() },
    { icon: "qr", label: "kit.qr", onClick: () => showQR(app.url()) },
    { icon: "copy", label: "menu.disc", onClick: () => app.discText() },
    { icon: "reset", label: "menu.reset", onClick: () => app.reset() },
  ],
});
for (const b of document.querySelectorAll("[data-ic]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic));
Object.assign(app, startApp({ ...kit, toast, icon, fmtNum, parseNum, niceTicks, version: VERSION }));
