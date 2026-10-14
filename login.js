import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut, doc, getDoc, runTransaction, serverTimestamp } from "./fb.js";
import { $, DEPARTMENTS, attachValidation, rules, busy, authMessage, bindPasswordToggles } from "./ui.js";

const loginForm = $("#login-form"), signupForm = $("#signup-form");
const alertBox = $("#alert"), notice = $("#notice");

$("#s-dept").innerHTML = `<option value="">Select</option>` + DEPARTMENTS.map((d) => `<option>${d}</option>`).join("");
bindPasswordToggles();

/* ---------- tabs ---------- */
function show(which) {
  const isLogin = which === "login";
  loginForm.classList.toggle("d-none", !isLogin);
  signupForm.classList.toggle("d-none", isLogin);
  $("#tab-login").classList.toggle("active", isLogin);
  $("#tab-signup").classList.toggle("active", !isLogin);
  $("#tab-login").setAttribute("aria-selected", String(isLogin));
  $("#tab-signup").setAttribute("aria-selected", String(!isLogin));
  alertBox.classList.add("d-none");
  history.replaceState(null, "", isLogin ? "login.html" : "login.html#signup");
}
$("#tab-login").addEventListener("click", () => show("login"));
$("#tab-signup").addEventListener("click", () => show("signup"));
if (location.hash === "#signup") show("signup");

const showAlert = (m) => { notice.classList.add("d-none"); alertBox.textContent = m; alertBox.classList.remove("d-none"); alertBox.scrollIntoView({ block: "nearest" }); };
const showNotice = (m) => { alertBox.classList.add("d-none"); notice.textContent = m; notice.classList.remove("d-none"); };

const reason = new URLSearchParams(location.search).get("reason");
if (reason === "removed") showAlert("This student account was removed by an admin.");
if (reason === "notadmin") showAlert("This account does not have admin access.");
if (reason === "suspended") showAlert("This account is suspended. Contact the event office.");

/* ---------- validation ---------- */
const loginV = attachValidation(loginForm, {
  email: rules.email,
  password: (v) => (v ? "" : "Enter your password.")
});
const signupV = attachValidation(signupForm, {
  name: rules.name,
  rollNo: rules.roll,
  phone: rules.phone,
  email: rules.email,
  department: rules.required("your department"),
  year: rules.required("your year"),
  password: rules.password,
  confirm: (v, f) => (!v ? "Re-enter your password." : v !== f.elements.password.value ? "Passwords do not match." : "")
});
signupForm.elements.rollNo.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/\s/g, ""); });
signupForm.elements.phone.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ""); });
signupForm.elements.password.addEventListener("input", () => { if (signupForm.elements.confirm.value) signupForm.elements.confirm.dispatchEvent(new Event("input")); });

/* ---------- log in ---------- */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!loginV.validateAll()) return;
  const btn = loginForm.querySelector("button[type=submit]");
  const role = loginForm.elements.role.value;
  busy(btn, true, "Logging in");
  try {
    const cred = await signInWithEmailAndPassword(auth, loginForm.elements.email.value.trim().toLowerCase(), loginForm.elements.password.value);
    const isAdmin = (await getDoc(doc(db, "admins", cred.user.uid))).exists();
    if (role === "admin" && !isAdmin) { await signOut(auth); return showAlert("This account does not have admin access."); }
    if (isAdmin) return (location.href = "admin.html");
    const prof = await getDoc(doc(db, "users", cred.user.uid));
    if (!prof.exists()) { await signOut(auth); return showAlert("This student account was removed by an admin."); }
    if (prof.data().status === "suspended") { await signOut(auth); return showAlert("This account is suspended. Contact the event office."); }
    location.href = "student.html";
  } catch (err) {
    showAlert(authMessage(err.code));
  } finally {
    busy(btn, false);
  }
});

$("#forgot").addEventListener("click", async () => {
  const email = loginForm.elements.email.value.trim().toLowerCase();
  const msg = rules.email(email);
  if (msg) return loginV.setError("email", msg || "Enter your email first.");
  try { await sendPasswordResetEmail(auth, email); showNotice("If an account exists for that email, a reset link is on its way."); }
  catch (err) { showAlert(authMessage(err.code)); }
});

/* ---------- sign up (unique email + unique roll number) ---------- */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!signupV.validateAll()) return;
  const f = signupForm.elements;
  const profile = {
    name: f.name.value.trim().replace(/\s+/g, " "),
    rollNo: f.rollNo.value.trim().toUpperCase(),
    phone: f.phone.value.trim(),
    email: f.email.value.trim().toLowerCase(),
    department: f.department.value,
    year: f.year.value,
    status: "active"
  };
  const btn = signupForm.querySelector("button[type=submit]");
  busy(btn, true, "Creating account");
  let created = null;
  try {
    // 1. Roll number pre-check (nicer error before touching Auth)
    if ((await getDoc(doc(db, "rollNumbers", profile.rollNo))).exists()) {
      return signupV.setError("rollNo", "This roll number is already registered.");
    }
    // 2. Firebase Auth rejects a duplicate email
    const cred = await createUserWithEmailAndPassword(auth, profile.email, f.password.value);
    created = cred.user;
    // 3. Transaction: claim the roll number and write the profile together
    const rollRef = doc(db, "rollNumbers", profile.rollNo);
    const userRef = doc(db, "users", created.uid);
    await runTransaction(db, async (tx) => {
      if ((await tx.get(rollRef)).exists()) throw new Error("ROLL_TAKEN");
      tx.set(rollRef, { uid: created.uid, email: profile.email });
      tx.set(userRef, { ...profile, createdAt: serverTimestamp() });
    });
    await updateProfile(created, { displayName: profile.name });
    location.href = "student.html";
  } catch (err) {
    if (created) { try { await created.delete(); } catch { /* ignore */ } }
    if (err.message === "ROLL_TAKEN") signupV.setError("rollNo", "This roll number is already registered.");
    else if (err.code === "auth/email-already-in-use") signupV.setError("email", "An account with this email already exists. Log in instead.");
    else if (err.code) showAlert(authMessage(err.code));
    else if (err.message) showAlert(authMessage("unknown"));
  } finally {
    busy(btn, false);
  }
});
