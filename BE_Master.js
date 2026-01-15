/**
 * ============================================================
 * STARKIT MASTER LICENSE ENGINE — v1.4.2 (RESCUE MONITORING)
 * ============================================================
 * Juragan SaaS Sheet [2026-01-15]
 * Focus: Centralized FE Rescue Log & Smart Load Balancing
 */

const MASTER_SHEET_ID = '1Vh6K-5C5Yol1tylr9Ot6tssptzo94_TTDHm_ZqoJd-4';
const LOG_WEBAPP_URL = 'https://script.google.com/macros/s/1s5mR5zmDQYKY934Y8Fvly_WJEGjQVJqvw4M7NEags_M/exec'; 
const SHEET_DATA = 'data';
const SHEET_ENGINES = 'engines';
const SHEET_OVERLOAD = 'logOverload'; // Tab baru untuk audit rescue
const DEFAULT_PASSWORD = 'starkitoye';
const DEFAULT_SALT = 'STARKIT_SALT';

// LOG CONFIG
const ENGINE_ID = 'MASTER-CENTRAL';
const ENGINE_CACHE_KEY = 'engine_log_buffer';
const CACHE = CacheService.getScriptCache();
const MASTER_LOG_SHEET_ID = '1s5mR5zmDQYKY934Y8Fvly_WJEGjQVJqvw4M7NEags_M'; 
const MASTER_LOG_TAB = 'engine_logs';

/**
 * 1. GATEWAY HANDLER (doPost)
 */
function doPost(e) {
  try {
    // 1. Ambil data (FE mengirim text/plain, jadi kita parse manual)
    const p = JSON.parse(e.postData.contents || '{}');
    const action = p.action || 'unknown';

    // Catat log jika fungsi bufferEngineLog tersedia
    if (typeof bufferEngineLog === 'function') bufferEngineLog(1, 'Incoming: ' + action);

    let result;

    // --- ROUTING ACTIONS ---
    if (action === 'claim') {
      result = claimSerial(p);
    } else if (action === 'verifySerial') {
      result = verifySerial(p);
    } else if (action === 'login') {
      result = processLogin(p);
    } else if (action === 'emergency_rescue') {
      result = handleEmergencyRescue(p); 
    } else {
      result = { success: false, ok: false, message: 'UNKNOWN ACTION' };
    }

    // 2. Kembalikan JSON (Google otomatis handle CORS di sini)
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    if (typeof bufferEngineLog === 'function') bufferEngineLog(0, 'Error: ' + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Optional: handle preflight CORS request (browser mengirim OPTIONS)
 */
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * 2. EMERGENCY RESCUE LOGIC (SMART & AUDITED)
 */
function handleEmergencyRescue(p) {
  const lock = LockService.getScriptLock();
  try {
    // 1. Lock selama 10 detik untuk menangani shout bersamaan
    lock.waitLock(10000);

    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const engineSheet = ss.getSheetByName(SHEET_ENGINES);
    const overloadSheet = ss.getSheetByName(SHEET_OVERLOAD) || ss.insertSheet(SHEET_OVERLOAD);
    
    // Setup Header logOverload jika belum ada
    if (overloadSheet.getLastRow() === 0) {
      overloadSheet.appendRow(['timestamp', 'user_email', 'serial_number', 'failed_engine_url', 'notes']);
      overloadSheet.getRange(1, 1, 1, 5).setBackground("#991b1b").setFontColor("#ffffff").setFontWeight("bold");
    }

    // 2. Catat Log Overload (Waktu Jakarta)
    const timeJakarta = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    overloadSheet.appendRow([
      timeJakarta,
      p.user_email || 'N/A',
      p.serial || 'N/A',
      p.failed_url || 'N/A',
      'emergency_rescue FE'
    ]);

    // 3. Cari Engine Fresh
    const data = engineSheet.getDataRange().getValues();
    if (data.length < 2) return { success: false, message: 'NO_ENGINES_AVAILABLE' };

    const headers = data[0].map(h => h.toString().toLowerCase());
    const urlIdx = headers.indexOf("url");
    const reqIdx = headers.indexOf("request");
    const nameIdx = headers.indexOf("nama");

    // Mapping & Filter: Abaikan engine yang sedang overload
    const enginePool = data.slice(1)
      .map(row => ({
        nama: row[nameIdx],
        url: row[urlIdx],
        request: parseInt(row[reqIdx]) || 0
      }))
      .filter(eng => eng.url && eng.url.startsWith("http") && eng.url !== p.failed_url);

    if (enginePool.length === 0) {
      return { success: false, message: 'NO_OTHER_ENGINES' };
    }

    // Sortir berdasarkan beban request terendah
    enginePool.sort((a, b) => a.request - b.request);
    const freshEngine = enginePool[0];

    // Log ke Log Center (optional monitoring)
    sendLog(p.serial || 'SYSTEM', 'RESCUE_REDIRECT', 'SUCCESS', `Redirected ${p.user_email} to ${freshEngine.nama}`);

    return { 
      success: true, 
      new_engine_url: freshEngine.url,
      engine_name: freshEngine.nama
    };

  } catch (e) {
    return { success: false, message: "Rescue Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 3. CORE FUNCTIONS (NO CHANGES - PRESERVING INTEGRITY)
 */
function claimSerial(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const email = (p.email || '').trim();
    const sheetUrl = (p.spreadsheet || '').trim();
    if (!email || !sheetUrl) return { ok: false, message: 'EMAIL & SPREADSHEET WAJIB' };

    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const dataSheet = ss.getSheetByName(SHEET_DATA);
    const engineSheet = ss.getSheetByName(SHEET_ENGINES);
    const rows = dataSheet.getDataRange().getValues();

    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][2] || '').trim().toLowerCase() === email.toLowerCase()) {
        return { ok: true, serial: rows[i][1], password: DEFAULT_PASSWORD, message: 'SUDAH TERDAFTAR' };
      }
    }

    const engineRows = engineSheet.getDataRange().getValues();
    if (engineRows.length < 2) throw "Sheet 'engines' kosong.";
    const selectedEngineName = engineRows[1][1]; 
    const selectedEngineUrl = engineRows[1][2];

    try {
      const targetId = extractIdFromUrl(sheetUrl);
      setupClientSheets(SpreadsheetApp.openById(targetId), email);
    } catch (err) {
      return { ok: false, message: 'Gagal Provisioning: Cek Izin Editor script.' };
    }

    const serial = 'SKV-' + Utilities.getUuid().split('-')[0].toUpperCase();
    const id = Utilities.getUuid().slice(0, 8);
    dataSheet.appendRow([id, serial, email, sheetUrl, selectedEngineName, selectedEngineUrl, 'AKTIF', new Date().toISOString()]);
    SpreadsheetApp.flush();

    sendLog(serial, 'CLAIM_SERIAL', 'SUCCESS', `Metadata Provisioned`);
    return { ok: true, serial: serial, password: DEFAULT_PASSWORD, engine_name: selectedEngineName, engine_url: selectedEngineUrl };

  } catch (err) {
    return { ok: false, message: 'Error: ' + err.toString() };
  } finally { if(lock.hasLock()) lock.releaseLock(); }
}

function setupClientSheets(ss, adminEmail) {
  const now = new Date().toISOString();
  let roleSheet = ss.getSheetByName('roles') || ss.insertSheet('roles');
  if (roleSheet.getLastRow() === 0) {
    roleSheet.appendRow(['id', 'role_name', 'description', 'created_at']);
    roleSheet.appendRow(['{"label":"ID","hidden":true}', '{"label":"ROLE NAME","type":"TEXT","required":true}', '{"label":"DESCRIPTION","type":"TEXT"}', '{"label":"CREATED","hidden":true}']);
    roleSheet.appendRow(['R-001', 'admin', 'Super User Akses Penuh', now]);
    roleSheet.appendRow(['R-002', 'staf', 'User Operasional Terbatas', now]);
  }
  let userSheet = ss.getSheetByName('users') || ss.insertSheet('users');
  if (userSheet.getLastRow() === 0) {
    userSheet.appendRow(['id', 'email', 'password', 'role', 'salt', 'created_at']);
    userSheet.appendRow(['{"label":"ID","hidden":true}', '{"label":"EMAIL","type":"TEXT","required":true}', '{"label":"PASSWORD","type":"TEXT","required":true}', '{"label":"ROLE","type":"LOOKUP","lookup":{"table":"roles","field":"role_name"}}', '{"label":"SALT","hidden":true}', '{"label":"CREATED","hidden":true}']);
    userSheet.appendRow(['ID-ADMIN', adminEmail, DEFAULT_PASSWORD, 'admin', DEFAULT_SALT, now]);
  }
  let permSheet = ss.getSheetByName('config_permissions') || ss.insertSheet('config_permissions');
  if (permSheet.getLastRow() === 0) {
    permSheet.appendRow(['id', 'resource', 'role', 'can_browse', 'can_add', 'can_edit', 'can_delete', 'ownership_policy']);
    permSheet.appendRow(['{"label":"ID"}', '{"label":"RESOURCE"}', '{"label":"ROLE"}', '{"label":"BROWSE"}', '{"label":"ADD"}', '{"label":"EDIT"}', '{"label":"DELETE"}', '{"label":"POLICY"}']);
    permSheet.appendRow(['PERM-001', '*', 'admin', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'all']);
    permSheet.appendRow(['PERM-005', 'transaksi', 'staf', 'TRUE', 'TRUE', 'FALSE', 'FALSE', 'own']);
  }
  let dashSheet = ss.getSheetByName('config_dashboard') || ss.insertSheet('config_dashboard');
  if (dashSheet.getLastRow() === 0) {
    dashSheet.appendRow(['id', 'created_by', 'created_at', 'deleted_at', 'config_json', 'updated_at']);
    dashSheet.appendRow(['{"label":"ID","hidden":true}', '{"label":"BY","hidden":true}', '{"label":"CREATED","hidden":true}', '{"label":"DELETED","hidden":true}', '{"label":"CONFIG","type":"TEXT"}', '{"label":"UPDATED"}']);
    dashSheet.appendRow(['DASH-001', 'system', new Date().toISOString(), '', '{"widgets":[], "theme":"dark"}', new Date().toISOString()]);
  }
}

function processLogin(p) {
  const email = (p.email || '').trim().toLowerCase();
  const password = (p.password || '').trim();
  const serial = (p.serial || '').trim();
  const dataSheet = getSheet();
  const masterRows = dataSheet.getDataRange().getValues();
  let clientSheetUrl = '';
  for(let i=1; i<masterRows.length; i++) {
    if(masterRows[i][1] === serial) { clientSheetUrl = masterRows[i][3]; break; }
  }
  if(!clientSheetUrl) return { ok: false, message: 'SERIAL TIDAK VALID' };
  try {
    const clientSs = SpreadsheetApp.openById(extractIdFromUrl(clientSheetUrl));
    const userRows = clientSs.getSheetByName('users').getDataRange().getValues();
    for(let j=2; j<userRows.length; j++) {
      if(userRows[j][1].toLowerCase() === email && userRows[j][2].toString() === password) {
        sendLog(serial, 'LOGIN', 'SUCCESS', `User ${email} logged in`);
        return { ok: true, success: true, token: 'TK-' + Utilities.getUuid().slice(0,12), role: userRows[j][3], email: email };
      }
    }
  } catch(e) { return { ok: false, message: 'DATABASE KLIEN ERROR' }; }
  return { ok: false, message: 'LOGIN GAGAL' };
}

function verifySerial(p) {
  const serial = (p.serial || '').trim();
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][1] || '').trim() === serial && (rows[i][6] || '').toUpperCase() === 'AKTIF') {
      return { ok: true, serial: serial, sheet: rows[i][3], engine_url: rows[i][5] };
    }
  }
  return { ok: false, message: 'SERIAL TIDAK VALID/NONAKTIF' };
}

/**
 * 4. LOGGING UTILS
 */
function bufferEngineLog(activeRequests, notes) {
  try {
    let cacheData = CACHE.get(ENGINE_CACHE_KEY);
    let buffer = cacheData ? JSON.parse(cacheData) : [];
    buffer.push({ timestamp: new Date().toISOString(), engine_id: ENGINE_ID, active_requests: activeRequests || 0, notes: notes || '' });
    CACHE.put(ENGINE_CACHE_KEY, JSON.stringify(buffer), 900);
  } catch (e) { console.warn('Buffer log failed', e); }
}

function flushEngineLogs() {
  try {
    const cacheData = CACHE.get(ENGINE_CACHE_KEY);
    if (!cacheData) return;
    const buffer = JSON.parse(cacheData);
    const ss = SpreadsheetApp.openById(MASTER_LOG_SHEET_ID);
    let logSheet = ss.getSheetByName(MASTER_LOG_TAB) || ss.insertSheet(MASTER_LOG_TAB);
    const rows = buffer.map(e => [e.timestamp, e.engine_id, e.active_requests, e.notes]);
    logSheet.getRange(logSheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
    CACHE.remove(ENGINE_CACHE_KEY);
  } catch (e) { console.warn('Flush engine log failed', e); }
}

function sendLog(serial, action, status, details) {
  try {
    UrlFetchApp.fetch(LOG_WEBAPP_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ serial_number: serial, engine_id: "MASTER-REGISTRY", action: action, status: status, details: details }),
      muteHttpExceptions: true
    });
  } catch (e) { console.warn("Log failed"); }
}

function extractIdFromUrl(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url;
}

function getSheet() { return SpreadsheetApp.openById(MASTER_SHEET_ID).getSheetByName(SHEET_DATA); }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }