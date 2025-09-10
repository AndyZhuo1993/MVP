# 健康導覽員 · 零雲端 MVP

一個不需要伺服器的 React 原型（Vite）。所有資料存在瀏覽器 localStorage。含：日記、建議卡、紅旗、照片（本機壓縮）、月曆、CSV 匯出。

## 快速開始
1. 安裝 Node.js 18+ 與 npm/yarn/pnpm
2. 安裝依賴：
   ```bash
   npm i
   ```
3. 開發模式：
   ```bash
   npm run dev
   ```
   打開終端顯示的本機網址（預設 http://localhost:5173）

4. 打包靜態檔：
   ```bash
   npm run build
   npm run preview
   ```

## 風險與聲明
- 僅供參考，非醫療診斷；如有緊急或嚴重症狀請立即就醫。
- 照片僅存本機（Base64），請避免包含可識別個資。
- 後續要「上雲」時，建議切換到 Firebase / Cloud Run 並將建議/紅旗規則搬到你方的黑箱 API。

## Tailwind 樣式
為了快速原型，`index.html` 透過 CDN 載入 Tailwind。正規專案可改為 PostCSS/Tailwind 正式整合。
