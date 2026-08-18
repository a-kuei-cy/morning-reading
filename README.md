# 興嘉國小家長入班晨讀打卡系統－最終校正版

## 固定設定
- 前端：GitHub Pages
- Apps Script API：`https://script.google.com/macros/s/AKfycbzagRlIzKJl8gJ2rrR7f_w8zK35pJ9rD29VYquSeInHtwmgdXhy4X87QDQUyxNXRKJ-/exec`
- Google 試算表 ID：`1FRhJQqQpJpvSuHOR4MZ-USGh072sxPUr9a-lp9NT2Tg`
- 工作表：`晨讀打卡`
- 管理密碼預設：`Xingjia2026!`（正式上線前可在 Code.gs 修改）

## 這版修正
1. 保留新版 RWD 圖片橫幅（`banner.png`）。
2. 統計 JSONP 增加一次自動重試，並改由 `<head>` 載入。
3. 修正舊資料欄位錯位造成日期顯示為 `1` 的問題。
4. `setup()` 會自動偵測舊版資料列，補 UUID、重新對齊日期/班級/學生/家長/書籍/評價/心得，並重算年級。
5. 年級統計固定只顯示一年級至六年級及其他，不再出現額外的 `1` 圖例。
6. 日期統計只接受 `yyyy-mm-dd`，避免錯誤日期污染圖表。

## 更新步驟
1. Google Apps Script：整份覆蓋 `Code.gs`。
2. 儲存後手動執行一次 `setup()`，第一次會要求授權。
3. 到「部署 → 管理部署作業 → 編輯」，版本選「新版本」後部署。
4. GitHub Pages：把 `index.html` 與 `banner.png` 放在同一層並覆蓋舊檔。
5. 等 GitHub Pages 更新後強制重新整理瀏覽器（Ctrl+Shift+R）。
6. 測試統計 API：在 `/exec` 後加 `?action=stats&callback=test`，應看到 `test({...});`。

> 建議先備份試算表。`setup()` 只針對「第一欄不像 UUID、但前兩欄都像日期」的舊資料進行欄位修復。

## 管理者匯出功能
登入「管理」頁後可使用：
- 「匯出完整打卡資料 CSV」：匯出全部打卡紀錄（不受畫面 200 筆上限影響）。
- 「匯出統計數據 CSV」：匯出總人次、平均評分、每日趨勢、各年級比例與星等統計。

兩項匯出都會在 Apps Script 後端驗證管理密碼後才提供資料。
