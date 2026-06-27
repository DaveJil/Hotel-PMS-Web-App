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
