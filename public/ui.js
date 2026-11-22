// The small toolkit every screen uses: DOM building from nodes and text (never markup strings), the API call, toasts,
// dialogs, and the image downscaling done before a page is uploaded.

import { icon } from './icons.js';

/** h('button', { class: 'btn', onclick: fn }, 'Text', node, …) – text always goes in as text nodes. */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  add(el, children);
  return el;
}

export function add(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data || {};
  }
}

/** api('/home') is a GET; api('/collections', {title}) is a POST with JSON. */
export async function api(path, body) {
  const options = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  let res;
  try {
    res = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
  } catch (e) {
    throw new ApiError(0, 'Ingen kontakt med Quizla. Kolla nätet och försök igen.');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* not JSON */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'Något gick fel. Försök igen.', data);
  return data;
}

// ---------------------------------------------------------------- toasts

let toastBox;
export function toast(message, kind = 'ok') {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  const el = h('div', { class: `toast toast-${kind}` }, icon(kind === 'error' ? 'alert' : kind === 'win' ? 'star' : 'check'), h('span', {}, message));
  toastBox.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, kind === 'error' ? 5000 : 2800);
}
export const oops = (e) => toast(e && e.message ? e.message : 'Något gick fel. Försök igen.', 'error');

/** Run an async action from a button: the button answers at once (spinner, disabled) and errors become toasts. */
export async function busy(button, fn) {
  if (button.disabled) return undefined;
  button.disabled = true;
  button.classList.add('busy');
  try {
    return await fn();
  } catch (e) {
    oops(e);
    return undefined;
  } finally {
    button.disabled = false;
    button.classList.remove('busy');
  }
}

// ---------------------------------------------------------------- dialogs

/** A modal sheet. Returns { el, close }; closes on Escape, on the backdrop and on the ✕. */
export function modal({ title, body, wide = false, onclose }) {
  const dlg = h('dialog', { class: `sheet${wide ? ' wide' : ''}` });
  const close = () => { if (dlg.open) dlg.close(); };
  add(dlg, [
    h('div', { class: 'sheet-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Stäng', onclick: close }, icon('x'))),
    h('div', { class: 'sheet-body' }, body),
  ]);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => { dlg.remove(); if (onclose) onclose(); });
  document.body.appendChild(dlg);
  dlg.showModal();
  return { el: dlg, close };
}

export function confirmDialog({ title, text, ok = 'Ja', danger = false, iconName = 'alert' }) {
  return new Promise((resolve) => {
    let answer = false;
    const m = modal({
      title,
      body: [
        h('div', { class: 'confirm' }, h('div', { class: `badge-icon ${danger ? 'red' : 'blue'}` }, icon(iconName)), h('p', {}, text)),
        h('div', { class: 'row end' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Avbryt'),
          h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => { answer = true; m.close(); } }, ok)),
      ],
      onclose: () => resolve(answer),
    });
  });
}

// ---------------------------------------------------------------- small pieces

export const chip = (text, cls = '', iconName) => h('span', { class: `chip ${cls}`.trim() }, iconName && icon(iconName), text);

export function empty(art, title, text, action) {
  return h('div', { class: 'empty' }, art, h('h3', {}, title), text && h('p', { class: 'muted' }, text), action);
}

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'label' }, label), input, hint && h('span', { class: 'hint' }, hint));
}

export function dateText(iso) {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return 'i dag';
  if (days === 1) return 'i går';
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------- photos

const MAX_SIDE = 1800;
const MAX_CHARS = 4.4e6;      // base64 of roughly 3.3 MB – under the server's limit for one page

async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* try the <img> way */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A photo from the camera or the library -> a JPEG data URL, at most 1800 px on its long side. */
export async function shrinkImage(file) {
  let source;
  try {
    source = await decode(file);
  } catch (e) {
    throw new Error('Den bilden gick inte att öppna här. Prova att ta ett foto eller välj en JPG/PNG.');
  }
  const w = source.width || source.naturalWidth;
  const hgt = source.height || source.naturalHeight;
  let scale = Math.min(1, MAX_SIDE / Math.max(w, hgt));
  let quality = 0.85;
  for (let i = 0; i < 4; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(hgt * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_CHARS) {
      if (source.close) source.close();
      return url;
    }
    quality -= 0.12;
    scale *= 0.85;
  }
  throw new Error('Bilden är för stor. Prova att ta ett nytt foto.');
}
