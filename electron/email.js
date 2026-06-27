const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const { getDb } = require('./database');

let emailTimer = null;
let emailRunning = false;

function getElectronApp() {
  try {
    const electron = require('electron');
    return electron && electron.app ? electron.app : null;
  } catch (err) {
    return null;
  }
}

function getUserDataPath() {
  const electronApp = getElectronApp();
  return electronApp ? electronApp.getPath('userData') : path.join(__dirname, '..', 'database');
}

function getConfigPath() {
  return process.env.PMS_EMAIL_CONFIG || path.join(getUserDataPath(), 'email-config.json');
}

function setState(key, value) {
  getDb()
    .prepare('INSERT INTO EmailState (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value == null ? '' : value));
}

function getState(key, fallback = '') {
  const row = getDb().prepare('SELECT value FROM EmailState WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function loadEmailConfig() {
  const configPath = getConfigPath();
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  return {
    enabled: String(process.env.PMS_EMAIL_ENABLED || fileConfig.enabled || getState('enabled', 'false')).toLowerCase() === 'true',
    host: process.env.PMS_SMTP_HOST || fileConfig.host || '',
    port: Number(process.env.PMS_SMTP_PORT || fileConfig.port || 587),
    secure: String(process.env.PMS_SMTP_SECURE || fileConfig.secure || 'false').toLowerCase() === 'true',
    username: process.env.PMS_SMTP_USERNAME || fileConfig.username || '',
    password: process.env.PMS_SMTP_PASSWORD || fileConfig.password || '',
    fromName: process.env.PMS_EMAIL_FROM_NAME || fileConfig.fromName || 'NDDC Clubhouse',
    fromAddress: process.env.PMS_EMAIL_FROM_ADDRESS || fileConfig.fromAddress || fileConfig.username || ''
  };
}

function saveEmailConfig(next) {
  const current = loadEmailConfig();
  const config = Object.assign({}, current, next || {});
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  setState('enabled', config.enabled ? 'true' : 'false');
  setState('lastStatus', config.enabled ? 'Waiting to send' : 'Disabled');
  return getEmailStatus();
}

function getEmailStatus() {
  const config = loadEmailConfig();
  const pending = getDb().prepare("SELECT COUNT(*) AS count FROM EmailQueue WHERE status IN ('pending', 'failed')").get().count;
  return {
    ok: true,
    enabled: config.enabled,
    configured: Boolean(config.host && config.port && config.username && config.password && config.fromAddress),
    pending,
    lastStatus: getState('lastStatus', 'Not configured'),
    lastSentAt: getState('lastSentAt', ''),
    lastError: getState('lastError', ''),
    configPath: getConfigPath(),
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.username,
    fromName: config.fromName,
    fromAddress: config.fromAddress
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function queueEmail({ recipient, subject, htmlBody }) {
  const email = String(recipient || '').trim();
  if (!isValidEmail(email)) {
    return { ok: false, message: 'A valid recipient email address is required.' };
  }

  const info = getDb()
    .prepare(`
      INSERT INTO EmailQueue (recipient, subject, html_body, status, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `)
    .run(email, String(subject || ''), String(htmlBody || ''), new Date().toISOString(), new Date().toISOString());

  setState('lastStatus', 'Email queued');
  return {
    ok: true,
    queued: true,
    queueId: Number(info.lastInsertRowid),
    message: 'Email queued and will send automatically when internet is available.'
  };
}

async function hasInternet(host) {
  try {
    await dns.lookup(host || 'google.com');
    return true;
  } catch (err) {
    return false;
  }
}

async function processEmailQueue(options = {}) {
  if (emailRunning) return getEmailStatus();
  const config = loadEmailConfig();
  if (!config.enabled && !options.force) return getEmailStatus();
  if (!config.host || !config.username || !config.password || !config.fromAddress) {
    setState('lastStatus', 'SMTP not configured');
    return getEmailStatus();
  }

  emailRunning = true;
  try {
    if (!(await hasInternet(config.host))) {
      setState('lastStatus', 'Offline - emails remain queued');
      return getEmailStatus();
    }

    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (err) {
      throw new Error('Email dependency is missing. Run npm install.');
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password
      }
    });

    const pending = getDb()
      .prepare("SELECT * FROM EmailQueue WHERE status IN ('pending', 'failed') ORDER BY created_at, id LIMIT 20")
      .all();

    for (const item of pending) {
      try {
        await transporter.sendMail({
          from: `"${String(config.fromName || '').replace(/"/g, '')}" <${config.fromAddress}>`,
          to: item.recipient,
          subject: item.subject,
          html: item.html_body
        });
        getDb()
          .prepare("UPDATE EmailQueue SET status = 'sent', attempts = attempts + 1, last_error = '', updated_at = ?, sent_at = ? WHERE id = ?")
          .run(new Date().toISOString(), new Date().toISOString(), item.id);
        setState('lastSentAt', new Date().toISOString());
      } catch (err) {
        getDb()
          .prepare("UPDATE EmailQueue SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?")
          .run(err.message || String(err), new Date().toISOString(), item.id);
        throw err;
      }
    }

    setState('lastStatus', pending.length ? `Sent ${pending.length} queued email(s)` : 'Nothing to send');
    setState('lastError', '');
    return getEmailStatus();
  } catch (err) {
    setState('lastStatus', 'Email delivery failed');
    setState('lastError', err.message || String(err));
    return getEmailStatus();
  } finally {
    emailRunning = false;
  }
}

function startEmailWorker(intervalMs = 60000) {
  if (emailTimer) return;
  emailTimer = setInterval(() => {
    processEmailQueue().catch(() => {});
  }, intervalMs);
}

function stopEmailWorker() {
  if (!emailTimer) return;
  clearInterval(emailTimer);
  emailTimer = null;
}

module.exports = {
  getEmailStatus,
  processEmailQueue,
  queueEmail,
  saveEmailConfig,
  startEmailWorker,
  stopEmailWorker
};
