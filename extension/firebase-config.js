window.CANCEL_IT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAgFW70gH42Bv5cjbk7fx2l1t0GobYzFTg",
  authDomain: "cancel-it-13eda.firebaseapp.com",
  projectId: "cancel-it-13eda",
  storageBucket: "cancel-it-13eda.firebasestorage.app",
  messagingSenderId: "46617074105",
  appId: "1:46617074105:web:1d89d35e5d21727271be68",
  measurementId: "G-8ERDT7FN7H",
  // GA4 Measurement Protocol API secret. Create it in Google Analytics:
  // Admin → Data streams → (your web stream) → Measurement Protocol API secrets
  // → Create. Analytics stays fully inert while this is empty.
  apiSecret: "UbVTvJJ8SwORQ3873-l73g"
};

window.CANCEL_IT_ANALYTICS_SETTINGS = {
  enabled: true,
  provider: "ga4",
  mode: "measurement-protocol",
  // Set true while testing: events go to GA4's /debug/mp/collect validation
  // endpoint and the server's verdict is logged to the console.
  debug: false
};
