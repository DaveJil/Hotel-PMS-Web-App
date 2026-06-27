# NDDC Clubhouse PMS

Offline-first hotel property management desktop application built with Electron, Node.js, and SQLite.

## Desktop Features

- Local SQLite database
- Login and role-based access
- Rooms and reservations
- Check-in, check-out, extend stay, and late checkout
- Payments and payment history
- Room and non-room housekeeping
- Maintenance
- Reports and receipts
- User administration
- Optional Google Sheets background sync
- Local backdated entry portal
- Offline email queue with automatic SMTP delivery

## Offline Behavior

Hotel operations are written to SQLite first and continue without internet.

- Local changes are placed in `SyncQueue`.
- Online refresh pushes pending local changes and then pulls current Google Sheets data.
- Emails are placed in `EmailQueue`.
- Background workers retry queued work every 60 seconds.
- WhatsApp and PDF actions display an internet-required confirmation.
- PDF generation is blocked when the computer is offline.

## Run on macOS

```bash
npm install
npx electron-builder install-app-deps
npm start
```

## Build Windows Installer on macOS

```bash
npm install
npm run build:win
```

The Windows x64 installer is generated in `dist/`.

## Google Sheets Sync

1. Create a Google Cloud service account.
2. Enable the Google Sheets API.
3. Share the PMS spreadsheet with the service account email.
4. Log in as Admin.
5. Open **Admin > Google Sheets Sync**.
6. Enter the spreadsheet ID and service-account JSON file path.
7. Enable sync, save, queue a full sync, and run sync.

Pending local table snapshots are pushed first. The app then pulls the matching Google Sheet tabs into SQLite. Pulls that contain overlapping active room reservations are rejected until the conflicting spreadsheet reservation is corrected.

## Backdated Entry Portal

Select **Backdated Entry Portal** on the login screen. The portal supports historical reservations, payments, stay extensions, checkouts, and late-checkout fees.

```text
Username: backdated
Password: backdate123
```

## Email Queue

Email delivery uses SMTP and does not interrupt offline work.

1. Log in as Admin.
2. Open **Admin > Email Delivery Queue**.
3. Enter the SMTP host, port, username, password/app password, and sender address.
4. Enable email delivery and save.

Reservation confirmations, reservation updates, and checkout receipts are queued locally. They send automatically when internet is available.

For Gmail, use `smtp.gmail.com`, port `587`, STARTTLS, and a Google app password.

## Default Login

```text
Username: admin
Password: 6585
```

The remaining staff accounts are migrated from the `Users` sheet in `hotel pms.xlsx`.
