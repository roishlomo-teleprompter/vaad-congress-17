/**
 * ===================================================================
 * בדיקת רישיון - Vaad Receipt App
 * ===================================================================
 * קובץ זה רץ תחת החשבון שלך (רועי), לא תחת חשבון הלקוח.
 * הוא קורא גיליון פרטי שרק אתה שולט בו, וקובע אם המייל שמנסה
 * להתחבר לאפליקציה רשום כלקוח פעיל.
 *
 * הגדרה (חד-פעמי):
 * 1. צור Google Sheet פרטי חדש בשם "רישיונות - קבלות ועד".
 * 2. בלשונית הראשונה (שנה את שמה ל"רישיונות" בדיוק), הכנס שורת כותרות:
 *      Email | שם בניין | תאריך תפוגה | סטטוס
 *    ומתחתיה שורה לכל לקוח, לדוגמה:
 *      roi.shlomo@gmail.com | קונגרס 17 | 31/12/2026 | פעיל
 * 3. העתק את ה-Spreadsheet ID מתוך ה-URL של הגיליון הזה (בין /d/ ל-/edit).
 * 4. הדבק אותו ב-LICENSE_SHEET_ID למטה.
 * 5. בחר SHARED_SECRET - מחרוזת אקראית משלך (לדוגמה תוצאה מ-
 *    https://www.uuidgenerator.net) - והדבק גם אותה למטה.
 * 6. Deploy → New deployment → Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *    לחץ Deploy, אשר הרשאות, והעתק את ה-"Web app URL" שמתקבל.
 * 7. את ה-URL הזה ואת ה-SHARED_SECRET תדביק בקוד של index-generic.html
 *    (ב-LICENSE_API_URL ו-LICENSE_SECRET).
 * ===================================================================
 */

const LICENSE_SHEET_ID = 'PASTE_YOUR_LICENSE_SPREADSHEET_ID_HERE';
const SHEET_TAB_NAME    = 'רישיונות';
const SHARED_SECRET     = 'PASTE_A_RANDOM_SECRET_STRING_HERE';

function doGet(e) {
  const email = ((e.parameter.email || '') + '').trim().toLowerCase();
  const key   = (e.parameter.key || '') + '';

  if (key !== SHARED_SECRET) {
    return jsonResponse({ allowed: false, message: 'גישה לא מורשית.' });
  }
  if (!email) {
    return jsonResponse({ allowed: false, message: 'חסר מייל.' });
  }

  try {
    const sheet = SpreadsheetApp.openById(LICENSE_SHEET_ID).getSheetByName(SHEET_TAB_NAME);
    const data  = sheet.getDataRange().getValues();
    const header = data[0].map(h => (h || '').toString().trim());

    const emailIdx    = header.indexOf('Email');
    const buildingIdx = header.indexOf('שם בניין');
    const expiryIdx   = header.indexOf('תאריך תפוגה');
    const statusIdx   = header.indexOf('סטטוס');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowEmail = ((row[emailIdx] || '') + '').trim().toLowerCase();
      if (rowEmail === email) {
        const status      = ((row[statusIdx] || '') + '').trim();
        const expiryRaw   = row[expiryIdx];
        const expiryDate  = expiryRaw ? new Date(expiryRaw) : null;
        const isExpired   = expiryDate && !isNaN(expiryDate) && expiryDate < new Date();
        const isActive    = status === 'פעיל' && !isExpired;

        return jsonResponse({
          allowed:      isActive,
          buildingName: row[buildingIdx] || '',
          expiry:       (expiryDate && !isNaN(expiryDate)) ? expiryDate.toISOString() : null,
          message:      isActive ? '' : (isExpired ? 'המנוי פג תוקף.' : 'המנוי אינו פעיל כרגע.')
        });
      }
    }
    return jsonResponse({ allowed: false, message: 'חשבון זה אינו רשום כלקוח פעיל.' });

  } catch (err) {
    return jsonResponse({ allowed: false, message: 'שגיאת שרת בבדיקת הרישיון.' });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
