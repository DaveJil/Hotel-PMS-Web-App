const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const { getDb } = require('./database');

const TABLES = {
  Users: {
    sheet: 'Users',
    columns: ['user_id', 'username', 'password', 'full_name', 'role', 'status'],
    headers: ['User ID', 'Username', 'Password', 'Full Name', 'Role', 'Status'],
    orderBy: 'username'
  },
  Rooms: {
    sheet: 'Rooms',
    columns: ['room_no', 'room_type', 'rate', 'status', 'housekeeping_status', 'maintenance_status', 'apartment_group', 'last_cleaned'],
    headers: ['Room No', 'Room Type', 'Rate', 'Status', 'Housekeeping Status', 'Maintenance Status', 'Apartment Group', 'Last Cleaned'],
    orderBy: 'room_no'
  },
  Reservations: {
    sheet: 'Reservations',
    columns: ['res_id', 'guest_name', 'phone', 'email', 'room_no', 'room_type', 'check_in', 'check_out', 'nights', 'adults', 'rate', 'discount_pct', 'net_amount', 'channel', 'status', 'payment_status', 'rrr_number', 'action_by', 'notes', 'created_at'],
    headers: ['Res ID', 'Guest Name', 'Phone', 'Email', 'Room No', 'Room Type', 'Check In', 'Check Out', 'Nights', 'Adults', 'Rate', 'Discount %', 'Net Amount', 'Channel', 'Status', 'Payment Status', 'RRR Number', 'Action By', 'Notes', 'Created At'],
    orderBy: 'created_at'
  },
  BookingHistory: {
    sheet: 'Booking History',
    columns: ['res_id', 'guest_name', 'phone', 'email', 'room_no', 'room_type', 'check_in', 'check_out', 'actual_check_out', 'nights', 'adults', 'rate', 'discount_pct', 'discount_applied', 'net_amount', 'channel', 'status', 'payment_status', 'rrr_number', 'late_checkout', 'late_checkout_amount', 'late_checkout_receipt', 'late_checkout_receipt_name', 'action_by', 'notes', 'created_at', 'updated_at'],
    headers: ['Res ID', 'Guest Name', 'Phone', 'Email', 'Room No', 'Room Type', 'Check In', 'Check Out', 'Actual Check Out', 'Nights', 'Adults', 'Rate', 'Discount %', 'Discount Applied', 'Net Amount', 'Channel', 'Status', 'Payment Status', 'RRR Number', 'Late Checkout', 'Late Checkout Amount', 'Late Checkout Receipt', 'Late Checkout Receipt Name', 'Action By', 'Notes', 'Created At', 'Updated At'],
    orderBy: 'created_at'
  },
  PaymentHistory: {
    sheet: 'Payment History',
    columns: ['payment_id', 'res_id', 'guest_name', 'room_no', 'payment_type', 'amount', 'rrr_number', 'payment_date', 'action_by', 'note', 'receipt', 'receipt_name'],
    headers: ['Payment ID', 'Res ID', 'Guest Name', 'Room No', 'Payment Type', 'Amount', 'RRR Number', 'Payment Date', 'Action By', 'Note', 'Receipt', 'Receipt Name'],
    orderBy: 'payment_date'
  },
  HousekeepingHistory: {
    sheet: 'Housekeeping History',
    columns: ['log_id', 'room', 'previous_status', 'new_status', 'changed_by', 'date_time', 'cleaning_count', 'note'],
    headers: ['Log ID', 'Room', 'Previous Status', 'New Status', 'Changed By', 'Date Time', 'Cleaning Count', 'Note'],
    orderBy: 'date_time'
  },
  CleaningHistory: {
    sheet: 'Cleaning History',
    columns: ['session_id', 'room', 'status', 'started_at', 'started_by', 'joined_by', 'join_times', 'finished_at', 'finished_by', 'duration_mins', 'cleaning_note', 'action_by'],
    headers: ['Session ID', 'Room', 'Status', 'Started At', 'Started By', 'Joined By', 'Join Times', 'Finished At', 'Finished By', 'Duration (Mins)', 'Cleaning Note', 'Action By'],
    orderBy: 'started_at'
  },
  MaintenanceHistory: {
    sheet: 'Maintenance History',
    columns: ['log_id', 'room', 'maintenance_note', 'date_added', 'status', 'action_by', 'resolved_at', 'resolved_by'],
    headers: ['Log ID', 'Room', 'Maintenance Note', 'Date Added', 'Status', 'Action By', 'Resolved At', 'Resolved By'],
    orderBy: 'date_added'
  },
  NonRoomAreas: {
    sheet: 'Non-Room Areas',
    columns: ['area', 'status', 'last_cleaned', 'last_reset_date'],
    headers: ['Area', 'Status', 'Last Cleaned', 'Last Reset Date'],
    orderBy: 'area'
  },
  NonRoomHousekeepingHistory: {
    sheet: 'Non-Room Housekeeping History',
    columns: ['log_id', 'area', 'previous_status', 'new_status', 'changed_by', 'date_time', 'cleaning_count', 'note'],
    headers: ['Log ID', 'Area', 'Previous Status', 'New Status', 'Changed By', 'Date Time', 'Cleaning Count', 'Note'],
    orderBy: 'date_time'
  },
  NonRoomCleaningHistory: {
    sheet: 'Non-Room Cleaning History',
    columns: ['session_id', 'area', 'status', 'started_at', 'started_by', 'joined_by', 'join_times', 'finished_at', 'finished_by', 'duration_mins', 'cleaning_note', 'action_by'],
    headers: ['Session ID', 'Area', 'Status', 'Started At', 'Started By', 'Joined By', 'Join Times', 'Finished At', 'Finished By', 'Duration (Mins)', 'Cleaning Note', 'Action By'],
    orderBy: 'started_at'
  },
  NonRoomMaintenanceHistory: {
    sheet: 'Non-Room Maintenance History',
    columns: ['log_id', 'area', 'maintenance_note', 'date_added', 'status', 'action_by', 'resolved_at', 'resolved_by'],
    headers: ['Log ID', 'Area', 'Maintenance Note', 'Date Added', 'Status', 'Action By', 'Resolved At', 'Resolved By'],
    orderBy: 'date_added'
  },
  Roles: {
    sheet: 'Roles',
    columns: ['role_id', 'role_name', 'description', 'status'],
    headers: ['Role ID', 'Role Name', 'Description', 'Status'],
    orderBy: 'role_id'
  },
  Channels: {
    sheet: 'Channels',
    columns: ['channel'],
    headers: ['Channel'],
    orderBy: 'channel'
  },
  Setup: {
    sheet: 'Setup',
    columns: ['setting', 'value'],
    headers: ['Setting', 'Value'],
    orderBy: 'setting'
  },
  BackdatedEntryLog: {
    sheet: 'Backdated Entry Log',
    columns: ['entry_id', 'entry_type', 'res_id', 'guest_name', 'room_no', 'amount', 'transaction_date', 'entered_by', 'note', 'logged_at'],
    headers: ['Entry ID', 'Entry Type', 'Res ID', 'Guest Name', 'Room No', 'Amount', 'Transaction Date', 'Entered By', 'Note', 'Logged At'],
    orderBy: 'logged_at'
  }
};

let syncTimer = null;
let syncRunning = false;

function getElectronApp() {
  try {
    const electron = require('electron');
    return electron && electron.app ? electron.app : null;
  } catch (err) {
    return null;
  }
}

function getUserDataPath() {
  const electronApp = getElectronApp();
  return electronApp ? electronApp.getPath('userData') : path.join(__dirname, '..', 'database');
}

function getConfigPath() {
  return process.env.PMS_SYNC_CONFIG || path.join(getUserDataPath(), 'sync-config.json');
}

function setState(key, value) {
  getDb()
    .prepare('INSERT INTO SyncState (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value == null ? '' : value));
}

function getState(key, fallback = '') {
  const row = getDb().prepare('SELECT value FROM SyncState WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function loadConfig() {
  const configPath = getConfigPath();
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  return {
    enabled: String(process.env.PMS_SYNC_ENABLED || fileConfig.enabled || getState('enabled', 'false')).toLowerCase() === 'true',
    spreadsheetId: process.env.PMS_GOOGLE_SHEET_ID || fileConfig.spreadsheetId || getState('spreadsheetId', ''),
    serviceAccountKeyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || fileConfig.serviceAccountKeyFile || '',
    serviceAccountJson: process.env.PMS_GOOGLE_SERVICE_ACCOUNT_JSON || fileConfig.serviceAccountJson || ''
  };
}

function saveConfig(next) {
  const current = loadConfig();
  const config = Object.assign({}, current, next || {});
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  setState('enabled', config.enabled ? 'true' : 'false');
  setState('spreadsheetId', config.spreadsheetId || '');
  return getSyncStatus();
}

function getSyncStatus() {
  const config = loadConfig();
  const pending = getDb().prepare("SELECT COUNT(*) AS count FROM SyncQueue WHERE status IN ('pending', 'failed')").get().count;
  return {
    ok: true,
    enabled: config.enabled,
    configured: Boolean(config.spreadsheetId && (config.serviceAccountKeyFile || config.serviceAccountJson)),
    spreadsheetId: config.spreadsheetId || '',
    pending,
    lastStatus: getState('lastStatus', 'Not configured'),
    lastSyncAt: getState('lastSyncAt', ''),
    lastError: getState('lastError', ''),
    configPath: getConfigPath()
  };
}

function enqueueTable(tableName) {
  if (!TABLES[tableName]) return;
  const existing = getDb()
    .prepare("SELECT id FROM SyncQueue WHERE table_name = ? AND status = 'pending' ORDER BY id DESC LIMIT 1")
    .get(tableName);
  if (existing) return;

  getDb()
    .prepare('INSERT INTO SyncQueue (table_name, operation, payload, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(tableName, 'snapshot', '{}', 'pending', new Date().toISOString(), new Date().toISOString());
}

function enqueueTables(tableNames) {
  (tableNames || Object.keys(TABLES)).forEach(enqueueTable);
}

function enqueueAllTables() {
  enqueueTables(Object.keys(TABLES));
}

async function hasInternet() {
  try {
    await dns.lookup('sheets.googleapis.com');
    return true;
  } catch (err) {
    return false;
  }
}

async function getSheetsClient(config) {
  let google;
  try {
    google = require('googleapis').google;
  } catch (err) {
    throw new Error('Google Sheets sync dependency is missing. Run npm install before enabling sync.');
  }

  let credentials;
  if (config.serviceAccountJson) {
    credentials = typeof config.serviceAccountJson === 'string'
      ? JSON.parse(config.serviceAccountJson)
      : config.serviceAccountJson;
  } else {
    credentials = JSON.parse(fs.readFileSync(config.serviceAccountKeyFile, 'utf8'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function tableValues(tableName) {
  const def = TABLES[tableName];
  const cols = def.columns.join(', ');
  const rows = getDb()
    .prepare(`SELECT ${cols} FROM ${tableName} ORDER BY ${def.orderBy}`)
    .all();

  return [
    def.headers,
    ...rows.map((row) => def.columns.map((col) => row[col] == null ? '' : row[col]))
  ];
}

async function pushTableSnapshot(sheets, spreadsheetId, tableName) {
  const def = TABLES[tableName];
  const values = tableValues(tableName);
  const sheet = quoteSheetName(def.sheet);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheet}!A:ZZ`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheet}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });
}

function normalizeHeader(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function validateIncomingReservations(records) {
  const active = records.filter((row) => ['reserved', 'checked in'].includes(String(row.status || '').toLowerCase()));
  const rooms = getDb().prepare('SELECT room_no, apartment_group FROM Rooms').all();

  function physicalRooms(unitNo) {
    const group = rooms.filter((room) => String(room.apartment_group || '') === String(unitNo));
    if (group.length) return group.map((room) => String(room.room_no));
    const room = rooms.find((item) => String(item.room_no) === String(unitNo));
    return room && room.apartment_group
      ? [String(room.room_no), `group:${room.apartment_group}`]
      : [String(unitNo)];
  }

  function dateOnly(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const first = active[i];
      const second = active[j];
      const firstUnits = physicalRooms(first.room_no);
      const secondUnits = physicalRooms(second.room_no);
      const sameUnit = firstUnits.some((unit) => secondUnits.includes(unit))
        || firstUnits.includes(`group:${second.room_no}`)
        || secondUnits.includes(`group:${first.room_no}`);
      if (!sameUnit) continue;

      const firstStart = dateOnly(first.check_in);
      const firstEnd = dateOnly(first.check_out);
      const secondStart = dateOnly(second.check_in);
      const secondEnd = dateOnly(second.check_out);
      if (!firstStart || !firstEnd || !secondStart || !secondEnd) {
        throw new Error(`Google Sheets contains invalid reservation dates in ${first.res_id} or ${second.res_id}.`);
      }
      if (firstStart < secondEnd && firstEnd > secondStart) {
        throw new Error(
          `Google Sheets contains overlapping active reservations ${first.res_id} and ${second.res_id} for ${first.room_no}. Edit the conflicting reservation before pulling.`
        );
      }
    }
  }
}

async function pullTableSnapshot(sheets, spreadsheetId, tableName) {
  const def = TABLES[tableName];
  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheetName(def.sheet)}!A:ZZ`
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (/unable to parse range|requested entity was not found/i.test(message)) return { skipped: true };
    throw err;
  }

  const values = response.data.values || [];
  if (!values.length) return { skipped: true };
  const headerIndexes = new Map(values[0].map((header, index) => [normalizeHeader(header), index]));
  const missing = def.headers.filter((header) => !headerIndexes.has(normalizeHeader(header)));
  if (missing.length) {
    throw new Error(`${def.sheet} is missing required column(s): ${missing.join(', ')}`);
  }

  const records = values.slice(1)
    .filter((row) => row.some((value) => String(value == null ? '' : value).trim() !== ''))
    .map((row) => Object.fromEntries(def.columns.map((column, index) => [
      column,
      row[headerIndexes.get(normalizeHeader(def.headers[index]))] == null
        ? ''
        : row[headerIndexes.get(normalizeHeader(def.headers[index]))]
    ])));

  if (tableName === 'Reservations') validateIncomingReservations(records);

  const placeholders = def.columns.map(() => '?').join(', ');
  const insert = getDb().prepare(
    `INSERT INTO ${tableName} (${def.columns.join(', ')}) VALUES (${placeholders})`
  );
  getDb().transaction(() => {
    getDb().prepare(`DELETE FROM ${tableName}`).run();
    records.forEach((record) => insert.run(def.columns.map((column) => record[column])));
  })();
  return { pulled: records.length };
}

async function processSyncQueue(options = {}) {
  if (syncRunning) return getSyncStatus();
  const config = loadConfig();
  if (!config.enabled && !options.force) return getSyncStatus();
  if (!config.spreadsheetId) {
    setState('lastStatus', 'Missing spreadsheet ID');
    return getSyncStatus();
  }

  syncRunning = true;
  try {
    if (!(await hasInternet())) {
      setState('lastStatus', 'Offline');
      return getSyncStatus();
    }

    const sheets = await getSheetsClient(config);
    const pending = getDb()
      .prepare("SELECT * FROM SyncQueue WHERE status IN ('pending', 'failed') ORDER BY created_at, id LIMIT 25")
      .all();

    for (const item of pending) {
      try {
        await pushTableSnapshot(sheets, config.spreadsheetId, item.table_name);
        getDb()
          .prepare("UPDATE SyncQueue SET status = 'synced', attempts = attempts + 1, last_error = '', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), item.id);
      } catch (err) {
        getDb()
          .prepare("UPDATE SyncQueue SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?")
          .run(err.message || String(err), new Date().toISOString(), item.id);
        throw err;
      }
    }

    let pulledTables = 0;
    let pulledRows = 0;
    for (const tableName of Object.keys(TABLES)) {
      const result = await pullTableSnapshot(sheets, config.spreadsheetId, tableName);
      if (!result.skipped) {
        pulledTables += 1;
        pulledRows += result.pulled || 0;
      }
    }

    setState(
      'lastStatus',
      `Online sync complete: pushed ${pending.length} table(s), pulled ${pulledRows} row(s) from ${pulledTables} table(s)`
    );
    setState('lastSyncAt', new Date().toISOString());
    setState('lastError', '');
    return getSyncStatus();
  } catch (err) {
    setState('lastStatus', 'Sync failed');
    setState('lastError', err.message || String(err));
    return getSyncStatus();
  } finally {
    syncRunning = false;
  }
}

function startBackgroundSync(intervalMs = 60000) {
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    processSyncQueue().catch(() => {});
  }, intervalMs);
}

function stopBackgroundSync() {
  if (!syncTimer) return;
  clearInterval(syncTimer);
  syncTimer = null;
}

module.exports = {
  TABLES,
  enqueueAllTables,
  enqueueTables,
  getSyncStatus,
  processSyncQueue,
  saveConfig,
  startBackgroundSync,
  stopBackgroundSync
};
