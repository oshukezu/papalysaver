# Agent Development Specification: Papaly-Style Chrome Extension (Enterprise-Grade)

## 1. 專案背景與痛點剖析 (Background & Critical Pain Points)
* **商業痛點：** 原廠（Papaly）已停止維護其 Chrome 擴充功能（參考版本：`v6.0.1.crx`）。對於高度依賴「自定義標籤/看板」作為數位資產管理與瀏覽器首頁的用戶而言，現正面臨 V2 停用、同步失效、資安漏洞等斷崖式風險。
* **重構目標：** 100% 自主重構（Re-engineer）具備 Papaly 核心體驗的 Chrome Extension，確保其在 Chrome Manifest V3 規範下長期穩定運行。
* **初期核心定位：** 高頻精準的「網址採集與分類傳送器」。

---

## 2. 核心功能需求與規格 (Functional Specifications)

### Phase 1：智慧採集與極簡 UI (Extension Frontend)
* **一鍵解析：** 點擊 Action 圖示，自動且非同步地抓取當前活動分頁（Active Tab）的 `URL`、`Title`（支援手動編輯編輯）與 `Favicon`。
* **階層式路徑選擇：** 串接雲端 API，動態拉取並快取用戶的「Boards（畫布）」與「Categories（分類小工具）」，提供防呆下拉選單。
* **全鍵盤操作優化：** 支援全域快捷鍵喚醒（預設 `Ctrl+Shift+P`），且彈窗內支援 `Tab` 切換與 `Enter` 立即送出，滿足高階用戶的高效要求。

### Phase 2：穩健數據對接 (API & Communication)
* **逆向對接：** 封裝原 Papaly 平台的 Web 認證（Cookie/Session）或 API Token 機制。
* **防斷網機制（Offline-First）：** 當網路異常或 API 超時，資料須自動寫入 `chrome.storage.local` 暫存佇列，恢復連線後背景自動重試同步。

---

## 3. 技術架構與架構師建議 (Technical Architecture & Engineering Best Practices)

### 3.1 規範標準 (Strict Standards)
* **規範：** 必須嚴格採用 Chrome **Manifest V3**（拒絕任何過時的 V2 Background Pages 語法）。
* **核心權限最小化（Least Privilege Principle）：**
  
```json
  "permissions": [
    "activeTab",
    "storage"
  ]