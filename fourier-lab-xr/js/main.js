// Fourier Lab XR · main.js
// Entry point: kit setup (header, info, settings, language, theme, PWA), then the XR app (app.js).
// The maths (fourier.js) and the grab controller (grab.js) are classic scripts loaded before this module (globals Fourier, Grab, THREE).
import { initKit, icon, toast, fmtNum } from "../../kit/kit.js";
import STRINGS from "./strings.js";
import { startApp } from "./app.js";

const VERSION = "0.1.0";

const app = { reset: () => {}, csv: () => {} };
const kit = initKit({
  slug: "fourier-lab-xr",
  name: "Fourier Lab XR",
  version: VERSION,
  strings: STRINGS,
  menu: [
    { icon: "copy", label: "menu.csv", onClick: () => app.csv() },
    { icon: "reset", label: "menu.reset", onClick: () => app.reset() },
  ],
});
for (const b of document.querySelectorAll("[data-ic]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic));
Object.assign(app, startApp({ ...kit, toast, icon, fmtNum, version: VERSION }));
