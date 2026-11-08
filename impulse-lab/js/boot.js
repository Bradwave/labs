// Impulse Lab · boot.js
// Starts the lab kit (language, theme, settings menu, info dialog, PWA) and hands it to the app scripts.
// The app itself is six classic scripts (js/01-core.js … js/06-app.js) that share one global scope and run,
// in order, right after this module (all are deferred). They reach the kit through window.KIT.
import * as KIT from "../../kit/kit.js";
import STRINGS from "./strings.js";

export const VERSION = "1.1.0";

KIT.initKit({
  slug: "impulse-lab",
  name: "Impulse Lab",
  version: VERSION,
  strings: STRINGS,
  // share and export: filled in by js/06-app.js once the app is ready (window.IMPULSE)
  menu: [
    { icon: "link", label: "sh_link", onClick: () => window.IMPULSE && window.IMPULSE.copyLink() },
    { icon: "image", label: "sh_img", onClick: () => window.IMPULSE && window.IMPULSE.copyImage() },
  ],
});
window.KIT = KIT;
