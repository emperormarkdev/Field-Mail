# SiteReport

Offline-first PWA for writing site reports in the field and emailing them as PDFs when you reconnect. All report data stays on the device; the only server is a single Vercel function that sends mail.

The UI uses BoardUI: foundations (`src/styles/`, `src/utils/cx.ts`), source components (`src/components/base/`) and the project skill in `.claude/skills/boardui/`. SiteReport's tokens alias BoardUI's semantic tokens, with the accent ramp re-tinted green. Add more components with `npx boardui@latest add <name> -y -d src`.

## Setup

### 1. Gmail

1. Turn on 2-step verification for your Google account.
2. Open https://myaccount.google.com/apppasswords, create an app password named `SiteReport`, and copy the 16-character value.
3. Use the same Gmail address as the sender (`From` and `Reply-To`).

### 2. Deploy to Vercel

1. Push this project to a Git repository and import it in Vercel (framework preset: Vite).
2. Add these environment variables in **Project Settings → Environment Variables**:

| Variable | Required | Value |
| --- | --- | --- |
| `GMAIL_USER` | yes | Your Gmail address, e.g. `you@gmail.com` |
| `GMAIL_APP_PASSWORD` | yes | The 16-character app password (spaces are stripped automatically) |
| `ACCESS_KEY` | yes | A long random secret you choose (e.g. `openssl rand -hex 32`) |
| `ALLOWED_RECIPIENTS` | no | Comma-separated email addresses; when set, reports can only be sent to these addresses |

3. Deploy. `api/send.ts` is the only server-side code.

### 3. Configure the app

1. Open the deployed URL (install it with **Add to Home Screen** on iOS, or **Install app** on Android/desktop).
2. Go to **Settings** → **You** and enter your name and Gmail address.
3. Enter the same `ACCESS_KEY` from Vercel in **Sending → Access key**. It is stored only on this device and is never included in backups.
4. Add recipients, choose a theme, optionally set a default site name and PDF branding.
5. Use **Send test email** to confirm the whole chain works.

To change the access key later, edit the Vercel env var, redeploy, and update it in Settings.

## Local development

```bash
npm install
cp .env.example .env.local   # optional: VITE_DEV_ACCESS_KEY only
npm run dev
```

The Vite dev server does not run `/api/send`; email sending requires a Vercel deployment (or a local Vercel dev session with the env vars set). Service-worker registration is production-only.

```bash
npm run typecheck
npm run build
npm run icons   # regenerate PWA icons from scripts/generate-icons.mjs
```

## Manual test checklist

- **Offline creation:** turn on airplane mode, open the installed app, create a report from each starter template, fill required fields, add photos, and save. Confirm the shell opens instantly and the report appears as a draft.
- **Reconnect sending:** while offline, send a report. It should show "Waiting to send" with the calm offline message. Turn airplane mode off — the report sends automatically within seconds and moves to "Sent".
- **Failed send + retry:** set a deliberately wrong access key in Settings, send a report, and confirm it shows "Not sent" with an error. Correct the key, tap **Retry now** on the report detail screen, and confirm it sends. No duplicate email should arrive.
- **Large photo report:** add enough photos to exceed ~4.5 MB raw payload. Confirm multiple parts are sent ("Part 1 of 2" in the subject), each part has its own PDF with its share of the photos, and the recipient receives all parts.
- **Recipients:** verify To/Cc/Bcc toggles, validation of bad email addresses, and "Send me a copy" arriving in your own inbox.
- **Backup:** export a JSON backup, delete a report, import the backup, and confirm reports, photos and templates return. Confirm the access key is absent from the backup file.
- **Install and theme:** check install prompt on Android, "Add to Home Screen" instructions on iOS, light/dark mode, update banner after a redeploy, and safe-area spacing on a notched phone.
