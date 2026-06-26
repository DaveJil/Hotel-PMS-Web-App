const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const projectRoot = path.join(__dirname, '..');
const dbPath = path.join(projectRoot, 'database', 'hotel.db');
const schemaPath = path.join(projectRoot, 'database', 'schema.sql');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const database = getDb();
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
  dbPath,
  getDb,
  initDatabase
};
