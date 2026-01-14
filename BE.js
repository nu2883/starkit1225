/**
 * STARKIT VOYAGER ENGINE - v44.3.5 (PATCHED LOGGING)
 * Role: Enterprise Multi-Tenant Baseline
 * Security: Intent-Based Access Control, HMAC Integrity, MasterLog Integrated
 * Dev: Juragan SaaS Sheet [2026-01-14]
 */

// --- 1. CONFIGURATION & SECRETS ---
const PROPS = PropertiesService.getScriptProperties();
const ENGINE_ID = PROPS.getProperty("ENGINE_ID") 
const ENGINE_SECRET = PROPS.getProperty("ENGINE_SECRET") || "STARKIT_SECRET_2026";
const MASTER_LOG_ENDPOINT = PROPS.getProperty("MASTER_LOG_URL") || "";
const MASTER_LOG_SHEET_ID = '1s5mR5zmDQYKY934Y8Fvly_WJEGjQVJqvw4M7NEags_M';
const MASTER_LOG_TAB = 'engine_logs';
const ENGINE_CACHE_KEY = 'engine_log_buffer';
const CACHE = CacheService.getScriptCache();
const SESSION_EXPIRY_MS = 21600000; // 6 Jam

// PROPS.getProperty("MASTER_LOG_SHEET_ID") || 

// ================== BUFFER LOG ==================
function bufferEngineLog(activeRequests, notes) {
  try {
    let cacheData = CACHE.get(ENGINE_CACHE_KEY);
    let buffer = cacheData ? JSON.parse(cacheData) : [];

    buffer.push({
      timestamp: new Date().toISOString(),
      engine_id: ENGINE_ID,
      active_requests: activeRequests || 0,
      notes: notes || ''
    });

    CACHE.put(ENGINE_CACHE_KEY, JSON.stringify(buffer), 900); // 15 menit
  } catch (e) {
    console.warn('Buffer log failed', e);
  }
}

function flushEngineLogs() {
  try {
    const cacheData = CACHE.get(ENGINE_CACHE_KEY);
    if (!cacheData) return;

    const buffer = JSON.parse(cacheData);
    const ss = SpreadsheetApp.openById(MASTER_LOG_SHEET_ID);
    let logSheet = ss.getSheetByName(MASTER_LOG_TAB);
    if (!logSheet) logSheet = ss.insertSheet(MASTER_LOG_TAB);

    const rows = buffer.map(e => [e.timestamp, e.engine_id, e.active_requests, e.notes]);
    logSheet.getRange(logSheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);

    CACHE.remove(ENGINE_CACHE_KEY);
  } catch (e) {
    console.warn('Flush engine log failed', e);
  }
}

// ================== MAIN POST HANDLER ==================
function doPost(e) {
  try {
    let p = JSON.parse(e.postData.contents);

    // Catat setiap request ke buffer log
    bufferEngineLog(1, 'Request received: ' + (p.action || 'unknown'));

    const SS = getDynamicSS(p.sheet);
    if (!SS) {
      bufferEngineLog(0, 'SS_MISSING for sheet: ' + (p.sheet || 'undefined'));
      return out({ success: false, message: "SS_MISSING" });
    }

    if (p.action === "login") return out(handleLogin(p, SS));

    const auth = verifyToken(p.token, p.ua);
    if (!auth.valid) {
      bufferEngineLog(0, 'Unauthorized token attempt');
      return out({ success: false, message: "401_UNAUTHORIZED" });
    }

    switch (p.action) {
      case "migrate":
        return out(migrateNewTable(p.data, auth.user, SS));
      case "create":
        return out(handleWrite("create", p.table, p.data, auth.user, SS));
      case "update":
        return out(handleWrite("update", p.table, p.data, auth.user, SS));
      case "delete":
        return out(handleWrite("delete", p.table, p.data, auth.user, SS));
      case "flush_logs":
        if (auth.user.role !== 'admin') {
          bufferEngineLog(0, 'Flush_logs forbidden for user: ' + auth.user.email);
          return out({ success: false, message: "FORBIDDEN" });
        }
        return out(processPendingLogs(SS));
      default:
        bufferEngineLog(0, 'Unknown action: ' + (p.action || 'none'));
        return out({ success: false, message: "ACTION_UNKNOWN" });
    }

  } catch (err) {
    bufferEngineLog(0, 'doPost error: ' + err.toString());
    return out({ success: false, message: "REQ_ERR: " + err.toString() });
  }
}



// --- 2. API GATEWAY ---
function doGet(e) {
  try {
    const { action, table, token, viewMode, sheet: sheetUrl, ua, source, mode } = e.parameter;
    const SS = getDynamicSS(sheetUrl);
    if (!SS) return out({ success: false, message: "SS_MISSING" });

    const auth = verifyToken(token, ua);
    if (!auth.valid) return out({ success: false, message: "401_UNAUTHORIZED" });

    switch (action) {
      case "listResources": return out(listResources(auth.user, SS));
      case "read":          return out(handleRead(table, auth.user, viewMode, SS, source, mode));
      default:              return out({ success: false, message: "ACTION_UNKNOWN" });
    }
  } catch (err) { return out({ success: false, message: "ERR: " + err.toString() }); }
}


// --- 3. CORE READ ENGINE (INTENT-BASED) ---

/**
 * 🔐 FUNGSI UTAMA: GUARD PERMISSION (LOGIKA EM)
 */
/**
 * 🔐 FUNGSI UTAMA: GUARD PERMISSION (FINAL EM VERSION)
 */
function canReadTable(ctx) {
  const { user, table, mode, source, permission, schema } = ctx;

  // === 1. LOOKUP READ OVERRIDE (AMAN & TERKONTROL) ===
  if (source === 'lookup' && mode === 'browse') {
    if (!schema) {
      return { allow: false, reason: 'LOOKUP_SCHEMA_MISSING' };
    }

    return {
      allow: true,
      restricted: true,
      fields: getLookupFields(schema)
    };
  }

  // === 2. NORMAL READ FLOW ===
  if (!permission) {
    return { allow: false, reason: 'NO_PERMISSION_CONFIG' };
  }

  if (permission.can_browse === true && mode === 'browse') {
    return { allow: true };
  }

  return { allow: false, reason: '403_FORBIDDEN_READ_ACCESS' };
}


/**
 * 🔒 FUNGSI PEMBATAS FIELD (ANTI DATA LEAK)
 */
/**
 * 🔒 PEMBATAS FIELD LOOKUP (ANTI DATA LEAK)
 */
function getLookupFields(tableSchema) {
  const allowed = [];

  Object.entries(tableSchema).forEach(([field, cfg]) => {
    if (!cfg) return;

    // 🚫 keras
    if (cfg.hidden === true) return;
    if (cfg.type === 'PASSWORD') return;
    if (cfg.type === 'SECRET') return;
    if (cfg.sensitive === true) return;
    if (field === 'deleted_at') return;

    // ✅ aman
    allowed.push(field);
  });

  // fallback minimal
  if (!allowed.includes('id')) allowed.unshift('id');

  return allowed;
}


function handleRead(tableName, user, viewMode, SS, source = "browse", mode = "browse") {
  try {
    const sheet = SS.getSheetByName(tableName);
    if (!sheet) {
      return { success: false, message: "TABLE_NOT_FOUND" };
    }

    // === 1. LOAD SCHEMA & PERMISSION ===
    const schema = getTableSchema(sheet);
    const gov = getGov(tableName, user.role, SS);

    // === 2. EM GUARD (INTENT-BASED) ===
    const access = canReadTable({
      user,
      table: tableName,
      mode: mode,
      source: source,
      permission: gov,
      schema: schema
    });

    if (!access.allow) {
      return { success: false, message: access.reason };
    }

    // =====================================================
    // 🚪 EARLY EXIT — LOOKUP MODE (STRICT & SAFE)
    // =====================================================
    if (access.restricted === true) {
      const fullData = sheet.getDataRange().getValues();

      // header + schema + kosong
      if (fullData.length < 3) {
        return { success: true, rows: [], query_mode: "lookup" };
      }

      const headers = fullData[0]
        .map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));

      const dataRows = fullData.slice(2);

      const rows = dataRows
        .map(r => {
          const obj = {};
          headers.forEach((key, i) => obj[key] = r[i]);
          return obj;
        })
        .filter(r => !r.deleted_at) // ❌ jangan kirim data terhapus
        .map(r => {
          const clean = {};
          access.fields.forEach(f => {
            clean[f] = r[f];
          });
          return clean;
        });

      // ❗ lookup TIDAK kirim schema / modes
      return {
        success: true,
        rows: rows,
        query_mode: "lookup"
      };
    }

    // =====================================================
    // 📊 NORMAL READ FLOW (FULL TABLE)
    // =====================================================
    const fullData = sheet.getDataRange().getValues();
    if (fullData.length < 3) {
      return {
        success: true,
        rows: [],
        schema: schema,
        modes: gov
      };
    }

    const headers = fullData[0]
      .map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));

    const dataRows = fullData.slice(2);

    let formattedRows = dataRows
      .map(r => {
        const obj = {};
        headers.forEach((key, i) => {
          obj[key] = r[i];
        });
        return obj;
      })
      .filter(r => {
        const isDeleted = r.deleted_at && r.deleted_at !== "";

        if (viewMode === "trash") return isDeleted;
        if (isDeleted) return false;

        if (
          gov.ownership_policy === "own" &&
          r.created_by !== user.email
        ) {
          return false;
        }

        return true;
      });

    return {
      success: true,
      rows: formattedRows,
      schema: schema,
      modes: gov,
      query_mode: "full"
    };

  } catch (err) {
    return {
      success: false,
      message: err.toString()
    };
  }
}


// --- 4. CORE WRITE ENGINE (WATCHTOWER SYNC) ---
function handleWrite(action, tableName, payload, user, SS) {
  const lock = LockService.getScriptLock();
  let snapshotBefore = null;
  
  try {
    lock.waitLock(15000); 
    const sheet = SS.getSheetByName(tableName);
    if (!sheet) throw new Error("TABLE_NOT_FOUND: " + tableName);

    const schema = getTableSchema(sheet);
    let normalizedPayload = {};
    Object.keys(payload).forEach(k => {
      normalizedPayload[k.trim().toLowerCase().replace(/\s+/g, '_')] = payload[k];
    });

    let finalData = sanitizeObject(normalizedPayload);

    if (action !== "create") {
      if (!finalData.id) throw new Error("ID_REQUIRED");
      snapshotBefore = getRowSnapshot(tableName, finalData.id, SS);
      if (!snapshotBefore) throw new Error("DATA_NOT_FOUND");
      if (action === "update") finalData = { ...snapshotBefore, ...finalData };
    }

    const now = new Date().toISOString();
    if (action === "create") {
      finalData.id = "SK-" + Utilities.getUuid().split('-')[0].toUpperCase();
      finalData.created_at = now;
      finalData.created_by = user.email;
    }

    commitToSheet(action, tableName, finalData, schema, SS);

    const auditPayload = {
      actor: user.email,
      action: action.toUpperCase(),
      resource: tableName,
      status: "SUCCESS",
      target_id: finalData.id,
      snapshot_before: snapshotBefore,
      snapshot_after: (action === "delete") ? null : finalData
    };
    logMasterAudit(auditPayload, SS);

    return { success: true, id: finalData.id, data: finalData };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

// --- 5. MIGRATION ENGINE ---
function migrateNewTable(p, user, SS) {
  if (user.role !== 'admin') return { success: false, message: "Admin Only" };
  const tableName = p.tableName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (SS.getSheetByName(tableName)) return { success: false, message: "Duplicate Table" };
  
  const sheet = SS.insertSheet(tableName);
  const sysH = ["id", "created_by", "created_at", "deleted_at"];
  const userH = p.fields.map(f => f.name.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const headers = [...sysH, ...userH];
  
  const hints = [
    JSON.stringify({ label: "ID", hidden: true }),
    JSON.stringify({ label: "BY", hidden: true }),
    JSON.stringify({ label: "CREATED", hidden: true }),
    JSON.stringify({ label: "DELETED", hidden: true }),
    ...p.fields.map(f => {
      let lookupData = f.lookup || null;
      if (f.type === "LOOKUP" && lookupData) lookupData.mode = "reference";
      return JSON.stringify({
        label: (f.label || f.name).toUpperCase(),
        type: (f.type || "TEXT").toUpperCase(),
        hidden: !f.show,
        required: f.required || false,
        disabled: f.disabled || false,
        lookup: lookupData
      });
    })
  ];
  
  sheet.appendRow(headers);
  sheet.appendRow(hints);
  sheet.getRange(1, 1, 1, headers.length).setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(2);

  const pSheet = SS.getSheetByName("config_permissions");
  if (pSheet) pSheet.appendRow([new Date().getTime(), tableName, "admin", "TRUE", "TRUE", "TRUE", "TRUE", "ALL", new Date().toISOString()]);

  return { success: true };
}

// --- 6. PERSISTENCE LAYER ---
function commitToSheet(mode, tableName, data, schema, SS) {
  const sheet = SS.getSheetByName(tableName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const normalizedHeaders = headers.map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));

  if (mode === "create") {
    const row = normalizedHeaders.map(key => data[key] !== undefined ? data[key] : "");
    sheet.appendRow(row);
  } else {
    const fullData = sheet.getDataRange().getValues();
    const idIdx = normalizedHeaders.indexOf("id");
    for (let i = 2; i < fullData.length; i++) {
      if (String(fullData[i][idIdx]) === String(data.id)) {
        if (mode === "update") {
          const newRow = normalizedHeaders.map((key, colIdx) => data[key] !== undefined ? data[key] : fullData[i][colIdx]);
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
        } else if (mode === "delete") {
          const delIdx = normalizedHeaders.indexOf("deleted_at");
          if (delIdx !== -1) sheet.getRange(i + 1, delIdx + 1).setValue(new Date().toISOString());
        }
        return true;
      }
    }
    throw new Error("PERSISTENCE_ERR: ID_NOT_FOUND");
  }
}

// --- 7. CORE SECURITY & AUTH ---
function handleLogin(d, SS) {
  const uSheet = SS.getSheetByName("users");
  if(!uSheet) return { success: false, message: "TABLE_USERS_MISSING" };
  const rows = uSheet.getDataRange().getValues();
  const inputEmail = String(d.email).trim().toLowerCase();
  const inputPassHash = hashSaltedPassword(inputEmail, String(d.password));
  const uaHash = hashUA(d.ua);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase() === inputEmail) {
      const dbPass = String(rows[i][2]);
      if (dbPass === inputPassHash || dbPass === String(d.password)) {
        if (dbPass === String(d.password)) uSheet.getRange(i + 1, 3).setValue(inputPassHash);
        const token = Utilities.getUuid();
        CACHE.put("sess_" + token, JSON.stringify({ email: rows[i][1], role: rows[i][3], ua: uaHash }), SESSION_EXPIRY_MS / 1000);
        return { success: true, token, role: rows[i][3], email: rows[i][1] };
      }
    }
  }
  return { success: false, message: "INVALID_CREDENTIALS" };
}

function verifyToken(t, ua) {
  if (!t) return { valid: false };
  const cached = CACHE.get("sess_" + t);
  if (!cached) return { valid: false };
  const session = JSON.parse(cached);
  if (session.ua !== hashUA(ua)) return { valid: false };
  return { valid: true, user: session };
}

// --- 8. UTILS & HELPERS ---
function getTableSchema(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const configRow = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
  const schema = {};
  headers.forEach((h, i) => {
    if (!h) return;
    const cleanKey = String(h).trim().toLowerCase().replace(/\s+/g, '_');
    let config = { label: h.toUpperCase(), type: "TEXT" };
    try { if (configRow[i]) config = Object.assign(config, JSON.parse(configRow[i])); } catch (e) {}
    config.name = cleanKey;
    config.headerIdx = i;
    schema[cleanKey] = config;
  });
  return schema;
}

function getRowSnapshot(tableName, id, SS) {
  const sheet = SS.getSheetByName(tableName);
  const fullData = sheet.getDataRange().getValues();
  const headers = fullData[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
  const idIdx = headers.indexOf("id");
  const row = fullData.find(r => String(r[idIdx]) === String(id));
  return row ? headers.reduce((obj, h, i) => ({ ...obj, [h]: row[i] }), {}) : null;
}

function getGov(res, role, SS) {
  if (role === 'admin') return { can_browse: true, can_add: true, can_edit: true, can_delete: true, ownership_policy: "all" };
  const pSheet = SS.getSheetByName("config_permissions");
  if(!pSheet) return { can_browse: false };
  const fullData = pSheet.getDataRange().getValues();
  const headers = fullData[0];
  const p = fullData.slice(1).find(r => String(r[headers.indexOf("resource")]) === res && String(r[headers.indexOf("role")]) === role);
  if (!p) return { can_browse: false };
  const getCol = (name) => String(p[headers.indexOf(name)]).toUpperCase() === "TRUE";
  return { 
    can_browse: getCol("can_browse"), can_add: getCol("can_add"), 
    can_edit: getCol("can_edit"), can_delete: getCol("can_delete"),
    ownership_policy: p[headers.indexOf("ownership_policy")] || "all" 
  };
}

function logMasterAudit(payload, SS) {
  const endpoint = PropertiesService.getScriptProperties().getProperty("MASTER_LOG_URL");
  const engId = PropertiesService.getScriptProperties().getProperty("ENGINE_ID");
  const secret = PropertiesService.getScriptProperties().getProperty("ENGINE_SECRET");
  if (!endpoint || !engId) return;
  const targetSS = SS || SpreadsheetApp.getActiveSpreadsheet();
  if (!targetSS) return;
  const tenantId = targetSS.getId();
  const ts = Date.now().toString();
  const messageToSign = engId + tenantId + ts + JSON.stringify(payload);
  const sig = Utilities.computeHmacSha256Signature(messageToSign, secret).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  const body = { engine_id: engId, tenant_id: tenantId, timestamp: ts, payload: payload, sig: sig };
  try {
    UrlFetchApp.fetch(endpoint, { method: "post", contentType: "application/json", payload: JSON.stringify(body), muteHttpExceptions: true });
  } catch (e) {
    let s = targetSS.getSheetByName("pending_master_logs") || targetSS.insertSheet("pending_master_logs");
    s.appendRow([new Date().toISOString(), JSON.stringify(body), e.toString()]);
  }
}

function processPendingLogs(SS) {
  const sheet = SS.getSheetByName("pending_master_logs");
  if (!sheet || sheet.getLastRow() < 2) return { success: true };
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  let remain = [];
  data.forEach(r => {
    try { 
      const res = UrlFetchApp.fetch(MASTER_LOG_ENDPOINT, { method: "post", contentType: "application/json", payload: r[1], muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) throw new Error();
    } catch(e) { remain.push(r); }
  });
  sheet.clearContents().appendRow(["ts", "json"]);
  if (remain.length > 0) sheet.getRange(2, 1, remain.length, 2).setValues(remain);
  return { success: true, processed: data.length - remain.length };
}

function listResources(user, SS) {
  const forbidden = ['pending_master_logs', 'audit_log'];
  const filteredRes = SS.getSheets()
    .map(s => s.getName())
    .filter(name => {
      if (forbidden.includes(name) || name.startsWith('config_') || name.startsWith('sys_')) return false;
      const gov = getGov(name, user.role, SS);
      return gov.can_browse === true; 
    })
    .map(name => {
      const gov = getGov(name, user.role, SS);
      return { id: name, name: name.replace(/_/g, ' ').toUpperCase(), capabilities: gov };
    });
  return { success: true, resources: filteredRes };
}

function hashUA(ua) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ua || "unknown").map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join(''); }
function hashSaltedPassword(e, p) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, e + ":" + p + ":" + ENGINE_SECRET).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join(''); }
function getDynamicSS(u) { if (!u) return null; try { return (u.startsWith("http")) ? SpreadsheetApp.openByUrl(u) : SpreadsheetApp.openById(u); } catch (e) { return null; } }
function sanitizeObject(o) { let s = {}; for (let k in o) { s[k] = (typeof o[k] === 'string') ? o[k].replace(/<\/?[^>]+(>|$)/g, "") : o[k]; } return s; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }