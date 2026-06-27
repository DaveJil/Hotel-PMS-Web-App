const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const projectRoot = path.join(__dirname, '..');

function getElectronApp() {
  try {
    const electron = require('electron');
    return electron && electron.app ? electron.app : null;
  } catch (err) {
    return null;
  }
}

function getDatabasePath() {
  const electronApp = getElectronApp();
  if (electronApp && electronApp.isPackaged) {
    return path.join(electronApp.getPath('userData'), 'hotel.db');
  }
  return path.join(projectRoot, 'database', 'hotel.db');
}

function getSchemaPath() {
  const electronApp = getElectronApp();
  if (electronApp && electronApp.isPackaged) {
    return path.join(process.resourcesPath, 'database', 'schema.sql');
  }
  return path.join(projectRoot, 'database', 'schema.sql');
}

let db;

function migrateUsersTable(database) {
  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Users'")
    .get();
  if (!table || !/\busername\s+TEXT[^,]*\bUNIQUE\b/i.test(table.sql || '')) return;

  database.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE Users_migrated (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active'
    );
    INSERT INTO Users_migrated (user_id, username, password, full_name, role, status)
      SELECT user_id, username, password, full_name, role, status FROM Users;
    DROP TABLE Users;
    ALTER TABLE Users_migrated RENAME TO Users;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

function importWorkbookUsersOnce(database) {
  const marker = database
    .prepare("SELECT value FROM Setup WHERE setting = 'Workbook Users Imported v1'")
    .get();
  if (marker) return;

  const users = [
    ['U001', 'admin', '6585', 'System Admin', 'Admin', 'Active'],
    ['U002', 'princesscherri', 'princess123', 'Princess Ndiukwu', 'Front Desk', 'Active'],
    ['U003', 'josiaho', '8907', 'Josiah Onyomo', 'Housekeeping', 'Active'],
    ['U004', 'abdallataleb', '8912', 'Abdalla Taleb', 'Manager', 'Active'],
    ['U005', 'ezefranca', '8910', 'Eze Franca', 'Front Desk', 'Inactive'],
    ['U006', 'preciousd', '8031', 'Daka Precious', 'Housekeeping', 'Active'],
    ['U007', 'juiletb', '8341', 'Juliet Anderson', 'Housekeeping', 'Active'],
    ['U0008', 'Testuser', '9876', 'Test User', 'Front Desk', 'Active'],
    ['U0009', 'Testcleean', '6789', 'cleantest', 'Housekeeping', 'Active'],
    ['U010', 'backdated', 'backdate123', 'Backdated Staff', 'Backdated', 'Active'],
    ['U011', 'nkechisam', '7864', 'Nkechi Samuel Nwogu', 'Front Desk', 'Active'],
    ['U012', 'princesscherri', 'cherri123', 'Princess Ndiukwu', 'Backdated', 'Active'],
    ['U013', 'abigailnddc', '2560', 'Abigail NDDC', 'Manager', 'Active']
  ];
  const upsert = database.prepare(`
    INSERT INTO Users (user_id, username, password, full_name, role, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      full_name = excluded.full_name,
      role = excluded.role,
      status = excluded.status
  `);
  database.transaction(() => {
    users.forEach((user) => upsert.run(user));
    database.prepare("INSERT INTO Setup (setting, value) VALUES ('Workbook Users Imported v1', ?)").run(new Date().toISOString());
  })();
}

function getDb() {
  if (!db) {
    const dbPath = getDatabasePath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const database = getDb();
  const schemaPath = getSchemaPath();
  const schema = fs.readFileSync(schemaPath, 'utf8');
  migrateUsersTable(database);
  database.exec(schema);
  importWorkbookUsersOnce(database);
  resetNonRoomAreasDaily(database);
  return database;
}

function resetNonRoomAreasDaily(database = getDb()) {
  const today = new Date().toISOString().slice(0, 10);
  database
    .prepare(`
      UPDATE NonRoomAreas
      SET status = 'Dirty', last_reset_date = ?
      WHERE lower(status) != 'cleaning in progress'
        AND coalesce(last_reset_date, '') != ?
    `)
    .run(today, today);
}

module.exports = {
  dbPath: getDatabasePath(),
  getDb,
  initDatabase
};
