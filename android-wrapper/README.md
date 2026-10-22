# Build the Android APK using GitHub Actions

This project now includes a Capacitor configuration and `.github/workflows/build-apk.yml`.

1. Deploy the Node app to a host with HTTPS and WebSocket support. For a test deployment, see the main README.
2. Replace `https://YOUR-APP.onrender.com` in `capacitor.config.json` with your deployed HTTPS URL.
3. Upload the entire project to a GitHub repository, on the `main` branch.
4. Open the repository's **Actions** tab and run **Build aapka sathi Android APK** (or push a commit to `main`).
5. On a successful workflow run, download the artifact named `aapka-sathi-debug-apk`. Extract it to find `app-debug.apk`.

This requires GitHub Actions to run; this local project does not contain a prebuilt APK. The generated APK is for testing and is not a signed Play Store release.
