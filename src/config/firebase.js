const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Initialize Firebase Admin
// Supports two modes:
//   1. Local: serviceAccountKey.json file (FIREBASE_SERVICE_ACCOUNT path)
//   2. Cloud (Render): FIREBASE_SERVICE_ACCOUNT_JSON env var with JSON string
try {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Cloud deployment: JSON string in env var
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    // Local development: JSON file
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccountKey.json';
    serviceAccount = require(path.resolve(serviceAccountPath));
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  console.error('For local dev: make sure serviceAccountKey.json exists in backend/');
  console.error('For Render: set FIREBASE_SERVICE_ACCOUNT_JSON env var with the JSON content');
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();

module.exports = { admin, db, auth, storage, messaging };
