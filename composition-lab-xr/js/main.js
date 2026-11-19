// Composition Lab XR · main.js
// Entry point: kit setup (header, info, settings, language, theme, PWA), then the XR app (app.js).
// The maths (expr.js, compose.js) and the grab controller (grab.js) are classic scripts loaded before this module
// (globals Expr, Compose, Grab, THREE).
import { initKit, icon, toast, fmtNum, parseNum, showQR } from "../../kit/kit.js";
import STRINGS from "./strings.js";
import { startApp } from "./app.js";

const VERSION = "0.1.0";

const app = { reset: () => {}, share: () => {}, url: () => location.href };
const kit = initKit({
  slug: "composition-lab-xr",
  name: "Composition Lab XR",
  version: VERSION,
  strings: STRINGS,
  menu: [
    { icon: "link", label: "menu.share", onClick: () => app.share() },
    { icon: "qr", label: "kit.qr", onClick: () => showQR(app.url()) },
    { icon: "reset", label: "menu.reset", onClick: () => app.reset() },
  ],
});
for (const b of document.querySelectorAll("[data-ic]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic));
Object.assign(app, startApp({ ...kit, toast, icon, fmtNum, parseNum, version: VERSION }));
