# Identity document encryption migration

New identity document submissions are encrypted with AES-256-GCM before they are written to PostgreSQL. The administrator verification endpoint decrypts documents only when an authorized administrator requests the verification queue.

## Before deploying

1. Back up the database and test the backup restore procedure.
2. Configure a unique `ENCRYPTION_KEY` in the hosting provider's secret manager. Use a high-entropy secret of at least 32 characters. Never commit it to Git or include it in client/Android builds.
3. Keep the key in a durable secret manager and restrict access. Losing the key makes encrypted documents unrecoverable.
4. Deploy the code and set the key before accepting new identity verification requests.

## Migrate existing plaintext rows

Run this from the backend directory in a trusted server environment with the production database credentials and the same `ENCRYPTION_KEY` configured:

```sh
npm run migrate:identity-documents
```

The migration takes a table lock and a transaction, skips already encrypted values, and rolls back on error. Schedule it in a maintenance window because the lock temporarily blocks concurrent writes to `users`. Do not run it against production until a restorable backup has been verified.

## Verification and limitations

- The migration is idempotent for rows using the `enc:v1:` format.
- Legacy plaintext values remain readable by the admin review path until migration is completed; protect the admin endpoint and database backups accordingly.
- This migration does not remove plaintext copies from old database backups, logs, or exports. Apply the retention policy to those separately.
- Key rotation requires a planned re-encryption migration; changing `ENCRYPTION_KEY` directly makes existing encrypted values unreadable.
- Run `npm test` and the GitHub Actions checks after deployment. Do not treat static checks as a substitute for staging integration tests.
