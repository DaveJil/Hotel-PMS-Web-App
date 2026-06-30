# From Google Sheets to a Full Windows Hotel PMS

I recently completed a major migration of the NDDC Clubhouse Hotel Property Management System from a Google Apps Script web application into an offline-first Windows desktop application.

## The Original System

The original PMS used:

- Google Apps Script for backend business logic
- Google Sheets as the operational database
- HTML, CSS, and JavaScript for the interface
- `google.script.run` for frontend-to-backend communication
- Google services such as `SpreadsheetApp`, `DriveApp`, `CacheService`, `Session`, and `HtmlService`

It already handled reservations, check-in, check-out, payments, housekeeping, maintenance, reports, user permissions, receipts, booking history, late checkout, stay extensions, and administrative operations.

The main goal was to preserve those workflows and the existing interface while removing the application's dependency on an active internet connection.

## The New Desktop Architecture

The application now uses:

- **Electron** for the Windows desktop runtime
- **Node.js** for local backend services
- **SQLite** for offline data storage
- **better-sqlite3** for synchronous, transactional database access
- **Electron IPC** and a context-isolated preload bridge for secure frontend-to-backend communication
- **HTML, CSS, and vanilla JavaScript** for the preserved user interface
- **googleapis** for optional Google Sheets synchronization
- **Nodemailer** for queued SMTP email delivery
- **electron-builder** and **NSIS** for generating the Windows x64 installer

Calls such as:

```javascript
google.script.run.createReservation(payload);
```

were migrated to local Electron APIs:

```javascript
window.api.createReservation(payload);
```

The renderer cannot access Node.js directly. All privileged operations pass through the preload bridge and registered IPC handlers with Electron context isolation enabled.

## Offline-First Operation

SQLite is now the application's local operational database. Core hotel activities continue working without internet, including:

- User authentication and role-based access
- Room and apartment management
- Reservation creation and editing
- Check-in and check-out
- Stay extensions and late-checkout payments
- Payment history
- Room and non-room housekeeping
- Cleaning sessions
- Maintenance reporting and resolution
- Booking history and financial reports
- Backdated reservations, payments, extensions, and checkouts
- User administration

Data is stored on the Windows computer under the application's user-data directory, so application upgrades do not remove hotel records.

## Google Sheets Synchronization

Google Sheets is now an optional online synchronization layer rather than the primary database.

The synchronization service:

- Queues local changes while the computer is offline
- Automatically retries when internet access returns
- Pushes pending local table snapshots to Google Sheets
- Pulls updated Google Sheets data into SQLite
- Uses a Google Cloud service account and the Google Sheets API
- Reports pending operations, the last synchronization time, and errors
- Repairs duplicated history identifiers without discarding records
- Rejects unsafe cloud data, such as overlapping active reservations for the same physical room

The reservation rules understand the difference between an individual room and an entire apartment. Two different rooms in the same apartment can be reserved independently, while a whole-apartment booking blocks all rooms belonging to that apartment.

## Data Integrity and Booking Protection

Reservation validation exists in the local backend, not only in the interface.

Before a reservation or stay extension is saved, the backend checks:

- Check-in and check-out dates
- Existing active reservations
- Physical room conflicts
- Whole-apartment conflicts
- Checked-in guests who have not yet checked out

When a conflict is found, the application identifies the existing reservation, guest, room, and dates, then offers the user an opportunity to open and edit that reservation.

Database transactions protect multi-table operations so reservation, booking-history, payment, and backdated-entry records are committed together.

## Migrating Existing Users

The original user records were imported from the Excel/Google Sheets data model into SQLite.

The migration preserves:

- User IDs
- Usernames and passwords
- Staff names
- Roles
- Active and inactive account states
- Existing duplicate usernames that belong to different roles and credentials

A one-time migration marker prevents imported seed accounts from overwriting later user changes received through synchronization.

## Backdated Entry Portal

The separate Google Apps Script backdated-entry portal was also migrated into Electron.

It now runs locally and supports:

- Backdated reservations
- Historical payment records
- Backdated stay extensions
- Historical checkouts
- Late-checkout fees
- Entry history and summaries

All portal operations write to SQLite first and join the same synchronization queue as the main PMS.

## Email Delivery

Email delivery is handled through SMTP using Nodemailer.

Reservation confirmations, updates, and checkout receipts can be queued offline. When internet access becomes available, the email worker sends pending messages automatically through the hotel's company mailbox.

The SMTP host, port, encryption mode, username, sender identity, and password are configurable from the Admin panel.

## Windows Packaging

The application is packaged as a Windows x64 NSIS installer using Electron Builder.

The packaging process includes:

- The Electron application runtime
- The Windows x64 native `better-sqlite3` module
- The SQLite schema and migration logic
- Renderer assets
- The backdated-entry portal
- Google Sheets and email synchronization services

The installer can be produced from macOS through Electron's cross-platform Windows build target and deployed to a Windows computer.

## Key Engineering Lessons

This migration involved more than wrapping a website in Electron. The work included:

- Translating Apps Script functions into modular local APIs
- Replacing Google session and cache behavior
- Designing a persistent SQLite schema
- Preserving existing hotel business rules
- Handling offline and online state transitions
- Resolving duplicate legacy identifiers
- Protecting against double booking
- Migrating role-specific workflows
- Rebuilding native Node modules for the correct operating system and CPU architecture
- Verifying the final Windows installer and its bundled native dependencies

The result is a hotel PMS that remains operational during internet outages while still supporting controlled synchronization, company email delivery, and Windows deployment.

## Technology Stack

`Electron` | `Node.js` | `SQLite` | `better-sqlite3` | `Electron IPC` | `JavaScript` | `HTML` | `CSS` | `Google Sheets API` | `Google Cloud Service Accounts` | `Nodemailer` | `SMTP` | `electron-builder` | `NSIS`

#Electron #NodeJS #SQLite #JavaScript #DesktopApplication #HotelManagement #PropertyManagementSystem #OfflineFirst #GoogleSheetsAPI #SoftwareEngineering #DigitalTransformation
