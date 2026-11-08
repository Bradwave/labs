// Relative Motion Lab: DOM query helpers.

export const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
