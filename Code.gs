const SPREADSHEET_ID = '1FRhJQqQpJpvSuHOR4MZ-USGh072sxPUr9a-lp9NT2Tg';
const SHEET_NAME = '晨讀打卡';
const PHOTO_FOLDER_NAME = '興嘉國小晨讀照片';
const ADMIN_KEY = 'Xingjia2026!'; // 上線前請自行修改

const HEADERS = [
  'ID','建立時間','入班日期','班級','年級','學生姓名','家長姓名',
  '閱讀書籍','評價','回饋心得','照片網址','照片檔名'
];

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  // 先修復早期版本寫入、但之後被新版標題列錯位的舊資料。
  // 舊版欄位：建立時間、入班日期、班級、學生、家長、書籍、評價、心得、照片網址、照片檔名
  // 新版欄位：ID、建立時間、入班日期、班級、年級、學生、家長、書籍、評價、心得、照片網址、照片檔名
  repairLegacyRows_(sheet);

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#0f9d75')
    .setFontColor('#ffffff');
  sheet.autoResizeColumns(1, HEADERS.length);
  sheet.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange('C:C').setNumberFormat('yyyy-mm-dd');

  getPhotoFolder_();
  return 'setup 完成；已檢查並修復舊資料欄位';
}

function repairLegacyRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const width = Math.max(HEADERS.length, sheet.getLastColumn());
  const range = sheet.getRange(2, 1, lastRow - 1, width);
  const rows = range.getValues();
  let changed = false;

  const repaired = rows.map(row => {
    const r = row.slice(0, HEADERS.length);
    while (r.length < HEADERS.length) r.push('');

    // 新版資料第一欄為 UUID；舊版第一欄則是建立時間。
    const first = r[0];
    const second = r[1];
    if (looksLikeUuid_(first)) return r;

    if (looksLikeDateValue_(first) && looksLikeDateValue_(second)) {
      changed = true;
      const oldCreatedAt = first;
      const oldDate = second;
      const oldClass = r[2];
      const oldStudent = r[3];
      const oldParent = r[4];
      const oldBook = r[5];
      const oldRating = r[6];
      const oldFeedback = r[7];
      const oldPhotoUrl = r[8];
      const oldPhotoName = r[9];

      return [
        Utilities.getUuid(),
        oldCreatedAt,
        normalizeDateValue_(oldDate),
        oldClass,
        extractGrade_(oldClass),
        oldStudent,
        oldParent,
        oldBook,
        oldRating,
        oldFeedback,
        oldPhotoUrl,
        oldPhotoName
      ];
    }

    return r;
  });

  if (changed) {
    sheet.getRange(2, 1, repaired.length, HEADERS.length).setValues(repaired);
  }
}

function looksLikeUuid_(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '').trim());
}

function looksLikeDateValue_(v) {
  if (v instanceof Date && !isNaN(v)) return true;
  const s = String(v || '').trim();
  return /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(s);
}

function normalizeDateValue_(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy-MM-dd');
  }
  const s = String(v || '').trim();
  const m = s.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  return m ? m[1] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[3]).padStart(2,'0') : s.slice(0,10);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || 'ping';
  const callback = sanitizeCallback_(p.callback || 'callback');

  let data;
  try {
    if (action === 'ping') {
      data = { ok: true, message: '興嘉國小晨讀 API 正常', time: new Date().toISOString() };
    } else if (action === 'stats') {
      data = getStats_();
    } else if (action === 'adminAuth') {
      if (p.key !== ADMIN_KEY) throw new Error('管理密碼錯誤');
      data = { ok: true, message: '登入成功' };
    } else if (action === 'adminList') {
      if (p.key !== ADMIN_KEY) throw new Error('管理密碼錯誤');
      data = { ok: true, rows: getAdminRows_() };
    } else if (action === 'adminExportData') {
      if (p.key !== ADMIN_KEY) throw new Error('管理密碼錯誤');
      data = { ok: true, rows: getAdminRowsAll_() };
    } else if (action === 'adminExportStats') {
      if (p.key !== ADMIN_KEY) throw new Error('管理密碼錯誤');
      data = getStats_();
    } else {
      data = { ok: false, message: '未知 action' };
    }
  } catch (err) {
    data = { ok: false, message: err.message || String(err) };
  }

  return jsonp_(callback, data);
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || 'submit';
  let result;

  try {
    if (action === 'submit') {
      result = submitCheckin_(p);
    } else if (action === 'adminDelete') {
      if (p.key !== ADMIN_KEY) throw new Error('管理密碼錯誤');
      result = deleteRecord_(p.id);
    } else {
      result = { ok: false, message: '未知 action' };
    }
  } catch (err) {
    result = { ok: false, message: err.message || String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function submitCheckin_(p) {
  const required = ['date','className','studentName','parentName','book','rating','feedback'];
  required.forEach(k => {
    if (!String(p[k] || '').trim()) throw new Error('欄位不完整：' + k);
  });

  const rating = Number(p.rating);
  if (!(rating >= 1 && rating <= 5)) throw new Error('評價需為 1 到 5 星');

  const id = Utilities.getUuid();
  const createdAt = new Date();
  const grade = extractGrade_(p.className);
  let photoUrl = '';
  let photoName = '';

  if (p.photoBase64) {
    const photo = savePhoto_(p.photoBase64, p.photoMimeType, p.photoName, id);
    photoUrl = photo.url;
    photoName = photo.name;
  }

  const sheet = getSheet_();
  sheet.appendRow([
    id, createdAt, p.date, p.className, grade, p.studentName, p.parentName,
    p.book, rating, p.feedback, photoUrl, photoName
  ]);

  return { ok: true, id: id, message: '打卡成功' };
}

function getStats_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter(r => r[0]);

  const byDate = {};
  const byGrade = {'一年級':0,'二年級':0,'三年級':0,'四年級':0,'五年級':0,'六年級':0,'其他':0};
  const ratings = {1:0,2:0,3:0,4:0,5:0};
  let ratingSum = 0;
  let ratingCount = 0;

  rows.forEach(r => {
    const dateKey = normalizeDate_(r[2]);
    if (dateKey) byDate[dateKey] = (byDate[dateKey] || 0) + 1;

    // 舊資料可能把年級存成「1」「2」等值，統計前統一轉為正式年級名稱。
    // 若年級欄位空白或格式異常，改由班級欄位重新判斷。
    const rawGrade = String(r[4] || '').trim();
    const grade = normalizeGrade_(rawGrade, r[3]);
    byGrade[grade] += 1;

    const rating = Number(r[8]);
    if (ratings[rating] !== undefined) {
      ratings[rating]++;
      ratingSum += rating;
      ratingCount++;
    }
  });

  const dateSeries = Object.keys(byDate).sort().slice(-14).map(date => ({ date, count: byDate[date] }));
  // 固定順序輸出，不讓「1」「2」等舊資料值變成額外圖例。
  const gradeOrder = ['一年級','二年級','三年級','四年級','五年級','六年級','其他'];
  const gradeSeries = gradeOrder.map(name => ({ name, count: byGrade[name] || 0 }));
  const ratingSeries = [5,4,3,2,1].map(star => ({ star, count: ratings[star] }));

  return {
    ok: true,
    total: rows.length,
    averageRating: ratingCount ? Number((ratingSum / ratingCount).toFixed(1)) : 0,
    dateSeries,
    gradeSeries,
    ratingSeries
  };
}

function mapAdminRow_(r) {
  return {
    id:r[0], createdAt:r[1], date:r[2], className:r[3], grade:r[4], studentName:r[5],
    parentName:r[6], book:r[7], rating:r[8], feedback:r[9], photoUrl:r[10], photoName:r[11]
  };
}

function getAdminRows_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  return values.slice(1).filter(r => r[0]).reverse().slice(0, 200).map(mapAdminRow_);
}

function getAdminRowsAll_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  return values.slice(1).filter(r => r[0]).reverse().map(mapAdminRow_);
}

function deleteRecord_(id) {
  if (!id) throw new Error('缺少資料 ID');
  const sheet = getSheet_();
  const values = sheet.getRange(2,1,Math.max(sheet.getLastRow()-1,0),1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return { ok: true, message: '刪除成功' };
    }
  }
  throw new Error('找不到資料');
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function savePhoto_(base64, mimeType, originalName, id) {
  mimeType = mimeType || 'image/jpeg';
  const cleaned = String(base64).replace(/^data:[^;]+;base64,/, '');
  const bytes = Utilities.base64Decode(cleaned);
  if (bytes.length > 5 * 1024 * 1024) throw new Error('照片超過 5MB');

  const ext = mimeType.indexOf('png') >= 0 ? '.png' : '.jpg';
  const name = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '_' + id.slice(0,8) + ext;
  const blob = Utilities.newBlob(bytes, mimeType, name);
  const file = getPhotoFolder_().createFile(blob);
  return { name: file.getName(), url: file.getUrl() };
}

function getPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('PHOTO_FOLDER_ID');
  if (saved) {
    try { return DriveApp.getFolderById(saved); } catch (e) {}
  }
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}


function normalizeGrade_(rawGrade, className) {
  const s = String(rawGrade || '').trim();
  const aliases = {
    '1':'一年級','1年':'一年級','1年級':'一年級','一':'一年級','一年':'一年級','一年級':'一年級',
    '2':'二年級','2年':'二年級','2年級':'二年級','二':'二年級','二年':'二年級','二年級':'二年級',
    '3':'三年級','3年':'三年級','3年級':'三年級','三':'三年級','三年':'三年級','三年級':'三年級',
    '4':'四年級','4年':'四年級','4年級':'四年級','四':'四年級','四年':'四年級','四年級':'四年級',
    '5':'五年級','5年':'五年級','5年級':'五年級','五':'五年級','五年':'五年級','五年級':'五年級',
    '6':'六年級','6年':'六年級','6年級':'六年級','六':'六年級','六年':'六年級','六年級':'六年級'
  };
  if (aliases[s]) return aliases[s];
  const fromRaw = extractGrade_(s);
  if (fromRaw !== '其他') return fromRaw;
  const fromClass = extractGrade_(className);
  return fromClass || '其他';
}

function extractGrade_(className) {
  const s = String(className || '');
  const m = s.match(/([1-6一二三四五六])\s*年?/);
  if (!m) return '其他';
  const map = {'1':'一年級','2':'二年級','3':'三年級','4':'四年級','5':'五年級','6':'六年級','一':'一年級','二':'二年級','三':'三年級','四':'四年級','五':'五年級','六':'六年級'};
  return map[m[1]] || '其他';
}

function normalizeDate_(v) {
  const normalized = normalizeDateValue_(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function sanitizeCallback_(name) {
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(name) ? name : 'callback';
}

function jsonp_(callback, data) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
