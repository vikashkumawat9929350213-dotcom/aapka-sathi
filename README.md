# aapka sathi — anonymous private chat starter

A small web chat starter with a two-person room, no account signup, in-browser AES-GCM message encryption, and an in-memory relay server. It can be packaged for Android using Capacitor.

## Run locally
Requirements: Node.js 18+.

```bash
npm install
npm start
```
Open `http://localhost:3000` in two browser windows. Create a room in one, copy the code, and paste it into the other. Localhost is considered a secure context by modern browsers.

## Deploy for real users
- Deploy the Node server to a host that supports persistent WebSocket connections.
- Put it behind HTTPS (TLS). Browser WebCrypto requires a secure context.
- Configure hosting limits, rate limiting, abuse controls, monitoring, and security headers for your environment.
- Restrict CORS/origins appropriately before production. The sample uses same-origin hosting.
- Review your host's access logs and retention settings. Avoid logging room codes, IP addresses, message payloads, or request bodies.
- Add automated tests, dependency scanning, a security review, and a privacy notice before public launch.

## How privacy works
- No user account or profile is requested.
- The browser derives an AES-GCM key from a high-entropy random room code using SHA-256. The server only relays the encrypted payload.
- Messages are not persisted by this app; they exist only in connected browsers and transient network buffers.
- The server enforces a maximum of two concurrent sockets per room.
- The room code is the shared secret. Anyone who obtains it may join and attempt to read messages. Share it only with the intended person.
- This is a starter implementation, not a formal cryptographic protocol or audited product. A production design should use a reviewed key exchange/protocol, add rate limiting and abuse defenses, and undergo an independent security review.
- Network metadata (such as IP addresses) may be visible to the hosting provider. Do not claim absolute anonymity.

## Android
See `android-wrapper/README.md` for a Capacitor packaging path. This project does not include a prebuilt/signed APK.


## Online deployment (free test hosting)
1. Create a GitHub repository and upload this project.
2. In Render, create **New → Web Service**, connect the repository, set Build Command to `npm install`, Start Command to `npm start`, and choose Free for testing. Render supports WebSockets, but free services can sleep after inactivity, so the first connection may be slow. See https://render.com/docs/deploy-node-express-app and https://render.com/docs/free.
3. Once Render gives you a URL such as `https://your-service.onrender.com`, replace `https://YOUR-APP.onrender.com` in `capacitor.config.json` with that exact URL, then commit/push the change.
4. In GitHub, open **Actions → Build aapka sathi Android APK**. Wait for it to finish, open the successful run, and download the `aapka-sathi-debug-apk` artifact. Extract it to get `app-debug.apk`.
5. The APK is a debug/testing build, not a Play Store release. Only install APKs you built or trust.

## Notes
- You need a GitHub account and a Render account to perform these steps; the free host is for testing and can sleep when idle.
- The APK wrapper loads the deployed HTTPS website. Keep the server URL in `capacitor.config.json` up to date.
- This is a starter, not audited production cryptography. Room-code possession grants access, and hosting providers may see connection metadata.
