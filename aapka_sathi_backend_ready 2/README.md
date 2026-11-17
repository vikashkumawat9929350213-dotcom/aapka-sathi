# aapka sathi — backend-ready E2EE starter

This package includes the website client and a Node.js/Express + Socket.IO relay backend.

## Run locally
Requirements: Node.js 18+

```bash
npm install
npm start
```

Open `http://localhost:3000` in two separate browser profiles. Create a private room in one and open its invite link in the other.

## Backend behavior
- No signup, email, or phone number.
- Maximum two connected sockets per room.
- Server relays encrypted message payloads only.
- Server does not receive the browser's AES key or plaintext through the chat protocol.
- No message database or chat history.
- In-memory room state is lost when the server restarts or both participants disconnect.
- Basic limits: join-attempt throttling, message-rate limiting, payload validation, room cap, and connection cap.
- Health endpoint: `/healthz`.

Optional environment variables:
- `PORT` (default `3000`)
- `MAX_CONNECTIONS` (default `1000`)
- `MAX_ROOMS` (default `5000`)

## Deploy backend + website
Deploy this same Node.js project to a host that supports persistent Node processes, HTTPS, and WebSockets.
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`

For a single-instance deployment, in-memory rooms are sufficient for basic testing. Do not run multiple server instances without adding a shared adapter/store for Socket.IO and a deliberate room-state design. This project intentionally does not persist chat messages.

## Android APK
1. Deploy the website and obtain its HTTPS URL.
2. Put that URL in `capacitor.config.json` under `server.url`.
3. Commit the project to a GitHub repository.
4. Run the included `Build aapka sathi Android APK` GitHub Actions workflow.
5. Download the debug APK artifact from a successful run.

The APK loads the hosted website; it is not a standalone offline chat server.

## Security limitations — read before public use
This is a starter implementation, not an independently audited secure messenger. AES-GCM encryption is performed in the browser. The relay server receives room IDs, ciphertext, IVs, connection/network metadata, and timing. Hosting providers may also retain access logs. The website origin serves the JavaScript that performs encryption; a compromised or malicious deployment could serve altered code. Anyone holding a valid invite secret may join an available room. There is no identity verification, forward secrecy, key rotation, persistent history, abuse-report workflow, or multi-instance shared state. Do not use for highly sensitive conversations until the full system receives an expert security review and penetration testing.
