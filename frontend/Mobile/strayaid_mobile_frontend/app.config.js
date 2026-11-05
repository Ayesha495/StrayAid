// Firebase (Android push) needs google-services.json inside the build. The file is kept out of git, so
// EAS builds get it from the secret file variable GOOGLE_SERVICES_JSON (eas env, production and preview);
// local builds use the copy next to this file. Everything else stays in app.json.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const local = path.join(__dirname, "google-services.json");
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? "./google-services.json" : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
