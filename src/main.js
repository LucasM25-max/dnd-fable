// main.js — boot: build the 3D hub, wire the HUD, hand the avatar a
// portrait of the hero, then lift the loading curtain.

import { Hub3D } from './hub3d.js';
import { initUI } from './ui.js';

const canvas = document.getElementById('scene');
const hub = new Hub3D(canvas);
initUI(hub);
hub.start();

// let two frames render (instance buffers uploaded, pose settled), then
// capture the avatar portrait and reveal the hub
requestAnimationFrame(() => requestAnimationFrame(() => {
  try {
    const url = hub.capturePortrait(240);
    const img = document.getElementById('avatar');
    img.src = url;
  } catch (err) {
    console.warn('portrait capture failed; the hub still lives on', err);
  }
  setTimeout(() => document.getElementById('loader').classList.add('done'), 350);
}));
