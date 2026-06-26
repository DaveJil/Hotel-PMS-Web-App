PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Setup (
  setting TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS Users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
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

INSERT OR IGNORE INTO Setup (setting, value) VALUES
  ('Hotel Name', 'NDDC Clubhouse'),
  ('Tagline', 'Redefining Luxury Living'),
  ('Logo Data Uri', '');

INSERT OR IGNORE INTO Users (user_id, username, password, full_name, role, status) VALUES
  ('U001', 'admin', '1234', 'System Admin', 'Admin', 'Active');

INSERT OR IGNORE INTO Roles (role_id, role_name, description, status) VALUES
  ('R001', 'Admin', 'Full access', 'Active'),
  ('R002', 'Front Desk', 'Reservations and check-in/out', 'Active'),
  ('R003', 'Manager', 'Reports and oversight', 'Active'),
  ('R004', 'Housekeeping', 'Housekeeping and maintenance', 'Active');

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
