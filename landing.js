import { auth, db, onAuthStateChanged, collection, query, where, orderBy, limit, getDocs, Timestamp } from "./fb.js";
import { $, ticketHTML, esc } from "./ui.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  $("#nav-actions").innerHTML = `<a class="btn btn-primary" href="student.html">Open dashboard</a>`;
});

const day = 86400000;
const sample = [
  { id: "s1", category: "Cultural", title: "Open mic night", venue: "Amphitheatre", date: new Date(Date.now() + 5 * day), capacity: 120, registeredCount: 84 },
  { id: "s2", category: "Workshop", title: "Git and GitHub in a day", venue: "Lab 3", date: new Date(Date.now() + 9 * day), capacity: 60, registeredCount: 41 },
  { id: "s3", category: "Sports", title: "Inter-department cricket", venue: "Main ground", date: new Date(Date.now() + 14 * day), capacity: 200, registeredCount: 96 }
];

async function load() {
  let events = [];
  try {
    const snap = await getDocs(query(collection(db, "events"), where("date", ">=", Timestamp.now()), orderBy("date"), limit(6)));
    events = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.status === "open");
  } catch (err) { console.warn("Could not load events", err); }

  const stackEvents = events.length ? events.slice(0, 3) : sample;
  $("#stack").innerHTML = stackEvents.map((e) => ticketHTML({ ...e, description: "" })).join("");

  $("#upcoming").innerHTML = events.length
    ? events.map((e) => ticketHTML(e, { actions: `<a class="tk-btn text-decoration-none" href="login.html#signup">Sign up to register</a>` })).join("")
    : `<div class="empty" style="grid-column:1/-1"><h3>No events are published yet</h3><p class="mb-0">Check back soon. New events appear here as soon as the event office adds them.</p></div>`;
}
load();
