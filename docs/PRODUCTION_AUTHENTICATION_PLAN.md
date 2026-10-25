# Production authentication migration — Soq Libya

## Target design
- Google Identity Services sign-in for the initial identity provider.
- Verify Google ID tokens on the backend; never trust email, role, or user ID sent by the client.
- Use the Google `sub` claim as the stable external identity key. Email is profile data, not the primary identity.
- Issue short-lived signed access JWTs only after successful server-side verification. Require a strong `JWT_SECRET` from deployment secrets.
- Passkeys/WebAuthn are a separate follow-up enrollment step. A UI-only fingerprint prompt is not a passkey and must not be treated as authentication.
- Keep privileged seller/driver/admin authorization server-side. New accounts start as customer; seller/driver permissions require reviewed verification.
- Add abuse controls: per-IP and per-identity rate limits, generic auth errors, audit events, session revocation, and risk-based checks. Do not block users solely because Android has multiple Google accounts.

## Required backend configuration
- `GOOGLE_CLIENT_ID`: OAuth client ID for the app/web client.
- `JWT_SECRET`: high-entropy secret generated outside source control.
- `DATABASE_URL`: PostgreSQL connection string.
- Restrict CORS to known production origins; do not use wildcard origins with credentials.

## Database migration requirements
The existing `users.phone` column is NOT NULL and unique. Before email-first sign-in can be enabled, migrate it safely to nullable and add a unique identity table with provider + provider subject, plus normalized email and email_verified fields. Do not silently merge accounts by matching email unless the identity provider proves the email is verified and the account-linking policy explicitly allows it.

## Passkeys
Use a maintained WebAuthn implementation and challenge storage with expiry and one-time use. Store only credential public keys, credential IDs, counters and metadata; never store biometric data. Require a fresh server-issued challenge for registration and authentication. For native Android, use Credential Manager; for browser PWA, use WebAuthn. Provide secure recovery and revocation.

## Release gates
1. Database migration tested against a copy and rollback documented.
2. Google token verification tests: valid, expired, wrong audience, wrong issuer, missing subject, unverified email.
3. JWT tests: missing, malformed, expired, wrong signature; authorization tests across all protected routes.
4. Socket.IO uses the same verified bearer token; client-supplied userId is never authentication.
5. Rate-limit and account-linking tests.
6. Build frontend/backend and Android APK; run integration tests against a real PostgreSQL test database.
7. Deploy credentials only via hosting secret manager; complete live sign-in and passkey test on a physical Android device before calling production-ready.

## Current limitation
This plan is not proof of implementation. Do not enable public production traffic until each release gate is verified.