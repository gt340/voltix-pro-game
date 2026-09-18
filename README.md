# Voltix Pro – Foosball Challenge

Real-money foosball skill game with Firebase backend, Paystack payments, and an admin dashboard.

## Files

- `index.html` — main player app (game, buy balls, leaderboard)
- `admin.html` — admin dashboard (settings, banners, transactions)
- `chat.html` — group/DM chat
- `api/verify-payment.js` — Vercel serverless function: verifies Paystack payments server-side and credits balls
- `firestore.rules` — Firestore security rules
- `vercel.json` — Vercel function config

## ⚠️ Before you deploy

**Legal check:** this app charges real money to play and pays out real cash prizes.
Depending on how it's structured, this may fall under Ghana's Gaming Commission
licensing requirements even as a skill-based game. Worth a quick check with a
local lawyer or the Gaming Commission of Ghana before scaling up.

**Admin access:** now requires real email/password login — see the
"Admin access is now locked down" section below for one-time setup steps.

## Admin access is now locked down

`admin.html` requires real email/password sign-in, and Firestore rules
independently check an `admins` allow-list before permitting any writes
to settings, banners, or the leaderboard — so this can't be bypassed by
editing the page.

### One-time setup: create your admin account

1. **Enable email/password sign-in:** Firebase Console → your project →
   Authentication → Sign-in method → enable "Email/Password"
2. **Create your admin user:** Authentication → Users → Add user →
   enter your email + a strong password
3. **Copy that user's UID** (shown in the Users table after creation)
4. **Add yourself to the allow-list:** Firestore Database → Start collection
   → collection ID: `admins` → Document ID: paste the UID from step 3 →
   add any field (e.g. `role: "owner"`) → Save
5. Deploy the updated `firestore.rules` (see below)
6. Open `admin.html` and sign in with the email/password from step 2

To add more admins later, repeat steps 2–4 for each person — never let
players use the anonymous sign-in flow (the one in `index.html`) to
access `admin.html`; the two are now separate auth systems.

## 1. Deploy Firestore rules

In [Firebase Console](https://console.firebase.google.com) → your project
(`voltix-pro-dc363`) → Firestore Database → Rules, paste the contents of
`firestore.rules` and Publish.

(Or via CLI: `firebase deploy --only firestore:rules` if you have the Firebase CLI set up.)

## 2. Push to GitHub

```bash
cd voltix-game
git init
git add .
git commit -m "Initial commit: Voltix Pro game + Paystack backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

The `.gitignore` already excludes `node_modules`, `.env` files, and any
Firebase service account JSON — double check none of those show up in
`git status` before you push.

## 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → import your GitHub repo
2. Before the first deploy, add these Environment Variables (Project Settings → Environment Variables):
   - `PAYSTACK_SECRET_KEY` — your Paystack secret key (starts with `sk_live_...`)
   - `FIREBASE_SERVICE_ACCOUNT` — paste the **entire contents** of your Firebase
     Admin SDK JSON file as one string (all on one line is fine, or Vercel
     handles multi-line values too)
3. Deploy. Vercel will automatically detect `api/verify-payment.js` as a
   serverless function and serve `index.html`, `admin.html`, `chat.html` as
   static pages.
4. Your live payment verification endpoint will be at:
   `https://your-project.vercel.app/api/verify-payment`

## 4. Test payments

Paystack live keys process real transactions. Test with a small real
payment first (e.g. GHc 1) before announcing this publicly, to confirm
balls are credited and the transaction shows up in `admin.html` under
"Recent Transactions."

## Architecture notes

- Client never credits balls directly anymore — `index.html` opens the
  Paystack popup, then sends the reference to `/api/verify-payment`
- The backend independently re-verifies the transaction with Paystack's
  API (never trusts client-reported amounts) before writing anything
- Firebase Admin SDK (server-side only) does the actual balance credit +
  transaction log write, bypassing client security rules entirely
- Firestore rules block clients from writing to `balls` or `transactions`
  directly, so tampering with the browser can't fake a purchase
