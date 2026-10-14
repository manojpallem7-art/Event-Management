# Pulse Events

Event management web app with two roles, built with Bootstrap 5, vanilla JavaScript (ES modules) and Firebase (Auth + Firestore).

- **Student**: sign up or log in, browse and register for events, cancel a registration, dashboard with a countdown to the next event, edit profile.
- **Admin**: manage events (create, edit, close or reopen registration, delete, view attendees, download CSV) and manage students (edit, suspend, remove, view tickets).
- **No duplicates**: Firebase Auth blocks duplicate emails. A `rollNumbers/{ROLL}` document blocks duplicate roll numbers. A registration document id of `eventId_uid` blocks double registration. Firestore rules enforce all three on the server.
- **Form validation** on every form (name, email, roll number, 10-digit mobile, password strength, event fields).

## 1. Set up Firebase (project: eventmanagementapp-47c76)

1. **Authentication** > Sign-in method > enable **Email/Password**.
2. **Firestore Database** > create a database.
3. **Firestore Database > Rules**: paste the contents of `firestore.rules` and publish.
4. **Create the admin account by hand** (there is no admin sign-up):
   1. Authentication > Users > **Add user** (email and password of your choice). Copy the user's **UID**.
   2. Firestore > **Start collection** `admins` > Document ID = that UID > add a field `email` (string). Save.
5. Authentication > Settings > Authorized domains: `localhost` is there by default. Add your hosting domain when you deploy.

## 2. Run it

ES modules do not work from `file://`, so serve the folder:

```
cd pulse-events
python3 -m http.server 5500      # or: npx serve   |   or VS Code "Live Server"
```

Open http://localhost:5500

## 3. Using it

- Open `login.html`, choose **Admin**, and log in with the account from step 1.4. Create a few events.
- Students use **Create account** on the same page, then register for events.

## Notes

- Removing a student in the admin console deletes their profile, tickets and roll number record. Firebase Auth accounts cannot be deleted from browser code, so also delete the user in the Firebase console (Authentication > Users) if that email should be able to sign up again.
- The Firebase web config in `js/fb.js` is not a secret. Access is controlled by `firestore.rules`.
- Deploy with Firebase Hosting: `firebase init hosting` (public directory `.`), then `firebase deploy`.

## Structure

```
index.html        landing page with live upcoming events
login.html        student log in / sign up, admin log in
student.html      student dashboard
admin.html        admin console
css/style.css     ticket-stub design system
js/fb.js          Firebase config and SDK exports
js/ui.js          validation, toasts, dialogs, ticket component
js/login.js  js/landing.js  js/student.js  js/admin.js
firestore.rules   security rules
```
