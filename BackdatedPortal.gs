// ═══════════════════════════════════════════════════════════════════════════════
// BACKDATED ENTRY PORTAL — BackdatedPortal.gs
//
// DROP-IN: Add this file to your Apps Script project alongside Code.gs.
// Then run  setupBackdatedPortal()  ONCE from the Apps Script editor.
// That single function does EVERYTHING automatically:
//   • Creates the 'Backdated Entry Log' sheet
//   • Adds 'Backdated' to the Roles sheet (if missing)
//   • Creates a default portal user  backdated / backdate123  (change after first login)
//   • Patches doGet() in Code.gs to route ?portal=backdated to the portal HTML
//
// After running setupBackdatedPortal(), redeploy your web app and visit:
//   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?portal=backdated
// ═══════════════════════════════════════════════════════════════════════════════

var BACKDATED_LOG_SHEET  = 'Backdated Entry Log';
var BACKDATED_ROLE_NAME  = 'Backdated';
var BACKDATED_DEFAULT_UN = 'backdated';
var BACKDATED_DEFAULT_PW = 'backdate123';


// ══════════════════════════════════════════════════════════════════════════════
//  ONE-CLICK SETUP  — run this once from the Apps Script editor
// ══════════════════════════════════════════════════════════════════════════════

function setupBackdatedPortal() {
  try {
    ensureOperationalSheets_();          // make sure base PMS sheets exist first

    // 1. Backdated Entry Log sheet
    ensureBackdatedLogSheet_();

    // 2. Add 'Backdated' role to Roles sheet
    ensureBackdatedRole_();

    // 3. Add default portal user to Users sheet
    ensureBackdatedUser_();

    // 4. Patch doGet in Code.gs to route ?portal=backdated
    patchDoGet_();

    SpreadsheetApp.getActive().toast(
      'Setup complete! Redeploy your web app then visit ?portal=backdated\n' +
      'Default login → username: backdated  password: backdate123',
      'Backdated Portal Ready ✓', 15
    );

    Logger.log('=== Backdated Portal Setup Complete ===');
    Logger.log('Default login:  username=backdated  password=backdate123');
    Logger.log('Change the password from the main PMS Admin tab after first login.');
    return { ok: true, message: 'Setup complete.' };

  } catch (err) {
    Logger.log('Setup error: ' + err.message);
    return { ok: false, message: err.message };
  }
}


// ── 1. Ensure Backdated Entry Log sheet ──────────────────────────────────────

function ensureBackdatedLogSheet_() {
  ensureSheet_(BACKDATED_LOG_SHEET, [
    'Entry ID', 'Entry Type', 'Res ID', 'Guest Name', 'Room No',
    'Amount', 'Transaction Date', 'Entered By', 'Note', 'Logged At'
  ]);
}


// ── 2. Ensure 'Backdated' role in Roles sheet ────────────────────────────────

function ensureBackdatedRole_() {
  var sh = getSheet_(SHEETS.roles, false);
  if (!sh) return;

  var rows = getObjects_(sh);
  var exists = rows.some(function(r) {
    return String(r['Role Name'] || '').trim() === BACKDATED_ROLE_NAME;
  });

  if (!exists) {
    // Auto-generate next Role ID
    var lastId = rows.reduce(function(max, r) {
      var n = parseInt(String(r['Role ID'] || '0').replace(/\D/g, '')) || 0;
      return n > max ? n : max;
    }, 0);
    sh.appendRow([
      'R' + Utilities.formatString('%03d', lastId + 1),
      BACKDATED_ROLE_NAME,
      'Backdated entry portal access',
      'Active'
    ]);
    Logger.log('Added Backdated role to Roles sheet.');
  } else {
    // Make sure it's Active
    var headers = getHeaders_(sh);
    var rows2 = getObjects_(sh);
    var idx = rows2.findIndex(function(r) {
      return String(r['Role Name'] || '').trim() === BACKDATED_ROLE_NAME;
    });
    if (idx > -1) {
      setCellByHeader_(sh, idx + 2, headers, 'Status', 'Active');
    }
    Logger.log('Backdated role already exists — ensured Active.');
  }
}


// ── 3. Ensure default portal user in Users sheet ─────────────────────────────

function ensureBackdatedUser_() {
  var sh = getSheet_(SHEETS.users, false);
  if (!sh) return;

  var rows = getObjects_(sh);
  var exists = rows.some(function(r) {
    return String(r['Username'] || '').trim().toLowerCase() === BACKDATED_DEFAULT_UN &&
           String(r['Role'] || '').trim() === BACKDATED_ROLE_NAME;
  });

  if (!exists) {
    var lastId = rows.reduce(function(max, r) {
      var n = parseInt(String(r['User ID'] || '0').replace(/\D/g, '')) || 0;
      return n > max ? n : max;
    }, 0);
    sh.appendRow([
      'U' + Utilities.formatString('%03d', lastId + 1),
      BACKDATED_DEFAULT_UN,
      BACKDATED_DEFAULT_PW,
      'Backdated Staff',
      BACKDATED_ROLE_NAME,
      'Active'
    ]);
    Logger.log('Created default portal user: ' + BACKDATED_DEFAULT_UN);
  } else {
    Logger.log('Backdated user already exists.');
  }
}


// ── 4. Patch doGet in Code.gs ────────────────────────────────────────────────
// Reads Code.gs source, checks if the portal route is already present,
// and if not, inserts it at the top of doGet().

function patchDoGet_() {
  var files = ScriptApp.getScriptProject ? null : null; // only works via DriveApp file edit

  // Use the Apps Script API approach via source editing
  try {
    var projectFiles = getScriptFiles_();
    var codeFile = projectFiles.find(function(f) { return f.name === 'Code'; });
    if (!codeFile) {
      Logger.log('Code.gs not found via script API — applying manual patch instruction.');
      applyManualPatchFallback_();
      return;
    }

    var src = codeFile.source;
    var marker = '/* BACKDATED_PORTAL_ROUTE */';

    if (src.indexOf(marker) !== -1) {
      Logger.log('doGet already patched.');
      return;
    }

    // Insert portal route at start of doGet body
    var patched = src.replace(
      /function\s+doGet\s*\(\s*e?\s*\)\s*\{/,
      'function doGet(e) {\n' +
      '  ' + marker + '\n' +
      '  if (e && e.parameter && e.parameter.portal === \'backdated\') {\n' +
      '    return HtmlService.createTemplateFromFile(\'BackdatedPortal\')\n' +
      '      .evaluate()\n' +
      '      .setTitle(\'Backdated Entry Portal\')\n' +
      '      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);\n' +
      '  }'
    );

    if (patched === src) {
      Logger.log('Could not locate doGet pattern — applying manual patch instruction.');
      applyManualPatchFallback_();
      return;
    }

    updateScriptFile_(codeFile, patched);
    Logger.log('doGet patched successfully in Code.gs.');

  } catch (err) {
    Logger.log('Auto-patch failed (' + err.message + ') — using manual patch instruction.');
    applyManualPatchFallback_();
  }
}

function applyManualPatchFallback_() {
  // Write the patch to a dedicated helper sheet so the user can see it clearly
  var ss = SpreadsheetApp.getActive();
  var shName = 'Portal Setup Instructions';
  var existing = ss.getSheetByName(shName);
  if (existing) ss.deleteSheet(existing);

  var sh = ss.insertSheet(shName);
  var instructions = [
    ['Step', 'Action'],
    ['1', 'Open Apps Script (Extensions → Apps Script)'],
    ['2', 'Open the file Code.gs'],
    ['3', 'Find the line:   function doGet(e) {'],
    ['4', 'REPLACE that one line with the block below (copy exactly):'],
    ['', ''],
    ['Paste this block:', ''],
    ['', 'function doGet(e) {'],
    ['', '  /* BACKDATED_PORTAL_ROUTE */'],
    ['', '  if (e && e.parameter && e.parameter.portal === \'backdated\') {'],
    ['', '    return HtmlService.createTemplateFromFile(\'BackdatedPortal\')'],
    ['', '      .evaluate()'],
    ['', '      .setTitle(\'Backdated Entry Portal\')'],
    ['', '      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);'],
    ['', '  }'],
    ['', '  // ... rest of your existing doGet code stays here unchanged ...'],
    ['', '}'],
    ['', ''],
    ['5', 'Save Code.gs (Ctrl+S), then redeploy the web app (Deploy → Manage Deployments → edit → version: New version → Deploy)'],
    ['6', 'Access the portal at:  YOUR_WEBAPP_URL?portal=backdated'],
    ['7', 'Default login:  username = backdated   password = backdate123'],
    ['8', 'Change the password from the main PMS Admin tab after first login.'],
  ];

  sh.getRange(1, 1, instructions.length, 2).setValues(instructions);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#c9a227').setFontColor('#111');
  sh.autoResizeColumns(1, 2);

  Logger.log('Setup instructions written to "Portal Setup Instructions" sheet in the spreadsheet.');
}

// Attempt to read/write script files via the Apps Script API (requires script linked to Cloud project)
function getScriptFiles_() {
  var scriptId = ScriptApp.getScriptId();
  var url = 'https://script.googleapis.com/v1/projects/' + scriptId + '/content';
  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Script API returned ' + response.getResponseCode());
  var data = JSON.parse(response.getContentText());
  return data.files || [];
}

function updateScriptFile_(fileObj, newSource) {
  var scriptId = ScriptApp.getScriptId();
  var url = 'https://script.googleapis.com/v1/projects/' + scriptId + '/content';

  // We must re-send ALL files, not just the changed one
  var allFiles = getScriptFiles_();
  allFiles = allFiles.map(function(f) {
    if (f.name === fileObj.name) return Object.assign({}, f, { source: newSource });
    return f;
  });

  var response = UrlFetchApp.fetch(url, {
    method: 'PUT',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ files: allFiles }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Script API write returned ' + response.getResponseCode());
}


// ══════════════════════════════════════════════════════════════════════════════
//  PORTAL AUTH  (separate session namespace from main PMS)
// ══════════════════════════════════════════════════════════════════════════════

function getPortalSessionKey_() {
  return 'portal_' + Session.getTemporaryActiveUserKey();
}

function savePortalSession_(user) {
  CacheService.getUserCache().put(getPortalSessionKey_(), JSON.stringify(user), 21600);
}

function clearPortalSession_() {
  CacheService.getUserCache().remove(getPortalSessionKey_());
}

function getPortalUser_() {
  var raw = CacheService.getUserCache().get(getPortalSessionKey_());
  return raw ? JSON.parse(raw) : null;
}

function requirePortalUser_() {
  var user = getPortalUser_();
  if (!user) throw new Error('Session expired. Please log in again.');
  if (user.role !== BACKDATED_ROLE_NAME) throw new Error('Access denied.');
  return user;
}

// ── Login / Logout ───────────────────────────────────────────────────────────

function portalLogin(username, password) {
  try {
    ensureOperationalSheets_();
    ensureBackdatedLogSheet_();

    var sh = getSheet_(SHEETS.users);
    var rows = getObjects_(sh);

    var found = rows.find(function(r) {
      return String(r['Username'] || '').trim().toLowerCase() === String(username || '').trim().toLowerCase() &&
             String(r['Password'] || '').trim()               === String(password || '').trim() &&
             String(r['Status']   || '').toLowerCase()        === 'active' &&
             String(r['Role']     || '').trim()               === BACKDATED_ROLE_NAME;
    });

    if (!found) return { ok: false, message: 'Invalid credentials or access not permitted.' };

    var user = {
      userId:   String(found['User ID']   || ''),
      username: String(found['Username']  || ''),
      fullName: String(found['Full Name'] || found['Username'] || ''),
      role:     BACKDATED_ROLE_NAME,
      status:   'Active'
    };

    savePortalSession_(user);
    audit_('Portal Login', user.username, 'Backdated portal login');

    return {
      ok: true,
      user: user,
      rooms: getRoomsData_(),
      reservations: getAllReservationsForPortal_(),
      channels: getChannels_()
    };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function portalLogout() {
  clearPortalSession_();
  return { ok: true };
}

// ── Bootstrap (restores session on page load) ────────────────────────────────

function getPortalBootstrap() {
  try {
    var user = getPortalUser_();
    if (!user || user.role !== BACKDATED_ROLE_NAME) return { ok: false };
    ensureBackdatedLogSheet_();
    return {
      ok: true,
      user: user,
      rooms: getRoomsData_(),
      reservations: getAllReservationsForPortal_(),
      channels: getChannels_()
    };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// All reservations (active + history) for portal lookups
function getAllReservationsForPortal_() {
  var seen = {};
  var all  = [];
  getReservations_().forEach(function(r) { seen[r.resId] = true; all.push(r); });
  getBookingHistory_().forEach(function(r) { if (!seen[r.resId]) { seen[r.resId] = true; all.push(r); } });
  return all;
}


// ══════════════════════════════════════════════════════════════════════════════
//  LOOKUP  — auto-fill guest/room on forms
// ══════════════════════════════════════════════════════════════════════════════

function lookupReservationForPortal(resId) {
  try {
    requirePortalUser_();
    var found = getAllReservationsForPortal_().find(function(r) {
      return String(r.resId || '') === String(resId || '').trim();
    });
    if (!found) return { ok: false, message: 'Reservation not found.' };
    return { ok: true, data: found };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}


// ══════════════════════════════════════════════════════════════════════════════
//  MAIN SAVE DISPATCHER
// ══════════════════════════════════════════════════════════════════════════════

function saveBackdatedEntry(payload) {
  try {
    var user = requirePortalUser_();
    ensureBackdatedLogSheet_();

    var type = String(payload.entryType || '').trim();
    var result;

    switch (type) {
      case 'Reservation':   result = saveBackdatedReservation_(payload, user);   break;
      case 'Payment':       result = saveBackdatedPayment_(payload, user);       break;
      case 'Extension':     result = saveBackdatedExtension_(payload, user);     break;
      case 'Checkout':      result = saveBackdatedCheckout_(payload, user);      break;
      case 'Late Checkout': result = saveBackdatedLateCheckout_(payload, user);  break;
      default: throw new Error('Unknown entry type: ' + type);
    }

    if (result && result.ok) {
      logBackdatedEntry_({
        entryId:   result.entryId   || '',
        entryType: type,
        resId:     result.resId     || payload.resId     || '',
        guestName: result.guestName || payload.guestName || '',
        roomNo:    result.roomNo    || payload.roomNo    || '',
        amount:    Number(result.amount || payload.amount || 0),
        txDate:    payload.txDate || '',
        enteredBy: user.fullName || user.username,
        note:      payload.note  || ''
      });
      audit_('Backdated ' + type, user.username,
        (result.resId || payload.resId || '') + ' backdated ' + type);
    }

    return result;
  } catch (err) {
    return { ok: false, message: err.message };
  }
}


// ══════════════════════════════════════════════════════════════════════════════
//  1. BACKDATED RESERVATION
//  Writes → Reservations, Booking History, Payment History (if paid)
// ══════════════════════════════════════════════════════════════════════════════

function saveBackdatedReservation_(payload, user) {
  if (!payload.guestName)                 throw new Error('Guest name is required.');
  if (!payload.roomNo)                    throw new Error('Room / apartment is required.');
  if (!payload.checkIn || !payload.checkOut) throw new Error('Check-in and check-out dates are required.');
  if (!payload.txDate)                    throw new Error('Original transaction date is required.');

  var rooms        = getRoomsData_();
  var aptRooms     = rooms.filter(function(r) { return String(r.apartmentGroup || '') === String(payload.roomNo); });
  var isApt        = aptRooms.length > 0;
  var primaryRoom  = isApt ? aptRooms[0] : rooms.find(function(r) { return String(r.roomNo) === String(payload.roomNo); });
  if (!primaryRoom) throw new Error('Room not found: ' + payload.roomNo);

  var payStatus    = payload.paymentStatus || 'Paid';
  var baseRate     = isApt ? APARTMENT_FIXED_RATE : Number(primaryRoom.rate || 0);
  var rate         = isFreePrStatus_(payStatus) ? 0 : baseRate;
  var nights       = nightsBetween_(payload.checkIn, payload.checkOut);
  var discPct      = Number(payload.discountPct || 0);
  var netAmount    = isFreePrStatus_(payStatus) ? 0 : Math.round(rate * nights * (1 - discPct / 100));
  var resStatus    = payload.reservationStatus || 'Checked Out';
  var roomType     = isApt ? ('Apartment - ' + payload.roomNo) : (primaryRoom.roomType || '');
  var txDate       = new Date(payload.txDate);
  var actionBy     = (user.fullName || user.username) + ' [Backdated]';

  // ── Reservations sheet ──
  var resSheet = getSheet_(SHEETS.reservations);
  var resId    = makeId_('RES', resSheet);
  resSheet.appendRow([
    resId, payload.guestName, payload.phone || '', payload.email || '',
    payload.roomNo, roomType,
    new Date(payload.checkIn), new Date(payload.checkOut),
    nights, Number(payload.adults || 1),
    rate, discPct, netAmount,
    payload.channel || 'Walk-in',
    resStatus, payStatus,
    payload.rrrNumber || '', actionBy,
    '[Backdated] ' + (payload.notes || ''),
    txDate   // Created At = original date
  ]);

  // ── Booking History ──
  var actualCO = '';
  if (payload.actualCheckout) {
    try { actualCO = new Date(payload.actualCheckout); } catch(e) {}
  }
  var hist = getSheet_(SHEETS.bookingHistory);
  hist.appendRow([
    resId, payload.guestName, payload.phone || '', payload.email || '',
    payload.roomNo, roomType,
    new Date(payload.checkIn), new Date(payload.checkOut),
    actualCO || '',
    nights, Number(payload.adults || 1),
    rate, discPct, discPct > 0 ? 'Yes' : 'No',
    netAmount, payload.channel || 'Walk-in',
    resStatus, payStatus,
    payload.rrrNumber || '',
    'No', 0, '', '',   // late checkout fields
    actionBy,
    '[Backdated] ' + (payload.notes || ''),
    txDate,      // Created At = original transaction date
    new Date()   // Updated At = now
  ]);

  // ── Payment History (if money changed hands) ──
  if ((payStatus === 'Paid' || payStatus === 'Part Paid') && netAmount > 0) {
    var paySheet = getSheet_(SHEETS.paymentHistory);
    paySheet.appendRow([
      makeId_('PAY', paySheet), resId,
      payload.guestName, payload.roomNo,
      'Reservation Payment', netAmount,
      payload.rrrNumber || '',
      txDate,   // original payment date
      actionBy,
      '[Backdated] ' + payStatus,
      '', ''
    ]);
  }

  return { ok: true, message: 'Backdated reservation saved.', entryId: resId, resId: resId,
           guestName: payload.guestName, roomNo: payload.roomNo, amount: netAmount };
}


// ══════════════════════════════════════════════════════════════════════════════
//  2. BACKDATED PAYMENT
//  Adds a payment row; optionally updates payment status on res + history
// ══════════════════════════════════════════════════════════════════════════════

function saveBackdatedPayment_(payload, user) {
  if (!payload.resId)                           throw new Error('Reservation ID is required.');
  if (!payload.amount || Number(payload.amount) <= 0) throw new Error('Valid amount required.');
  if (!payload.txDate)                          throw new Error('Payment date is required.');

  var txDate    = new Date(payload.txDate);
  var actionBy  = (user.fullName || user.username) + ' [Backdated]';
  var guestName = String(payload.guestName || '').trim();
  var roomNo    = String(payload.roomNo    || '').trim();

  // Resolve guest/room from history if not provided
  if (!guestName || !roomNo) {
    var found = getAllReservationsForPortal_().find(function(r) {
      return String(r.resId || '') === String(payload.resId);
    });
    if (found) {
      guestName = guestName || found.guestName || '';
      roomNo    = roomNo    || found.roomNo    || '';
    }
  }

  var paySheet = getSheet_(SHEETS.paymentHistory);
  var payId    = makeId_('PAY', paySheet);
  paySheet.appendRow([
    payId, payload.resId, guestName, roomNo,
    payload.paymentType || 'Reservation Payment',
    Number(payload.amount),
    payload.rrrNumber || '',
    txDate,   // original payment date
    actionBy,
    '[Backdated] ' + (payload.note || payload.paymentType || ''),
    '', ''
  ]);

  if (payload.updatePaymentStatus) {
    updateReservationPaymentStatus_(
      payload.resId, payload.updatePaymentStatus, payload.rrrNumber || '', actionBy
    );
  }

  return { ok: true, message: 'Payment record saved.', entryId: payId,
           resId: payload.resId, guestName: guestName, roomNo: roomNo,
           amount: Number(payload.amount) };
}


// ══════════════════════════════════════════════════════════════════════════════
//  3. BACKDATED STAY EXTENSION
//  Updates checkout date in both sheets; logs an Extension Payment
// ══════════════════════════════════════════════════════════════════════════════

function saveBackdatedExtension_(payload, user) {
  if (!payload.resId)      throw new Error('Reservation ID required.');
  if (!payload.newCheckOut) throw new Error('New checkout date required.');
  if (!payload.txDate)     throw new Error('Transaction date required.');

  var txDate   = new Date(payload.txDate);
  var actionBy = (user.fullName || user.username) + ' [Backdated]';

  // ── Update Booking History ──
  var histSheet = getSheet_(SHEETS.bookingHistory, false);
  if (histSheet) {
    var hH = getHeaders_(histSheet);
    var hR = getObjects_(histSheet);
    var hI = hR.findIndex(function(r) { return String(r['Res ID'] || '') === String(payload.resId); });
    if (hI > -1) {
      var newNights = nightsBetween_(formatDate_(hR[hI]['Check In']), payload.newCheckOut);
      setCellByHeader_(histSheet, hI + 2, hH, 'Check Out', new Date(payload.newCheckOut));
      setCellByHeader_(histSheet, hI + 2, hH, 'Nights', newNights);
      setCellByHeader_(histSheet, hI + 2, hH, 'Notes',
        appendNote_(String(hR[hI]['Notes'] || ''),
          '[Backdated Extension] Extended to ' + payload.newCheckOut));
      setCellByHeader_(histSheet, hI + 2, hH, 'Updated At', new Date());
    }
  }

  // ── Update live Reservations if still active ──
  var resSheet = getSheet_(SHEETS.reservations, false);
  if (resSheet) {
    var rH = getHeaders_(resSheet);
    var rR = getObjects_(resSheet);
    var rI = rR.findIndex(function(r) { return String(r['Res ID'] || '') === String(payload.resId); });
    if (rI > -1) {
      setCellByHeader_(resSheet, rI + 2, rH, 'Check Out', new Date(payload.newCheckOut));
    }
  }

  // ── Extension Payment ──
  var payId = '';
  if (Number(payload.amount || 0) > 0) {
    var paySheet = getSheet_(SHEETS.paymentHistory);
    payId = makeId_('PAY', paySheet);
    paySheet.appendRow([
      payId, payload.resId,
      payload.guestName || '', payload.roomNo || '',
      'Extension Payment', Number(payload.amount),
      payload.rrrNumber || '',
      txDate,   // original payment date
      actionBy,
      '[Backdated] Extended to ' + payload.newCheckOut + (payload.note ? ' — ' + payload.note : ''),
      '', ''
    ]);
  }

  return { ok: true, message: 'Extension saved.', entryId: payId || ('EXT-' + payload.resId),
           resId: payload.resId, guestName: payload.guestName || '',
           roomNo: payload.roomNo || '', amount: Number(payload.amount || 0) };
}


// ══════════════════════════════════════════════════════════════════════════════
//  4. BACKDATED CHECKOUT
//  Stamps actual checkout on Booking History; updates reservation status
// ══════════════════════════════════════════════════════════════════════════════

function saveBackdatedCheckout_(payload, user) {
  if (!payload.resId)           throw new Error('Reservation ID required.');
  if (!payload.actualCheckout)  throw new Error('Actual checkout date/time required.');
  if (!payload.txDate)          throw new Error('Transaction date required.');

  var txDate   = new Date(payload.txDate);
  var actualDt = new Date(payload.actualCheckout);
  var actionBy = (user.fullName || user.username) + ' [Backdated]';

  var histUpdates = {
    status:         'Checked Out',
    actualCheckout: actualDt,
    lateCheckout:   isLateCheckout_(null, actualDt) ? 'Yes' : 'No'
  };
  if (payload.updatePaymentStatus) histUpdates.paymentStatus = payload.updatePaymentStatus;
  if (payload.note) histUpdates.extraNote = '[Backdated Checkout] ' + payload.note;

  updateBookingHistoryStatus_(payload.resId, histUpdates);

  // Update Reservations status if row exists
  var resSheet = getSheet_(SHEETS.reservations, false);
  if (resSheet) {
    var rH = getHeaders_(resSheet);
    var rR = getObjects_(resSheet);
    var rI = rR.findIndex(function(r) { return String(r['Res ID'] || '') === String(payload.resId); });
    if (rI > -1) setCellByHeader_(resSheet, rI + 2, rH, 'Status', 'Checked Out');
  }

  var entryId = 'CO-' + payload.resId + '-' +
    Utilities.formatDate(txDate, Session.getScriptTimeZone(), 'yyyyMMdd');

  return { ok: true, message: 'Checkout record saved.', entryId: entryId,
           resId: payload.resId, guestName: payload.guestName || '',
           roomNo: payload.roomNo || '', amount: 0 };
}


// ══════════════════════════════════════════════════════════════════════════════
//  5. BACKDATED LATE CHECKOUT FEE
//  Adds Late Checkout Payment; marks lateCheckout=Yes on Booking History
// ══════════════════════════════════════════════════════════════════════════════

function saveBackdatedLateCheckout_(payload, user) {
  if (!payload.resId)                           throw new Error('Reservation ID required.');
  if (!payload.amount || Number(payload.amount) <= 0) throw new Error('Valid fee amount required.');
  if (!payload.txDate)                          throw new Error('Transaction date required.');

  var txDate   = new Date(payload.txDate);
  var actionBy = (user.fullName || user.username) + ' [Backdated]';
  var amount   = Number(payload.amount);

  var paySheet = getSheet_(SHEETS.paymentHistory);
  var payId    = makeId_('PAY', paySheet);
  paySheet.appendRow([
    payId, payload.resId,
    payload.guestName || '', payload.roomNo || '',
    'Late Checkout Payment', amount,
    payload.rrrNumber || '',
    txDate,   // original fee date
    actionBy,
    '[Backdated] ' + (payload.note || 'Late checkout fee'),
    '', ''
  ]);

  updateBookingHistoryStatus_(payload.resId, {
    lateCheckout:       'Yes',
    lateCheckoutAmount: amount,
    extraNote: '[Backdated Late Checkout] ' + (payload.note || '')
  });

  return { ok: true, message: 'Late checkout fee saved.', entryId: payId,
           resId: payload.resId, guestName: payload.guestName || '',
           roomNo: payload.roomNo || '', amount: amount };
}


// ══════════════════════════════════════════════════════════════════════════════
//  READ BACKDATED LOG
// ══════════════════════════════════════════════════════════════════════════════

function getBackdatedEntries() {
  try {
    requirePortalUser_();
    ensureBackdatedLogSheet_();
    var sh = getSheet_(BACKDATED_LOG_SHEET, false);
    if (!sh) return { ok: true, rows: [] };
    var rows = getObjects_(sh).map(function(r) {
      return {
        entryId:   String(r['Entry ID']          || ''),
        entryType: String(r['Entry Type']         || ''),
        resId:     String(r['Res ID']             || ''),
        guestName: String(r['Guest Name']         || ''),
        roomNo:    String(r['Room No']            || ''),
        amount:    Number(r['Amount']             || 0),
        txDate:    String(r['Transaction Date']   || ''),
        enteredBy: String(r['Entered By']         || ''),
        note:      String(r['Note']               || ''),
        loggedAt:  String(r['Logged At']          || '')
      };
    }).reverse();
    return { ok: true, rows: rows };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}


// ══════════════════════════════════════════════════════════════════════════════
//  PRIVATE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function logBackdatedEntry_(data) {
  var sh = getSheet_(BACKDATED_LOG_SHEET);
  sh.appendRow([
    data.entryId   || '',
    data.entryType || '',
    data.resId     || '',
    data.guestName || '',
    data.roomNo    || '',
    Number(data.amount || 0),
    data.txDate    || '',
    data.enteredBy || '',
    data.note      || '',
    new Date()
  ]);
}

function updateReservationPaymentStatus_(resId, paymentStatus, rrrNumber, actionBy) {
  var sh = getSheet_(SHEETS.reservations, false);
  if (sh) {
    var headers = getHeaders_(sh);
    var rows    = getObjects_(sh);
    var idx     = rows.findIndex(function(r) { return String(r['Res ID'] || '') === String(resId); });
    if (idx > -1) {
      setCellByHeader_(sh, idx + 2, headers, 'Payment Status', paymentStatus);
      if (rrrNumber) setCellByHeader_(sh, idx + 2, headers, 'RRR Number', rrrNumber);
    }
  }
  updateBookingHistoryStatus_(resId, {
    paymentStatus: paymentStatus,
    rrrNumber:     rrrNumber || undefined
  });
}
