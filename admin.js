import { auth, db, onAuthStateChanged, signOut, doc, getDoc, addDoc, updateDoc, writeBatch, collection, query, where, orderBy, getDocs, onSnapshot, increment, serverTimestamp, Timestamp } from "./fb.js";
import { $, $$, esc, toast, busy, confirmDialog, attachValidation, rules, toDate, fmtWhen, toInputValue, CATEGORIES, DEPARTMENTS } from "./ui.js";

const state = { events: [], users: [], regs: [], ready: 0, editEvent: null, editUser: null };
const isPast = (e) => toDate(e.date) < new Date();
const evModal = () => bootstrap.Modal.getOrCreateInstance($("#eventModal"));
const stModal = () => bootstrap.Modal.getOrCreateInstance($("#studentModal"));
const panel = () => bootstrap.Offcanvas.getOrCreateInstance($("#panel"));

/* ---------- navigation ---------- */
function go(sec) {
  if (!$("#sec-" + sec)) sec = "overview";
  $$(".sec").forEach((s) => s.classList.toggle("d-none", s.id !== "sec-" + sec));
  $$("#nav [data-sec]").forEach((b) => b.classList.toggle("active", b.dataset.sec === sec));
  history.replaceState(null, "", "#" + sec);
}
$("#nav").addEventListener("click", (e) => { const b = e.target.closest("[data-sec]"); if (b) go(b.dataset.sec); });
$("#logout").addEventListener("click", async () => { await signOut(auth); location.href = "login.html"; });

/* ---------- rendering ---------- */
function render() {
  if (state.ready < 3) return;
  $("#loading").classList.add("d-none");
  if (!$$(".sec").some((s) => !s.classList.contains("d-none"))) go(location.hash.slice(1) || "overview");
  renderOverview(); renderEvents(); renderStudents();
}

function renderOverview() {
  const seats = state.events.reduce((a, e) => a + e.capacity, 0), taken = state.events.reduce((a, e) => a + (e.registeredCount || 0), 0);
  $("#o-events").textContent = state.events.length; $("#o-students").textContent = state.users.length; $("#o-regs").textContent = state.regs.length;
  $("#o-fill").textContent = (seats ? Math.round((taken / seats) * 100) : 0) + "%";
  const fullest = state.events.filter((e) => !isPast(e)).sort((a, b) => (b.registeredCount || 0) / b.capacity - (a.registeredCount || 0) / a.capacity).slice(0, 5);
  $("#o-fullest").innerHTML = fullest.length ? fullest.map((e) => {
    const pct = Math.round(((e.registeredCount || 0) / e.capacity) * 100);
    return `<div class="fill-row"><div><b>${esc(e.title)}</b><div class="meter"><span style="width:${pct}%"></span></div></div><small class="text-muted text-end">${e.registeredCount || 0} of ${e.capacity}</small></div>`;
  }).join("") : `<p class="text-muted mb-0">No upcoming events yet. Create one in the Events tab.</p>`;
  const recent = [...state.regs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 6);
  $("#o-recent").innerHTML = recent.length ? recent.map((r) => `<div class="d-flex justify-content-between gap-3 py-2 border-bottom"><span><b>${esc(r.studentName)}</b> <span class="text-muted">${esc(r.rollNo)}</span></span><span class="text-muted text-end">${esc(r.eventTitle)}</span></div>`).join("") : `<p class="text-muted mb-0">No registrations yet.</p>`;
}

function evStatus(e) { return isPast(e) ? ["past", "Ended"] : e.status === "open" ? ["open", "Open"] : ["closed", "Closed"]; }
function renderEvents() {
  const q = $("#ev-search").value.trim().toLowerCase();
  const rows = state.events.filter((e) => !q || `${e.title} ${e.venue} ${e.category}`.toLowerCase().includes(q));
  $("#ev-body").innerHTML = rows.length ? rows.map((e) => {
    const [cls, label] = evStatus(e), c = CATEGORIES[e.category] || CATEGORIES.Seminar;
    return `<tr data-id="${esc(e.id)}"><td><span class="dot" style="--c:${c.color}"></span><b>${esc(e.title)}</b><div class="text-muted small">${esc(e.category)}</div></td>
      <td class="text-nowrap">${esc(fmtWhen(e.date))}</td><td>${esc(e.venue)}</td><td class="text-nowrap">${e.registeredCount || 0} of ${e.capacity}</td>
      <td><span class="badge-soft badge-${cls}">${label}</span></td>
      <td class="text-end text-nowrap">
        <button class="icon-btn" data-act="attendees" title="View attendees" aria-label="View attendees"><i class="bi bi-people"></i></button>
        <button class="icon-btn" data-act="edit" title="Edit event" aria-label="Edit event"><i class="bi bi-pencil"></i></button>
        <button class="icon-btn" data-act="toggle" title="${e.status === "open" ? "Close registration" : "Reopen registration"}" aria-label="Toggle registration"><i class="bi bi-${e.status === "open" ? "lock" : "unlock"}"></i></button>
        <button class="icon-btn danger" data-act="delete" title="Delete event" aria-label="Delete event"><i class="bi bi-trash"></i></button></td></tr>`;
  }).join("") : `<tr><td colspan="6" class="text-center text-muted py-5">${state.events.length ? "No events match your search." : "No events yet. Select New event to create the first one."}</td></tr>`;
}

function renderStudents() {
  const q = $("#st-search").value.trim().toLowerCase();
  const rows = state.users.filter((u) => !q || `${u.name} ${u.rollNo} ${u.email}`.toLowerCase().includes(q));
  $("#st-body").innerHTML = rows.length ? rows.map((u) => {
    const n = state.regs.filter((r) => r.uid === u.id).length, sus = u.status === "suspended";
    return `<tr data-id="${esc(u.id)}"><td><b>${esc(u.name)}</b><div class="text-muted small">${esc(u.email)}</div></td><td>${esc(u.rollNo)}</td>
      <td>${esc(u.department)}<div class="text-muted small">Year ${esc(u.year)}</div></td><td>${esc(u.phone)}</td><td>${n}</td>
      <td><span class="badge-soft badge-${sus ? "suspended" : "active"}">${sus ? "Suspended" : "Active"}</span></td>
      <td class="text-end text-nowrap">
        <button class="icon-btn" data-act="tickets" title="View tickets" aria-label="View tickets"><i class="bi bi-ticket-perforated"></i></button>
        <button class="icon-btn" data-act="edit" title="Edit student" aria-label="Edit student"><i class="bi bi-pencil"></i></button>
        <button class="icon-btn" data-act="suspend" title="${sus ? "Reactivate" : "Suspend"}" aria-label="${sus ? "Reactivate student" : "Suspend student"}"><i class="bi bi-${sus ? "person-check" : "person-slash"}"></i></button>
        <button class="icon-btn danger" data-act="remove" title="Remove student" aria-label="Remove student"><i class="bi bi-trash"></i></button></td></tr>`;
  }).join("") : `<tr><td colspan="7" class="text-center text-muted py-5">${state.users.length ? "No students match your search." : "No students have signed up yet."}</td></tr>`;
}
$("#ev-search").addEventListener("input", renderEvents);
$("#st-search").addEventListener("input", renderStudents);

/* ---------- side panel ---------- */
function openPanel(title, sub, html) { $("#panelTitle").textContent = title; $("#panelSub").textContent = sub; $("#panelBody").innerHTML = html; panel().show(); }

function showAttendees(ev) {
  const list = state.regs.filter((r) => r.eventId === ev.id).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  const body = list.length
    ? `<button class="btn btn-outline-ink mb-3" id="csv"><i class="bi bi-download me-1"></i>Download CSV</button>` +
      list.map((r) => `<div class="py-2 border-bottom"><b>${esc(r.studentName)}</b> <span class="text-muted">${esc(r.rollNo)}</span><div class="text-muted small">${esc(r.email)}</div></div>`).join("")
    : `<div class="empty">No one has registered yet.</div>`;
  openPanel(ev.title, `${list.length} registered of ${ev.capacity} seats`, body);
  $("#csv")?.addEventListener("click", () => {
    const rows = [["Name", "Roll number", "Email", "Registered at"], ...list.map((r) => [r.studentName, r.rollNo, r.email, r.createdAt ? toDate(r.createdAt).toISOString() : ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `${ev.title.replace(/\W+/g, "-").toLowerCase()}-attendees.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  });
}
function showTickets(u) {
  const list = state.regs.filter((r) => r.uid === u.id).map((r) => ({ r, e: state.events.find((e) => e.id === r.eventId) })).filter((x) => x.e);
  openPanel(u.name, `${u.rollNo} | ${list.length} ticket${list.length === 1 ? "" : "s"}`,
    list.length ? list.map(({ e }) => `<div class="py-2 border-bottom"><b>${esc(e.title)}</b><div class="text-muted small">${esc(fmtWhen(e.date))}, ${esc(e.venue)}</div></div>`).join("") : `<div class="empty">This student has no tickets.</div>`);
}

/* ---------- events: create, edit, toggle, delete ---------- */
$("#e-cat").innerHTML = `<option value="">Select</option>` + Object.keys(CATEGORIES).map((c) => `<option>${c}</option>`).join("");
const eventForm = $("#event-form");
const eventV = attachValidation(eventForm, {
  title: rules.text("an event title", 3, 80),
  category: rules.required("a category"),
  date: (v) => { if (!v) return "Choose a date and time."; const d = new Date(v); if (isNaN(d)) return "Choose a valid date."; if (!state.editEvent && d < new Date()) return "Choose a date in the future."; return ""; },
  venue: rules.text("a venue", 2, 80),
  capacity: (v) => { const n = Number(v); if (!v) return "Enter the number of seats."; if (!Number.isInteger(n) || n < 1 || n > 10000) return "Use a whole number from 1 to 10000."; const taken = state.editEvent?.registeredCount || 0; if (n < taken) return `${taken} students already registered. Seats cannot go below that.`; return ""; },
  status: rules.required("a status"),
  description: rules.text("a short description", 10, 500)
});
$("#new-event").addEventListener("click", () => {
  state.editEvent = null; eventV.reset(); $("#eventModalTitle").textContent = "New event";
  eventForm.elements.status.value = "open"; evModal().show();
});
eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!eventV.validateAll()) return;
  const f = eventForm.elements, btn = eventForm.querySelector("button[type=submit]");
  const data = { title: f.title.value.trim(), category: f.category.value, description: f.description.value.trim(), venue: f.venue.value.trim(), capacity: Number(f.capacity.value), status: f.status.value, date: Timestamp.fromDate(new Date(f.date.value)) };
  busy(btn, true, "Saving");
  try {
    if (state.editEvent) await updateDoc(doc(db, "events", state.editEvent.id), data);
    else await addDoc(collection(db, "events"), { ...data, registeredCount: 0, createdAt: serverTimestamp() });
    toast(state.editEvent ? "Event updated." : "Event created.", "success");
    evModal().hide();
  } catch { toast("Could not save the event. Try again.", "danger"); }
  finally { busy(btn, false); }
});

$("#ev-body").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const ev = state.events.find((x) => x.id === b.closest("tr").dataset.id); if (!ev) return;
  if (b.dataset.act === "attendees") return showAttendees(ev);
  if (b.dataset.act === "edit") {
    state.editEvent = ev; eventV.reset(); $("#eventModalTitle").textContent = "Edit event";
    const f = eventForm.elements;
    f.title.value = ev.title; f.category.value = ev.category; f.date.value = toInputValue(ev.date); f.venue.value = ev.venue; f.capacity.value = ev.capacity; f.status.value = ev.status; f.description.value = ev.description || "";
    return evModal().show();
  }
  if (b.dataset.act === "toggle") {
    try { await updateDoc(doc(db, "events", ev.id), { status: ev.status === "open" ? "closed" : "open" }); toast(ev.status === "open" ? "Registration closed." : "Registration reopened.", "dark"); }
    catch { toast("Could not update the event.", "danger"); }
    return;
  }
  if (b.dataset.act === "delete") {
    const n = state.regs.filter((r) => r.eventId === ev.id).length;
    if (!(await confirmDialog({ title: `Delete "${ev.title}"?`, body: n ? `This also cancels ${n} registration${n === 1 ? "" : "s"}. This cannot be undone.` : "This cannot be undone.", ok: "Delete event", danger: true }))) return;
    try {
      const regs = await getDocs(query(collection(db, "registrations"), where("eventId", "==", ev.id)));
      const batch = writeBatch(db);
      regs.forEach((r) => batch.delete(r.ref));
      batch.delete(doc(db, "events", ev.id));
      await batch.commit();
      toast("Event deleted.", "dark");
    } catch { toast("Could not delete the event.", "danger"); }
  }
});

/* ---------- students: edit, suspend, remove ---------- */
$("#m-dept").innerHTML = `<option value="">Select</option>` + DEPARTMENTS.map((d) => `<option>${d}</option>`).join("");
const stForm = $("#student-form");
const stV = attachValidation(stForm, { name: rules.name, phone: rules.phone, department: rules.required("a department"), year: rules.required("a year") });
stForm.elements.phone.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ""); });
stForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!stV.validateAll()) return;
  const f = stForm.elements, btn = stForm.querySelector("button[type=submit]");
  busy(btn, true, "Saving");
  try {
    await updateDoc(doc(db, "users", state.editUser.id), { name: f.name.value.trim().replace(/\s+/g, " "), phone: f.phone.value.trim(), department: f.department.value, year: f.year.value });
    toast("Student updated.", "success"); stModal().hide();
  } catch { toast("Could not update the student.", "danger"); }
  finally { busy(btn, false); }
});

$("#st-body").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const u = state.users.find((x) => x.id === b.closest("tr").dataset.id); if (!u) return;
  if (b.dataset.act === "tickets") return showTickets(u);
  if (b.dataset.act === "edit") {
    state.editUser = u; stV.reset(); const f = stForm.elements;
    $("#s-ident").textContent = `${u.rollNo} | ${u.email}`;
    f.name.value = u.name; f.phone.value = u.phone; f.department.value = u.department; f.year.value = u.year;
    return stModal().show();
  }
  if (b.dataset.act === "suspend") {
    const sus = u.status === "suspended";
    if (!sus && !(await confirmDialog({ title: `Suspend ${u.name}?`, body: "They will not be able to log in or register until you reactivate them.", ok: "Suspend" }))) return;
    try { await updateDoc(doc(db, "users", u.id), { status: sus ? "active" : "suspended" }); toast(sus ? "Student reactivated." : "Student suspended.", "dark"); }
    catch { toast("Could not update the student.", "danger"); }
    return;
  }
  if (b.dataset.act === "remove") {
    const mine = state.regs.filter((r) => r.uid === u.id);
    if (!(await confirmDialog({ title: `Remove ${u.name}?`, body: `Their profile and ${mine.length} registration${mine.length === 1 ? "" : "s"} will be deleted and roll number ${u.rollNo} becomes available again. This cannot be undone.`, ok: "Remove student", danger: true }))) return;
    try {
      const batch = writeBatch(db);
      mine.forEach((r) => { batch.delete(doc(db, "registrations", r.id)); if (state.events.some((ev) => ev.id === r.eventId)) batch.update(doc(db, "events", r.eventId), { registeredCount: increment(-1) }); });
      batch.delete(doc(db, "users", u.id));
      batch.delete(doc(db, "rollNumbers", u.rollNo));
      await batch.commit();
      toast("Student removed.", "dark");
    } catch { toast("Could not remove the student.", "danger"); }
  }
});

/* ---------- boot ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.replace("login.html");
  try {
    if (!(await getDoc(doc(db, "admins", user.uid))).exists()) { await signOut(auth); return location.replace("login.html?reason=notadmin"); }
  } catch { await signOut(auth); return location.replace("login.html?reason=notadmin"); }
  $("#me").textContent = user.email;
  const fail = () => toast("Could not load data. Check your Firestore rules.", "danger");
  const sub = (q, key) => onSnapshot(q, (s) => { state[key] = s.docs.map((d) => ({ id: d.id, ...d.data() })); state.ready = Math.min(3, state.ready + (sub.seen.has(key) ? 0 : 1)); sub.seen.add(key); render(); }, fail);
  sub.seen = new Set();
  sub(query(collection(db, "events"), orderBy("date")), "events");
  sub(query(collection(db, "users"), orderBy("name")), "users");
  sub(collection(db, "registrations"), "regs");
});
