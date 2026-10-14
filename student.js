import { auth, db, onAuthStateChanged, signOut, doc, getDoc, updateDoc, collection, query, where, orderBy, onSnapshot, runTransaction, increment, serverTimestamp } from "./fb.js";
import { $, $$, esc, toast, busy, confirmDialog, attachValidation, rules, ticketHTML, toDate, CATEGORIES, DEPARTMENTS, UserError } from "./ui.js";

const state = { uid: null, me: null, events: [], regs: new Map(), stamp: null, q: "", cat: "All", ready: { events: false, regs: false } };
const isPast = (ev) => toDate(ev.date) < new Date();

function evState(ev) {
  if (state.regs.has(ev.id)) return "registered";
  if (isPast(ev)) return "ended";
  if (ev.status !== "open") return "closed";
  if ((ev.registeredCount || 0) >= ev.capacity) return "full";
  return "open";
}
function actionFor(ev) {
  switch (evState(ev)) {
    case "open": return `<button class="tk-btn" data-act="register" data-id="${esc(ev.id)}">Register</button>`;
    case "registered": return isPast(ev) ? "" : `<button class="tk-btn tk-btn-ghost" data-act="cancel" data-id="${esc(ev.id)}">Cancel registration</button>`;
    case "full": return `<button class="tk-btn" disabled>Fully booked</button>`;
    case "closed": return `<button class="tk-btn" disabled>Registration closed</button>`;
    default: return `<button class="tk-btn" disabled>Event ended</button>`;
  }
}
const stampFor = (ev) => (state.regs.has(ev.id) ? `<div class="stamp ${state.stamp === ev.id ? "stamp-anim" : ""}">Registered</div>` : "");
const card = (ev, extra = {}) => ticketHTML(ev, { actions: actionFor(ev), stamp: stampFor(ev), ...extra });
const emptyBox = (title, text, btn = "") => `<div class="empty" style="grid-column:1/-1"><h3>${esc(title)}</h3><p class="mb-3">${esc(text)}</p>${btn}</div>`;

function until(d) {
  const ms = toDate(d) - new Date();
  if (ms <= 0) return "Happening now";
  const m = Math.floor(ms / 60000), dd = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return dd ? `Starts in ${dd}d ${h}h` : h ? `Starts in ${h}h ${mm}m` : `Starts in ${mm}m`;
}

/* ---------- rendering ---------- */
function myEvents() {
  return [...state.regs.values()].map((r) => state.events.find((e) => e.id === r.eventId)).filter(Boolean).sort((a, b) => toDate(a.date) - toDate(b.date));
}
function render() {
  if (!state.me || !state.ready.events || !state.ready.regs) return;
  $("#loading").classList.add("d-none");
  if (!$$(".sec").some((s) => !s.classList.contains("d-none"))) go(location.hash.slice(1) || "dashboard");

  const mine = myEvents(), up = mine.filter((e) => !isPast(e)), past = mine.filter(isPast);
  const open = state.events.filter((e) => evState(e) === "open");

  // dashboard
  $("#hello").textContent = `Hi, ${state.me.name.split(" ")[0]}.`;
  $("#st-up").textContent = up.length; $("#st-past").textContent = past.length; $("#st-open").textContent = open.length;
  $("#next").innerHTML = up.length
    ? ticketHTML(up[0], { stamp: stampFor(up[0]), barcode: true }) + `<p class="countdown" id="countdown">${until(up[0].date)}</p>`
    : `<div class="empty"><h3>No tickets yet</h3><p class="mb-3">Register for an event and it will show up here with a countdown.</p><button class="btn btn-primary" data-go="discover">Find an event</button></div>`;
  $("#suggest").innerHTML = open.length ? open.slice(0, 3).map((e) => card(e)).join("") : emptyBox("Nothing open right now", "New events appear here as soon as the event office publishes them.");

  // discover
  $("#cats").innerHTML = ["All", ...Object.keys(CATEGORIES)].map((c) => `<button class="chip ${state.cat === c ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
  const q = state.q.toLowerCase();
  const list = state.events.filter((e) => (state.cat === "All" || e.category === state.cat) && (!q || `${e.title} ${e.venue}`.toLowerCase().includes(q)) && (!isPast(e) || state.regs.has(e.id)));
  $("#discover-list").innerHTML = list.length ? list.map((e) => card(e)).join("") : emptyBox("No events match", "Try another category or clear your search.");

  // tickets
  $("#tickets-up").innerHTML = up.length ? up.map((e) => card(e, { barcode: true })).join("") : emptyBox("No upcoming tickets", "Events you register for will appear here.", `<button class="btn btn-primary" data-go="discover">Browse events</button>`);
  $("#tickets-past").innerHTML = past.length ? past.map((e) => `<div class="ticket-dim">${ticketHTML(e, { stamp: stampFor(e), barcode: true })}</div>`).join("") : emptyBox("No past events yet", "Events you attend will be listed here.");

  // profile
  $("#p-email").textContent = state.me.email; $("#p-roll").textContent = state.me.rollNo;
}

function go(sec) {
  if (!$("#sec-" + sec)) sec = "dashboard";
  $$(".sec").forEach((s) => s.classList.toggle("d-none", s.id !== "sec-" + sec));
  $$("#nav .nav-link").forEach((b) => b.classList.toggle("active", b.dataset.sec === sec));
  history.replaceState(null, "", "#" + sec);
  window.scrollTo({ top: 0 });
}

/* ---------- actions ---------- */
async function register(id, btn) {
  busy(btn, true, "Registering");
  state.stamp = id;
  try {
    await runTransaction(db, async (tx) => {
      const evRef = doc(db, "events", id), regRef = doc(db, "registrations", `${id}_${state.uid}`);
      const [ev, reg] = await Promise.all([tx.get(evRef), tx.get(regRef)]);
      if (!ev.exists()) throw new UserError("This event no longer exists.");
      if (reg.exists()) throw new UserError("You are already registered for this event.");
      const e = ev.data();
      if (toDate(e.date) < new Date()) throw new UserError("This event has already happened.");
      if (e.status !== "open") throw new UserError("Registration for this event is closed.");
      if ((e.registeredCount || 0) >= e.capacity) throw new UserError("Sorry, this event just filled up.");
      tx.set(regRef, { eventId: id, uid: state.uid, studentName: state.me.name, rollNo: state.me.rollNo, email: state.me.email, eventTitle: e.title, createdAt: serverTimestamp() });
      tx.update(evRef, { registeredCount: increment(1) });
    });
    toast("You are registered. See you there!", "success");
  } catch (err) {
    state.stamp = null;
    toast(err instanceof UserError ? err.message : "Could not register. Please try again.", "danger");
    busy(btn, false);
  }
  setTimeout(() => { state.stamp = null; }, 1500);
}

async function cancel(id, btn) {
  const ev = state.events.find((e) => e.id === id);
  if (!(await confirmDialog({ title: "Cancel registration?", body: `You will give up your seat for ${ev ? ev.title : "this event"}.`, ok: "Cancel registration", danger: true }))) return;
  busy(btn, true, "Cancelling");
  try {
    await runTransaction(db, async (tx) => {
      const evRef = doc(db, "events", id), regRef = doc(db, "registrations", `${id}_${state.uid}`);
      const [e, r] = await Promise.all([tx.get(evRef), tx.get(regRef)]);
      if (!r.exists()) return;
      tx.delete(regRef);
      if (e.exists() && (e.data().registeredCount || 0) > 0) tx.update(evRef, { registeredCount: increment(-1) });
    });
    toast("Registration cancelled.", "dark");
  } catch { toast("Could not cancel. Please try again.", "danger"); busy(btn, false); }
}

/* ---------- wiring ---------- */
document.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]");
  if (act) return act.dataset.act === "register" ? register(act.dataset.id, act) : cancel(act.dataset.id, act);
  const g = e.target.closest("[data-go]"); if (g) return go(g.dataset.go);
  const s = e.target.closest("#nav [data-sec]"); if (s) return go(s.dataset.sec);
  const c = e.target.closest("[data-cat]"); if (c) { state.cat = c.dataset.cat; render(); }
});
$("#search").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
$("#logout").addEventListener("click", async () => { await signOut(auth); location.href = "login.html"; });
setInterval(() => { const up = myEvents().find((e) => !isPast(e)); const c = $("#countdown"); if (up && c) c.textContent = until(up.date); }, 30000);

$("#p-dept").innerHTML = `<option value="">Select</option>` + DEPARTMENTS.map((d) => `<option>${d}</option>`).join("");
const pv = attachValidation($("#profile-form"), { name: rules.name, phone: rules.phone, department: rules.required("a department"), year: rules.required("a year") });
$("#profile-form").elements.phone.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ""); });
$("#profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pv.validateAll()) return;
  const f = e.target.elements, btn = e.target.querySelector("button[type=submit]");
  const data = { name: f.name.value.trim().replace(/\s+/g, " "), phone: f.phone.value.trim(), department: f.department.value, year: f.year.value };
  busy(btn, true, "Saving");
  try { await updateDoc(doc(db, "users", state.uid), data); Object.assign(state.me, data); toast("Profile saved.", "success"); render(); }
  catch { toast("Could not save your profile. Try again.", "danger"); }
  finally { busy(btn, false); }
});

/* ---------- boot ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.replace("login.html");
  try {
    if ((await getDoc(doc(db, "admins", user.uid))).exists()) return location.replace("admin.html");
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) { await signOut(auth); return location.replace("login.html?reason=removed"); }
    if (snap.data().status === "suspended") { await signOut(auth); return location.replace("login.html?reason=suspended"); }
    state.uid = user.uid; state.me = snap.data();
    const f = $("#profile-form").elements;
    f.name.value = state.me.name; f.phone.value = state.me.phone; f.department.value = state.me.department; f.year.value = state.me.year;

    onSnapshot(query(collection(db, "events"), orderBy("date")), (s) => { state.events = s.docs.map((d) => ({ id: d.id, ...d.data() })); state.ready.events = true; render(); },
      () => toast("Could not load events.", "danger"));
    onSnapshot(query(collection(db, "registrations"), where("uid", "==", user.uid)), (s) => { state.regs = new Map(s.docs.map((d) => [d.data().eventId, { id: d.id, ...d.data() }])); state.ready.regs = true; render(); },
      () => toast("Could not load your tickets.", "danger"));
  } catch { $("#loading").textContent = "Could not load your dashboard. Refresh to try again."; }
});
