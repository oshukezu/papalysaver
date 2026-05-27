# Papaly Saver

這是一個非官方開源的 Chrome 擴充功能，基於最新 Chrome Manifest V3 規範重新打造。
This is an unofficial, open-source Chrome extension rebuilt based on the latest Chrome Manifest V3 specification.

*   **專案監製/設計 (Created by)**: J.J. Wang
*   **語言導航 (Navigation)**: [繁體中文](#繁體中文) | [English](#english)

---

## 繁體中文

### 數位書籤囤積症救星

這是一個用於快速採集網址並同步至 [Papaly](https://papaly.com/) 帳號的 Chrome 擴充功能。

### 🌟 核心功能
*   ⚡ **快速採集**：點擊即可自動非同步抓取當前網頁的標題與網址，並支援手動編輯。
*   📁 **雲端同步**：自動同步並載入您在 Papaly 雲端上的「畫布 (Boards)」與「分類 (Categories)」。
*   ❤️ **狀態識別**：若當前網址已被收藏，套件圖示會自動變換為愛心狀態並標示「已收藏」。
*   ⌨️ **鍵盤優化**：支援彈窗內全鍵盤操作，按 `Enter` 可立即儲存，並支援快捷鍵喚醒（`Command+Shift+P` 或 `Ctrl+Shift+P`）。
*   🚀 **請求防護優化**：改為僅在當前活動分頁 (Active Tab) 進行 API 收藏狀態檢查，大幅減低高達 99% 的併發網路請求，防止對 `papaly.com` 造成負載過重而導致 Heroku 伺服器崩潰（Application Error）。
*   📥 **批次匯入**：支援 `.txt` 與 `.md` 檔案批次匯入書籤至背景佇列中排程自動同步（設定頁內附有一鍵複製範例與說明）。
*   📤 **雙格式導出**：支援將您的雲端書籤完整導出為**瀏覽器標準 HTML 書籤**或是 **Markdown (MD) 備份檔案**，下載時會彈出對話框，可自訂要儲存的目錄路徑（產生的 `.md` 與批次匯入格式 100% 相容）。

### 📦 安裝指引
1.  下載或複製本專案程式碼至您的本機目錄。
2.  打開 Chrome 瀏覽器，前往 `chrome://extensions/`（擴充功能管理頁面）。
3.  開啟右上角的「**開發者模式**」。
4.  點擊左上角的「**載入未封裝擴充功能** (Load unpacked)」。
5.  選取本專案的根目錄資料夾，即可載入完成！

### ⚙️ 使用說明
1.  載入完成後，點選套件圖示或進入「**選項** (Options)」設定頁面。
2.  若要同步至雲端，請先在底部輸入並儲存您的 **Papaly API Token**。
3.  您可在設定頁面上方使用「**匯入與導出**」功能，將您雲端的所有書籤導出備份，或批次匯入外部書籤。
4.  在任何瀏覽分頁點擊套件圖示，或按下快捷鍵 `Command+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows)，即可選擇畫布與分類並將網址儲存至 Papaly。

### ⚖️ 免責聲明
本專案為開源社群專案，旨在提供高頻精準的網址採集與分類傳送功能。本工具並非由 Papaly 官方開發、授權或認可。所有商標與版權均屬於其各自擁有者。使用本擴充功能所產生的任何風險由使用者自行承擔。

---

## English

### The Ultimate Savior for Bookmark Hoarders

A Chrome extension for quickly clipping URLs and syncing them to your [Papaly](https://papaly.com/) account.

### 🌟 Key Features
*   ⚡ **Quick Clipping**: One-click asynchronous fetching of current webpage title and URL, with manual editing support.
*   📁 **Cloud Sync**: Automatically syncs and loads your "Boards" and "Categories" from your Papaly cloud account.
*   ❤️ **State Identification**: If the URL is already bookmarked, the extension icon automatically changes to a pink heart marked as "Saved".
*   ⌨️ **Keyboard Optimized**: Supports full keyboard operations in the popup, press `Enter` to save immediately. Shortcuts: `Command+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows).
*   🚀 **Request Protection**: Restricts API checking to the active tab only. This reduces concurrent network requests by 99%, preventing server overload and crashes on `papaly.com` (Heroku Application Error).
*   📥 **Batch Import**: Supports batch importing bookmarks via `.txt` and `.md` files into the background offline queue for auto-syncing (examples and one-click copy available on the options page).
*   📤 **Dual-Format Export**: Supports exporting all cloud bookmarks into standard **HTML format** or **Markdown (MD) backup files**, prompting a browser dialog to choose your preferred download directory (the exported `.md` is 100% compatible with the import format).

### 📦 Installation
1.  Download or clone this repository to your local directory.
2.  Open your Chrome browser and navigate to `chrome://extensions/`.
3.  Enable **"Developer mode"** in the top-right corner.
4.  Click **"Load unpacked"** in the top-left corner.
5.  Select the root folder of this project to load the extension.

### ⚙️ Usage
1.  Once loaded, click the extension icon or open the **Options** settings page.
2.  To sync with the cloud, input and save your **Papaly API Token** at the bottom.
3.  Use the **"Import & Export"** panel at the top of the settings page to backup your bookmarks or batch import new ones.
4.  Click the extension icon or press `Command+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows) on any webpage to select a board and category to save the bookmark.

### ⚖️ Disclaimer
This is an open-source community project designed to provide high-frequency, precise URL clipping and categorization. This tool is NOT developed, authorized, or endorsed by Papaly. All trademarks and copyrights belong to their respective owners. Use of this extension is at your own risk.
