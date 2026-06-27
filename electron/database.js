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
