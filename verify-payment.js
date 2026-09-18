// api/verify-payment.js
// Runs server-side on Vercel. Verifies a Paystack transaction with Paystack's
// own servers, then uses the Firebase Admin SDK (full trust, bypasses client
// security rules) to credit balls and log a transaction record.
//
// Required Vercel Environment Variables (Project Settings -> Environment Variables):
//   PAYSTACK_SECRET_KEY          -> starts with sk_live_... (Paystack Dashboard -> Settings -> API Keys)
//   FIREBASE_SERVICE_ACCOUNT     -> the ENTIRE contents of your Firebase Admin SDK JSON file, as one string
//
// Never put either of these in client-side code or commit them to git.

const admin = require("firebase-admin");

// Initialize Firebase Admin once (Vercel may reuse the same process across invocations)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { reference, userId, balls, amountGhc } = req.body;

    if (!reference || !userId || !balls) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // ---- 1. Idempotency check: has this reference already been processed? ----
    const existing = await db.collection("transactions").where("reference", "==", reference).limit(1).get();
    if (!existing.empty) {
      return res.status(200).json({ success: true, note: "Already processed" });
    }

    // ---- 2. Verify the transaction directly with Paystack's servers ----
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      await db.collection("transactions").add({
        userId,
        type: "purchase",
        balls,
        amountGhc: amountGhc || null,
        reference,
        status: "failed",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(400).json({ success: false, error: "Payment not verified as successful" });
    }

    // ---- 3. Confirm the amount actually paid matches what we expect ----
    // Paystack amount is in the smallest currency unit (pesewas for GHS)
    const amountPaidGhc = verifyData.data.amount / 100;
    if (amountGhc && Math.abs(amountPaidGhc - amountGhc) > 0.01) {
      await db.collection("transactions").add({
        userId,
        type: "purchase",
        balls,
        amountGhc: amountPaidGhc,
        reference,
        status: "amount-mismatch",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(400).json({ success: false, error: "Amount mismatch" });
    }

    // ---- 4. Credit balls + log transaction (atomic-ish via batch) ----
    const userRef = db.collection("users").doc(userId);
    const txRef = db.collection("transactions").doc();

    const batch = db.batch();
    batch.set(
      userRef,
      { balls: admin.firestore.FieldValue.increment(balls) },
      { merge: true }
    );
    batch.set(txRef, {
      userId,
      type: "purchase",
      balls,
      amountGhc: amountPaidGhc,
      reference,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();

    return res.status(200).json({ success: true, ballsAdded: balls });
  } catch (err) {
    console.error("verify-payment error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};
