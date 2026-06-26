const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  getAppBootstrap: () => invoke('app:getBootstrap'),
  login: (username, password) => invoke('auth:login', username, password),
  logout: () => invoke('auth:logout'),
  getPortalUrl: () => invoke('app:getPortalUrl'),
  checkMailAuthorization: () => invoke('api:checkMailAuthorization'),
  createReservation: (payload) => invoke('api:createReservation', payload),
  updateReservation: (resId, payload) => invoke('api:updateReservation', resId, payload),
  processReservationAction: (resId, action) => invoke('api:processReservationAction', resId, action),
  extendStay: (payload) => invoke('api:extendStay', payload),
  applyLateCheckout: (payload) => invoke('api:applyLateCheckout', payload),
  updateRoomHousekeeping: (roomNo, status) => invoke('api:updateRoomHousekeeping', roomNo, status),
  addAiredLog: (roomNo, note) => invoke('api:addAiredLog', roomNo, note),
  joinRoomCleaning: (roomNo) => invoke('api:joinRoomCleaning', roomNo),
  finishRoomCleaning: (roomNo, note) => invoke('api:finishRoomCleaning', roomNo, note),
  createNonRoomArea: (payload) => invoke('api:createNonRoomArea', payload),
  createNonRoomMaintenanceLog: (payload) => invoke('api:createNonRoomMaintenanceLog', payload),
  resolveNonRoomMaintenanceLog: (logId, status) => invoke('api:resolveNonRoomMaintenanceLog', logId, status),
  startNonRoomCleaning: (area) => invoke('api:startNonRoomCleaning', area),
  updateNonRoomHousekeeping: (area, status, note) => invoke('api:updateNonRoomHousekeeping', area, status, note),
  joinNonRoomCleaning: (area) => invoke('api:joinNonRoomCleaning', area),
  finishNonRoomCleaning: (area, note) => invoke('api:finishNonRoomCleaning', area, note),
  getCheckoutReceiptData: (resId) => invoke('api:getCheckoutReceiptData', resId),
  buildCheckoutReceiptPdf: (payload) => invoke('api:buildCheckoutReceiptPdf', payload),
  emailCheckoutReceipt: (payload) => invoke('api:emailCheckoutReceipt', payload),
  downloadBookingPaymentReportPdf: (payload) => invoke('api:downloadBookingPaymentReportPdf', payload),
  downloadCleaningReportPdf: (payload) => invoke('api:downloadCleaningReportPdf', payload),
  downloadFinancialReport: (startDate, endDate) => invoke('api:downloadFinancialReport', startDate, endDate),
  createMaintenanceLog: (payload) => invoke('api:createMaintenanceLog', payload),
  updatePayment: (payload) => invoke('api:updatePayment', payload),
  createUser: (payload) => invoke('api:createUser', payload),
  resolveMaintenanceLog: (logId, status) => invoke('api:resolveMaintenanceLog', logId, status)
});
