const { ipcMain } = require('electron');
const dns = require('dns').promises;
const { getDb } = require('./database');
const {
  enqueueAllTables,
  getSyncStatus,
  processSyncQueue,
  saveConfig,
  enqueueTables
} = require('./sync');
const {
  getEmailStatus,
  processEmailQueue,
  queueEmail,
  saveEmailConfig
} = require('./email');

let currentUser = null;

function asText(value) {
  return value == null ? '' : String(value);
}

function toNumber(value) {
  return Number(value || 0);
}

function formatDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return asText(value);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return asText(value);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function audit(action, username, details) {
  getDb()
    .prepare('INSERT INTO AuditLog (time, action, username, details) VALUES (?, ?, ?, ?)')
    .run(new Date().toISOString(), action, username || '', details || '');
}

function getBranding() {
  const rows = getDb().prepare('SELECT setting, value FROM Setup').all();
  const setup = Object.fromEntries(rows.map((row) => [row.setting, row.value]));
  return {
    hotelName: setup['Hotel Name'] || 'NDDC Clubhouse',
    tagline: setup.Tagline || 'Redefining Luxury Living',
    logoDataUri: setup['Logo Data Uri'] || ''
  };
}

function getUsers() {
  return getDb()
    .prepare('SELECT user_id, username, full_name, role, status FROM Users ORDER BY username')
    .all()
    .map((row) => ({
      userId: asText(row.user_id),
      username: asText(row.username),
      fullName: asText(row.full_name),
      role: asText(row.role),
      status: asText(row.status)
    }));
}

function getRoomsData() {
  return getDb()
    .prepare('SELECT * FROM Rooms ORDER BY room_no')
    .all()
    .map((row) => ({
      roomNo: asText(row.room_no),
      roomType: asText(row.room_type),
      rate: toNumber(row.rate),
      status: asText(row.status),
      housekeepingStatus: asText(row.housekeeping_status),
      maintenanceStatus: asText(row.maintenance_status),
      apartmentGroup: asText(row.apartment_group),
      lastCleaned: formatDateTime(row.last_cleaned)
    }));
}

function getReservations() {
  return getDb()
    .prepare(`
      SELECT * FROM Reservations
      WHERE status IN ('Reserved', 'Checked In')
      ORDER BY check_in, room_no
    `)
    .all()
    .map((row) => ({
      resId: asText(row.res_id),
      guestName: asText(row.guest_name),
      phone: asText(row.phone),
      email: asText(row.email),
      roomNo: asText(row.room_no),
      roomType: asText(row.room_type),
      checkIn: formatDateOnly(row.check_in),
      checkOut: formatDateOnly(row.check_out),
      nights: toNumber(row.nights),
      adults: toNumber(row.adults),
      rate: toNumber(row.rate),
      discountPct: toNumber(row.discount_pct),
      netAmount: toNumber(row.net_amount),
      channel: asText(row.channel),
      status: asText(row.status),
      paymentStatus: asText(row.payment_status),
      rrrNumber: asText(row.rrr_number),
      notes: asText(row.notes)
    }));
}

function getBookingHistory() {
  return getDb()
    .prepare('SELECT * FROM BookingHistory ORDER BY created_at DESC')
    .all()
    .map((row) => ({
      resId: asText(row.res_id),
      guestName: asText(row.guest_name),
      phone: asText(row.phone),
      email: asText(row.email),
      roomNo: asText(row.room_no),
      roomType: asText(row.room_type),
      checkIn: formatDateOnly(row.check_in),
      checkOut: formatDateOnly(row.check_out),
      actualCheckout: formatDateTime(row.actual_check_out),
      discountPct: toNumber(row.discount_pct),
      discountApplied: asText(row.discount_applied || 'No'),
      netAmount: toNumber(row.net_amount),
      channel: asText(row.channel),
      paymentStatus: asText(row.payment_status),
      rrrNumber: asText(row.rrr_number),
      lateCheckout: asText(row.late_checkout || 'No'),
      lateCheckoutAmount: toNumber(row.late_checkout_amount),
      lateCheckoutReceipt: asText(row.late_checkout_receipt),
      lateCheckoutReceiptName: asText(row.late_checkout_receipt_name),
      status: asText(row.status),
      notes: asText(row.notes),
      createdAt: formatDateTime(row.created_at),
      updatedAt: formatDateTime(row.updated_at)
    }));
}

function rows(table, orderBy) {
  return getDb().prepare(`SELECT * FROM ${table} ${orderBy || ''}`).all();
}

function getHousekeepingHistory() {
  return rows('HousekeepingHistory', 'ORDER BY date_time DESC').map((row) => ({
    logId: asText(row.log_id),
    roomNo: asText(row.room),
    previousStatus: asText(row.previous_status),
    newStatus: asText(row.new_status),
    changedBy: asText(row.changed_by),
    dateTime: formatDateTime(row.date_time),
    cleaningCount: toNumber(row.cleaning_count),
    note: asText(row.note)
  }));
}

function getMaintenanceHistory() {
  return rows('MaintenanceHistory', 'ORDER BY date_added DESC').map((row) => ({
    logId: asText(row.log_id),
    roomNo: asText(row.room),
    maintenanceNote: asText(row.maintenance_note),
    dateAdded: formatDateTime(row.date_added),
    status: asText(row.status),
    actionBy: asText(row.action_by),
    resolvedAt: formatDateTime(row.resolved_at),
    resolvedBy: asText(row.resolved_by)
  }));
}

function getCleaningHistory() {
  return rows('CleaningHistory', 'ORDER BY started_at DESC').map((row) => ({
    sessionId: asText(row.session_id),
    roomNo: asText(row.room),
    status: asText(row.status),
    startedAt: formatDateTime(row.started_at),
    startedBy: asText(row.started_by),
    joinedBy: asText(row.joined_by),
    joinTimes: asText(row.join_times),
    finishedAt: formatDateTime(row.finished_at),
    finishedBy: asText(row.finished_by),
    durationMins: asText(row.duration_mins),
    cleaningNote: asText(row.cleaning_note),
    actionBy: asText(row.action_by)
  }));
}

function getPaymentHistory() {
  return rows('PaymentHistory', 'ORDER BY payment_date DESC').map((row) => ({
    paymentId: asText(row.payment_id),
    resId: asText(row.res_id),
    guestName: asText(row.guest_name),
    roomNo: asText(row.room_no),
    paymentType: asText(row.payment_type),
    amount: toNumber(row.amount),
    rrrNumber: asText(row.rrr_number),
    paymentDate: formatDateTime(row.payment_date),
    actionBy: asText(row.action_by),
    note: asText(row.note),
    receipt: asText(row.receipt),
    receiptName: asText(row.receipt_name)
  }));
}

function getNonRoomAreas() {
  return rows('NonRoomAreas', 'ORDER BY area').map((row) => ({
    area: asText(row.area),
    status: asText(row.status),
    lastCleaned: formatDateTime(row.last_cleaned),
    lastResetDate: asText(row.last_reset_date)
  }));
}

function getNonRoomHousekeepingHistory() {
  return rows('NonRoomHousekeepingHistory', 'ORDER BY date_time DESC').map((row) => ({
    logId: asText(row.log_id),
    area: asText(row.area),
    previousStatus: asText(row.previous_status),
    newStatus: asText(row.new_status),
    changedBy: asText(row.changed_by),
    dateTime: formatDateTime(row.date_time),
    cleaningCount: toNumber(row.cleaning_count),
    note: asText(row.note)
  }));
}

function getNonRoomCleaningHistory() {
  return rows('NonRoomCleaningHistory', 'ORDER BY started_at DESC').map((row) => ({
    sessionId: asText(row.session_id),
    area: asText(row.area),
    status: asText(row.status),
    startedAt: formatDateTime(row.started_at),
    startedBy: asText(row.started_by),
    joinedBy: asText(row.joined_by),
    joinTimes: asText(row.join_times),
    finishedAt: formatDateTime(row.finished_at),
    finishedBy: asText(row.finished_by),
    durationMins: asText(row.duration_mins),
    cleaningNote: asText(row.cleaning_note),
    actionBy: asText(row.action_by)
  }));
}

function getNonRoomMaintenanceHistory() {
  return rows('NonRoomMaintenanceHistory', 'ORDER BY date_added DESC').map((row) => ({
    logId: asText(row.log_id),
    area: asText(row.area),
    maintenanceNote: asText(row.maintenance_note),
    dateAdded: formatDateTime(row.date_added),
    status: asText(row.status),
    actionBy: asText(row.action_by),
    resolvedAt: formatDateTime(row.resolved_at),
    resolvedBy: asText(row.resolved_by)
  }));
}

function getChannels() {
  return rows('Channels', 'ORDER BY channel').map((row) => row.channel).filter(Boolean);
}

function getActiveRoles() {
  return getDb()
    .prepare("SELECT role_name FROM Roles WHERE lower(status) = 'active' ORDER BY role_name")
    .all()
    .map((row) => row.role_name)
    .filter(Boolean);
}

function getDashboard() {
  const rooms = getRoomsData();
  const reservations = getReservations();
  return {
    totalRooms: rooms.length,
    occupied: rooms.filter((room) => room.status.toLowerCase() === 'occupied').length,
    reserved: reservations.filter((reservation) => reservation.status === 'Reserved').length,
    dirty: rooms.filter((room) => room.housekeepingStatus.toLowerCase() === 'dirty').length
  };
}

function requireUser() {
  if (!currentUser) throw new Error('Session expired. Please log in again.');
  return currentUser;
}

function actor() {
  const user = requireUser();
  return user.fullName || user.username;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function appendNote(notes, extra) {
  const a = String(notes || '').trim();
  const b = String(extra || '').trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} | ${b}`;
}

function nightsBetween(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function isFreePrStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return value === 'free/pr' || value === 'pr(free)' || value === 'free' || value === 'pr';
}

function makeId(prefix, table, idColumn) {
  const database = getDb();
  for (let i = 0; i < 1000; i += 1) {
    const next = database.prepare(`SELECT COUNT(*) + 1 AS n FROM ${table}`).get().n + i;
    const id = `${prefix}${String(next).padStart(4, '0')}`;
    const found = database.prepare(`SELECT 1 FROM ${table} WHERE ${idColumn} = ?`).get(id);
    if (!found) return id;
  }
  return `${prefix}${Date.now()}`;
}

function okWithBootstrap(message) {
  enqueueAllTables();
  return { ok: true, message, data: getAppBootstrap() };
}

function getReservationRow(resId) {
  return getDb().prepare('SELECT * FROM Reservations WHERE res_id = ?').get(resId);
}

function getRoom(rowOrNo) {
  const roomNo = typeof rowOrNo === 'string' ? rowOrNo : rowOrNo.room_no;
  return getDb().prepare('SELECT * FROM Rooms WHERE room_no = ?').get(roomNo);
}

function apartmentRooms(unitNo) {
  return getDb().prepare('SELECT * FROM Rooms WHERE apartment_group = ? ORDER BY room_no').all(unitNo);
}

function reservationActionRooms(unitNo) {
  const grouped = apartmentRooms(unitNo);
  return grouped.length ? grouped.map((room) => room.room_no) : [String(unitNo)];
}

function isReservationConflict(unitNo, checkIn, checkOut, excludeResId) {
  const reqStart = new Date(`${checkIn}T00:00:00`);
  const reqEnd = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(reqStart.getTime()) || Number.isNaN(reqEnd.getTime())) throw new Error('Invalid reservation dates.');
  if (reqEnd <= reqStart) throw new Error('Check-out date must be after check-in date.');

  const rooms = getRoomsData();
  const grouped = rooms.filter((room) => String(room.apartmentGroup || '') === String(unitNo)).map((room) => room.roomNo);
  const selectedRoom = rooms.find((room) => String(room.roomNo) === String(unitNo));
  const rows = getDb()
    .prepare("SELECT * FROM Reservations WHERE status IN ('Reserved', 'Checked In')")
    .all();

  return rows.some((row) => {
    if (excludeResId && String(row.res_id) === String(excludeResId)) return false;
    const start = new Date(`${formatDateOnly(row.check_in)}T00:00:00`);
    const end = new Date(`${formatDateOnly(row.check_out)}T00:00:00`);
    if (!(reqStart < end && reqEnd > start)) return false;

    const reservedUnit = String(row.room_no || '');
    if (grouped.length) return grouped.includes(reservedUnit) || reservedUnit === String(unitNo);
    if (reservedUnit === String(unitNo)) return true;
    return Boolean(selectedRoom && selectedRoom.apartmentGroup && reservedUnit === selectedRoom.apartmentGroup);
  });
}

function updateActionRoomStatuses(unitNo, updates) {
  const database = getDb();
  reservationActionRooms(unitNo).forEach((roomNo) => {
    const current = getRoom(roomNo);
    if (!current) return;
    database
      .prepare(`
        UPDATE Rooms
        SET status = ?, housekeeping_status = ?, maintenance_status = ?, last_cleaned = ?
        WHERE room_no = ?
      `)
      .run(
        updates.status || current.status,
        updates.housekeepingStatus || current.housekeeping_status,
        updates.maintenanceStatus || current.maintenance_status,
        updates.lastCleaned || current.last_cleaned,
        roomNo
      );
  });
}

function upsertReservationPayment(row, paymentStatus, rrrNumber) {
  if (paymentStatus !== 'Paid' && paymentStatus !== 'Part Paid') return;
  const database = getDb();
  const existing = database
    .prepare("SELECT payment_id FROM PaymentHistory WHERE res_id = ? AND payment_type = 'Reservation Payment'")
    .get(row.res_id);
  const paymentId = existing ? existing.payment_id : makeId('PAY', 'PaymentHistory', 'payment_id');
  database
    .prepare(`
      INSERT INTO PaymentHistory
        (payment_id, res_id, guest_name, room_no, payment_type, amount, rrr_number, payment_date, action_by, note, receipt, receipt_name)
      VALUES (?, ?, ?, ?, 'Reservation Payment', ?, ?, ?, ?, ?, '', '')
      ON CONFLICT(payment_id) DO UPDATE SET
        guest_name = excluded.guest_name,
        room_no = excluded.room_no,
        amount = excluded.amount,
        rrr_number = excluded.rrr_number,
        payment_date = excluded.payment_date,
        action_by = excluded.action_by,
        note = excluded.note
    `)
    .run(paymentId, row.res_id, row.guest_name, row.room_no, row.net_amount, rrrNumber || '', nowIso(), actor(), paymentStatus);
}

function bookingPatch(resId, updates) {
  const row = getDb().prepare('SELECT * FROM BookingHistory WHERE res_id = ?').get(resId);
  if (!row) return;
  getDb()
    .prepare(`
      UPDATE BookingHistory SET
        status = ?,
        actual_check_out = ?,
        payment_status = ?,
        rrr_number = ?,
        late_checkout = ?,
        late_checkout_amount = ?,
        late_checkout_receipt = ?,
        late_checkout_receipt_name = ?,
        notes = ?,
        updated_at = ?
      WHERE res_id = ?
    `)
    .run(
      updates.status || row.status,
      updates.actualCheckout || row.actual_check_out,
      updates.paymentStatus || row.payment_status,
      updates.rrrNumber === undefined ? row.rrr_number : updates.rrrNumber,
      updates.lateCheckout || row.late_checkout,
      updates.lateCheckoutAmount === undefined ? row.late_checkout_amount : updates.lateCheckoutAmount,
      updates.lateCheckoutReceipt === undefined ? row.late_checkout_receipt : updates.lateCheckoutReceipt,
      updates.lateCheckoutReceiptName === undefined ? row.late_checkout_receipt_name : updates.lateCheckoutReceiptName,
      updates.extraNote ? appendNote(row.notes, updates.extraNote) : (updates.notes === undefined ? row.notes : updates.notes),
      nowIso(),
      resId
    );
}

function validateReservation(payload) {
  if (!payload || !String(payload.guestName || '').trim()) throw new Error('Guest name is required.');
  if (!payload.roomNo) throw new Error('Please select a room or apartment.');
  if (!payload.checkIn || !payload.checkOut) throw new Error('Check-in and check-out dates are required.');
  if (Number(payload.adults || 0) > 2) throw new Error('Not allowed by management. Adults cannot be more than 2.');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function reservationEmailHtml(title, data) {
  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <div style="max-width:680px;margin:0 auto;border:1px solid #ddd;border-radius:12px;overflow:hidden">
        <div style="background:#111;color:#fff;padding:20px">
          <h2 style="margin:0">${escapeHtml(getBranding().hotelName)}</h2>
          <div style="margin-top:6px">${escapeHtml(title)}</div>
        </div>
        <div style="padding:22px">
          <p>Dear ${escapeHtml(data.guestName || 'Guest')},</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Reservation ID</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.resId)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Room</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.roomNo)} - ${escapeHtml(data.roomType)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Check In</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.checkIn)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Check Out</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.checkOut)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Amount</strong></td><td style="padding:8px;border:1px solid #ddd">NGN ${Number(data.netAmount || 0).toLocaleString()}</td></tr>
          </table>
          <p>Thank you for choosing ${escapeHtml(getBranding().hotelName)}.</p>
        </div>
      </div>
    </div>
  `;
}

function queueReservationEmail(title, row) {
  if (!row || !String(row.email || '').trim()) return;
  queueEmail({
    recipient: row.email,
    subject: `${title} - ${row.res_id}`,
    htmlBody: reservationEmailHtml(title, {
      resId: row.res_id,
      guestName: row.guest_name,
      roomNo: row.room_no,
      roomType: row.room_type,
      checkIn: formatDateOnly(row.check_in),
      checkOut: formatDateOnly(row.check_out),
      netAmount: row.net_amount
    })
  });
}

function reservationAmounts(payload) {
  const grouped = apartmentRooms(payload.roomNo);
  const isApartmentBooking = grouped.length > 0;
  const primary = isApartmentBooking ? grouped[0] : getRoom(payload.roomNo);
  if (!primary) throw new Error('Room not found.');
  const paymentStatus = payload.paymentStatus || 'Unpaid';
  const baseRate = isApartmentBooking ? 300000 : Number(primary.rate || 0);
  const rate = isFreePrStatus(paymentStatus) ? 0 : baseRate;
  const nights = nightsBetween(payload.checkIn, payload.checkOut);
  const discountPct = Number(payload.discountPct || 0);
  const netAmount = isFreePrStatus(paymentStatus) ? 0 : Math.round((rate * nights) * (1 - discountPct / 100));
  return {
    roomType: isApartmentBooking ? `Apartment - ${payload.roomNo}` : (primary.room_type || ''),
    rate,
    nights,
    netAmount
  };
}

function createReservationLocal(payload) {
  try {
    validateReservation(payload);
    if (isReservationConflict(payload.roomNo, payload.checkIn, payload.checkOut)) throw new Error('Selected room or apartment is not available for those dates.');
    const totals = reservationAmounts(payload);
    const resId = makeId('RES', 'Reservations', 'res_id');
    const userName = actor();
    const database = getDb();
    const paymentStatus = payload.paymentStatus || 'Unpaid';
    const createdAt = nowIso();
    const discountPct = Number(payload.discountPct || 0);
    database.prepare(`
      INSERT INTO Reservations
        (res_id, guest_name, phone, email, room_no, room_type, check_in, check_out, nights, adults, rate, discount_pct, net_amount, channel, status, payment_status, rrr_number, action_by, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Reserved', ?, ?, ?, ?, ?)
    `).run(resId, payload.guestName, payload.phone || '', payload.email || '', payload.roomNo, totals.roomType, payload.checkIn, payload.checkOut, totals.nights, Number(payload.adults || 1), totals.rate, discountPct, totals.netAmount, payload.channel || 'Walk-in', paymentStatus, payload.rrrNumber || '', userName, payload.notes || '', createdAt);
    database.prepare(`
      INSERT INTO BookingHistory
        (res_id, guest_name, phone, email, room_no, room_type, check_in, check_out, nights, adults, rate, discount_pct, discount_applied, net_amount, channel, status, payment_status, rrr_number, late_checkout, late_checkout_amount, action_by, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Reserved', ?, ?, 'No', 0, ?, ?, ?, ?)
    `).run(resId, payload.guestName, payload.phone || '', payload.email || '', payload.roomNo, totals.roomType, payload.checkIn, payload.checkOut, totals.nights, Number(payload.adults || 1), totals.rate, discountPct, discountPct > 0 ? 'Yes' : 'No', totals.netAmount, payload.channel || 'Walk-in', paymentStatus, payload.rrrNumber || '', userName, payload.notes || '', createdAt, createdAt);
    const row = getReservationRow(resId);
    upsertReservationPayment(row, paymentStatus, payload.rrrNumber || '');
    queueReservationEmail('Reservation Confirmation', row);
    audit('Create Reservation', currentUser.username, `${resId} created`);
    return okWithBootstrap('Reservation created successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function updateReservationLocal(resId, payload) {
  try {
    validateReservation(payload);
    const current = getReservationRow(resId);
    if (!current) throw new Error('Reservation not found.');
    if (!['Reserved', 'Checked In'].includes(current.status)) throw new Error('Only reserved or checked-in bookings can be edited.');
    if (isReservationConflict(payload.roomNo, payload.checkIn, payload.checkOut, resId)) throw new Error('Selected room or apartment is not available for those dates.');
    const totals = reservationAmounts(payload);
    const paymentStatus = payload.paymentStatus || 'Unpaid';
    const discountPct = Number(payload.discountPct || 0);
    getDb().prepare(`
      UPDATE Reservations SET
        guest_name = ?, phone = ?, email = ?, room_no = ?, room_type = ?, check_in = ?, check_out = ?,
        nights = ?, adults = ?, rate = ?, discount_pct = ?, net_amount = ?, channel = ?,
        payment_status = ?, rrr_number = ?, notes = ?
      WHERE res_id = ?
    `).run(payload.guestName, payload.phone || '', payload.email || '', payload.roomNo, totals.roomType, payload.checkIn, payload.checkOut, totals.nights, Number(payload.adults || 1), totals.rate, discountPct, totals.netAmount, payload.channel || 'Walk-in', paymentStatus, payload.rrrNumber || '', payload.notes || '', resId);
    getDb().prepare(`
      UPDATE BookingHistory SET
        guest_name = ?, phone = ?, email = ?, room_no = ?, room_type = ?, check_in = ?, check_out = ?,
        nights = ?, adults = ?, rate = ?, discount_pct = ?, discount_applied = ?, net_amount = ?, channel = ?,
        payment_status = ?, rrr_number = ?, notes = ?, updated_at = ?
      WHERE res_id = ?
    `).run(payload.guestName, payload.phone || '', payload.email || '', payload.roomNo, totals.roomType, payload.checkIn, payload.checkOut, totals.nights, Number(payload.adults || 1), totals.rate, discountPct, discountPct > 0 ? 'Yes' : 'No', totals.netAmount, payload.channel || 'Walk-in', paymentStatus, payload.rrrNumber || '', payload.notes || '', nowIso(), resId);
    upsertReservationPayment(getReservationRow(resId), paymentStatus, payload.rrrNumber || '');
    queueReservationEmail('Reservation Updated', getReservationRow(resId));
    audit('Update Reservation', currentUser.username, `${resId} updated`);
    return okWithBootstrap('Reservation updated successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function processReservationActionLocal(resId, action) {
  try {
    requireUser();
    const row = getReservationRow(resId);
    if (!row) throw new Error('Reservation not found.');
    if (action === 'Check In') {
      getDb().prepare("UPDATE Reservations SET status = 'Checked In' WHERE res_id = ?").run(resId);
      updateActionRoomStatuses(row.room_no, { status: 'Occupied' });
      bookingPatch(resId, { status: 'Checked In' });
    } else if (action === 'Check Out') {
      const actual = nowIso();
      getDb().prepare("UPDATE Reservations SET status = 'Checked Out' WHERE res_id = ?").run(resId);
      updateActionRoomStatuses(row.room_no, { status: 'Vacant', housekeepingStatus: 'Dirty' });
      const late = new Date(actual).getTime() > new Date(`${formatDateOnly(row.check_out)}T13:00:00`).getTime();
      bookingPatch(resId, { status: 'Checked Out', actualCheckout: actual, lateCheckout: late ? 'Yes' : 'No' });
    } else if (action === 'Cancel') {
      getDb().prepare("UPDATE Reservations SET status = 'Cancelled' WHERE res_id = ?").run(resId);
      bookingPatch(resId, { status: 'Cancelled' });
    } else {
      throw new Error('Unsupported reservation action.');
    }
    audit(action, currentUser.username, `${resId} ${action}`);
    return okWithBootstrap(`${action} completed.`);
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function extendStayLocal(payload) {
  try {
    const row = getReservationRow(payload.resId);
    if (!row) throw new Error('Reservation not found');
    if (row.status !== 'Checked In') throw new Error('Only checked-in guests can extend stay.');
    if (new Date(payload.newCheckOut) <= new Date(row.check_out)) throw new Error('New checkout date must be after current checkout date.');
    if (isReservationConflict(row.room_no, formatDateOnly(row.check_out), payload.newCheckOut, payload.resId)) throw new Error('Cannot extend stay because the room/apartment is already reserved for the extended dates.');
    const newNights = nightsBetween(row.check_in, payload.newCheckOut);
    const newNet = isFreePrStatus(row.payment_status) ? 0 : Math.round((Number(row.rate || 0) * newNights) * (1 - Number(row.discount_pct || 0) / 100));
    const additional = Math.max(0, newNet - Number(row.net_amount || 0));
    const rrr = payload.rrrNumber || row.rrr_number || '';
    getDb().prepare('UPDATE Reservations SET check_out = ?, nights = ?, net_amount = ?, rrr_number = ? WHERE res_id = ?').run(payload.newCheckOut, newNights, newNet, rrr, payload.resId);
    getDb().prepare('UPDATE BookingHistory SET check_out = ?, nights = ?, net_amount = ?, rrr_number = ?, notes = ?, updated_at = ? WHERE res_id = ?').run(payload.newCheckOut, newNights, newNet, rrr, appendNote(row.notes, `Stay extended to ${payload.newCheckOut}`), nowIso(), payload.resId);
    if (additional > 0) {
      getDb().prepare(`
        INSERT INTO PaymentHistory (payment_id, res_id, guest_name, room_no, payment_type, amount, rrr_number, payment_date, action_by, note)
        VALUES (?, ?, ?, ?, 'Extension Payment', ?, ?, ?, ?, ?)
      `).run(makeId('PAY', 'PaymentHistory', 'payment_id'), payload.resId, row.guest_name, row.room_no, additional, rrr, nowIso(), actor(), `Extended stay to ${payload.newCheckOut}`);
    }
    audit('Extend Stay', currentUser.username, `${payload.resId} extended`);
    return okWithBootstrap('Stay extended successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function applyLateCheckoutLocal(payload) {
  try {
    const row = getReservationRow(payload.resId);
    if (!row) throw new Error('Reservation not found');
    if (row.status !== 'Checked In') throw new Error('Late checkout can only be added for checked-in guests.');
    const existing = getDb().prepare("SELECT 1 FROM PaymentHistory WHERE res_id = ? AND payment_type = 'Late Checkout Payment'").get(payload.resId);
    if (existing) throw new Error('Late checkout payment has already been recorded for this reservation.');
    const amount = Number(payload.amount || 0);
    if (amount <= 0) throw new Error('Invalid late checkout amount.');
    const rrr = payload.rrrNumber || row.rrr_number || '';
    getDb().prepare('UPDATE Reservations SET notes = ?, rrr_number = ? WHERE res_id = ?').run(appendNote(row.notes, 'Late checkout payment recorded'), rrr, payload.resId);
    bookingPatch(payload.resId, { lateCheckout: 'Yes', lateCheckoutAmount: amount, rrrNumber: rrr, extraNote: appendNote('Late checkout payment recorded', payload.note || '') });
    getDb().prepare(`
      INSERT INTO PaymentHistory (payment_id, res_id, guest_name, room_no, payment_type, amount, rrr_number, payment_date, action_by, note)
      VALUES (?, ?, ?, ?, 'Late Checkout Payment', ?, ?, ?, ?, ?)
    `).run(makeId('PAY', 'PaymentHistory', 'payment_id'), payload.resId, row.guest_name, row.room_no, amount, rrr, nowIso(), actor(), payload.note || 'Late checkout payment');
    audit('Late Checkout Payment', currentUser.username, `${payload.resId} late checkout payment recorded`);
    return okWithBootstrap('Late checkout payment saved successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function updatePaymentLocal(payload) {
  try {
    const row = getReservationRow(payload.resId);
    if (!row) throw new Error('Reservation not found.');
    const status = String(payload.paymentStatus || 'Unpaid');
    const rrr = String(payload.rrrNumber || '').trim();
    const rate = isFreePrStatus(status) ? 0 : row.rate;
    const net = isFreePrStatus(status) ? 0 : row.net_amount;
    getDb().prepare('UPDATE Reservations SET payment_status = ?, rrr_number = ?, rate = ?, net_amount = ? WHERE res_id = ?').run(status, rrr, rate, net, payload.resId);
    getDb().prepare('UPDATE BookingHistory SET payment_status = ?, rrr_number = ?, rate = ?, net_amount = ?, notes = ?, updated_at = ? WHERE res_id = ?').run(status, rrr, rate, net, isFreePrStatus(status) ? appendNote(row.notes, 'Marked as Free/PR') : row.notes, nowIso(), payload.resId);
    upsertReservationPayment({ ...row, payment_status: status, rrr_number: rrr, rate, net_amount: net }, status, rrr);
    audit('Update Payment', currentUser.username, `${payload.resId} payment updated`);
    return okWithBootstrap('Payment updated successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function addHousekeepingLog(roomNo, previous, next, by, note) {
  const cleanCount = getDb().prepare("SELECT COUNT(*) AS n FROM HousekeepingHistory WHERE room = ? AND lower(new_status) = 'clean'").get(roomNo).n + (String(next).toLowerCase() === 'clean' ? 1 : 0);
  getDb().prepare(`
    INSERT INTO HousekeepingHistory (log_id, room, previous_status, new_status, changed_by, date_time, cleaning_count, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(makeId('HK', 'HousekeepingHistory', 'log_id'), roomNo, previous || '', next || '', by || actor(), nowIso(), cleanCount, note || '');
}

function updateRoomHousekeepingLocal(roomNo, status) {
  try {
    const room = getRoom(roomNo);
    if (!room) throw new Error('Room not found.');
    getDb().prepare('UPDATE Rooms SET housekeeping_status = ? WHERE room_no = ?').run(status, roomNo);
    addHousekeepingLog(roomNo, room.housekeeping_status, status, actor(), '');
    if (String(status).toLowerCase() === 'cleaning in progress') {
      const open = getDb().prepare("SELECT 1 FROM CleaningHistory WHERE room = ? AND status = 'In Progress'").get(roomNo);
      if (!open) {
        getDb().prepare(`
          INSERT INTO CleaningHistory (session_id, room, status, started_at, started_by, action_by)
          VALUES (?, ?, 'In Progress', ?, ?, ?)
        `).run(makeId('CLN', 'CleaningHistory', 'session_id'), roomNo, nowIso(), actor(), actor());
      }
    }
    audit('Room Housekeeping', currentUser.username, `${roomNo} -> ${status}`);
    return okWithBootstrap('Room housekeeping updated.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function addAiredLogLocal(roomNo, note) {
  try {
    const room = getRoom(roomNo);
    if (!room) throw new Error('Room not found.');
    addHousekeepingLog(roomNo, room.housekeeping_status, room.housekeeping_status, actor(), note || 'Room aired');
    return okWithBootstrap('Room marked as aired.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function joinCleaningLocal(table, keyCol, keyVal, label) {
  try {
    const session = getDb().prepare(`SELECT * FROM ${table} WHERE ${keyCol} = ? AND status = 'In Progress'`).get(keyVal);
    if (!session) throw new Error(`No active cleaning session for this ${label}.`);
    const who = actor();
    const joined = String(session.joined_by || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (session.started_by === who || joined.includes(who)) throw new Error('You have already joined this cleaning session.');
    joined.push(who);
    const joinTimes = appendNote(session.join_times, `${who}@${formatDateTime(nowIso())}`);
    getDb().prepare(`UPDATE ${table} SET joined_by = ?, join_times = ?, action_by = ? WHERE session_id = ?`).run(joined.join(', '), joinTimes, who, session.session_id);
    return okWithBootstrap('Joined cleaning successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function finishRoomCleaningLocal(roomNo, note) {
  try {
    const session = getDb().prepare("SELECT * FROM CleaningHistory WHERE room = ? AND status = 'In Progress'").get(roomNo);
    if (!session) throw new Error('No active cleaning session for this room.');
    const duration = Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000));
    getDb().prepare("UPDATE CleaningHistory SET status = 'Finished', finished_at = ?, finished_by = ?, duration_mins = ?, cleaning_note = ?, action_by = ? WHERE session_id = ?").run(nowIso(), actor(), duration, note || '', actor(), session.session_id);
    getDb().prepare("UPDATE Rooms SET housekeeping_status = 'Clean', last_cleaned = ? WHERE room_no = ?").run(nowIso(), roomNo);
    addHousekeepingLog(roomNo, 'Cleaning In Progress', 'Clean', actor(), note || '');
    return okWithBootstrap('Room cleaning completed.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function createNonRoomAreaLocal(payload) {
  try {
    const area = String(payload && payload.area || '').trim();
    if (!area) throw new Error('Area name is required.');
    getDb().prepare("INSERT INTO NonRoomAreas (area, status) VALUES (?, 'Dirty')").run(area);
    return okWithBootstrap('New area added successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function addNonRoomHousekeepingLog(area, previous, next, note) {
  const cleanCount = getDb().prepare("SELECT COUNT(*) AS n FROM NonRoomHousekeepingHistory WHERE area = ? AND lower(new_status) = 'clean'").get(area).n + (String(next).toLowerCase() === 'clean' ? 1 : 0);
  getDb().prepare(`
    INSERT INTO NonRoomHousekeepingHistory (log_id, area, previous_status, new_status, changed_by, date_time, cleaning_count, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(makeId('NHK', 'NonRoomHousekeepingHistory', 'log_id'), area, previous || '', next || '', actor(), nowIso(), cleanCount, note || '');
}

function startNonRoomCleaningLocal(area) {
  try {
    const row = getDb().prepare('SELECT * FROM NonRoomAreas WHERE area = ?').get(area);
    if (!row) throw new Error('Area not found.');
    const open = getDb().prepare("SELECT 1 FROM NonRoomCleaningHistory WHERE area = ? AND status = 'In Progress'").get(area);
    if (open) throw new Error('Cleaning is already in progress for this area.');
    getDb().prepare("INSERT INTO NonRoomCleaningHistory (session_id, area, status, started_at, started_by, action_by) VALUES (?, ?, 'In Progress', ?, ?, ?)").run(makeId('NCL', 'NonRoomCleaningHistory', 'session_id'), area, nowIso(), actor(), actor());
    getDb().prepare("UPDATE NonRoomAreas SET status = 'Cleaning In Progress' WHERE area = ?").run(area);
    addNonRoomHousekeepingLog(area, row.status, 'Cleaning In Progress', 'Cleaning started');
    return okWithBootstrap('Cleaning started.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function updateNonRoomHousekeepingLocal(area, status, note) {
  try {
    const row = getDb().prepare('SELECT * FROM NonRoomAreas WHERE area = ?').get(area);
    if (!row) throw new Error('Area not found');
    const clean = String(status).toLowerCase() === 'clean';
    getDb().prepare('UPDATE NonRoomAreas SET status = ?, last_cleaned = ?, last_reset_date = ? WHERE area = ?').run(status, clean ? nowIso() : row.last_cleaned, clean ? todayIso() : row.last_reset_date, area);
    addNonRoomHousekeepingLog(area, row.status, status, note || '');
    return okWithBootstrap('Area updated successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function finishNonRoomCleaningLocal(area, note) {
  try {
    const session = getDb().prepare("SELECT * FROM NonRoomCleaningHistory WHERE area = ? AND status = 'In Progress'").get(area);
    if (!session) throw new Error('No active cleaning session for this area.');
    const duration = Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000));
    getDb().prepare("UPDATE NonRoomCleaningHistory SET status = 'Finished', finished_at = ?, finished_by = ?, duration_mins = ?, cleaning_note = ?, action_by = ? WHERE session_id = ?").run(nowIso(), actor(), duration, note || '', actor(), session.session_id);
    return updateNonRoomHousekeepingLocal(area, 'Clean', note || '');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function createMaintenanceLogLocal(payload) {
  try {
    getDb().prepare(`
      INSERT INTO MaintenanceHistory (log_id, room, maintenance_note, date_added, status, action_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(makeId('MNT', 'MaintenanceHistory', 'log_id'), payload.roomNo, payload.note || '', nowIso(), payload.status || 'Not Resolved', actor());
    getDb().prepare('UPDATE Rooms SET maintenance_status = ? WHERE room_no = ?').run(payload.status === 'Resolved' ? 'Resolved' : 'Not Resolved', payload.roomNo);
    return okWithBootstrap('Maintenance log created.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function resolveMaintenanceLogLocal(logId, status) {
  try {
    const row = getDb().prepare('SELECT * FROM MaintenanceHistory WHERE log_id = ?').get(logId);
    if (!row) throw new Error('Maintenance log not found.');
    getDb().prepare('UPDATE MaintenanceHistory SET status = ?, resolved_at = ?, resolved_by = ? WHERE log_id = ?').run(status, nowIso(), actor(), logId);
    getDb().prepare('UPDATE Rooms SET maintenance_status = ? WHERE room_no = ?').run(status === 'Resolved' ? 'Resolved' : 'Not Resolved', row.room);
    return okWithBootstrap('Maintenance updated.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function createNonRoomMaintenanceLogLocal(payload) {
  try {
    if (!payload.area) throw new Error('Area is required.');
    if (!payload.note) throw new Error('Maintenance note is required.');
    getDb().prepare(`
      INSERT INTO NonRoomMaintenanceHistory (log_id, area, maintenance_note, date_added, status, action_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(makeId('NRM', 'NonRoomMaintenanceHistory', 'log_id'), payload.area, payload.note || '', nowIso(), payload.status || 'Not Resolved', actor());
    return okWithBootstrap('Non-room maintenance log created.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function resolveNonRoomMaintenanceLogLocal(logId, status) {
  try {
    const found = getDb().prepare('SELECT 1 FROM NonRoomMaintenanceHistory WHERE log_id = ?').get(logId);
    if (!found) throw new Error('Non-room maintenance log not found.');
    getDb().prepare('UPDATE NonRoomMaintenanceHistory SET status = ?, resolved_at = ?, resolved_by = ? WHERE log_id = ?').run(status, nowIso(), actor(), logId);
    return okWithBootstrap('Non-room maintenance updated.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function createUserLocal(payload) {
  try {
    const user = requireUser();
    if (user.role !== 'Admin') throw new Error('Only admin can create users.');
    if (!payload.username || !payload.password || !payload.fullName || !payload.role) throw new Error('All user fields are required.');
    getDb().prepare('INSERT INTO Users (user_id, username, password, full_name, role, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(makeId('U', 'Users', 'user_id'), payload.username.trim(), payload.password, payload.fullName.trim(), payload.role, 'Active');
    return okWithBootstrap('User created successfully.');
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function checkoutReceiptData(resId) {
  const row = getDb().prepare('SELECT * FROM BookingHistory WHERE res_id = ?').get(resId);
  if (!row) throw new Error('Booking history record not found.');
  const payments = getPaymentHistory().filter((payment) => payment.resId === resId);
  return {
    resId: row.res_id,
    guestName: row.guest_name,
    phone: row.phone,
    email: row.email,
    roomNo: row.room_no,
    roomType: row.room_type,
    checkIn: formatDateOnly(row.check_in),
    checkOut: formatDateOnly(row.check_out),
    actualCheckout: formatDateTime(row.actual_check_out),
    nights: toNumber(row.nights),
    adults: toNumber(row.adults),
    rate: toNumber(row.rate),
    discountPct: toNumber(row.discount_pct),
    netAmount: toNumber(row.net_amount),
    lateCheckoutAmount: toNumber(row.late_checkout_amount),
    totalPaid: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    paymentStatus: row.payment_status,
    rrrNumber: row.rrr_number,
    payments
  };
}

function checkoutReceiptEmailHtml(data) {
  const paymentRows = (data.payments || []).map((payment) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd">${escapeHtml(payment.paymentType)}</td>
      <td style="padding:8px;border:1px solid #ddd">NGN ${Number(payment.amount || 0).toLocaleString()}</td>
      <td style="padding:8px;border:1px solid #ddd">${escapeHtml(payment.paymentDate)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <div style="max-width:760px;margin:0 auto;border:1px solid #ddd;border-radius:12px;overflow:hidden">
        <div style="background:#111;color:#fff;padding:20px">
          <h2 style="margin:0">${escapeHtml(getBranding().hotelName)}</h2>
          <div style="margin-top:6px">Checkout Receipt</div>
        </div>
        <div style="padding:22px">
          <p>Dear ${escapeHtml(data.guestName || 'Guest')},</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Reservation ID</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.resId)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Room</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.roomNo)} - ${escapeHtml(data.roomType)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Stay</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.checkIn)} to ${escapeHtml(data.checkOut)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Total Paid</strong></td><td style="padding:8px;border:1px solid #ddd">NGN ${Number(data.totalPaid || 0).toLocaleString()}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Payment Status</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.paymentStatus)}</td></tr>
          </table>
          <h3>Payments</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th style="padding:8px;border:1px solid #ddd">Type</th><th style="padding:8px;border:1px solid #ddd">Amount</th><th style="padding:8px;border:1px solid #ddd">Date</th></tr></thead>
            <tbody>${paymentRows || '<tr><td colspan="3" style="padding:8px;border:1px solid #ddd">No payment records</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function simplePdfResponse(title, lines, fileStem) {
  const text = [title, '', ...(lines || [])].join('\n').replace(/[()\\]/g, '\\$&');
  const stream = `BT /F1 12 Tf 50 780 Td (${text.replace(/\n/g, ') Tj 0 -16 Td (')}) Tj ET`;
  const pdf = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF`;
  return {
    ok: true,
    message: 'PDF ready.',
    fileName: `${fileStem}-${todayIso()}.pdf`,
    mimeType: 'application/pdf',
    base64: Buffer.from(pdf, 'utf8').toString('base64'),
    blob: Buffer.from(pdf, 'utf8').toString('base64')
  };
}

async function onlinePdfResponse(title, lines, fileStem) {
  try {
    await dns.lookup('google.com');
  } catch (err) {
    return { ok: false, message: 'Internet connection is required to generate this PDF.' };
  }
  return simplePdfResponse(title, lines, fileStem);
}

function registerApiHandlers() {
  const handlers = {
    checkMailAuthorization: () => {
      const status = getEmailStatus();
      return {
        ok: status.configured,
        queuedDelivery: true,
        message: status.configured
          ? 'Email is configured. Messages will queue offline and send when internet is available.'
          : 'SMTP email is not configured in Admin.'
      };
    },
    createReservation: (_event, payload) => createReservationLocal(payload),
    updateReservation: (_event, resId, payload) => updateReservationLocal(resId, payload),
    processReservationAction: (_event, resId, action) => processReservationActionLocal(resId, action),
    extendStay: (_event, payload) => extendStayLocal(payload),
    applyLateCheckout: (_event, payload) => applyLateCheckoutLocal(payload),
    updatePayment: (_event, payload) => updatePaymentLocal(payload),
    updateRoomHousekeeping: (_event, roomNo, status) => updateRoomHousekeepingLocal(roomNo, status),
    addAiredLog: (_event, roomNo, note) => addAiredLogLocal(roomNo, note),
    joinRoomCleaning: (_event, roomNo) => joinCleaningLocal('CleaningHistory', 'room', roomNo, 'room'),
    finishRoomCleaning: (_event, roomNo, note) => finishRoomCleaningLocal(roomNo, note),
    createNonRoomArea: (_event, payload) => createNonRoomAreaLocal(payload),
    createNonRoomMaintenanceLog: (_event, payload) => createNonRoomMaintenanceLogLocal(payload),
    resolveNonRoomMaintenanceLog: (_event, logId, status) => resolveNonRoomMaintenanceLogLocal(logId, status),
    startNonRoomCleaning: (_event, area) => startNonRoomCleaningLocal(area),
    updateNonRoomHousekeeping: (_event, area, status, note) => updateNonRoomHousekeepingLocal(area, status, note),
    joinNonRoomCleaning: (_event, area) => joinCleaningLocal('NonRoomCleaningHistory', 'area', area, 'area'),
    finishNonRoomCleaning: (_event, area, note) => finishNonRoomCleaningLocal(area, note),
    getCheckoutReceiptData: (_event, resId) => {
      try { return { ok: true, data: checkoutReceiptData(resId) }; } catch (err) { return { ok: false, message: err.message }; }
    },
    buildCheckoutReceiptPdf: async (_event, payload) => {
      try {
        const data = checkoutReceiptData(payload.resId);
        return onlinePdfResponse('Checkout Receipt', [`Reservation: ${data.resId}`, `Guest: ${data.guestName}`, `Room: ${data.roomNo}`, `Total Paid: ${data.totalPaid}`], 'checkout-receipt');
      } catch (err) { return { ok: false, message: err.message }; }
    },
    emailCheckoutReceipt: (_event, payload) => {
      try {
        const data = checkoutReceiptData(payload.resId);
        const recipient = String(payload.email || data.email || '').trim();
        return queueEmail({
          recipient,
          subject: `Checkout Receipt - ${data.resId}`,
          htmlBody: checkoutReceiptEmailHtml(data)
        });
      } catch (err) {
        return { ok: false, message: err.message };
      }
    },
    downloadBookingPaymentReportPdf: (_event, payload) => onlinePdfResponse('Booking and Payment Report', [`Range: ${(payload && payload.startDate) || 'Beginning'} to ${(payload && payload.endDate) || 'Today'}`, `Bookings: ${getBookingHistory().length}`, `Payments: ${getPaymentHistory().length}`], 'booking-payment-report'),
    downloadCleaningReportPdf: () => onlinePdfResponse('Cleaning Report', [`Room sessions: ${getCleaningHistory().length}`, `Non-room sessions: ${getNonRoomCleaningHistory().length}`], 'cleaning-report'),
    downloadFinancialReport: (_event, startDate, endDate) => onlinePdfResponse('Financial Report', [`Range: ${startDate || 'Beginning'} to ${endDate || 'Today'}`, `Payment total: ${getPaymentHistory().reduce((sum, p) => sum + Number(p.amount || 0), 0)}`], 'financial-report'),
    createMaintenanceLog: (_event, payload) => createMaintenanceLogLocal(payload),
    createUser: (_event, payload) => createUserLocal(payload),
    resolveMaintenanceLog: (_event, logId, status) => resolveMaintenanceLogLocal(logId, status)
  };

  Object.entries(handlers).forEach(([name, handler]) => {
    ipcMain.handle(`api:${name}`, handler);
  });
}

function getAppBootstrap() {
  const isHousekeeping = currentUser && currentUser.role === 'Housekeeping';

  return {
    ok: true,
    user: currentUser,
    branding: getBranding(),
    dashboard: getDashboard(),
    rooms: getRoomsData(),
    reservations: isHousekeeping ? [] : getReservations(),
    bookingHistory: isHousekeeping ? [] : getBookingHistory(),
    housekeepingHistory: getHousekeepingHistory(),
    maintenanceHistory: getMaintenanceHistory(),
    cleaningHistory: getCleaningHistory(),
    paymentHistory: isHousekeeping ? [] : getPaymentHistory(),
    nonRoomAreas: getNonRoomAreas(),
    nonRoomHousekeepingHistory: getNonRoomHousekeepingHistory(),
    nonRoomCleaningHistory: getNonRoomCleaningHistory(),
    nonRoomMaintenanceHistory: getNonRoomMaintenanceHistory(),
    users: getUsers(),
    roles: getActiveRoles(),
    channels: getChannels()
  };
}

function registerIpcHandlers() {
  registerApiHandlers();

  ipcMain.handle('sync:getStatus', () => getSyncStatus());
  ipcMain.handle('sync:saveConfig', (_event, payload) => saveConfig(payload || {}));
  ipcMain.handle('sync:enqueueFull', () => {
    enqueueAllTables();
    return getSyncStatus();
  });
  ipcMain.handle('sync:runNow', () => processSyncQueue({ force: true }));
  ipcMain.handle('email:getStatus', () => getEmailStatus());
  ipcMain.handle('email:saveConfig', (_event, payload) => saveEmailConfig(payload || {}));
  ipcMain.handle('email:runNow', () => processEmailQueue({ force: true }));

  ipcMain.handle('auth:login', (_event, username, password) => {
    try {
      const row = getDb()
        .prepare(`
          SELECT user_id, username, full_name, role, status
          FROM Users
          WHERE lower(username) = lower(?)
            AND password = ?
            AND lower(status) = 'active'
        `)
        .get(String(username || '').trim(), String(password || '').trim());

      if (!row) return { ok: false, message: 'Invalid username or password.' };

      currentUser = {
        userId: asText(row.user_id),
        username: asText(row.username),
        fullName: asText(row.full_name || row.username),
        role: asText(row.role),
        status: asText(row.status)
      };

      audit('Login', currentUser.username, 'User logged in');
      return { ok: true, user: currentUser };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  });

  ipcMain.handle('auth:logout', () => {
    if (currentUser) audit('Logout', currentUser.username, 'User logged out');
    currentUser = null;
    return { ok: true };
  });

  ipcMain.handle('app:getBootstrap', () => {
    try {
      return getAppBootstrap();
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
        nonRoomMaintenanceHistory: [],
        users: [],
        roles: [],
        channels: []
      };
    }
  });

  ipcMain.handle('app:getPortalUrl', () => null);
}

module.exports = {
  registerIpcHandlers
};
