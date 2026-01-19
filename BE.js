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

// ================== BUFFER LOG (SMART SESSION) ==================
function bufferEngineLog(userEmail, serialNumber, activeRequests = 1, notes = '') {
  try {
    const raw = CACHE.get(ENGINE_CACHE_KEY);
    const buffer = raw ? JSON.parse(raw) : {};

    // --- LOGIC RECOVERY: CEK CACHE UNTUK SN YANG HILANG ---
    let finalSerial = serialNumber || '';
    
    if (!finalSerial) {
      // Cari apakah user ini (userEmail) sudah pernah masuk ke buffer dengan SN sebelumnya
      // Kita scan buffer yang ada di cache saat ini
      const entries = Object.values(buffer);
      const previousEntry = entries.find(e => e.user === userEmail && e.serial !== '');
      
      if (previousEntry) {
        finalSerial = previousEntry.serial; // Pulihkan SN yang hilang dari memory cache
      }
    }

    // Key unik: Tetap sertakan finalSerial agar agregasi per SN tetap valid
    const key = `${ENGINE_ID}|${userEmail}|${finalSerial}`;

    if (!buffer[key]) {
      buffer[key] = {
        engine_id: ENGINE_ID,
        user: userEmail,
        serial: finalSerial,
        request_count: 0,
        first_ts: new Date().toISOString(),
        last_ts: null,
        notes: ''
      };
    }

    // Update data
    buffer[key].request_count += activeRequests;
    buffer[key].last_ts = new Date().toISOString();
    
    if (notes) {
      // Append notes agar history action terlihat
      const oldNotes = buffer[key].notes || '';
      if (!oldNotes.includes(notes)) {
        buffer[key].notes = oldNotes ? oldNotes + "; " + notes : notes;
      }
    }

    // Simpan ke Cache
    const payload = JSON.stringify(buffer);
    if (payload.length < 100000) {
      CACHE.put(ENGINE_CACHE_KEY, payload, 1200);
    } else {
      flushEngineLogs();
    }
  } catch (e) {
    console.warn('Buffer log failed', e);
  }
}

// ================== FLUSH LOGS (CLEANUP) ==================
function flushEngineLogs() {
  try {
    const raw = CACHE.get(ENGINE_CACHE_KEY);
    if (!raw) return;

    const buffer = JSON.parse(raw);
    const ss = SpreadsheetApp.openById(MASTER_LOG_SHEET_ID);
    let sheet = ss.getSheetByName(MASTER_LOG_TAB);

    if (!sheet) {
      sheet = ss.insertSheet(MASTER_LOG_TAB);
      sheet.appendRow(['flush_time', 'engine', 'user', 'serial', 'req', 'start', 'end', 'actions']);
    }

    const rows = Object.values(buffer).map(e => [
      Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
      e.engine_id,
      e.user,
      e.serial,
      e.request_count,
      Utilities.formatDate(new Date(e.first_ts), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
      Utilities.formatDate(new Date(e.last_ts), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
      e.notes
    ]);

    if (rows.length) {
      // Filter: Jangan tulis baris yang benar-benar kosong user & serial-nya jika ada
      const validRows = rows.filter(r => r[2] !== ''); 
      if (validRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, validRows.length, validRows[0].length).setValues(validRows);
      }
    }

    CACHE.remove(ENGINE_CACHE_KEY);
  } catch (e) {
    console.warn('Flush failed', e);
  }
}

// ================== MAIN POST HANDLER ==================
function doPost(e) {
  try {
    const contents = e.postData.contents;
    if (!contents) return out({ success: false, message: "EMPTY_PAYLOAD" });
    
    const p = JSON.parse(contents);
    const SS = getDynamicSS(p.sheet);
    if (!SS) return out({ success: false, message: "SS_MISSING" });

    // 1. LOGIN (Tanpa Log Traffic berlebih)
    if (p.action === "login") return out(handleLogin(p, SS));

    // 2. VERIFIKASI TOKEN
    const auth = verifyToken(p.token, p.ua);
    if (!auth.valid) return out({ success: false, message: "401_UNAUTHORIZED" });

    // 3. CAPTURE SERIAL
    const serial = p.serial || (auth.user ? auth.user.serial : '') || '';

    // 4. RECORD LOG
    bufferEngineLog(auth.user.email, serial, 1, `POST:${p.action}`);

    // 5. ACTION SWITCH
    // Pastikan p.action dievaluasi dengan benar
    switch (p.action) {
      
      // 🛡️ ACTION BARU UNTUK ROW POLICY
      case "create_row_policy":
        if (auth.user.role !== 'admin') return out({ success: false, message: "FORBIDDEN_NOT_ADMIN" });
        return out(createRowPolicy(p.data, SS));
      
      case "delete":
        // Cek jika tabelnya adalah config_row_policies
        if (p.table === "config_row_policies") {
          if (auth.user.role !== 'admin') return out({ success: false, message: "FORBIDDEN_NOT_ADMIN" });
          return out(deleteRowPolicy(p.id, SS));
        }
        // Jika tabel lain, jalankan handleWrite delete biasa
        return out(handleWrite("delete", p.table, p.data, auth.user, SS));

      // ⚙️ ACTION BAWAAN VOYAGER
      case "migrate":
        return out(migrateNewTable(p.data, auth.user, SS));
      case "create":
        return out(handleWrite("create", p.table, p.data, auth.user, SS));
      case "update":
        return out(handleWrite("update", p.table, p.data, auth.user, SS));
      case "flush_logs":
        if (auth.user.role !== 'admin') return out({ success: false, message: "FORBIDDEN" });
        flushEngineLogs();
        return out({ success: true });

      default:
        // Jika sampai sini, berarti action p.action tidak ada yang cocok
        console.error("Action tidak dikenal: " + p.action);
        return out({ success: false, message: "ACTION_UNKNOWN: " + p.action });
    }
  } catch (err) {
    console.error('doPost error', err);
    return out({ success: false, message: "REQ_ERR: " + err.toString() });
  }
}
// ================== MAIN GET HANDLER ==================
function doGet(e) {
  try {
    const { action, table, token, viewMode, sheet: sheetUrl, ua, source, mode, serial } = e.parameter;

    const SS = getDynamicSS(sheetUrl);
    if (!SS) return out({ success: false, message: "SS_MISSING" });

    const auth = verifyToken(token, ua);
    if (!auth.valid) return out({ success: false, message: "401_UNAUTHORIZED" });

    // CAPTURE SERIAL
    const sn = serial || auth.user.serial || '';

    // RECORD LOG
    bufferEngineLog(auth.user.email, sn, 1, `GET:${action}`);

    switch (action) {
      case "listResources":
        return out(listResources(auth.user, SS));
      case "read":
        // 🛡️ NEW: Jika membaca tabel policy, gunakan handler khusus
        if (table === "config_row_policies") return out(readRowPolicies(SS));
        return out(handleRead(table, auth.user, viewMode, SS, source, mode));
      default:
        return out({ success: false, message: "ACTION_UNKNOWN" });
    }
  } catch (err) {
    return out({ success: false, message: "ERR: " + err.toString() });
  }
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


/**
 * FUNGSI PENERAPAN RLS (ROW LEVEL SECURITY) - VOYAGER ENGINE v44.4
 * Sesuai Prinsip Keamanan Juragan: Secure, Scalable, Stable.
 */
function applyRowLevelSecurity(rows, tableName, user, SS) {
  try {
    // 1. Ambil semua aturan policy dari sheet config
    const pRes = readRowPolicies(SS);
    if (!pRes.success) return rows; 
    
    // 2. Filter policy yang hanya berlaku untuk TABEL ini dan ROLE user ini
    const policies = (pRes.data || []).filter(p => 
      p.resource === tableName && 
      p.role === user.role
    );

    // Jika tidak ada aturan khusus untuk role/tabel ini, kembalikan semua data
    if (policies.length === 0) return rows;

    // 3. Urutkan berdasarkan prioritas (Priority 100 ke atas dieksekusi duluan)
    policies.sort((a, b) => (parseInt(b.priority) || 0) - (parseInt(a.priority) || 0));

    // 4. Proses filtering baris demi baris
    return rows.filter(row => {
      // Kita cek terhadap setiap policy yang relevan
      for (let p of policies) {
        const fieldKey = String(p.field).toLowerCase().trim();
        
        // Proteksi jika field yang ditulis di config tidak ada di data_penjualan
        if (!(fieldKey in row)) {
          console.warn(`Policy Error: Field ${fieldKey} tidak ditemukan di tabel ${tableName}`);
          continue; 
        }

        const cellValue = String(row[fieldKey] || "").toLowerCase().trim();
        const targetValue = String(p.value || "").toLowerCase().trim().replace(/"/g, ''); 
        
        let isMatch = false;
        
        // Evaluasi Operator secara dinamis
        switch(p.operator) {
          case "=":  isMatch = (cellValue === targetValue); break;
          case "!=": isMatch = (cellValue !== targetValue); break;
          case ">":  isMatch = (parseFloat(cellValue) > parseFloat(targetValue)); break;
          case "<":  isMatch = (parseFloat(cellValue) < parseFloat(targetValue)); break;
          case "LIKE": isMatch = (cellValue.includes(targetValue)); break;
          default: isMatch = false;
        }

        // JIKA KONDISI COCOK (MATCH):
        if (isMatch) {
          // Putuskan apakah baris ini boleh lewat atau tidak
          // can_view = TRUE -> Lolos (return true)
          // can_view = FALSE -> Terblokir (return false)
          return (String(p.can_view).toUpperCase() === "TRUE");
        }
      }
      // Jika baris ini tidak "terpancing" oleh satupun policy, biarkan muncul secara default
      return true;
    });
  } catch (err) {
    console.error("Critical RLS Error: " + err.toString());
    return rows; // Jika error, amankan dengan menampilkan data (atau ganti [] jika ingin zero-trust)
  }
}

/**
 * ============================================================
 * HANDLE READ (Backend - GAS)
 * ============================================================
 * Fungsi utuh untuk membaca data sheet dengan proteksi RLS.
 */
/**
 * REVISI KHUSUS MODE REFERENCE & RLS
 * Paste bagian ini untuk menggantikan fungsi handleRead, canReadTable, dan getLookupFields yang lama.
 */

function handleRead(tableName, user, viewMode, SS, source = "browse", mode = "browse") {
  try {
    const sheet = SS.getSheetByName(tableName);
    if (!sheet) return { success: false, message: "TABLE_NOT_FOUND" };

    const schema = getTableSchema(sheet);
    const gov = getGov(tableName, user.role, SS);

    // 1. Validasi Akses (Cek apakah ini lookup atau read biasa)
    const access = canReadTable({ user, table: tableName, mode, source, permission: gov, schema });
    if (!access.allow) return { success: false, message: access.reason };

    const fullData = sheet.getDataRange().getValues();
    if (fullData.length < 3) return { success: true, rows: [], schema: schema, modes: gov };

    const headers = fullData[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
    const dataRows = fullData.slice(2);

    // 2. Map ke Object & Filter Dasar
    let formattedRows = dataRows.map(r => {
      const obj = {};
      headers.forEach((key, i) => { obj[key] = r[i]; });
      return obj;
    }).filter(r => {
      const isDeleted = r.deleted_at && r.deleted_at !== "";
      if (viewMode === "trash") return isDeleted;
      if (isDeleted) return false;
      if (gov.ownership_policy === "own" && r.created_by !== user.email) return false;
      return true;
    });

    // 3. 🛡️ TERAPKAN RLS (Row Level Security)
    if (tableName !== "config_row_policies") {
      formattedRows = applyRowLevelSecurity(formattedRows, tableName, user, SS);
    }

    // 4. 🔒 FILTER KOLOM (Jika mode reference/lookup)
    const isLookup = (access.restricted === true);
    
    return {
      success: true,
      rows: isLookup ? formattedRows.map(r => {
        const clean = {};
        access.fields.forEach(f => { clean[f] = r[f]; });
        return clean;
      }) : formattedRows,
      schema: schema,
      modes: gov,
      query_mode: isLookup ? "lookup" : "full"
    };

  } catch (err) {
    console.error("Critical Read Error:", err);
    return { success: false, message: err.toString() };
  }
}

function canReadTable(ctx) {
  const { user, table, mode, source, permission, schema } = ctx;

  // Logic khusus mode reference (lookup)
  if (source === 'lookup' || mode === 'reference') {
    if (!schema) return { allow: false, reason: 'SCHEMA_MISSING' };
    return {
      allow: true,
      restricted: true,
      fields: getLookupFields(schema)
    };
  }

  // Logic read biasa
  if (!permission) return { allow: false, reason: 'NO_PERMISSION' };
  if (permission.can_browse === true) return { allow: true };

  return { allow: false, reason: '403_FORBIDDEN' };
}

function getLookupFields(tableSchema) {
  const allowed = [];
  Object.entries(tableSchema).forEach(([field, cfg]) => {
    if (!cfg) return;
    // Blacklist kolom sensitif
    if (cfg.hidden === true || cfg.type === 'PASSWORD' || cfg.type === 'SECRET' || cfg.sensitive === true || field === 'deleted_at') return;
    allowed.push(field);
  });
  if (!allowed.includes('id')) allowed.unshift('id');
  return allowed;
}

/**
 * ============================================================
 * ROW LEVEL SECURITY MODULE (STARKIT v44.4)
 * ============================================================
 */
function readRowPolicies(SS) {
  try {
    let sheet = SS.getSheetByName("config_row_policies");
    if (!sheet) return { success: true, data: [] };
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return { success: true, data: [] };
    const headers = values[0].map(h => String(h).trim().toLowerCase());
    const data = values.slice(1).map(row => {
      let obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    return { success: true, data: data };
  } catch (e) { return { success: false, message: e.toString() }; }
}

/**
 * CREATE ROW POLICY (Backend - GAS)
 * Fungsi untuk menyimpan aturan keamanan baru ke sheet config_row_policies.
 * Otomatis menangani tanda petik satu (') pada operator agar tidak error di Sheets.
 */
function createRowPolicy(data, SS) {
  const lock = LockService.getScriptLock();
  try {
    // Tunggu akses hingga 10 detik agar tidak tabrakan (Scalability)
    lock.waitLock(10000);
    
    let sheet = SS.getSheetByName("config_row_policies");
    
    // Jika sheet belum ada, buat baru dengan header lengkap
    if (!sheet) {
      sheet = SS.insertSheet("config_row_policies");
      sheet.appendRow([
        'id', 'policy_name', 'resource', 'role', 'field', 
        'operator', 'value', 'can_view', 'priority', 'created_at'
      ]);
      // Beri format teks pada kolom operator dan value agar lebih aman
      sheet.getRange("F:G").setNumberFormat("@"); 
    }

    // 1. GENERATE UNIQUE ID
    const id = "POL-" + Utilities.getUuid().slice(0, 8).toUpperCase();

    // 2. LOGIKA OTOMATIS TANDA PETIK (Anti-Formula Error)
    let op = String(data.operator || "=").trim();
    
    // Pastikan jika isinya = atau !=, kita beri tanda petik satu (') di depannya
    // Google Sheets akan membacanya sebagai teks, bukan awal formula
    if (op === "=" || op === "!=") {
      op = "'" + op; 
    }

    // 3. PREPARASI DATA BARIS
    const rowPayload = [
      id,
      data.policy_name || "New Policy",
      data.resource,     // Nama tabel (data_penjualan)
      data.role,         // Nama role (kasir)
      data.field,        // Nama kolom (status)
      op,                // Operator yang sudah diproteksi ('=)
      data.value,        // Nilai (PAID)
      String(data.can_view).toUpperCase(), // TRUE/FALSE
      data.priority || 100,
      new Date().toISOString()
    ];

    // 4. EKSEKUSI SIMPAN
    sheet.appendRow(rowPayload);

    return { 
      success: true, 
      id: id, 
      message: "Policy saved successfully with operator protection" 
    };

  } catch (err) {
    console.error("Error createRowPolicy:", err);
    return { success: false, message: err.toString() };
  } finally {
    // Selalu lepas lock agar user lain bisa menulis
    lock.releaseLock();
  }
}

function deleteRowPolicy(id, SS) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SS.getSheetByName("config_row_policies");
    if (!sheet) return { success: false };
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, message: "POLICY_NOT_FOUND" };
  } catch (e) { return { success: false, message: e.toString() }; }
  finally { if (lock.hasLock()) lock.releaseLock(); }
}

/**
 * FUNGSI PENERAPAN RLS (ROW LEVEL SECURITY) - VERSI ANTI-ERROR SHEET
 * Menangani karakter khusus seperti '= atau '!= yang ada di Spreadsheet
 */
function applyRowLevelSecurity(rows, tableName, user, SS) {
  try {
    const pRes = readRowPolicies(SS);
    if (!pRes.success) return rows; 
    
    const policies = (pRes.data || []).filter(p => 
      p.resource === tableName && p.role === user.role
    );

    if (policies.length === 0) return rows;

    // Sort prioritas (100 ke atas)
    policies.sort((a, b) => (parseInt(b.priority) || 0) - (parseInt(a.priority) || 0));

    return rows.filter(row => {
      // Loop melalui setiap aturan policy
      for (let p of policies) {
        const fieldKey = String(p.field).toLowerCase().trim();
        if (!(fieldKey in row)) continue;

        const cellValue = String(row[fieldKey] || "").toLowerCase().trim();
        const targetValue = String(p.value || "").toLowerCase().trim().replace(/"/g, '');
        const op = String(p.operator).trim().startsWith("'") ? p.operator.slice(1) : p.operator;

        let isMatch = false;
        if (op === "=") isMatch = (cellValue === targetValue);
        else if (op === "!=") isMatch = (cellValue !== targetValue);
        else if (op === ">") isMatch = (parseFloat(cellValue) > parseFloat(targetValue));
        else if (op === "<") isMatch = (parseFloat(cellValue) < parseFloat(targetValue));

        // JIKA MATCH: Langsung ambil keputusan dari policy ini dan BERHENTI (Return)
        if (isMatch) {
          return (String(p.can_view).toUpperCase() === "TRUE");
        }
      }
      
      /**
       * 💡 LOGIKA DEFAULT (PENTING):
       * Jika ada policy untuk tabel ini tapi baris data tidak "match" dengan value-nya,
       * maka kita harus memutuskan: Apakah default-nya boleh lihat atau tidak?
       * * Rekomendasi: Jika ada policy "=" dan can_view "TRUE", 
       * maka yang tidak match otomatis FALSE (Whitelist mode).
       */
      const hasWhitelist = policies.some(p => String(p.can_view).toUpperCase() === "TRUE");
      return hasWhitelist ? false : true; 
    });
  } catch (err) {
    return rows;
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

// --- 5. MIGRATION ENGINE (FIXED: AUTOFILL RETENTION) ---
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
      
      // 🚀 PERBAIKAN DISINI: Daftarkan SEMUA property autofill agar tertulis ke Sheet
      return JSON.stringify({
        label: (f.label || f.name).toUpperCase(),
        type: (f.type || "TEXT").toUpperCase(),
        hidden: !f.show,
        required: f.required || false,
        disabled: f.disabled || false,
        lookup: lookupData,
        // Tambahkan ini agar tidak hilang saat migrasi:
        formula: f.formula || null,
        autoTrigger: f.autoTrigger || null,
        autoTable: f.autoTable || null,
        autoCol: f.autoCol || null
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

// --- 8. UTILS & HELPERS (FIXED: ROBUST PARSING) ---
function getTableSchema(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  
  const range = sheet.getRange(1, 1, 2, lastCol).getValues();
  const headers = range[0];
  const configRow = range[1];
  const schema = {};
  
  headers.forEach((h, i) => {
    if (!h) return;
    const cleanKey = String(h).trim().toLowerCase().replace(/\s+/g, '_');
    
    // Default config
    let config = { 
      label: h.toUpperCase(), 
      type: "TEXT",
      autoTrigger: null, 
      autoTable: null, 
      autoCol: null 
    };
    
    // 🚀 PERBAIKAN DISINI: Pastikan JSON diparsing dengan benar
    if (configRow[i]) {
      try {
        const strConfig = String(configRow[i]);
        if (strConfig.startsWith('{')) {
          const parsed = JSON.parse(strConfig);
          // Gunakan spread operator agar property dari JSON menimpa default
          config = { ...config, ...parsed };
        }
      } catch (e) {
        console.error("Gagal parse config kolom: " + h);
      }
    }
    
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