/**
 * ============================================================
 * STARKIT MASTER LICENSE ENGINE — v1.8.0 (MAXIMUM COVERAGE)
 * ============================================================
 * Juragan SaaS Sheet [2026-01-26]
 * Focus: No Reductions, Total Integrity, Security v1.7, Time GMT+7
 */

const MASTER_SHEET_ID = '1Vh6K-5C5Yol1tylr9Ot6tssptzo94_TTDHm_ZqoJd-4';
const LOG_WEBAPP_URL = 'https://script.google.com/macros/s/1s5mR5zmDQYKY934Y8Fvly_WJEGjQVJqvw4M7NEags_M/exec'; 
const SHEET_DATA = 'data';
const SHEET_ENGINES = 'engines';
const SHEET_OVERLOAD = 'logOverload';
const DEFAULT_PASSWORD = 'starkitoye';
const DEFAULT_SALT = 'STKIT_SALT_2026'; // Salt baru untuk arsitektur keamanan

// CACHE & SESSION CONFIG
const CACHE = CacheService.getScriptCache();
const SESSION_EXPIRY = 3600; // 1 Jam
const ENGINE_ID = 'MASTER-CENTRAL';
const ENGINE_CACHE_KEY = 'engine_log_buffer';

/**
 * 1. GATEWAY HANDLER (doPost)
 * Menangani semua request masuk dari FE (Claim, Login, Rescue, dll)
 */
function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents || '{}');
    const action = String(p.action || 'unknown');
    const serial = String(p.serial || 'anon');
    const clientFp = p.fp || 'legacy_device_unhashed';

    // Log Aktivitas ke Buffer
    if (typeof bufferEngineLog === 'function') bufferEngineLog(1, 'Incoming Action: ' + action);

    let result;

    // --- ROUTING ACTIONS ---
    if (action === 'claim') {
      result = claimSerial(p);
    } else if (action === 'verifySerial') {
      result = verifySerial(p);
    } else if (action === 'login') {
      result = processLogin(p, clientFp);
    } else if (action === 'emergency_rescue') {
      // Logic Hybrid: Izinkan legacy FE atau yang sudah punya Token
      const session = getValidatedSession(serial, p.token, clientFp);
      result = handleEmergencyRescue(p, session ? session.email : 'LEGACY_USER');
    } else if (action === 'logout') {
      if (p.token) CACHE.remove('auth_' + serial + '_' + p.token);
      result = { success: true, message: 'LOGGED_OUT' };
    } else {
      result = { success: false, message: 'UNKNOWN ACTION' };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    if (typeof bufferEngineLog === 'function') bufferEngineLog(0, 'Error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 2. CLAIM SERIAL & SMART PROVISIONING (MODIFIED v2.1)
 * Mengizinkan email duplikat, tapi memblokir Spreadsheet URL duplikat.
 */
function claimSerial(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); 
    const email = (p.email || '').trim().toLowerCase();
    const sheetUrl = (p.spreadsheet || '').trim();
    const appName = (p.appName || 'Starkit').trim();

    if (!email || !sheetUrl) return { ok: false, message: 'EMAIL & SPREADSHEET WAJIB' };

    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const dataSheet = ss.getSheetByName(SHEET_DATA);
    const engineSheet = ss.getSheetByName(SHEET_ENGINES);
    const rows = dataSheet.getDataRange().getValues();

    // --- LOGIKA VALIDASI BARU ---
    // Cek apakah Spreadsheet ini sudah pernah didaftarkan
    for (let i = 1; i < rows.length; i++) {
      const dbSheetUrl = (rows[i][3] || '').trim(); // Kolom D (Indeks 3)
      if (dbSheetUrl === sheetUrl) {
        return { 
          ok: true, 
          serial: rows[i][1], // Kolom B
          appName: rows[i][4] || appName, // Kolom E
          message: 'SPREADSHEET INI SUDAH MEMILIKI LISENSI' 
        };
      }
    }

    // --- LOAD BALANCING LOGIC ---
    const engineRows = engineSheet.getDataRange().getValues();
    const headers = engineRows[0].map(h => h.toString().toLowerCase());
    const reqIdx = headers.indexOf("request");
    const nameIdx = headers.indexOf("nama");
    const urlIdx = headers.indexOf("url");

    let selectedRow = 1;
    let minRequests = Infinity;

    for (let j = 1; j < engineRows.length; j++) {
      let currentReq = parseInt(engineRows[j][reqIdx]) || 0;
      if (currentReq < minRequests && engineRows[j][urlIdx]) {
        minRequests = currentReq;
        selectedRow = j;
      }
    }

    const selectedEngineName = engineRows[selectedRow][nameIdx];
    const selectedEngineUrl = engineRows[selectedRow][urlIdx];

    // --- PROVISIONING CLIENT ---
    try {
      const targetId = extractIdFromUrl(sheetUrl);
      setupClientSheets(SpreadsheetApp.openById(targetId), email);
    } catch (err) {
      return { ok: false, message: 'Gagal Provisioning: Pastikan Master adalah Editor di Sheet Client.' };
    }

    // UPDATE HIT COUNTER PADA ENGINE
    engineSheet.getRange(selectedRow + 1, reqIdx + 1).setValue(minRequests + 1);

    // --- GENERATE DATA BARU ---
    const serial = 'SKV-' + Utilities.getUuid().split('-')[0].toUpperCase();
    const id = Utilities.getUuid().slice(0, 8);
    const timeJakarta = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

    /**
     * SESUAIKAN DENGAN STRUKTUR DATA JURAGAN:
     * A: id, B: serial, C: email, D: spreadsheet, E: app_name, 
     * F: engine_name, G: engine_url, H: Status, I: activated_at
     */
    dataSheet.appendRow([
      id,           // A (0)
      serial,       // B (1)
      email,        // C (2)
      sheetUrl,     // D (3)
      appName,      // E (4)
      selectedEngineName, // F (5)
      selectedEngineUrl,  // G (6)
      'AKTIF',      // H (7)
      timeJakarta   // I (8)
    ]);
    
    if (typeof sendLog === 'function') sendLog(serial, 'CLAIM_SERIAL', 'SUCCESS', 'New License for: ' + appName);

    return { 
      ok: true, 
      serial: serial, 
      password: DEFAULT_PASSWORD, 
      appName: appName, 
      engine_name: selectedEngineName, 
      engine_url: selectedEngineUrl 
    };

  } catch (err) {
    return { ok: false, message: 'Error: ' + err.toString() };
  } finally { 
    if(lock.hasLock()) lock.releaseLock(); 
  }
}
/**
 * 3. SETUP CLIENT SHEETS (PROVISIONING FULL)
 * Membuat semua struktur tabel yang dibutuhkan oleh FE
 */
function setupClientSheets(ss, adminEmail) {
  const now = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
  
  // Create ROLES
  let roleSheet = ss.getSheetByName('roles') || ss.insertSheet('roles');
  if (roleSheet.getLastRow() === 0) {
    roleSheet.appendRow(['id', 'role_name', 'description', 'created_at', 'deleted_at']);
    roleSheet.appendRow(['{"label":"ID","hidden":true}', '{"label":"ROLE NAME","type":"TEXT","required":true}', '{"label":"DESCRIPTION","type":"TEXT"}', '{"label":"CREATED","hidden":true}', '{"label":"DELETED","hidden":true}']);
    roleSheet.appendRow(['R-001', 'admin', 'Super User Akses Penuh', now]);
    roleSheet.appendRow(['R-002', 'staf', 'User Operasional Terbatas', now]);
  }

  // Create USERS
  let userSheet = ss.getSheetByName('users') || ss.insertSheet('users');
  if (userSheet.getLastRow() === 0) {
    userSheet.appendRow(['id', 'email', 'password', 'role', 'salt', 'created_at', 'deleted_at']);
    userSheet.appendRow(['{"label":"ID","hidden":true}', '{"label":"EMAIL","type":"TEXT","required":true}', '{"label":"PASSWORD","type":"TEXT","required":true}', '{"label":"ROLE","type":"LOOKUP","lookup":{"table":"roles","field":"role_name"}}', '{"label":"SALT","hidden":true}', '{"label":"CREATED","hidden":true}', '{"label":"DELETED","hidden":true}']);
    userSheet.appendRow(['ID-ADMIN', adminEmail, DEFAULT_PASSWORD, 'admin', DEFAULT_SALT, now]);
  }

  // Create PERMISSIONS
  let permSheet = ss.getSheetByName('config_permissions') || ss.insertSheet('config_permissions');
  if (permSheet.getLastRow() === 0) {
    permSheet.appendRow(['id', 'resource', 'role', 'can_browse', 'can_add', 'can_edit', 'can_delete', 'ownership_policy', 'field_policy']);
    permSheet.appendRow(['{"label":"ID"}', '{"label":"RESOURCE"}', '{"label":"ROLE"}', '{"label":"BROWSE"}', '{"label":"ADD"}', '{"label":"EDIT"}', '{"label":"DELETE"}', '{"label":"POLICY"}', '{"label":"FIELD POLICY"}']);
    permSheet.appendRow(['PERM-001', '*', 'admin', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'all']);
    permSheet.appendRow(['PERM-005', 'transaksi', 'staf', 'TRUE', 'TRUE', 'FALSE', 'FALSE', 'own']);
  }

  // Create DASHBOARD
  let dashSheet = ss.getSheetByName('config_dashboard') || ss.insertSheet('config_dashboard');
  if (dashSheet.getLastRow() === 0) {
    dashSheet.appendRow(['id', 'created_by', 'created_at', 'deleted_at', 'config_json', 'updated_at']);
    dashSheet.appendRow(['{"label":"ID","hidden":true}', '{"label":"BY","hidden":true}', '{"label":"CREATED","hidden":true}', '{"label":"DELETED","hidden":true}', '{"label":"CONFIG","type":"TEXT"}', '{"label":"UPDATED"}']);
    dashSheet.appendRow(['DASH-001', 'system', now, '', '{"widgets":[], "theme":"dark"}', now]);
  }
}

/**
 * 4. LOGIN ENGINE (WITH AUTO-HASH MIGRATION)
 */
function processLogin(p, clientFp) {
  const email = (p.email || '').trim().toLowerCase();
  const password = (p.password || '').trim();
  const serial = (p.serial || '').trim();
  
  const clientSheetUrl = getClientSheetUrl(serial);
  if(!clientSheetUrl) return { ok: false, message: 'SERIAL TIDAK VALID' };

  try {
    const clientSs = SpreadsheetApp.openById(extractIdFromUrl(clientSheetUrl));
    const userSheet = clientSs.getSheetByName('users');
    const userRows = userSheet.getDataRange().getValues();
    
    for(let j=2; j<userRows.length; j++) {
      if(userRows[j][1].toLowerCase() === email) {
        const dbPassword = userRows[j][2].toString();
        const dbSalt = userRows[j][4] || DEFAULT_SALT;
        const inputHash = computeSecureHash(password, dbSalt);

        // Cek kecocokan (Plaintext atau Hash)
        if (dbPassword === password || dbPassword === inputHash) {
          // AUTO MIGRASI: Jika masih plaintext, ubah jadi hash sekarang
          if (dbPassword === password) {
            userSheet.getRange(j + 1, 3).setValue(inputHash);
          }

          const token = 'STK-' + Utilities.getUuid();
          const sessionData = { email: email, fp: clientFp, s: serial };
          CACHE.put('auth_' + serial + '_' + token, JSON.stringify(sessionData), SESSION_EXPIRY);
          
          sendLog(serial, 'LOGIN', 'SUCCESS', 'User ' + email + ' logged in');
          return { ok: true, success: true, token: token, role: userRows[j][3], email: email };
        }
      }
    }
  } catch(e) { return { ok: false, message: 'DATABASE KLIEN ERROR: ' + e.toString() }; }
  return { ok: false, message: 'LOGIN GAGAL: Email atau Password salah' };
}

/**
 * 5. EMERGENCY RESCUE LOGIC (SMART & AUDITED)
 */
function handleEmergencyRescue(p, email) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const engineSheet = ss.getSheetByName(SHEET_ENGINES);
    const overloadSheet = ss.getSheetByName(SHEET_OVERLOAD) || ss.insertSheet(SHEET_OVERLOAD);
    
    const timeJakarta = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    if (overloadSheet.getLastRow() === 0) {
      overloadSheet.appendRow(['timestamp', 'user_email', 'serial_number', 'failed_engine_url', 'notes']);
      overloadSheet.getRange(1, 1, 1, 5).setBackground("#991b1b").setFontColor("#ffffff").setFontWeight("bold");
    }

    overloadSheet.appendRow([timeJakarta, email, p.serial || 'N/A', p.failed_url || 'N/A', 'emergency_rescue']);

    const data = engineSheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase());
    const urlIdx = headers.indexOf("url");
    const reqIdx = headers.indexOf("request");
    const nameIdx = headers.indexOf("nama");

    const enginePool = data.slice(1)
      .map(row => ({ nama: row[nameIdx], url: row[urlIdx], request: parseInt(row[reqIdx]) || 0 }))
      .filter(eng => eng.url && eng.url.startsWith("http") && eng.url !== p.failed_url);

    if (enginePool.length === 0) return { success: false, message: 'NO_OTHER_ENGINES' };

    enginePool.sort((a, b) => a.request - b.request);
    const freshEngine = enginePool[0];

    return { success: true, new_engine_url: freshEngine.url, engine_name: freshEngine.nama };

  } catch (e) { return { success: false, message: e.toString() }; }
  finally { lock.releaseLock(); }
}

/**
 * 6. SECURITY & LOGGING HELPERS
 */
function getValidatedSession(serial, token, currentFp) {
  if (!token || !serial) return null;
  const raw = CACHE.get('auth_' + serial + '_' + token);
  if (!raw) return null;
  const session = JSON.parse(raw);
  const isFpValid = (session.fp === currentFp || session.fp === 'legacy_device_unhashed' || currentFp === 'legacy_device_unhashed');
  if (session.s === serial && isFpValid) return session;
  return null;
}

/**
 * 6. SECURITY HELPERS - VERIFY SERIAL (FULL VERSION)
 * Disesuaikan dengan struktur kolom riil:
 * B(1)=serial, D(3)=spreadsheet, E(4)=app_name, G(6)=engine_url, H(7)=Status
 */
function verifySerial(p) {
  const serial = (p.serial || '').trim();
  
  // Pastikan Master Sheet ID benar
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const dataSheet = ss.getSheetByName(SHEET_DATA);
  
  if (!dataSheet) {
    return { ok: false, message: 'DATABASE MASTER TIDAK DITEMUKAN' };
  }

  const rows = dataSheet.getDataRange().getValues();

  // Mulai iterasi dari baris ke-2 (indeks 1) untuk melewati header
  for (let i = 1; i < rows.length; i++) {
    const dbSerial = (rows[i][1] || '').toString().trim();
    const dbStatus = (rows[i][7] || '').toString().trim().toUpperCase(); // Kolom H (Status)

    // Validasi: Serial cocok (Case Insensitive) DAN Status harus AKTIF
    if (dbSerial.toUpperCase() === serial.toUpperCase() && dbStatus === 'AKTIF') {
      
      // Log verifikasi berhasil ke Master Log (Opsional)
      if (typeof sendLog === 'function') {
        sendLog(dbSerial, 'VERIFY_SERIAL', 'SUCCESS', 'App Name: ' + rows[i][4]);
      }

      return {
        ok: true,
        serial: dbSerial,
        appName: rows[i][4] || '', // Kolom E (app_name)
        sheet: rows[i][3],                   // Kolom D (spreadsheet)
        engine_url: rows[i][6]               // Kolom G (engine_url)
      };
    }
  }

  // Jika setelah looping tidak ditemukan serial yang cocok atau status non-aktif
  return { 
    ok: false, 
    message: 'SERIAL TIDAK VALID/NONAKTIF' 
  };
}

function computeSecureHash(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  return Utilities.base64Encode(digest);
}

function getClientSheetUrl(serial) {
  const data = SpreadsheetApp.openById(MASTER_SHEET_ID).getSheetByName(SHEET_DATA).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === serial) return data[i][3];
  }
  return null;
}

function bufferEngineLog(activeRequests, notes) {
  try {
    let cacheData = CACHE.get(ENGINE_CACHE_KEY);
    let buffer = cacheData ? JSON.parse(cacheData) : [];
    buffer.push({ timestamp: new Date().toISOString(), engine_id: ENGINE_ID, active_requests: activeRequests || 0, notes: notes || '' });
    CACHE.put(ENGINE_CACHE_KEY, JSON.stringify(buffer), 900);
  } catch (e) {}
}

function sendLog(serial, action, status, details) {
  try {
    UrlFetchApp.fetch(LOG_WEBAPP_URL, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ serial_number: serial, engine_id: "MASTER-REGISTRY", action: action, status: status, details: details }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function extractIdFromUrl(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}