// Shared helpers: DOM, validation, toasts, dialogs, and the ticket component.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export class UserError extends Error {}

export const DEPARTMENTS = ["Computer Science", "Information Technology", "Electronics", "Electrical", "Mechanical", "Civil", "Commerce", "Arts and Humanities", "Management", "Other"];

export const CATEGORIES = {
  Tech: { color: "#3A3CF0", ink: "#FFFFFF" },
  Cultural: { color: "#FF5A4E", ink: "#FFFFFF" },
  Sports: { color: "#12B886", ink: "#04231B" },
  Workshop: { color: "#FFD23F", ink: "#2B2300" },
  Seminar: { color: "#14123B", ink: "#FFFFFF" }
};

/* ---------- dates ---------- */
export const toDate = (v) => (v && v.toDate ? v.toDate() : new Date(v));
const whenFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const fmtWhen = (d) => whenFmt.format(toDate(d));
export const monthShort = (d) => toDate(d).toLocaleString("en-IN", { month: "short" });
export function toInputValue(d) {
  const x = toDate(d), p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

/* ---------- buttons, toasts, dialogs ---------- */
export function busy(btn, on, label = "Please wait") {
  if (!btn) return;
  if (on) {
    btn.dataset.html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(label)}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
  }
}

export function toast(msg, type = "dark") {
  let box = $("#toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    box.className = "toast-container position-fixed bottom-0 end-0 p-3";
    document.body.append(box);
  }
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${type} border-0`;
  el.setAttribute("role", "status");
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  box.append(el);
  new bootstrap.Toast(el, { delay: 4000 }).show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

export function confirmDialog({ title, body, ok = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "modal fade";
    el.tabIndex = -1;
    el.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content">
      <div class="modal-body p-4"><h2 class="h4 mb-2">${esc(title)}</h2><p class="mb-4 text-muted">${esc(body)}</p>
      <div class="d-flex gap-2 justify-content-end"><button class="btn btn-light" data-bs-dismiss="modal">Keep it</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${esc(ok)}</button></div></div></div></div>`;
    document.body.append(el);
    const modal = new bootstrap.Modal(el);
    let result = false;
    el.querySelector("[data-ok]").addEventListener("click", () => { result = true; modal.hide(); });
    el.addEventListener("hidden.bs.modal", () => { el.remove(); resolve(result); });
    modal.show();
  });
}

export function authMessage(code) {
  return ({
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/email-already-in-use": "An account with this email already exists. Log in instead.",
    "auth/weak-password": "Choose a stronger password (at least 8 characters).",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
    "auth/user-disabled": "This account has been disabled. Contact the event office.",
    "permission-denied": "You don't have permission to do that."
  })[code] || "Something went wrong. Please try again.";
}

/* ---------- validation ---------- */
export const rules = {
  name: (v) => { v = v.trim(); if (!v) return "Enter your full name."; if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(v)) return "Use letters only, between 2 and 60 characters."; return ""; },
  email: (v) => { v = v.trim(); if (!v) return "Enter your email address."; if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter a valid email, like name@college.edu."; return ""; },
  roll: (v) => { v = v.trim(); if (!v) return "Enter your roll number."; if (!/^[A-Za-z0-9-]{4,20}$/.test(v)) return "Use 4 to 20 letters, numbers or hyphens. No spaces."; return ""; },
  phone: (v) => { v = v.trim(); if (!v) return "Enter your mobile number."; if (!/^[6-9]\d{9}$/.test(v)) return "Enter a 10-digit mobile number starting with 6 to 9."; return ""; },
  password: (v) => { if (!v) return "Enter a password."; if (v.length < 8) return "Use at least 8 characters."; if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Include at least one letter and one number."; return ""; },
  required: (what) => (v) => (v ? "" : `Choose ${what}.`),
  text: (label, min, max) => (v) => { v = v.trim(); if (!v) return `Enter ${label}.`; if (v.length < min) return `Use at least ${min} characters.`; if (v.length > max) return `Keep it under ${max} characters.`; return ""; }
};

export function attachValidation(form, schema) {
  const check = (name) => {
    const el = form.elements[name];
    const msg = schema[name](el.value, form);
    el.classList.toggle("is-invalid", !!msg);
    el.classList.toggle("is-valid", !msg && el.value !== "");
    const fb = el.closest(".field")?.querySelector(".invalid-feedback");
    if (fb) fb.textContent = msg;
    return !msg;
  };
  Object.keys(schema).forEach((name) => {
    const el = form.elements[name];
    el.addEventListener("blur", () => check(name));
    el.addEventListener("input", () => { if (el.classList.contains("is-invalid")) check(name); });
  });
  return {
    validateAll() {
      let ok = true, first = null;
      for (const n of Object.keys(schema)) if (!check(n)) { ok = false; first = first || form.elements[n]; }
      if (first) first.focus();
      return ok;
    },
    setError(name, msg) {
      const el = form.elements[name];
      el.classList.add("is-invalid");
      el.classList.remove("is-valid");
      const fb = el.closest(".field")?.querySelector(".invalid-feedback");
      if (fb) fb.textContent = msg;
      el.focus();
    },
    reset() { form.reset(); form.querySelectorAll(".is-valid,.is-invalid").forEach((e) => e.classList.remove("is-valid", "is-invalid")); }
  };
}

export function bindPasswordToggles(root = document) {
  $$("[data-toggle-pw]", root).forEach((b) => b.addEventListener("click", () => {
    const input = b.parentElement.querySelector("input");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.textContent = show ? "Hide" : "Show";
    b.setAttribute("aria-pressed", String(show));
  }));
}

/* ---------- the ticket ---------- */
export function ticketHTML(ev, { stamp = "", actions = "", barcode = false } = {}) {
  const c = CATEGORIES[ev.category] || CATEGORIES.Seminar;
  const d = toDate(ev.date);
  const taken = ev.registeredCount || 0;
  const left = Math.max(ev.capacity - taken, 0);
  const pct = Math.min(100, Math.round((taken / ev.capacity) * 100));
  return `<article class="ticket ${stamp ? "is-reg" : ""}" style="--tk:${c.color};--tk-ink:${c.ink}" data-id="${esc(ev.id)}">
    <div class="tk-main">
      <span class="tk-cat">${esc(ev.category)}</span>
      <h3 class="tk-title">${esc(ev.title)}</h3>
      <p class="tk-meta"><i class="bi bi-clock" aria-hidden="true"></i> ${esc(fmtWhen(d))}</p>
      <p class="tk-meta"><i class="bi bi-geo-alt" aria-hidden="true"></i> ${esc(ev.venue)}</p>
      ${ev.description ? `<p class="tk-desc">${esc(ev.description)}</p>` : ""}
      <div class="tk-seats"><div class="tk-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <small>${left ? `${left} of ${ev.capacity} seats left` : "Fully booked"}</small></div>
      ${actions ? `<div class="tk-actions">${actions}</div>` : ""}
    </div>
    <div class="tk-stub"><span class="tk-day">${d.getDate()}</span><span class="tk-mon">${esc(monthShort(d))}</span>${barcode ? '<span class="tk-barcode" aria-hidden="true"></span>' : ""}</div>
    ${stamp}
  </article>`;
}
