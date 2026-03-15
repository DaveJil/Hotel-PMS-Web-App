const APP_TITLE = 'Hotel Name PMS';
const APARTMENT_FIXED_RATE = 300000;

const SHEETS = {
  setup: 'Setup',
  rooms: 'Rooms',
  reservations: 'Reservations',
  bookingHistory: 'Booking History',
  housekeepingHistory: 'Housekeeping History',
  maintenanceHistory: 'Maintenance History',
  cleaningHistory: 'Cleaning History',
  users: 'Users',
  roles: 'Roles',
  channels: 'Channels',
  paymentHistory: 'Payment History',
  nonRoomAreas: 'Non-Room Areas',
  nonRoomHousekeepingHistory: 'Non-Room Housekeeping History',
  nonRoomCleaningHistory: 'Non-Room Cleaning History'
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showPmsSidebar() {
  showSidebar();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('NDDC PMS')
    .addItem('Open PMS', 'showSidebar')
    .addItem('Authorize App', 'authorizeApp')
    .addToUi();
}

function authorizeApp() {
  ensureOperationalSheets_();
  SpreadsheetApp.getActiveSpreadsheet().getName();
  return 'authorized';
}

function login(username, password) {
  try {
    ensureOperationalSheets_();
    const sh = getSheet_(SHEETS.users);
    const rows = getObjects_(sh);

    const found = rows.find(r =>
      String(r['Username'] || '').trim().toLowerCase() === String(username || '').trim().toLowerCase() &&
      String(r['Password'] || '').trim() === String(password || '').trim() &&
      String(r['Status'] || '').toLowerCase() === 'active'
    );

    if (!found) return { ok: false, message: 'Invalid username or password.' };

    const user = {
      userId: String(found['User ID'] || ''),
      username: String(found['Username'] || ''),
      fullName: String(found['Full Name'] || found['Username'] || ''),
      role: String(found['Role'] || ''),
      status: String(found['Status'] || '')
    };

    PropertiesService.getUserProperties().setProperty('CURRENT_USER', JSON.stringify(user));
    audit_('Login', user.username, 'User logged in');
    return { ok: true, user: user };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function logout() {
  PropertiesService.getUserProperties().deleteProperty('CURRENT_USER');
  return { ok: true };
}

function getCurrentUser_() {
  const raw = PropertiesService.getUserProperties().getProperty('CURRENT_USER');
  return raw ? JSON.parse(raw) : null;
}

function requireUser_() {
  const user = getCurrentUser_();
  if (!user) throw new Error('Session expired. Please log in again.');
  return user;
}

function getAppBootstrap() {
  try {
    ensureOperationalSheets_();
    const user = getCurrentUser_();
    const isHousekeeping = user && String(user.role) === 'Housekeeping';

    return {
      ok: true,
      user: user,
      branding: getBranding_(),
      dashboard: getDashboard_(),
      rooms: getRoomsData_(),
      reservations: isHousekeeping ? [] : getReservations_(),
      bookingHistory: isHousekeeping ? [] : getBookingHistory_(),
      housekeepingHistory: getHousekeepingHistory_(),
      maintenanceHistory: getMaintenanceHistory_(),
      cleaningHistory: getCleaningHistory_(),
      paymentHistory: isHousekeeping ? [] : getPaymentHistory_(),
      nonRoomAreas: getNonRoomAreas_(),
      nonRoomHousekeepingHistory: getNonRoomHousekeepingHistory_(),
      nonRoomCleaningHistory: getNonRoomCleaningHistory_(),
      users: getUsers_(),
      roles: getActiveRoles_(),
      channels: getChannels_()
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message,
      user: null,
      branding: { hotelName: 'NDDC Clubhouse', tagline: 'Redefining Luxury Living', logoDataUri: '' },
      dashboard: { totalRooms: 0, occupied: 0, reserved: 0, dirty: 0 },
      rooms: [],
      reservations: [],
      bookingHistory: [],
      housekeepingHistory: [],
      maintenanceHistory: [],
      cleaningHistory: [],
      paymentHistory: [],
      nonRoomAreas: [],
      nonRoomHousekeepingHistory: [],
      nonRoomCleaningHistory: [],
      users: [],
      roles: [],
      channels: []
    };
  }
}

function getBranding_() {
  const sh = getSheet_(SHEETS.setup, false);
  if (!sh) return { hotelName: 'NDDC Clubhouse', tagline: 'Redefining Luxury Living', logoDataUri: '' };

  const rows = getObjects_(sh);
  const map = {};
  rows.forEach(r => map[String(r['Setting'] || '')] = String(r['Value'] || ''));

  return {
    hotelName: map['Hotel Name'] || 'NDDC Clubhouse',
    tagline: map['Tagline'] || 'Redefining Luxury Living',
    logoDataUri: map['Logo Data Uri'] || ''
  };
}

function getDashboard_() {
  const rooms = getRoomsData_();
  const reservations = getReservations_();

  return {
    totalRooms: rooms.length,
    occupied: rooms.filter(r => String(r.status).toLowerCase() === 'occupied').length,
    reserved: reservations.filter(r => String(r.status) === 'Reserved').length,
    dirty: rooms.filter(r => String(r.housekeepingStatus).toLowerCase() === 'dirty').length
  };
}

function getUsers_() {
  const sh = getSheet_(SHEETS.users, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    userId: String(r['User ID'] || ''),
    username: String(r['Username'] || ''),
    fullName: String(r['Full Name'] || ''),
    role: String(r['Role'] || ''),
    status: String(r['Status'] || '')
  }));
}

function getRoomsData_() {
  const sh = getSheet_(SHEETS.rooms, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    roomNo: String(r['Room No'] || ''),
    roomType: String(r['Room Type'] || ''),
    rate: Number(r['Rate'] || 0),
    status: String(r['Status'] || ''),
    housekeepingStatus: String(r['Housekeeping Status'] || ''),
    maintenanceStatus: String(r['Maintenance Status'] || ''),
    apartmentGroup: String(r['Apartment Group'] || ''),
    lastCleaned: formatDateTime_(r['Last Cleaned'])
  }));
}

function getReservations_() {
  const sh = getSheet_(SHEETS.reservations, false);
  if (!sh) return [];

  return getObjects_(sh)
    .map(r => ({
      resId: String(r['Res ID'] || ''),
      guestName: String(r['Guest Name'] || ''),
      phone: String(r['Phone'] || ''),
      email: String(r['Email'] || ''),
      roomNo: String(r['Room No'] || ''),
      roomType: String(r['Room Type'] || ''),
      checkIn: formatDate_(r['Check In']),
      checkOut: formatDate_(r['Check Out']),
      nights: Number(r['Nights'] || 0),
      adults: Number(r['Adults'] || 0),
      rate: Number(r['Rate'] || 0),
      discountPct: Number(r['Discount %'] || 0),
      netAmount: Number(r['Net Amount'] || 0),
      channel: String(r['Channel'] || ''),
      status: String(r['Status'] || ''),
      paymentStatus: String(r['Payment Status'] || ''),
      rrrNumber: String(r['RRR Number'] || ''),
      notes: String(r['Notes'] || '')
    }))
    .filter(r => r.status === 'Reserved' || r.status === 'Checked In');
}

function getBookingHistory_() {
  const sh = getSheet_(SHEETS.bookingHistory, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    resId: String(r['Res ID'] || ''),
    guestName: String(r['Guest Name'] || ''),
    phone: String(r['Phone'] || ''),
    email: String(r['Email'] || ''),
    roomNo: String(r['Room No'] || ''),
    roomType: String(r['Room Type'] || ''),
    checkIn: formatDate_(r['Check In']),
    checkOut: formatDate_(r['Check Out']),
    actualCheckout: formatDateTime_(r['Actual Check Out']),
    discountPct: Number(r['Discount %'] || 0),
    discountApplied: String(r['Discount Applied'] || 'No'),
    netAmount: Number(r['Net Amount'] || 0),
    channel: String(r['Channel'] || ''),
    paymentStatus: String(r['Payment Status'] || ''),
    rrrNumber: String(r['RRR Number'] || ''),
    lateCheckout: String(r['Late Checkout'] || 'No'),
    lateCheckoutAmount: Number(r['Late Checkout Amount'] || 0),
    lateCheckoutReceipt: String(r['Late Checkout Receipt'] || ''),
    lateCheckoutReceiptName: String(r['Late Checkout Receipt Name'] || ''),
    status: String(r['Status'] || ''),
    notes: String(r['Notes'] || ''),
    createdAt: formatDateTime_(r['Created At']),
    updatedAt: formatDateTime_(r['Updated At'])
  }));
}

function getHousekeepingHistory_() {
  const sh = getSheet_(SHEETS.housekeepingHistory, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    logId: String(r['Log ID'] || ''),
    roomNo: String(r['Room'] || ''),
    previousStatus: String(r['Previous Status'] || ''),
    newStatus: String(r['New Status'] || ''),
    changedBy: String(r['Changed By'] || ''),
    dateTime: formatDateTime_(r['Date Time']),
    cleaningCount: Number(r['Cleaning Count'] || 0),
    note: String(r['Note'] || '')
  }));
}

function getMaintenanceHistory_() {
  const sh = getSheet_(SHEETS.maintenanceHistory, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    logId: String(r['Log ID'] || ''),
    roomNo: String(r['Room'] || ''),
    maintenanceNote: String(r['Maintenance Note'] || ''),
    dateAdded: formatDateTime_(r['Date Added']),
    status: String(r['Status'] || ''),
    actionBy: String(r['Action By'] || '')
  }));
}

function getCleaningHistory_() {
  const sh = getSheet_(SHEETS.cleaningHistory, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    sessionId: String(r['Session ID'] || ''),
    roomNo: String(r['Room'] || ''),
    status: String(r['Status'] || ''),
    startedAt: formatDateTime_(r['Started At']),
    startedBy: String(r['Started By'] || ''),
    joinedBy: String(r['Joined By'] || ''),
    joinTimes: String(r['Join Times'] || ''),
    finishedAt: formatDateTime_(r['Finished At']),
    finishedBy: String(r['Finished By'] || ''),
    durationMins: String(r['Duration (Mins)'] || ''),
    cleaningNote: String(r['Cleaning Note'] || ''),
    actionBy: String(r['Action By'] || '')
  }));
}

function getPaymentHistory_() {
  const sh = getSheet_(SHEETS.paymentHistory, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    paymentId: String(r['Payment ID'] || ''),
    resId: String(r['Res ID'] || ''),
    guestName: String(r['Guest Name'] || ''),
    roomNo: String(r['Room No'] || ''),
    paymentType: String(r['Payment Type'] || ''),
    amount: Number(r['Amount'] || 0),
    rrrNumber: String(r['RRR Number'] || ''),
    paymentDate: formatDateTime_(r['Payment Date']),
    actionBy: String(r['Action By'] || ''),
    note: String(r['Note'] || ''),
    receipt: String(r['Receipt'] || ''),
    receiptName: String(r['Receipt Name'] || '')
  }));
}

function getNonRoomAreas_() {
  const sh = getSheet_(SHEETS.nonRoomAreas, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    area: String(r['Area'] || ''),
    status: String(r['Status'] || ''),
    lastCleaned: formatDateTime_(r['Last Cleaned']),
    lastResetDate: String(r['Last Reset Date'] || '')
  }));
}

function getNonRoomHousekeepingHistory_() {
  const sh = getSheet_(SHEETS.nonRoomHousekeepingHistory, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    logId: String(r['Log ID'] || ''),
    area: String(r['Area'] || ''),
    previousStatus: String(r['Previous Status'] || ''),
    newStatus: String(r['New Status'] || ''),
    changedBy: String(r['Changed By'] || ''),
    dateTime: formatDateTime_(r['Date Time']),
    cleaningCount: Number(r['Cleaning Count'] || 0),
    note: String(r['Note'] || '')
  }));
}

function getNonRoomCleaningHistory_() {
  const sh = getSheet_(SHEETS.nonRoomCleaningHistory, false);
  if (!sh) return [];
  return getObjects_(sh).map(r => ({
    sessionId: String(r['Session ID'] || ''),
    area: String(r['Area'] || ''),
    status: String(r['Status'] || ''),
    startedAt: formatDateTime_(r['Started At']),
    startedBy: String(r['Started By'] || ''),
    joinedBy: String(r['Joined By'] || ''),
    joinTimes: String(r['Join Times'] || ''),
    finishedAt: formatDateTime_(r['Finished At']),
    finishedBy: String(r['Finished By'] || ''),
    durationMins: String(r['Duration (Mins)'] || ''),
    cleaningNote: String(r['Cleaning Note'] || ''),
    actionBy: String(r['Action By'] || '')
  }));
}

function getChannels_() {
  const sh = getSheet_(SHEETS.channels, false);
  if (!sh) return ['Walk-in', 'Online', 'OTA', 'Corporate', 'Referral'];
  return getObjects_(sh).map(r => String(r['Channel'] || '')).filter(Boolean);
}

function getActiveRoles_() {
  const sh = getSheet_(SHEETS.roles, false);
  if (!sh) return ['Admin', 'Front Desk', 'Manager', 'Housekeeping'];
  return getObjects_(sh)
    .filter(r => String(r['Status'] || '').toLowerCase() === 'active')
    .map(r => String(r['Role Name'] || ''))
    .filter(Boolean);
}

function backfillMissingReservationPayments() {
  try {

    const bookingSheet = getSheet_(SHEETS.bookingHistory, false);
    const paymentSheet = getSheet_(SHEETS.paymentHistory);

    if (!bookingSheet) {
      return { ok:false, message:'Booking History sheet not found.' };
    }

    const bookings = getObjects_(bookingSheet);
    const payments = getObjects_(paymentSheet);

    let created = 0;
    let skipped = 0;

    bookings.forEach(function(b){

      const resId = String(b['Res ID'] || '').trim();
      const status = String(b['Status'] || '').trim();
      const paymentStatus = String(b['Payment Status'] || '').trim();
      const guestName = String(b['Guest Name'] || '').trim();
      const roomNo = String(b['Room No'] || '').trim();
      const rrrNumber = String(b['RRR Number'] || '').trim();
      const netAmount = Number(b['Net Amount'] || 0);
      const createdAt = b['Created At'] || new Date();
      const actionBy = String(b['Action By'] || 'System Backfill');

      if (!resId) {
        skipped++;
        return;
      }

      const validStatus =
        status === 'Reserved' ||
        status === 'Checked In' ||
        status === 'Checked Out';

      const validPayment =
        paymentStatus === 'Paid' ||
        paymentStatus === 'Part Paid';

      if (!validStatus || !validPayment || netAmount <= 0) {
        skipped++;
        return;
      }

      const alreadyExists = payments.some(function(p){
        return String(p['Res ID'] || '') === resId &&
               String(p['Payment Type'] || '') === 'Reservation Payment';
      });

      if (alreadyExists) {
        skipped++;
        return;
      }

      paymentSheet.appendRow([
        makeId_('PAY', paymentSheet),
        resId,
        guestName,
        roomNo,
        'Reservation Payment',
        netAmount,
        rrrNumber,
        createdAt,
        actionBy,
        'Backfilled payment record (' + paymentStatus + ')',
        '',
        ''
      ]);

      payments.push({
        'Res ID': resId,
        'Payment Type': 'Reservation Payment'
      });

      created++;

    });

    return {
      ok:true,
      message:'Backfill completed successfully.',
      created: created,
      skipped: skipped
    };

  } catch(err) {

    return { ok:false, message:err.message };

  }
}

function ensureOperationalSheets_() {
  ensureSheet_(SHEETS.users, ['User ID', 'Username', 'Password', 'Full Name', 'Role', 'Status'], [
    ['U001', 'admin', '1234', 'System Admin', 'Admin', 'Active']
  ]);

  ensureSheet_(SHEETS.roles, ['Role ID', 'Role Name', 'Description', 'Status'], [
    ['R001', 'Admin', 'Full access', 'Active'],
    ['R002', 'Front Desk', 'Reservations and check-in/out', 'Active'],
    ['R003', 'Manager', 'Reports and oversight', 'Active'],
    ['R004', 'Housekeeping', 'Housekeeping and maintenance', 'Active']
  ]);

  ensureSheet_(SHEETS.setup, ['Setting', 'Value'], [
    ['Hotel Name', 'NDDC Clubhouse'],
    ['Tagline', 'Redefining Luxury Living'],
    ['Logo Data Uri', '']
  ]);

  ensureSheet_(SHEETS.channels, ['Channel'], [
    ['Walk-in'],
    ['Online'],
    ['OTA'],
    ['Corporate'],
    ['Referral']
  ]);

  ensureSheet_(SHEETS.rooms, ['Room No', 'Room Type', 'Rate', 'Status', 'Housekeeping Status', 'Maintenance Status', 'Apartment Group', 'Last Cleaned'], [
    ['201', 'Deluxe', 50000, 'Vacant', 'Clean', 'Resolved', 'Apartment 1', ''],
    ['202', 'Deluxe', 50000, 'Vacant', 'Clean', 'Resolved', 'Apartment 1', ''],
    ['203', 'Deluxe', 50000, 'Vacant', 'Clean', 'Resolved', 'Apartment 1', ''],
    ['204', 'Classic', 40000, 'Vacant', 'Clean', 'Resolved', '', ''],
    ['205', 'Classic', 40000, 'Vacant', 'Clean', 'Resolved', '', ''],
    ['301', 'Executive', 55000, 'Vacant', 'Clean', 'Resolved', 'Apartment 3', ''],
    ['302', 'Executive', 55000, 'Vacant', 'Clean', 'Resolved', 'Apartment 3', ''],
    ['303', 'Executive', 55000, 'Vacant', 'Clean', 'Resolved', 'Apartment 3', ''],
    ['304', 'Executive', 52000, 'Vacant', 'Clean', 'Resolved', 'Apartment 2', ''],
    ['305', 'Executive', 52000, 'Vacant', 'Clean', 'Resolved', 'Apartment 2', ''],
    ['306', 'Executive', 52000, 'Vacant', 'Clean', 'Resolved', 'Apartment 2', '']
  ]);

  ensureSheet_(SHEETS.reservations, [
    'Res ID', 'Guest Name', 'Phone', 'Email', 'Room No', 'Room Type', 'Check In', 'Check Out',
    'Nights', 'Adults', 'Rate', 'Discount %', 'Net Amount', 'Channel', 'Status',
    'Payment Status', 'RRR Number', 'Action By', 'Notes', 'Created At'
  ]);

  ensureSheet_(SHEETS.bookingHistory, [
    'Res ID', 'Guest Name', 'Phone', 'Email', 'Room No', 'Room Type', 'Check In', 'Check Out',
    'Actual Check Out', 'Nights', 'Adults', 'Rate', 'Discount %', 'Discount Applied',
    'Net Amount', 'Channel', 'Status', 'Payment Status', 'RRR Number', 'Late Checkout',
    'Late Checkout Amount', 'Late Checkout Receipt', 'Late Checkout Receipt Name',
    'Action By', 'Notes', 'Created At', 'Updated At'
  ]);

  ensureSheet_(SHEETS.housekeepingHistory, [
    'Log ID', 'Room', 'Previous Status', 'New Status', 'Changed By', 'Date Time', 'Cleaning Count', 'Note'
  ]);

  ensureSheet_(SHEETS.maintenanceHistory, [
    'Log ID', 'Room', 'Maintenance Note', 'Date Added', 'Status', 'Action By', 'Resolved At', 'Resolved By'
  ]);

  ensureSheet_(SHEETS.cleaningHistory, [
    'Session ID', 'Room', 'Status', 'Started At', 'Started By', 'Joined By', 'Join Times',
    'Finished At', 'Finished By', 'Duration (Mins)', 'Cleaning Note', 'Action By'
  ]);

  ensureSheet_(SHEETS.paymentHistory, [
    'Payment ID', 'Res ID', 'Guest Name', 'Room No', 'Payment Type', 'Amount', 'RRR Number',
    'Payment Date', 'Action By', 'Note', 'Receipt', 'Receipt Name'
  ]);

  ensureSheet_(SHEETS.nonRoomAreas, ['Area', 'Status', 'Last Cleaned', 'Last Reset Date'], [
    ['Lobby', 'Dirty', '', ''],
    ['Reception', 'Dirty', '', ''],
    ['Restaurant', 'Dirty', '', ''],
    ['Kitchen', 'Dirty', '', ''],
    ['Gym', 'Dirty', '', ''],
    ['Bar', 'Dirty', '', ''],
    ['Corridor', 'Dirty', '', ''],
    ['Staircase', 'Dirty', '', '']
  ]);

  ensureSheet_(SHEETS.nonRoomHousekeepingHistory, [
    'Log ID', 'Area', 'Previous Status', 'New Status', 'Changed By', 'Date Time', 'Cleaning Count', 'Note'
  ]);

  ensureSheet_(SHEETS.nonRoomCleaningHistory, [
    'Session ID', 'Area', 'Status', 'Started At', 'Started By', 'Joined By', 'Join Times',
    'Finished At', 'Finished By', 'Duration (Mins)', 'Cleaning Note', 'Action By'
  ]);

  ensureSheet_('Audit Log', ['Time', 'Action', 'Username', 'Details']);

  resetNonRoomAreasDaily_();
}

function resetNonRoomAreasDaily_() {
  const sh = getSheet_(SHEETS.nonRoomAreas, false);
  if (!sh) return;

  const headers = getHeaders_(sh);
  const rows = getObjects_(sh);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  rows.forEach((r, i) => {
    const currentStatus = String(r['Status'] || '').toLowerCase();
    const lastReset = formatDate_(r['Last Reset Date']);

    if (currentStatus === 'cleaning in progress') return;
    if (lastReset === today) return;

    const rowNumber = i + 2;
    setCellByHeader_(sh, rowNumber, headers, 'Status', 'Dirty');
    setCellByHeader_(sh, rowNumber, headers, 'Last Reset Date', today);
  });
}

function ensureSheet_(name, headers, seedRows) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const lastColumn = Math.max(sh.getLastColumn(), headers.length);
  const existingHeaders = sh.getLastRow() >= 1 && sh.getLastColumn() > 0
    ? sh.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(h) { return String(h || ''); })
    : [];

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers.forEach(function(header, i) {
      const current = String(existingHeaders[i] || '');
      if (!current) {
        sh.getRange(1, i + 1).setValue(header);
      } else if (current !== header) {
        const foundIndex = existingHeaders.indexOf(header);
        if (foundIndex === -1) {
          sh.getRange(1, i + 1).setValue(header);
        }
      }
    });
  }

  if (seedRows && seedRows.length && sh.getLastRow() === 1) {
    sh.getRange(2, 1, seedRows.length, seedRows[0].length).setValues(seedRows);
  }
}

function getSheet_(name, required) {
  if (required === undefined) required = true;
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh && required) throw new Error('Missing sheet: ' + name);
  return sh || null;
}

function getHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function getObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headers = getHeaders_(sheet);
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function setCellByHeader_(sheet, rowNumber, headers, headerName, value) {
  const idx = headers.indexOf(headerName);
  if (idx === -1) return;
  sheet.getRange(rowNumber, idx + 1).setValue(value);
}

function makeId_(prefix, sheet) {
  const rows = sheet && sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat()
    : [];

  const maxNum = rows.reduce(function(max, val) {
    const text = String(val || '').trim();
    if (!text) return max;

    const match = text.match(new RegExp('^' + prefix + '(\\d+)$'));
    if (!match) return max;

    const num = Number(match[1] || 0);
    return num > max ? num : max;
  }, 0);

  return prefix + Utilities.formatString('%04d', maxNum + 1);
}

function authorizeMail() {
  MailApp.getRemainingDailyQuota();
  return { ok: true, message: 'Mail authorization successful.' };
}

function checkMailAuthorization() {
  try {
    MailApp.getRemainingDailyQuota();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function formatDate_(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateTime_(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function nightsBetween_(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function datesOverlap_(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function isLateCheckout_(checkoutDate, actualCheckout) {
  const co = new Date(checkoutDate);
  const actual = new Date(actualCheckout);
  co.setHours(13, 0, 0, 0);
  return actual.getTime() > co.getTime();
}

function appendNote_(notes, extra) {
  const a = String(notes || '').trim();
  const b = String(extra || '').trim();
  if (!a) return b;
  if (!b) return a;
  return a + ' | ' + b;
}

function isFreePrStatus_(paymentStatus) {
  const value = String(paymentStatus || '').trim().toLowerCase();
  return value === 'free/pr' || value === 'pr(free)' || value === 'free' || value === 'pr';
}

function createRequestCache_() {
  return {
    rooms: null,
    reservationsSheetRows: null,
    reservationsUiRows: null,
    bookingHistoryRows: null,
    paymentHistoryRows: null
  };
}

function getRoomsDataCached_(cache) {
  if (cache && cache.rooms) return cache.rooms;
  const rows = getRoomsData_();
  if (cache) cache.rooms = rows;
  return rows;
}

function getReservationSheetRowsCached_(cache) {
  if (cache && cache.reservationsSheetRows) return cache.reservationsSheetRows;
  const sh = getSheet_(SHEETS.reservations, false);
  const rows = sh ? getObjects_(sh) : [];
  if (cache) cache.reservationsSheetRows = rows;
  return rows;
}

function getBookingHistoryCached_(cache) {
  if (cache && cache.bookingHistoryRows) return cache.bookingHistoryRows;
  const rows = getBookingHistory_();
  if (cache) cache.bookingHistoryRows = rows;
  return rows;
}

function getPaymentHistoryCached_(cache) {
  if (cache && cache.paymentHistoryRows) return cache.paymentHistoryRows;
  const rows = getPaymentHistory_();
  if (cache) cache.paymentHistoryRows = rows;
  return rows;
}

function isApartmentUnit_(unitNo, rooms) {
  const list = [...new Set((rooms || getRoomsData_()).map(r => String(r.apartmentGroup || '')).filter(Boolean))];
  return list.indexOf(String(unitNo)) > -1;
}

function getLinkedRoomNos_(unitNo, rooms) {
  const roomRows = rooms || getRoomsData_();
  const apartmentRooms = roomRows
    .filter(r => String(r.apartmentGroup || '') === String(unitNo))
    .map(r => String(r.roomNo));

  if (apartmentRooms.length) return apartmentRooms;

  const room = roomRows.find(r => String(r.roomNo) === String(unitNo));
  if (room && room.apartmentGroup) {
    return roomRows
      .filter(r => String(r.apartmentGroup || '') === String(room.apartmentGroup))
      .map(r => String(r.roomNo));
  }

  return [String(unitNo)];
}

function getReservationActionRoomNos_(unitNo, rooms) {
  const roomRows = rooms || getRoomsData_();

  const apartmentRooms = roomRows
    .filter(r => String(r.apartmentGroup || '') === String(unitNo))
    .map(r => String(r.roomNo));

  if (apartmentRooms.length) {
    // reservation was made against apartment group name
    return apartmentRooms;
  }

  // reservation was made against a single room
  return [String(unitNo)];
}

function updateReservationActionRoomStatuses_(unitNo, updates, rooms) {
  getReservationActionRoomNos_(unitNo, rooms).forEach(function(roomNo) {
    updateRoomStatus_(roomNo, updates);
  });
}

function updateLinkedRoomStatuses_(unitNo, updates, rooms) {
  getLinkedRoomNos_(unitNo, rooms).forEach(roomNo => updateRoomStatus_(roomNo, updates));
}

function isUnitAvailable_(unitNo, checkIn, checkOut, cache) {
  const rooms = getRoomsDataCached_(cache);
  const linked = getLinkedRoomNos_(unitNo, rooms);

  for (var i = 0; i < linked.length; i++) {
    const room = rooms.find(r => String(r.roomNo) === String(linked[i]));
    if (!room) return false;
    if (String(room.status).toLowerCase() === 'occupied') return false;
  }

  if (hasReservationConflict_(unitNo, checkIn, checkOut, cache)) return false;
  return true;
}

function hasReservationConflict_(unitNo, checkIn, checkOut, cache) {
  const rows = getReservationSheetRowsCached_(cache);
  const rooms = getRoomsDataCached_(cache);
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const linked = getLinkedRoomNos_(unitNo, rooms);

  return rows.some(r => {
    const status = String(r['Status'] || '');
    if (status === 'Checked Out' || status === 'Cancelled') return false;

    const bookedUnit = String(r['Room No'] || '');
    const bookedLinked = getLinkedRoomNos_(bookedUnit, rooms);

    const overlapsInventory =
      bookedUnit === String(unitNo) ||
      linked.indexOf(bookedUnit) > -1 ||
      bookedLinked.some(x => linked.indexOf(x) > -1);

    if (!overlapsInventory) return false;
    return datesOverlap_(start, end, new Date(r['Check In']), new Date(r['Check Out']));
  });
}

function hasReservationConflictExcluding_(unitNo, checkIn, checkOut, excludeResId, cache) {
  const rows = getReservationSheetRowsCached_(cache);
  const rooms = getRoomsDataCached_(cache);
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const linked = getLinkedRoomNos_(unitNo, rooms);

  return rows.some(r => {
    if (String(r['Res ID']) === String(excludeResId)) return false;

    const status = String(r['Status'] || '');
    if (status === 'Checked Out' || status === 'Cancelled') return false;

    const bookedUnit = String(r['Room No'] || '');
    const bookedLinked = getLinkedRoomNos_(bookedUnit, rooms);

    const overlapsInventory =
      bookedUnit === String(unitNo) ||
      linked.indexOf(bookedUnit) > -1 ||
      bookedLinked.some(x => linked.indexOf(x) > -1);

    if (!overlapsInventory) return false;
    return datesOverlap_(start, end, new Date(r['Check In']), new Date(r['Check Out']));
  });
}

function splitCsvNames_(value) {
  return String(value || '')
    .split(',')
    .map(function(x) { return x.trim(); })
    .filter(Boolean);
}

function splitJoinTimes_(value) {
  return String(value || '')
    .split('|')
    .map(function(x) { return x.trim(); })
    .filter(Boolean);
}

function buildJoinTimesString_(entries) {
  return (entries || [])
    .filter(function(x) { return x && x.name; })
    .map(function(x) {
      return x.name + '@' + formatDateTime_(x.joinedAt);
    })
    .join(' | ');
}

function parseJoinTimesEntries_(joinedBy, joinTimes) {
  const names = splitCsvNames_(joinedBy);
  const times = splitJoinTimes_(joinTimes);
  const out = [];

  names.forEach(function(name, i) {
    const raw = times[i] || '';
    const atIndex = raw.indexOf('@');
    const parsedName = atIndex > -1 ? raw.slice(0, atIndex).trim() : name;
    const parsedTime = atIndex > -1 ? raw.slice(atIndex + 1).trim() : raw.trim();

    out.push({
      name: parsedName || name,
      joinedAtRaw: parsedTime,
      joinedAt: parseServerDate_(parsedTime, false)
    });
  });

  return out;
}

function validateReservation_(payload) {
  if (!payload.guestName) throw new Error('Guest name is required.');
  if (!payload.roomNo) throw new Error('Please select a room or apartment.');
  if (!payload.checkIn || !payload.checkOut) throw new Error('Check-in and check-out dates are required.');
  if (Number(payload.adults || 0) > 2) throw new Error('Not allowed by management. Adults cannot be more than 2.');
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function sendReservationConfirmationEmail_(reservation) {
  const email = String(reservation.email || '').trim();
  if (!email) return { ok: true, skipped: true };
  if (!isValidEmail_(email)) return { ok: false, message: 'Invalid guest email address.' };

  const subject = 'Reservation Confirmation - ' + (reservation.resId || 'NDDC Clubhouse');
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <div style="max-width:680px;margin:0 auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
        <div style="background:#111827;color:#fff;padding:20px 24px">
          <h2 style="margin:0;font-size:22px">NDDC Clubhouse</h2>
          <div style="opacity:.9;margin-top:6px">Reservation Confirmation</div>
        </div>
        <div style="padding:24px">
          <p>Dear ${escapeHtmlServer_(reservation.guestName || 'Guest')},</p>
          <p>Your reservation has been confirmed. Here are your booking details:</p>

          <table style="width:100%;border-collapse:collapse;margin:18px 0">
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Reservation ID</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(reservation.resId || '')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Guest Name</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(reservation.guestName || '')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Room</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(reservation.roomNo || '')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Room Type</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(reservation.roomType || '')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Check In</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(reservation.checkIn || '')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Check Out</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(reservation.checkOut || '')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Nights</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(String(reservation.nights || 0))}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Adults</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(String(reservation.adults || 1))}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Amount</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(formatCurrency_(reservation.netAmount || 0))}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Channel</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(reservation.channel || '')}</td></tr>
          </table>

          <p>Thank you for choosing NDDC Clubhouse.</p>
        </div>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody
  });

  return { ok: true };
}

function escapeHtmlServer_(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function audit_(action, username, details) {
  const sh = getSheet_('Audit Log', false);
  if (!sh) return;
  sh.appendRow([new Date(), action, username || '', details || '']);
}

function createReservation(payload) {
  try {
    const user = requireUser_();
    const cache = createRequestCache_();
    validateReservation_(payload);

    if (!isUnitAvailable_(payload.roomNo, payload.checkIn, payload.checkOut, cache)) {
      throw new Error('Selected room or apartment is not available for those dates.');
    }

    const rooms = getRoomsDataCached_(cache);
    const selectedRoom = rooms.find(r => String(r.roomNo) === String(payload.roomNo));
    const apartmentRooms = rooms.filter(r => String(r.apartmentGroup || '') === String(payload.roomNo));
    const isApartmentBooking = apartmentRooms.length > 0;

    const primaryRoom = isApartmentBooking ? apartmentRooms[0] : selectedRoom;
    if (!primaryRoom) throw new Error('Room not found.');

    const paymentStatus = payload.paymentStatus || 'Unpaid';
    const baseRate = isApartmentBooking ? APARTMENT_FIXED_RATE : Number(primaryRoom.rate || 0);
    const rate = isFreePrStatus_(paymentStatus) ? 0 : baseRate;
    const nights = nightsBetween_(payload.checkIn, payload.checkOut);
    const netAmount = isFreePrStatus_(paymentStatus)
      ? 0
      : Math.round((rate * nights) * (1 - Number(payload.discountPct || 0) / 100));

    const sh = getSheet_(SHEETS.reservations);
    const resId = makeId_('RES', sh);

    sh.appendRow([
      resId,
      payload.guestName,
      payload.phone || '',
      payload.email || '',
      payload.roomNo,
      isApartmentBooking ? ('Apartment - ' + payload.roomNo) : (primaryRoom.roomType || ''),
      new Date(payload.checkIn),
      new Date(payload.checkOut),
      nights,
      Number(payload.adults || 1),
      rate,
      Number(payload.discountPct || 0),
      netAmount,
      payload.channel || 'Walk-in',
      'Reserved',
      paymentStatus,
      payload.rrrNumber || '',
      user.fullName || user.username,
      payload.notes || '',
      new Date()
    ]);

    const hist = getSheet_(SHEETS.bookingHistory);
    hist.appendRow([
      resId,
      payload.guestName,
      payload.phone || '',
      payload.email || '',
      payload.roomNo,
      isApartmentBooking ? ('Apartment - ' + payload.roomNo) : (primaryRoom.roomType || ''),
      new Date(payload.checkIn),
      new Date(payload.checkOut),
      '',
      nights,
      Number(payload.adults || 1),
      rate,
      Number(payload.discountPct || 0),
      Number(payload.discountPct || 0) > 0 ? 'Yes' : 'No',
      netAmount,
      payload.channel || 'Walk-in',
      'Reserved',
      paymentStatus,
      payload.rrrNumber || '',
      'No',
      0,
      '',
      '',
      user.fullName || user.username,
      payload.notes || '',
      new Date(),
      new Date()
    ]);

    if (String(payload.email || '').trim()) {
      sendReservationConfirmationEmail_({
        resId: resId,
        guestName: payload.guestName,
        email: payload.email,
        roomNo: payload.roomNo,
        roomType: isApartmentBooking ? ('Apartment - ' + payload.roomNo) : (primaryRoom.roomType || ''),
        checkIn: formatDate_(payload.checkIn),
        checkOut: formatDate_(payload.checkOut),
        nights: nights,
        adults: Number(payload.adults || 1),
        netAmount: netAmount,
        channel: payload.channel || 'Walk-in'
      });
    }

    audit_('Create Reservation', user.username, resId + ' created');
    return { ok: true, message: 'Reservation created successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function updateReservation(resId, payload) {
  try {
    const user = requireUser_();
    const cache = createRequestCache_();
    validateReservation_(payload);

    const sh = getSheet_(SHEETS.reservations);
    const headers = getHeaders_(sh);
    const rows = getObjects_(sh);
    const idx = rows.findIndex(r => String(r['Res ID']) === String(resId));
    if (idx === -1) throw new Error('Reservation not found.');

    const current = rows[idx];
    if (String(current['Status']) !== 'Reserved') throw new Error('Only reserved bookings can be edited.');

    if (hasReservationConflictExcluding_(payload.roomNo, payload.checkIn, payload.checkOut, resId, cache)) {
      throw new Error('Selected room or apartment is not available for those dates.');
    }

    const rooms = getRoomsDataCached_(cache);
    const selectedRoom = rooms.find(r => String(r.roomNo) === String(payload.roomNo));
    const apartmentRooms = rooms.filter(r => String(r.apartmentGroup || '') === String(payload.roomNo));
    const isApartmentBooking = apartmentRooms.length > 0;

    const primaryRoom = isApartmentBooking ? apartmentRooms[0] : selectedRoom;
    if (!primaryRoom) throw new Error('Room not found.');

    const paymentStatus = payload.paymentStatus || 'Unpaid';
    const baseRate = isApartmentBooking ? APARTMENT_FIXED_RATE : Number(primaryRoom.rate || 0);
    const rate = isFreePrStatus_(paymentStatus) ? 0 : baseRate;
    const nights = nightsBetween_(payload.checkIn, payload.checkOut);
    const netAmount = isFreePrStatus_(paymentStatus)
      ? 0
      : Math.round((rate * nights) * (1 - Number(payload.discountPct || 0) / 100));
    const rowNumber = idx + 2;

    setCellByHeader_(sh, rowNumber, headers, 'Guest Name', payload.guestName);
    setCellByHeader_(sh, rowNumber, headers, 'Phone', payload.phone || '');
    setCellByHeader_(sh, rowNumber, headers, 'Email', payload.email || '');
    setCellByHeader_(sh, rowNumber, headers, 'Room No', payload.roomNo);
    setCellByHeader_(sh, rowNumber, headers, 'Room Type', isApartmentBooking ? ('Apartment - ' + payload.roomNo) : (primaryRoom.roomType || ''));
    setCellByHeader_(sh, rowNumber, headers, 'Check In', new Date(payload.checkIn));
    setCellByHeader_(sh, rowNumber, headers, 'Check Out', new Date(payload.checkOut));
    setCellByHeader_(sh, rowNumber, headers, 'Nights', nights);
    setCellByHeader_(sh, rowNumber, headers, 'Adults', Number(payload.adults || 1));
    setCellByHeader_(sh, rowNumber, headers, 'Rate', rate);
    setCellByHeader_(sh, rowNumber, headers, 'Discount %', Number(payload.discountPct || 0));
    setCellByHeader_(sh, rowNumber, headers, 'Net Amount', netAmount);
    setCellByHeader_(sh, rowNumber, headers, 'Channel', payload.channel || 'Walk-in');
    setCellByHeader_(sh, rowNumber, headers, 'Payment Status', paymentStatus);
    setCellByHeader_(sh, rowNumber, headers, 'RRR Number', payload.rrrNumber || '');
    setCellByHeader_(sh, rowNumber, headers, 'Notes', payload.notes || '');

    const hist = getSheet_(SHEETS.bookingHistory, false);
    if (hist) {
      const hHeaders = getHeaders_(hist);
      const hRows = getObjects_(hist);
      const hIdx = hRows.findIndex(r => String(r['Res ID']) === String(resId));
      if (hIdx > -1) {
        const hRowNumber = hIdx + 2;
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Guest Name', payload.guestName);
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Phone', payload.phone || '');
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Email', payload.email || '');
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Room No', payload.roomNo);
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Room Type', isApartmentBooking ? ('Apartment - ' + payload.roomNo) : (primaryRoom.roomType || ''));
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Check In', new Date(payload.checkIn));
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Check Out', new Date(payload.checkOut));
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Nights', nights);
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Adults', Number(payload.adults || 1));
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Rate', rate);
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Discount %', Number(payload.discountPct || 0));
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Discount Applied', Number(payload.discountPct || 0) > 0 ? 'Yes' : 'No');
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Net Amount', netAmount);
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Channel', payload.channel || 'Walk-in');
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Payment Status', paymentStatus);
        setCellByHeader_(hist, hRowNumber, hHeaders, 'RRR Number', payload.rrrNumber || '');
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Notes', payload.notes || '');
        setCellByHeader_(hist, hRowNumber, hHeaders, 'Updated At', new Date());
      }
    }

    audit_('Update Reservation', user.username, resId + ' updated');
    return { ok: true, message: 'Reservation updated successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function addHousekeepingLog_(roomNo, previousStatus, newStatus, by, note) {
  const sh = getSheet_(SHEETS.housekeepingHistory);
  const rows = getObjects_(sh).filter(r =>
    String(r['Room']) === String(roomNo) &&
    String(r['New Status']).toLowerCase() === 'clean'
  );
  const cleanCount = String(newStatus).toLowerCase() === 'clean' ? rows.length + 1 : rows.length;
  sh.appendRow([
    makeId_('HK', sh),
    roomNo,
    previousStatus || '',
    newStatus || '',
    by || '',
    new Date(),
    cleanCount,
    note || ''
  ]);
}

function addAiredLog(roomNo, note) {
  try {
    const user = requireUser_();
    const rooms = getRoomsData_();
    const room = rooms.find(r => String(r.roomNo) === String(roomNo));
    if (!room) throw new Error('Room not found.');
    if (String(room.housekeepingStatus).toLowerCase() !== 'clean') {
      throw new Error('Only clean rooms can be marked as aired.');
    }

    const sh = getSheet_(SHEETS.housekeepingHistory);
    const rows = getObjects_(sh).filter(r =>
      String(r['Room']) === String(roomNo) &&
      String(r['New Status']).toLowerCase() === 'clean'
    );
    const cleanCount = rows.length;

    sh.appendRow([
      makeId_('HK', sh),
      roomNo,
      'Clean',
      'Aired',
      user.fullName || user.username,
      new Date(),
      cleanCount,
      note || 'Room aired'
    ]);

    audit_('Mark Room Aired', user.username, roomNo + ' aired');
    return { ok: true, message: 'Room marked as aired.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function updateBookingHistoryStatus_(resId, updates) {
  const sh = getSheet_(SHEETS.bookingHistory, false);
  if (!sh) return;

  const headers = getHeaders_(sh);
  const rows = getObjects_(sh);
  const idx = rows.findIndex(r => String(r['Res ID']) === String(resId));
  if (idx === -1) return;

  const rowNumber = idx + 2;

  if (updates.status !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Status', updates.status);
  if (updates.actualCheckout !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Actual Check Out', updates.actualCheckout);
  if (updates.lateCheckout !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Late Checkout', updates.lateCheckout);
  if (updates.lateCheckoutAmount !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Late Checkout Amount', updates.lateCheckoutAmount);
  if (updates.lateCheckoutReceipt !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Late Checkout Receipt', updates.lateCheckoutReceipt);
  if (updates.lateCheckoutReceiptName !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Late Checkout Receipt Name', updates.lateCheckoutReceiptName);
  if (updates.paymentStatus !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Payment Status', updates.paymentStatus);
  if (updates.rrrNumber !== undefined) setCellByHeader_(sh, rowNumber, headers, 'RRR Number', updates.rrrNumber);
  if (updates.extraNote !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Notes', updates.extraNote);

  setCellByHeader_(sh, rowNumber, headers, 'Updated At', new Date());
}

function updateRoomStatus_(roomNo, updates) {
  const sh = getSheet_(SHEETS.rooms);
  const headers = getHeaders_(sh);
  const rows = getObjects_(sh);
  const idx = rows.findIndex(r => String(r['Room No']) === String(roomNo));
  if (idx === -1) return;

  const rowNumber = idx + 2;
  if (updates.status !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Status', updates.status);
  if (updates.housekeepingStatus !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Housekeeping Status', updates.housekeepingStatus);
  if (updates.maintenanceStatus !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Maintenance Status', updates.maintenanceStatus);
  if (updates.lastCleaned !== undefined) setCellByHeader_(sh, rowNumber, headers, 'Last Cleaned', updates.lastCleaned);
}

function processReservationAction(resId, action) {
  try {
    const user = requireUser_();
    const cache = createRequestCache_();
    const sh = getSheet_(SHEETS.reservations);
    const headers = getHeaders_(sh);
    const rows = getObjects_(sh);
    const idx = rows.findIndex(r => String(r['Res ID']) === String(resId));
    if (idx === -1) throw new Error('Reservation not found.');

    const row = rows[idx];
    const rowNumber = idx + 2;
    const rooms = getRoomsDataCached_(cache);

    if (action === 'Check In') {
      setCellByHeader_(sh, rowNumber, headers, 'Status', 'Checked In');
      SpreadsheetApp.flush();

      updateReservationActionRoomStatuses_(row['Room No'], { status: 'Occupied' }, rooms);

      updateBookingHistoryStatus_(resId, { status: 'Checked In' });

    } else if (action === 'Check Out') {
      const actualCheckout = new Date();

      setCellByHeader_(sh, rowNumber, headers, 'Status', 'Checked Out');
      SpreadsheetApp.flush();

      updateReservationActionRoomStatuses_(row['Room No'], {
        status: 'Vacant',
        housekeepingStatus: 'Dirty'
      }, rooms);

      const late = isLateCheckout_(row['Check Out'], actualCheckout);
      updateBookingHistoryStatus_(resId, {
        status: 'Checked Out',
        actualCheckout: actualCheckout,
        lateCheckout: late ? 'Yes' : 'No'
      });

    } else if (action === 'Cancel') {
      setCellByHeader_(sh, rowNumber, headers, 'Status', 'Cancelled');
      SpreadsheetApp.flush();

      updateBookingHistoryStatus_(resId, { status: 'Cancelled' });

    } else {
      throw new Error('Unsupported reservation action.');
    }

    audit_(action, user.username, resId + ' ' + action);
    return { ok: true, message: action + ' completed.', data: getAppBootstrap() };

  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function extendStay(payload) {
  try {
    const user = requireUser_();
    const cache = createRequestCache_();
    const resSheet = getSheet_(SHEETS.reservations);
    const headers = getHeaders_(resSheet);
    const rows = getObjects_(resSheet);
    const idx = rows.findIndex(r => String(r['Res ID']) === String(payload.resId));
    if (idx === -1) throw new Error('Reservation not found');

    const row = rows[idx];
    if (String(row['Status']) !== 'Checked In') throw new Error('Only checked-in guests can extend stay.');

    const oldCheckout = new Date(row['Check Out']);
    const newCheckout = new Date(payload.newCheckOut);
    if (isNaN(newCheckout.getTime())) throw new Error('Please select a valid new checkout date.');
    if (newCheckout <= oldCheckout) throw new Error('New checkout date must be after current checkout date.');

    if (hasReservationConflictExcluding_(row['Room No'], formatDate_(oldCheckout), formatDate_(newCheckout), payload.resId, cache)) {
      throw new Error('Cannot extend stay because the room/apartment is already reserved for the extended dates.');
    }

    const rowNumber = idx + 2;
    const oldCheckIn = new Date(row['Check In']);
    const newNights = nightsBetween_(oldCheckIn, newCheckout);
    const paymentStatus = String(row['Payment Status'] || '');
    const baseRate = Number(row['Rate'] || 0);
    const rate = isFreePrStatus_(paymentStatus) ? 0 : baseRate;
    const discountPct = Number(row['Discount %'] || 0);
    const newNet = isFreePrStatus_(paymentStatus) ? 0 : Math.round((rate * newNights) * (1 - discountPct / 100));
    const additionalAmount = Math.max(0, newNet - Number(row['Net Amount'] || 0));
    const newRrr = payload.rrrNumber || row['RRR Number'] || '';

    setCellByHeader_(resSheet, rowNumber, headers, 'Check Out', newCheckout);
    setCellByHeader_(resSheet, rowNumber, headers, 'Nights', newNights);
    setCellByHeader_(resSheet, rowNumber, headers, 'Net Amount', newNet);
    setCellByHeader_(resSheet, rowNumber, headers, 'RRR Number', newRrr);

    const historySheet = getSheet_(SHEETS.bookingHistory, false);
    if (historySheet) {
      const hHeaders = getHeaders_(historySheet);
      const hRows = getObjects_(historySheet);
      const hIdx = hRows.findIndex(r => String(r['Res ID']) === String(payload.resId));
      if (hIdx > -1) {
        const hRowNumber = hIdx + 2;
        setCellByHeader_(historySheet, hRowNumber, hHeaders, 'Check Out', newCheckout);
        setCellByHeader_(historySheet, hRowNumber, hHeaders, 'Nights', newNights);
        setCellByHeader_(historySheet, hRowNumber, hHeaders, 'Net Amount', newNet);
        setCellByHeader_(historySheet, hRowNumber, hHeaders, 'RRR Number', newRrr);
        setCellByHeader_(historySheet, hRowNumber, hHeaders, 'Notes', appendNote_(row['Notes'], 'Stay extended to ' + formatDate_(newCheckout)));
        setCellByHeader_(historySheet, hRowNumber, hHeaders, 'Updated At', new Date());
      }
    }

    if (additionalAmount > 0) {
      const paySheet = getSheet_(SHEETS.paymentHistory);
      paySheet.appendRow([
        makeId_('PAY', paySheet),
        payload.resId,
        row['Guest Name'] || '',
        row['Room No'] || '',
        'Extension Payment',
        additionalAmount,
        newRrr,
        new Date(),
        user.fullName || user.username,
        'Extended stay to ' + formatDate_(newCheckout),
        '',
        ''
      ]);
    }

    audit_('Extend Stay', user.username, payload.resId + ' extended to ' + formatDate_(newCheckout));
    return { ok: true, message: 'Stay extended successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function applyLateCheckout(payload) {
  try {
    const user = requireUser_();
    const cache = createRequestCache_();
    const resSheet = getSheet_(SHEETS.reservations);
    const headers = getHeaders_(resSheet);
    const rows = getObjects_(resSheet);
    const idx = rows.findIndex(r => String(r['Res ID']) === String(payload.resId));
    if (idx === -1) throw new Error('Reservation not found');

    const row = rows[idx];
    if (String(row['Status']) !== 'Checked In') throw new Error('Late checkout can only be added for checked-in guests.');

    const paymentHistory = getPaymentHistoryCached_(cache);
    const existingLatePayment = paymentHistory.some(function(pay) {
      return String(pay.resId) === String(payload.resId) && String(pay.paymentType) === 'Late Checkout Payment';
    });
    if (existingLatePayment) throw new Error('Late checkout payment has already been recorded for this reservation.');

    const amount = payload.amount !== undefined && payload.amount !== null && payload.amount !== ''
      ? Number(payload.amount)
      : Math.round(Number(row['Net Amount'] || 0) * 0.5);

    if (amount <= 0) throw new Error('Invalid late checkout amount.');

    const rowNumber = idx + 2;
    const noteText = appendNote_(row['Notes'], 'Late checkout payment recorded');

    setCellByHeader_(resSheet, rowNumber, headers, 'Notes', noteText);
    setCellByHeader_(resSheet, rowNumber, headers, 'RRR Number', payload.rrrNumber || row['RRR Number'] || '');

    updateBookingHistoryStatus_(payload.resId, {
      lateCheckout: 'Yes',
      lateCheckoutAmount: amount,
      lateCheckoutReceipt: '',
      lateCheckoutReceiptName: '',
      rrrNumber: payload.rrrNumber || row['RRR Number'] || '',
      extraNote: appendNote_(row['Notes'], 'Late checkout payment recorded' + (payload.note ? ' - ' + payload.note : ''))
    });

    const paySheet = getSheet_(SHEETS.paymentHistory);
    paySheet.appendRow([
      makeId_('PAY', paySheet),
      payload.resId,
      row['Guest Name'] || '',
      row['Room No'] || '',
      'Late Checkout Payment',
      amount,
      payload.rrrNumber || row['RRR Number'] || '',
      new Date(),
      user.fullName || user.username,
      payload.note || 'Late checkout payment',
      '',
      ''
    ]);

    audit_('Late Checkout Payment', user.username, payload.resId + ' late checkout payment recorded');
    return { ok: true, message: 'Late checkout payment saved successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function updatePayment(payload) {
  try {
    const user = requireUser_();
    const sh = getSheet_(SHEETS.reservations);
    const headers = getHeaders_(sh);
    const rows = getObjects_(sh);
    const idx = rows.findIndex(r => String(r['Res ID']) === String(payload.resId));
    if (idx === -1) throw new Error('Reservation not found.');

    const rowNumber = idx + 2;
    const paymentStatus = String(payload.paymentStatus || 'Unpaid');
    const current = rows[idx];
    const guestName = String(current['Guest Name'] || '');
    const roomNo = String(current['Room No'] || '');
    const rrrNumber = String(payload.rrrNumber || '').trim();
    const netAmount = Number(current['Net Amount'] || 0);

    setCellByHeader_(sh, rowNumber, headers, 'Payment Status', paymentStatus);
    setCellByHeader_(sh, rowNumber, headers, 'RRR Number', rrrNumber);

    if (isFreePrStatus_(paymentStatus)) {
      setCellByHeader_(sh, rowNumber, headers, 'Rate', 0);
      setCellByHeader_(sh, rowNumber, headers, 'Net Amount', 0);
    }

    updateBookingHistoryStatus_(payload.resId, {
      paymentStatus: paymentStatus,
      rrrNumber: rrrNumber,
      extraNote: isFreePrStatus_(paymentStatus)
        ? appendNote_(current['Notes'], 'Marked as Free/PR')
        : undefined
    });

    if (isFreePrStatus_(paymentStatus)) {
      const hist = getSheet_(SHEETS.bookingHistory, false);
      if (hist) {
        const hHeaders = getHeaders_(hist);
        const hRows = getObjects_(hist);
        const hIdx = hRows.findIndex(r => String(r['Res ID']) === String(payload.resId));
        if (hIdx > -1) {
          const hRowNumber = hIdx + 2;
          setCellByHeader_(hist, hRowNumber, hHeaders, 'Rate', 0);
          setCellByHeader_(hist, hRowNumber, hHeaders, 'Net Amount', 0);
          setCellByHeader_(hist, hRowNumber, hHeaders, 'Updated At', new Date());
        }
      }
    }

    if (paymentStatus === 'Paid' || paymentStatus === 'Part Paid') {
      const paySheet = getSheet_(SHEETS.paymentHistory);
      const payRows = getObjects_(paySheet);

      const existingIdx = payRows.findIndex(function(p) {
        return String(p['Res ID'] || '') === String(payload.resId) &&
               String(p['Payment Type'] || '') === 'Reservation Payment';
      });

      if (existingIdx > -1) {
        const payHeaders = getHeaders_(paySheet);
        const payRowNumber = existingIdx + 2;
        setCellByHeader_(paySheet, payRowNumber, payHeaders, 'Guest Name', guestName);
        setCellByHeader_(paySheet, payRowNumber, payHeaders, 'Room No', roomNo);
        setCellByHeader_(paySheet, payRowNumber, payHeaders, 'Amount', netAmount);
        setCellByHeader_(paySheet, payRowNumber, payHeaders, 'RRR Number', rrrNumber);
        setCellByHeader_(paySheet, payRowNumber, payHeaders, 'Payment Date', new Date());
        setCellByHeader_(paySheet, payRowNumber, payHeaders, 'Action By', user.fullName || user.username);
        setCellByHeader_(paySheet, payRowNumber, payHeaders, 'Note', paymentStatus);
      } else {
        paySheet.appendRow([
          makeId_('PAY', paySheet),
          payload.resId,
          guestName,
          roomNo,
          'Reservation Payment',
          netAmount,
          rrrNumber,
          new Date(),
          user.fullName || user.username,
          paymentStatus,
          '',
          ''
        ]);
      }
    }

    audit_('Update Payment', user.username, payload.resId + ' payment updated');
    return { ok: true, message: 'Payment updated successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function getOpenRoomCleaningSession_(roomNo) {
  const sh = getSheet_(SHEETS.cleaningHistory, false);
  if (!sh) return null;
  const headers = getHeaders_(sh);
  const rows = getObjects_(sh);
  const idx = rows.findIndex(r => String(r['Room']) === String(roomNo) && String(r['Status']) === 'In Progress');
  if (idx === -1) return null;
  return { sheet: sh, headers: headers, rowIndex: idx + 2, row: rows[idx] };
}

function joinRoomCleaning(roomNo) {
  try {
    const user = requireUser_();
    const who = user.fullName || user.username;
    const session = getOpenRoomCleaningSession_(roomNo);
    if (!session) throw new Error('No active cleaning session for this room.');

    const starter = String(session.row['Started By'] || '').trim();
    const joinedBy = splitCsvNames_(session.row['Joined By']);
    if (starter === who || joinedBy.indexOf(who) > -1) {
      throw new Error('You have already joined this cleaning session.');
    }

    joinedBy.push(who);
    const joinEntries = parseJoinTimesEntries_(session.row['Joined By'], session.row['Join Times']);
    joinEntries.push({ name: who, joinedAt: new Date() });

    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Joined By', joinedBy.join(', '));
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Join Times', buildJoinTimesString_(joinEntries));
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Action By', who);

    audit_('Join Room Cleaning', user.username, roomNo + ' joined');
    return { ok: true, message: 'Joined cleaning successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function finishRoomCleaning(roomNo, note) {
  try {
    const user = requireUser_();
    const session = getOpenRoomCleaningSession_(roomNo);
    if (!session) throw new Error('No active cleaning session for this room.');

    const now = new Date();
    const startedAt = new Date(session.row['Started At']);
    const duration = Math.max(0, Math.round((now - startedAt) / 60000));
    const who = user.fullName || user.username;

    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Status', 'Finished');
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Finished At', now);
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Finished By', who);
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Duration (Mins)', duration);
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Cleaning Note', note || '');
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Action By', who);

    updateRoomStatus_(roomNo, { housekeepingStatus: 'Clean', lastCleaned: now });
    addHousekeepingLog_(roomNo, 'Cleaning In Progress', 'Clean', who, note || '');

    audit_('Finish Room Cleaning', user.username, roomNo + ' cleaning finished');
    return { ok: true, message: 'Room cleaning completed.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function updateRoomHousekeeping(roomNo, newStatus) {
  try {
    const user = requireUser_();
    const rooms = getRoomsData_();
    const room = rooms.find(r => String(r.roomNo) === String(roomNo));
    if (!room) throw new Error('Room not found.');

    const previous = room.housekeepingStatus || '';
    updateRoomStatus_(roomNo, { housekeepingStatus: newStatus });
    addHousekeepingLog_(roomNo, previous, newStatus, user.fullName || user.username, '');

    if (String(newStatus).toLowerCase() === 'cleaning in progress') {
      const sh = getSheet_(SHEETS.cleaningHistory);
      sh.appendRow([
        makeId_('CLN', sh),
        roomNo,
        'In Progress',
        new Date(),
        user.fullName || user.username,
        '',
        '',
        '',
        '',
        '',
        '',
        user.fullName || user.username
      ]);
    }

    audit_('Room Housekeeping', user.username, roomNo + ' -> ' + newStatus);
    return { ok: true, message: 'Room housekeeping updated.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function getOpenNonRoomCleaningSession_(area) {
  const sh = getSheet_(SHEETS.nonRoomCleaningHistory, false);
  if (!sh) return null;
  const headers = getHeaders_(sh);
  const rows = getObjects_(sh);
  const idx = rows.findIndex(r => String(r['Area']) === String(area) && String(r['Status']) === 'In Progress');
  if (idx === -1) return null;
  return { sheet: sh, headers: headers, rowIndex: idx + 2, row: rows[idx] };
}

function startNonRoomCleaning(area) {
  try {
    const user = requireUser_();

    const areaSheet = getSheet_(SHEETS.nonRoomAreas);
    const areaHeaders = getHeaders_(areaSheet);
    const areaRows = getObjects_(areaSheet);
    const areaIdx = areaRows.findIndex(r => String(r['Area']) === String(area));
    if (areaIdx === -1) throw new Error('Area not found.');

    const areaRowNumber = areaIdx + 2;
    const currentAreaStatus = String(areaRows[areaIdx]['Status'] || '');
    const previous = currentAreaStatus;

    const cleaningSheet = getSheet_(SHEETS.nonRoomCleaningHistory);
    const cleaningHeaders = getHeaders_(cleaningSheet);
    const cleaningRows = getObjects_(cleaningSheet);

    const openIdx = cleaningRows.findIndex(r =>
      String(r['Area']) === String(area) &&
      String(r['Status']) === 'In Progress'
    );

    if (openIdx > -1 && String(currentAreaStatus).toLowerCase() !== 'cleaning in progress') {
      const staleRowNumber = openIdx + 2;
      setCellByHeader_(cleaningSheet, staleRowNumber, cleaningHeaders, 'Status', 'Finished');
      setCellByHeader_(cleaningSheet, staleRowNumber, cleaningHeaders, 'Finished At', new Date());
      setCellByHeader_(cleaningSheet, staleRowNumber, cleaningHeaders, 'Finished By', 'System Reset');
      setCellByHeader_(cleaningSheet, staleRowNumber, cleaningHeaders, 'Duration (Mins)', 0);
      setCellByHeader_(cleaningSheet, staleRowNumber, cleaningHeaders, 'Cleaning Note', 'Auto-closed stale session');
      setCellByHeader_(cleaningSheet, staleRowNumber, cleaningHeaders, 'Action By', 'System Reset');
    }

    const latestRows = getObjects_(cleaningSheet);
    const stillOpen = latestRows.some(r =>
      String(r['Area']) === String(area) &&
      String(r['Status']) === 'In Progress'
    );
    if (stillOpen) throw new Error('Cleaning is already in progress for this area.');

    cleaningSheet.appendRow([
      makeId_('NCL', cleaningSheet),
      area,
      'In Progress',
      new Date(),
      user.fullName || user.username,
      '',
      '',
      '',
      '',
      '',
      '',
      user.fullName || user.username
    ]);

    setCellByHeader_(areaSheet, areaRowNumber, areaHeaders, 'Status', 'Cleaning In Progress');

    const hist = getSheet_(SHEETS.nonRoomHousekeepingHistory);
    const cleanRows = getObjects_(hist).filter(r =>
      String(r['Area']) === String(area) &&
      String(r['New Status']).toLowerCase() === 'clean'
    );
    const cleanCount = cleanRows.length;

    hist.appendRow([
      makeId_('NHK', hist),
      area,
      previous,
      'Cleaning In Progress',
      user.fullName || user.username,
      new Date(),
      cleanCount,
      'Cleaning started'
    ]);

    audit_('Start Non-Room Cleaning', user.username, area + ' cleaning started');
    return { ok: true, message: 'Cleaning started.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function joinNonRoomCleaning(area) {
  try {
    const user = requireUser_();
    const who = user.fullName || user.username;
    const session = getOpenNonRoomCleaningSession_(area);
    if (!session) throw new Error('No active cleaning session for this area.');

    const starter = String(session.row['Started By'] || '').trim();
    const joinedBy = splitCsvNames_(session.row['Joined By']);
    if (starter === who || joinedBy.indexOf(who) > -1) {
      throw new Error('You have already joined this cleaning session.');
    }

    joinedBy.push(who);
    const joinEntries = parseJoinTimesEntries_(session.row['Joined By'], session.row['Join Times']);
    joinEntries.push({ name: who, joinedAt: new Date() });

    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Joined By', joinedBy.join(', '));
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Join Times', buildJoinTimesString_(joinEntries));
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Action By', who);

    audit_('Join Non-Room Cleaning', user.username, area + ' joined');
    return { ok: true, message: 'Joined cleaning successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function finishNonRoomCleaning(area, note) {
  try {
    const user = requireUser_();
    const session = getOpenNonRoomCleaningSession_(area);
    if (!session) throw new Error('No active cleaning session for this area.');

    const now = new Date();
    const startedAt = new Date(session.row['Started At']);
    const duration = Math.max(0, Math.round((now - startedAt) / 60000));
    const who = user.fullName || user.username;

    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Status', 'Finished');
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Finished At', now);
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Finished By', who);
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Duration (Mins)', duration);
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Cleaning Note', note || '');
    setCellByHeader_(session.sheet, session.rowIndex, session.headers, 'Action By', who);

    updateNonRoomHousekeeping(area, 'Clean', note || '');

    audit_('Finish Non-Room Cleaning', user.username, area + ' cleaning finished');
    return { ok: true, message: 'Cleaning finished.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function updateNonRoomHousekeeping(area, status, note) {
  try {
    const user = requireUser_();
    const sh = getSheet_(SHEETS.nonRoomAreas);
    const headers = getHeaders_(sh);
    const rows = getObjects_(sh);
    const idx = rows.findIndex(r => String(r['Area']) === String(area));
    if (idx === -1) throw new Error('Area not found');

    const rowNumber = idx + 2;
    const previous = String(rows[idx]['Status'] || '');

    setCellByHeader_(sh, rowNumber, headers, 'Status', status);

    if (String(status).toLowerCase() === 'clean') {
      setCellByHeader_(sh, rowNumber, headers, 'Last Cleaned', new Date());
      setCellByHeader_(sh, rowNumber, headers, 'Last Reset Date', formatDate_(new Date()));
    }

    const hist = getSheet_(SHEETS.nonRoomHousekeepingHistory);
    const cleanRows = getObjects_(hist).filter(r =>
      String(r['Area']) === String(area) &&
      String(r['New Status']).toLowerCase() === 'clean'
    );
    const cleanCount = String(status).toLowerCase() === 'clean'
      ? cleanRows.length + 1
      : cleanRows.length;

    hist.appendRow([
      makeId_('NHK', hist),
      area,
      previous,
      status,
      user.fullName || user.username,
      new Date(),
      cleanCount,
      note || ''
    ]);

    audit_('Non-Room Housekeeping', user.username, area + ' -> ' + status);
    return { ok: true, message: 'Area updated successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function getCheckoutReceiptData(resId) {
  try {
    requireUser_();
    return { ok: true, data: buildCheckoutReceiptData_(resId) };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function emailCheckoutReceipt(payload) {
  try {
    const user = requireUser_();
    const data = buildCheckoutReceiptData_(payload.resId);
    const email = String(payload.email || data.email || '').trim();
    if (!email) throw new Error('Guest email is required.');
    if (!isValidEmail_(email)) throw new Error('Invalid guest email address.');

    const subject = 'Checkout Receipt - ' + data.resId;
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: buildCheckoutReceiptHtml_(data)
    });

    audit_('Email Checkout Receipt', user.username, data.resId + ' emailed to ' + email);
    return { ok: true, message: 'Receipt sent successfully.' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function buildCheckoutReceiptData_(resId) {
  const sh = getSheet_(SHEETS.bookingHistory, false);
  const rows = sh ? getObjects_(sh) : [];
  const row = rows.find(r => String(r['Res ID']) === String(resId));
  if (!row) throw new Error('Booking history record not found.');

  const payments = getPaymentHistory_().filter(p => String(p.resId) === String(resId));
  const totalPaid = payments.reduce(function(sum, p) { return sum + Number(p.amount || 0); }, 0);

  return {
    resId: String(row['Res ID'] || ''),
    guestName: String(row['Guest Name'] || ''),
    phone: String(row['Phone'] || ''),
    email: String(row['Email'] || ''),
    roomNo: String(row['Room No'] || ''),
    roomType: String(row['Room Type'] || ''),
    checkIn: formatDate_(row['Check In']),
    checkOut: formatDate_(row['Check Out']),
    actualCheckout: formatDateTime_(row['Actual Check Out']),
    nights: Number(row['Nights'] || 0),
    adults: Number(row['Adults'] || 0),
    rate: Number(row['Rate'] || 0),
    discountPct: Number(row['Discount %'] || 0),
    netAmount: Number(row['Net Amount'] || 0),
    lateCheckoutAmount: Number(row['Late Checkout Amount'] || 0),
    totalPaid: totalPaid,
    paymentStatus: String(row['Payment Status'] || ''),
    rrrNumber: String(row['RRR Number'] || ''),
    payments: payments
  };
}

function buildCheckoutReceiptHtml_(data) {
  const paymentRows = (data.payments || []).map(function(p) {
    return '<tr>' +
      '<td style="padding:8px;border:1px solid #e5e7eb">' + escapeHtmlServer_(p.paymentType || '') + '</td>' +
      '<td style="padding:8px;border:1px solid #e5e7eb">' + escapeHtmlServer_(formatCurrency_(p.amount || 0)) + '</td>' +
      '<td style="padding:8px;border:1px solid #e5e7eb">' + escapeHtmlServer_(p.paymentDate || '') + '</td>' +
    '</tr>';
  }).join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.45">
      <div style="max-width:900px;margin:0 auto;border:1px solid #d1d5db;border-radius:12px;overflow:hidden">
        <div style="background:#111827;color:#fff;padding:18px 24px">
          <h2 style="margin:0">NDDC Clubhouse</h2>
          <div style="margin-top:6px;opacity:.92">Checkout Receipt</div>
        </div>
        <div style="padding:22px 24px">
          <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Receipt / Reservation ID</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(data.resId)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Guest Name</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(data.guestName)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Room</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(data.roomNo)} - ${escapeHtmlServer_(data.roomType)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Check In</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(data.checkIn)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Check Out</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(data.checkOut)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Actual Checkout</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(data.actualCheckout || '-')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Nights</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(String(data.nights || 0))}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Discount</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(String(data.discountPct || 0))}%</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Room Total</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(formatCurrency_(data.netAmount || 0))}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Late Checkout</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(formatCurrency_(data.lateCheckoutAmount || 0))}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Total Paid</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(formatCurrency_(data.totalPaid || 0))}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Payment Status</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtmlServer_(data.paymentStatus || '')}</td></tr>
          </table>

          <h3 style="margin:16px 0 8px">Payments</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;background:#f3f4f6">Type</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;background:#f3f4f6">Amount</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;background:#f3f4f6">Date</th>
              </tr>
            </thead>
            <tbody>
              ${paymentRows || '<tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb">No payments found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function buildPdfResponse_(title, subtitle, tables, fileStem, options) {
  const doc = DocumentApp.create(title + ' ' + new Date().getTime());
  const body = doc.getBody();
  body.clear();

  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(subtitle).setHeading(DocumentApp.ParagraphHeading.HEADING3);

  (tables || []).forEach(function(tableDef) {
    body.appendParagraph(tableDef.heading).setHeading(DocumentApp.ParagraphHeading.HEADING2);

    const emptyRow = (tableDef.headers || []).map(function(_, index) {
      return index === 0 ? 'No records found' : '';
    });

    const rows = [tableDef.headers].concat(
      (tableDef.rows && tableDef.rows.length ? tableDef.rows : [emptyRow])
    );

    const table = body.appendTable(rows);
    if (rows[0] && rows[0].length > 1) {
      const headerRow = table.getRow(0);
      for (var i = 0; i < headerRow.getNumCells(); i++) {
        headerRow.getCell(i).editAsText().setBold(true);
      }
    }
    body.appendParagraph('');
  });

  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(doc.getId()).getBlob().getAs(MimeType.PDF);
  const fileName =
    fileStem + '-' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') +
    '.pdf';

  pdfBlob.setName(fileName);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return {
    ok: true,
    message: 'PDF ready.',
    fileName: fileName,
    mimeType: MimeType.PDF,
    base64: Utilities.base64Encode(pdfBlob.getBytes())
  };
}

function buildCheckoutReceiptPdf(payload) {
  try {
    requireUser_();
    const data = buildCheckoutReceiptData_(payload.resId);
    const tables = [
      {
        heading: 'Checkout Summary',
        headers: ['Field', 'Value'],
        rows: [
          ['Reservation ID', data.resId],
          ['Guest Name', data.guestName],
          ['Phone', data.phone || ''],
          ['Email', data.email || ''],
          ['Room', data.roomNo + ' - ' + data.roomType],
          ['Check In', data.checkIn],
          ['Check Out', data.checkOut],
          ['Actual Checkout', data.actualCheckout || ''],
          ['Nights', data.nights],
          ['Discount %', data.discountPct],
          ['Room Total', formatCurrency_(data.netAmount)],
          ['Late Checkout', formatCurrency_(data.lateCheckoutAmount)],
          ['Total Paid', formatCurrency_(data.totalPaid)],
          ['Payment Status', data.paymentStatus]
        ]
      },
      {
        heading: 'Payments',
        headers: ['Type', 'Amount', 'Date'],
        rows: (data.payments || []).map(function(p) {
          return [p.paymentType || '', formatCurrency_(p.amount || 0), p.paymentDate || ''];
        })
      }
    ];

    return buildPdfResponse_(
      'Checkout Receipt',
      'Reservation: ' + data.resId,
      tables,
      'checkout-receipt',
      { landscape: true }
    );
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function createMaintenanceLog(payload) {
  try {
    const user = requireUser_();
    const sh = getSheet_(SHEETS.maintenanceHistory);
    sh.appendRow([
      makeId_('MNT', sh),
      payload.roomNo,
      payload.note || '',
      new Date(),
      payload.status || 'Not Resolved',
      user.fullName || user.username,
      '',
      ''
    ]);

    updateRoomStatus_(payload.roomNo, {
      maintenanceStatus: payload.status === 'Resolved' ? 'Resolved' : 'Not Resolved'
    });

    audit_('Create Maintenance Log', user.username, payload.roomNo + ' maintenance logged');
    return { ok: true, message: 'Maintenance log created.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function resolveMaintenanceLog(logId, status) {
  try {
    const user = requireUser_();
    const sh = getSheet_(SHEETS.maintenanceHistory);
    const headers = getHeaders_(sh);
    const rows = getObjects_(sh);
    const idx = rows.findIndex(r => String(r['Log ID']) === String(logId));
    if (idx === -1) throw new Error('Maintenance log not found.');

    const rowNumber = idx + 2;
    const roomNo = String(rows[idx]['Room'] || '');

    setCellByHeader_(sh, rowNumber, headers, 'Status', status);
    setCellByHeader_(sh, rowNumber, headers, 'Resolved At', new Date());
    setCellByHeader_(sh, rowNumber, headers, 'Resolved By', user.fullName || user.username);

    if (roomNo) {
      updateRoomStatus_(roomNo, { maintenanceStatus: status === 'Resolved' ? 'Resolved' : 'Not Resolved' });
    }

    audit_('Resolve Maintenance Log', user.username, logId + ' -> ' + status);
    return { ok: true, message: 'Maintenance updated.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function createUser(payload) {
  try {
    const user = requireUser_();
    if (String(user.role) !== 'Admin') throw new Error('Only admin can create users.');

    if (!payload.username || !payload.password || !payload.fullName || !payload.role) {
      throw new Error('All user fields are required.');
    }

    const sh = getSheet_(SHEETS.users);
    const rows = getObjects_(sh);
    const exists = rows.some(r => String(r['Username']).trim().toLowerCase() === String(payload.username).trim().toLowerCase());
    if (exists) throw new Error('Username already exists.');

    sh.appendRow([
      makeId_('U', sh),
      payload.username.trim(),
      payload.password,
      payload.fullName.trim(),
      payload.role,
      'Active'
    ]);

    audit_('Create User', user.username, payload.username + ' created');
    return { ok: true, message: 'User created successfully.', data: getAppBootstrap() };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function getBookingPaymentReportData_(payload) {
  const bookings = filterRowsByDateRangeServer_(
    getBookingHistory_(),
    payload.startDate,
    payload.endDate,
    ['createdAt', 'checkIn', 'updatedAt', 'actualCheckout']
  );

  const payments = filterRowsByDateRangeServer_(
    getPaymentHistory_(),
    payload.startDate,
    payload.endDate,
    ['paymentDate']
  );

  return { bookings: bookings, payments: payments };
}

function downloadBookingPaymentReportPdf(payload) {
  try {
    const user = requireUser_();
    if (String(user.role) === 'Housekeeping') throw new Error('Access denied.');

    const data = getBookingPaymentReportData_(payload || {});
    const title = 'Booking and Payment Report';
    const subtitle = 'Range: ' + describeRange_(payload && payload.startDate, payload && payload.endDate);

    const tables = [
      {
        heading: 'Booking History',
        headers: ['Res ID', 'Guest', 'Room', 'Check In', 'Check Out', 'Amount', 'Payment', 'Status', 'Created'],
        rows: data.bookings.map(r => [
          r.resId,
          r.guestName,
          r.roomNo,
          r.checkIn,
          r.checkOut,
          formatCurrency_(r.netAmount),
          r.paymentStatus || '',
          r.status || '',
          r.createdAt || ''
        ])
      },
      {
        heading: 'Payment History',
        headers: ['Payment ID', 'Res ID', 'Guest', 'Room', 'Type', 'Amount', 'Date', 'Receipt'],
        rows: data.payments.map(r => [
          r.paymentId,
          r.resId,
          r.guestName,
          r.roomNo,
          r.paymentType,
          formatCurrency_(r.amount),
          r.paymentDate || '',
          r.receiptName || ''
        ])
      }
    ];

    return buildPdfResponse_(title, subtitle, tables, 'booking-payment-report', { landscape: true });
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function getCleaningReportData_(payload, currentUser) {
  const targetUser = String(payload.targetUser || '').trim() || '';
  const effectiveTargetUser =
    String(currentUser.role) === 'Housekeeping'
      ? (currentUser.fullName || currentUser.username)
      : targetUser;

  const rows = [];

  function pushSessionRows(row, placeType, place) {
    if (!isWithinRangeServer_(row, payload.startDate, payload.endDate, ['startedAt', 'finishedAt'])) return;

    const startedBy = String(row.startedBy || '').trim();
    const sessionDuration = Number(row.durationMins || 0);

    if (startedBy && (!effectiveTargetUser || startedBy === effectiveTargetUser)) {
      rows.push({
        user: startedBy,
        placeType: placeType,
        place: place,
        startedAt: row.startedAt || row.finishedAt || '',
        durationMins: sessionDuration,
        note: row.cleaningNote || ''
      });
    }

    const finishAt = parseServerDate_(row.finishedAt, false);
    parseJoinTimesEntries_(row.joinedBy, row.joinTimes).forEach(function(entry) {
      if (!entry.name) return;
      if (effectiveTargetUser && entry.name !== effectiveTargetUser) return;
      if (!entry.joinedAt || !finishAt) return;

      const joinedDuration = Math.max(0, Math.round((finishAt.getTime() - entry.joinedAt.getTime()) / 60000));
      rows.push({
        user: entry.name,
        placeType: placeType,
        place: place,
        startedAt: formatDateTime_(entry.joinedAt) || row.startedAt || '',
        durationMins: joinedDuration,
        note: (row.cleaningNote || '') + ((row.cleaningNote || '') ? ' | ' : '') + 'Joined session'
      });
    });
  }

  getCleaningHistory_().forEach(function(row) {
    pushSessionRows(row, 'Room', row.roomNo || '');
  });

  getNonRoomCleaningHistory_().forEach(function(row) {
    pushSessionRows(row, 'Non-Room', row.area || '');
  });

  rows.sort(function(a, b) {
    return String(b.startedAt || '').localeCompare(String(a.startedAt || ''));
  });

  const summaryMap = {};
  rows.forEach(function(row) {
    if (!summaryMap[row.user]) {
      summaryMap[row.user] = {
        user: row.user,
        roomSessions: 0,
        nonRoomSessions: 0,
        totalMinutes: 0
      };
    }

    if (row.placeType === 'Room') summaryMap[row.user].roomSessions += 1;
    if (row.placeType === 'Non-Room') summaryMap[row.user].nonRoomSessions += 1;
    summaryMap[row.user].totalMinutes += Number(row.durationMins || 0);
  });

  const summary = Object.keys(summaryMap).sort().map(function(key) {
    return summaryMap[key];
  });

  return { targetUser: effectiveTargetUser, rows: rows, summary: summary };
}

function downloadCleaningReportPdf(payload) {
  try {
    const user = requireUser_();
    const targetUser = String(payload && payload.targetUser || '').trim();

    if (String(user.role) !== 'Admin' && String(user.role) !== 'Housekeeping') {
      throw new Error('Access denied.');
    }

    if (String(user.role) === 'Housekeeping' &&
        targetUser &&
        targetUser !== (user.fullName || user.username)) {
      throw new Error('Housekeeping can only view their own report.');
    }

    const data = getCleaningReportData_(payload || {}, user);
    const title = 'Cleaning Report';
    const subtitle =
      'Range: ' + describeRange_(payload && payload.startDate, payload && payload.endDate) +
      (data.targetUser ? ' | User: ' + data.targetUser : '');

    const tables = [
      {
        heading: 'User Summary',
        headers: ['User', 'Room Sessions', 'Non-Room Sessions', 'Total Minutes'],
        rows: data.summary.map(r => [
          r.user,
          r.roomSessions,
          r.nonRoomSessions,
          r.totalMinutes
        ])
      },
      {
        heading: 'Cleaning Details',
        headers: ['User', 'Type', 'Place', 'Date', 'Duration (Mins)', 'Note'],
        rows: data.rows.map(r => [
          r.user,
          r.placeType,
          r.place,
          r.startedAt || '',
          r.durationMins || 0,
          r.note || ''
        ])
      }
    ];

    return buildPdfResponse_(title, subtitle, tables, 'cleaning-report', { landscape: true });
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function filterRowsByDateRangeServer_(rows, startDate, endDate, fields) {
  return (rows || []).filter(function(row) {
    return isWithinRangeServer_(row, startDate, endDate, fields);
  });
}

function isWithinRangeServer_(row, startDate, endDate, fields) {
  const start = startDate ? parseServerDate_(startDate, false) : null;
  const end = endDate ? parseServerDate_(endDate, true) : null;
  if (!start && !end) return true;

  return (fields || []).some(function(field) {
    const parsed = parseServerDate_(row[field], false);
    if (!parsed) return false;
    if (start && parsed.getTime() < start.getTime()) return false;
    if (end && parsed.getTime() > end.getTime()) return false;
    return true;
  });
}

function parseServerDate_(value, endOfDay) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }

  const raw = String(value).trim();
  if (!raw) return null;
  let normalized = raw;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    normalized = raw + (endOfDay ? 'T23:59:59' : 'T00:00:00');
  } else if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(raw)) {
    normalized = raw.replace(' ', 'T') + ':00';
  } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const parts = raw.split('/');
    normalized =
      (parts[2].length === 2 ? '20' + parts[2] : parts[2]) + '-' +
      Utilities.formatString('%02d', Number(parts[0])) + '-' +
      Utilities.formatString('%02d', Number(parts[1])) +
      (endOfDay ? 'T23:59:59' : 'T00:00:00');
  }

  const dt = new Date(normalized);
  return isNaN(dt.getTime()) ? null : dt;
}

function describeRange_(startDate, endDate) {
  return (startDate || 'Beginning') + ' to ' + (endDate || 'Today');
}

function formatCurrency_(value) {
  return '₦' + Number(value || 0).toLocaleString();
}