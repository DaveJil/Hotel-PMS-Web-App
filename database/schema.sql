PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Setup (
  setting TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS Users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS Roles (
  role_id TEXT PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS Channels (
  channel TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS Rooms (
  room_no TEXT PRIMARY KEY,
  room_type TEXT NOT NULL DEFAULT '',
  rate REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Vacant',
  housekeeping_status TEXT NOT NULL DEFAULT 'Clean',
  maintenance_status TEXT NOT NULL DEFAULT 'Resolved',
  apartment_group TEXT NOT NULL DEFAULT '',
  last_cleaned TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS Reservations (
  res_id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  room_no TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  nights INTEGER NOT NULL DEFAULT 0,
  adults INTEGER NOT NULL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'Walk-in',
  status TEXT NOT NULL DEFAULT 'Reserved',
  payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  rrr_number TEXT NOT NULL DEFAULT '',
  action_by TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS BookingHistory (
  res_id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  room_no TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  actual_check_out TEXT NOT NULL DEFAULT '',
  nights INTEGER NOT NULL DEFAULT 0,
  adults INTEGER NOT NULL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  discount_applied TEXT NOT NULL DEFAULT 'No',
  net_amount REAL NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'Walk-in',
  status TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  rrr_number TEXT NOT NULL DEFAULT '',
  late_checkout TEXT NOT NULL DEFAULT 'No',
  late_checkout_amount REAL NOT NULL DEFAULT 0,
  late_checkout_receipt TEXT NOT NULL DEFAULT '',
  late_checkout_receipt_name TEXT NOT NULL DEFAULT '',
  action_by TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Payments (
  payment_id TEXT PRIMARY KEY,
  res_id TEXT NOT NULL,
  guest_name TEXT NOT NULL DEFAULT '',
  room_no TEXT NOT NULL DEFAULT '',
  payment_type TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  rrr_number TEXT NOT NULL DEFAULT '',
  payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  action_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  receipt TEXT NOT NULL DEFAULT '',
  receipt_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS PaymentHistory (
  payment_id TEXT PRIMARY KEY,
  res_id TEXT NOT NULL,
  guest_name TEXT NOT NULL DEFAULT '',
  room_no TEXT NOT NULL DEFAULT '',
  payment_type TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  rrr_number TEXT NOT NULL DEFAULT '',
  payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  action_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  receipt TEXT NOT NULL DEFAULT '',
  receipt_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS HousekeepingHistory (
  log_id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  previous_status TEXT NOT NULL DEFAULT '',
  new_status TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  date_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cleaning_count INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS CleaningHistory (
  session_id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT '',
  started_by TEXT NOT NULL DEFAULT '',
  joined_by TEXT NOT NULL DEFAULT '',
  join_times TEXT NOT NULL DEFAULT '',
  finished_at TEXT NOT NULL DEFAULT '',
  finished_by TEXT NOT NULL DEFAULT '',
  duration_mins INTEGER NOT NULL DEFAULT 0,
  cleaning_note TEXT NOT NULL DEFAULT '',
  action_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS MaintenanceHistory (
  log_id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  maintenance_note TEXT NOT NULL DEFAULT '',
  date_added TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'Not Resolved',
  action_by TEXT NOT NULL DEFAULT '',
  resolved_at TEXT NOT NULL DEFAULT '',
  resolved_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS NonRoomAreas (
  area TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Dirty',
  last_cleaned TEXT NOT NULL DEFAULT '',
  last_reset_date TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS NonRoomHousekeepingHistory (
  log_id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  previous_status TEXT NOT NULL DEFAULT '',
  new_status TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  date_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cleaning_count INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS NonRoomCleaningHistory (
  session_id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT '',
  started_by TEXT NOT NULL DEFAULT '',
  joined_by TEXT NOT NULL DEFAULT '',
  join_times TEXT NOT NULL DEFAULT '',
  finished_at TEXT NOT NULL DEFAULT '',
  finished_by TEXT NOT NULL DEFAULT '',
  duration_mins INTEGER NOT NULL DEFAULT 0,
  cleaning_note TEXT NOT NULL DEFAULT '',
  action_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS NonRoomMaintenanceHistory (
  log_id TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  maintenance_note TEXT NOT NULL DEFAULT '',
  date_added TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'Not Resolved',
  action_by TEXT NOT NULL DEFAULT '',
  resolved_at TEXT NOT NULL DEFAULT '',
  resolved_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS BackdatedEntryLog (
  entry_id TEXT PRIMARY KEY,
  entry_type TEXT NOT NULL DEFAULT '',
  res_id TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  room_no TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  transaction_date TEXT NOT NULL DEFAULT '',
  entered_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username
  ON Users(username COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS SyncQueue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'snapshot',
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status
  ON SyncQueue(status, created_at);

CREATE TABLE IF NOT EXISTS SyncState (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO SyncState (key, value) VALUES
  ('enabled', 'false'),
  ('lastStatus', 'Not configured'),
  ('lastSyncAt', ''),
  ('lastError', ''),
  ('spreadsheetId', '');

CREATE TABLE IF NOT EXISTS EmailQueue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status
  ON EmailQueue(status, created_at);

CREATE TABLE IF NOT EXISTS EmailState (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO EmailState (key, value) VALUES
  ('enabled', 'false'),
  ('lastStatus', 'Not configured'),
  ('lastSentAt', ''),
  ('lastError', '');

INSERT OR IGNORE INTO Setup (setting, value) VALUES
  ('Hotel Name', 'NDDC Clubhouse'),
  ('Tagline', 'Redefining Luxury Living'),
  ('Logo Data Uri', '');

INSERT OR IGNORE INTO Users (user_id, username, password, full_name, role, status) VALUES
  ('U001', 'admin', '6585', 'System Admin', 'Admin', 'Active'),
  ('U002', 'princesscherri', 'princess123', 'Princess Ndiukwu', 'Front Desk', 'Active'),
  ('U003', 'josiaho', '8907', 'Josiah Onyomo', 'Housekeeping', 'Active'),
  ('U004', 'abdallataleb', '8912', 'Abdalla Taleb', 'Manager', 'Active'),
  ('U005', 'ezefranca', '8910', 'Eze Franca', 'Front Desk', 'Inactive'),
  ('U006', 'preciousd', '8031', 'Daka Precious', 'Housekeeping', 'Active'),
  ('U007', 'juiletb', '8341', 'Juliet Anderson', 'Housekeeping', 'Active'),
  ('U0008', 'Testuser', '9876', 'Test User', 'Front Desk', 'Active'),
  ('U0009', 'Testcleean', '6789', 'cleantest', 'Housekeeping', 'Active'),
  ('U010', 'backdated', 'backdate123', 'Backdated Staff', 'Backdated', 'Active'),
  ('U011', 'nkechisam', '7864', 'Nkechi Samuel Nwogu', 'Front Desk', 'Active'),
  ('U012', 'princesscherri', 'cherri123', 'Princess Ndiukwu', 'Backdated', 'Active'),
  ('U013', 'abigailnddc', '2560', 'Abigail NDDC', 'Manager', 'Active');

INSERT OR IGNORE INTO Roles (role_id, role_name, description, status) VALUES
  ('R001', 'Admin', 'Full access', 'Active'),
  ('R002', 'Front Desk', 'Reservations and check-in/out', 'Active'),
  ('R003', 'Manager', 'Reports and oversight', 'Active'),
  ('R004', 'Housekeeping', 'Housekeeping and maintenance', 'Active'),
  ('R005', 'Backdated', 'Backdated entry portal access', 'Active');

INSERT OR IGNORE INTO Channels (channel) VALUES
  ('Walk-in'),
  ('Online'),
  ('OTA'),
  ('Corporate'),
  ('Referral');

INSERT OR IGNORE INTO Rooms (room_no, room_type, rate, status, housekeeping_status, maintenance_status, apartment_group, last_cleaned) VALUES
  ('201', 'Deluxe', 50000, 'Vacant', 'Clean', 'Resolved', 'Apartment 1', ''),
  ('202', 'Deluxe', 50000, 'Vacant', 'Clean', 'Resolved', 'Apartment 1', ''),
  ('203', 'Deluxe', 50000, 'Vacant', 'Clean', 'Resolved', 'Apartment 1', ''),
  ('204', 'Classic', 40000, 'Vacant', 'Clean', 'Resolved', '', ''),
  ('205', 'Classic', 40000, 'Vacant', 'Clean', 'Resolved', '', ''),
  ('301', 'Executive', 55000, 'Vacant', 'Clean', 'Resolved', 'Apartment 3', ''),
  ('302', 'Executive', 55000, 'Vacant', 'Clean', 'Resolved', 'Apartment 3', ''),
  ('303', 'Executive', 55000, 'Vacant', 'Clean', 'Resolved', 'Apartment 3', ''),
  ('304', 'Executive', 52000, 'Vacant', 'Clean', 'Resolved', 'Apartment 2', ''),
  ('305', 'Executive', 52000, 'Vacant', 'Clean', 'Resolved', 'Apartment 2', ''),
  ('306', 'Executive', 52000, 'Vacant', 'Clean', 'Resolved', 'Apartment 2', '');

INSERT OR IGNORE INTO NonRoomAreas (area, status, last_cleaned, last_reset_date) VALUES
  ('Lobby', 'Dirty', '', ''),
  ('Reception', 'Dirty', '', ''),
  ('Restaurant', 'Dirty', '', ''),
  ('Kitchen', 'Dirty', '', ''),
  ('Gym', 'Dirty', '', ''),
  ('Bar', 'Dirty', '', ''),
  ('Corridor', 'Dirty', '', ''),
  ('Staircase', 'Dirty', '', '');
