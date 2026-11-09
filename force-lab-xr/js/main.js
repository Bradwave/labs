// Force Lab XR · main.js
// Entry point: kit setup (header, info, settings, language, theme, PWA), then the XR app (app.js).
// The physics and the panels are classic scripts loaded before this module (globals Physics, Tracks, Input, XRPanel, Grab, Pointer, THREE).
import { initKit, icon, toast } from "../../kit/kit.js";
import STRINGS from "./strings.js";
import { startApp } from "./app.js";

const VERSION = "0.1.0";

const kit = initKit({
  slug: "force-lab-xr",
  name: "Force Lab XR",
  version: VERSION,
  strings: STRINGS,
  menu: [],
});
for (const b of document.querySelectorAll("[data-ic]")) b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic));
startApp({ ...kit, toast, version: VERSION });
