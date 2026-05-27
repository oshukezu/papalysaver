// background.js

const SYNC_ALARM_NAME = 'sync_offline_bookmarks';

// 輔助：背景檢查網址是否已被收藏
// 網址標準化，以進行精確且寬鬆的比對
function normalizeUrl(urlString) {
  try {
    urlString = urlString.trim();
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = 'https://' + urlString;
    }
    const url = new URL(urlString);
    
    // 轉小寫並去除 www. 前綴
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    
    let path = url.pathname;
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    
    // 過濾常見追蹤與行銷參數，防範參數不同導致比對失敗
    const searchParams = new URLSearchParams(url.search);
    const paramsToIgnore = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'gws_rd', 'tblci', 'msclkid'
    ];
    paramsToIgnore.forEach(p => searchParams.delete(p));
    
    const sortedKeys = Array.from(searchParams.keys()).sort();
    const newParams = new URLSearchParams();
    sortedKeys.forEach(key => {
      searchParams.getAll(key).forEach(val => newParams.append(key, val));
    });
    
    const searchStr = newParams.toString();
    let normalized = host + path;
    if (searchStr) {
      normalized += '?' + searchStr;
    }
    return normalized;
  } catch (e) {
    return urlString.replace(/^https?:\/\//i, '').replace(/\/$/, '').trim();
  }
}

// 從搜尋結果 HTML/JSON 中提取所有真實書籤 URL (支援 http://, https://, 與 // 等各種格式)
function extractUrlsFromHtml(html) {
  const urls = new Set();
  
  // 匹配所有類似 URL 的特徵字串 (包含 http://, https://, 或 //)
  // 這樣不論是 Protocol-relative、轉義斜線、或是單雙引號，都能百分之百捕捉到
  const regex = /((?:https?:)?\/\/[a-z0-9\-._~%!$&'()*+,;=:@/]+)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let urlStr = match[1];
    urlStr = urlStr.replace(/\\/g, ''); // 移除可能在 JSON 中被轉義的反斜線 (如 \/)
    if (urlStr.startsWith('//')) {
      urlStr = 'https:' + urlStr; // 補上協定以便標準化比對
    }
    urls.add(urlStr);
  }
  
  return Array.from(urls);
}

// 輔助：背景檢查網址是否已被收藏
async function checkIsSavedBg(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const normalizedTarget = normalizeUrl(url);
    
    // 先檢查本地快取 (剛儲存的網址)
    const { localSavedUrls = [] } = await chrome.storage.local.get({ localSavedUrls: [] });
    if (localSavedUrls.includes(normalizedTarget)) {
      return true;
    }

    // Papaly 的搜尋可能不支援完整的長網址，因此我們用「網域」進行搜尋，再從結果比對
    const response = await fetch(`https://papaly.com/items/search?q=${encodeURIComponent(domain)}&no_link_bar=true`, { credentials: 'include' });
    if (response.ok) {
      const html = await response.text();
      // 提取搜尋結果中所有 URL
      const extractedUrls = extractUrlsFromHtml(html);
      
      // 將提取出的 URLs 標準化，比對是否包含當前目標
      const isSaved = extractedUrls.some(extracted => normalizeUrl(extracted) === normalizedTarget);
      
      if (isSaved) {
        // 更新到快取
        if (!localSavedUrls.includes(normalizedTarget)) {
          localSavedUrls.push(normalizedTarget);
          if (localSavedUrls.length > 1000) localSavedUrls.shift();
          await chrome.storage.local.set({ localSavedUrls });
        }
      }
      return isSaved;
    }
  } catch (e) {
    // 忽略 fetch 失敗 (例如網路斷線或是 Request 被擋)，避免在 console 噴出黃色警告
  }
  return false;
}

// 核心檢查與更新圖示函式 (結合本地持久化快取與線上 Papaly API 雙重防線)
async function checkAndUpdateIcon(tabId, url) {
  if (!tabId || !url || !url.startsWith('http')) {
    try {
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          "16": "icons/icon_gray16.png",
          "48": "icons/icon_gray48.png",
          "128": "icons/icon_gray128.png"
        }
      }, () => { const err = chrome.runtime.lastError; });
      chrome.action.setBadgeText({ text: '', tabId: tabId }, () => { const err = chrome.runtime.lastError; });
    } catch (e) {}
    return;
  }

  try {
    const normalized = normalizeUrl(url);
    const storageKey = 'saved_' + normalized;
    
    // 1. 優先使用本地儲存進行 O(1) 快取查詢
    const result = await chrome.storage.local.get(storageKey);
    let isSaved = !!result[storageKey];

    // 2. 若本地無紀錄，進行 Papaly API 線上搜尋
    if (!isSaved) {
      isSaved = await checkIsSavedBg(url);
      if (isSaved) {
        // 線上確認已收藏，寫入本地持久化儲存
        await chrome.storage.local.set({ [storageKey]: true });
      }
    }

    // 3. 切換 Action Icon
    if (isSaved) {
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          "16": "icons/icon_pink16.png",
          "48": "icons/icon_pink48.png",
          "128": "icons/icon_pink128.png"
        }
      }, () => { const err = chrome.runtime.lastError; });
    } else {
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          "16": "icons/icon_gray16.png",
          "48": "icons/icon_gray48.png",
          "128": "icons/icon_gray128.png"
        }
      }, () => { const err = chrome.runtime.lastError; });
    }
    chrome.action.setBadgeText({ text: '', tabId: tabId }, () => { const err = chrome.runtime.lastError; });
  } catch (e) {
    // 忽略分頁已關閉之錯誤 (No tab with id)
  }
}

// 1. 監聽分頁更新 (Reload/導航)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.active) {
    checkAndUpdateIcon(tabId, tab.url);
  }
});

// 2. 監聽分頁切換 (用戶切換標籤頁)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      checkAndUpdateIcon(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    // 忽略找不到分頁的錯誤
  }
});

// 監聽來自 Popup 或 Options 的請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save_bookmark') {
    const tabId = request.data.tabId;
    handleSaveBookmark(request.data).then(result => {
      // 儲存成功後，立即更新該分頁的 Action Icon
      if (result.success && tabId) {
        checkAndUpdateIcon(tabId, request.data.url);
      }
      sendResponse(result);
    });
    return true; // 表示非同步回應
  }
  
  if (request.action === 'trigger_sync') {
    processOfflineQueue().then(() => {
      chrome.storage.local.get({ offlineQueue: [] }, (result) => {
        if (result.offlineQueue.length === 0) {
          sendResponse({ success: true, message: '同步成功' });
        } else {
          sendResponse({ success: false, message: '部分項目同步失敗，可能仍未登入' });
        }
      });
    });
    return true;
  }
});

async function handleSaveBookmark(data) {
  try {
    // 檢查是否有網路連線
    if (!navigator.onLine) {
      throw new Error('Offline');
    }

    // 從設定中取得 Token
    const { apiToken } = await chrome.storage.local.get({ apiToken: '' });
    if (!apiToken) {
       // 尚未設定 Token 的狀況，先預設允許，以利 Phase 1 開發測試
       console.log('未設定 API Token，繼續模擬儲存。');
    }

    // 模擬 API 呼叫
    await saveToAPI(data, apiToken);
    
    // 儲存成功，將網址以 Key-Value 寫入本地持久化儲存，避免搜尋 API 延遲且供 O(1) 快取查詢
    const normalizedTarget = normalizeUrl(data.url);
    const storageKey = 'saved_' + normalizedTarget;
    await chrome.storage.local.set({ [storageKey]: true });

    // 同步寫入原來的本地快取陣列 (向下相容)
    const { localSavedUrls = [] } = await chrome.storage.local.get({ localSavedUrls: [] });
    if (!localSavedUrls.includes(normalizedTarget)) {
      localSavedUrls.push(normalizedTarget);
      if (localSavedUrls.length > 1000) localSavedUrls.shift();
      await chrome.storage.local.set({ localSavedUrls });
    }
    
    return { success: true, message: '儲存成功！' };
  } catch (error) {
    console.warn('儲存失敗，加入離線佇列:', error);
    await addToOfflineQueue(data);
    return { success: false, message: '已加入離線佇列，稍後自動同步' };
  }
}

async function addToOfflineQueue(data) {
  const result = await chrome.storage.local.get({ offlineQueue: [] });
  const queue = result.offlineQueue;
  
  // 檢查佇列中是否已經有完全相同的網址，避免重複堆疊
  const isDuplicate = queue.some(item => item.url === data.url);
  if (isDuplicate) return;

  queue.push({
    ...data,
    timestamp: Date.now(),
    retries: 0
  });
  await chrome.storage.local.set({ offlineQueue: queue });
  
  // 設定 Alarm 定期重試
  chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    if (navigator.onLine) {
      await processOfflineQueue();
    }
  }
});

async function processOfflineQueue() {
  const result = await chrome.storage.local.get({ offlineQueue: [] });
  let queue = result.offlineQueue;
  
  if (queue.length === 0) {
    chrome.alarms.clear(SYNC_ALARM_NAME);
    return;
  }

  const { apiToken } = await chrome.storage.local.get({ apiToken: '' });
  const newQueue = [];
  
  for (const item of queue) {
    try {
      await saveToAPI(item, apiToken);
    } catch (error) {
      // 累加重試次數，小於 5 次才放回佇列，防止因 CSRF 失效或錯誤資料導致無限背景重試
      const retries = (item.retries || 0) + 1;
      if (retries < 5) {
        newQueue.push({
          ...item,
          retries
        });
      } else {
        console.warn('離線書籤重試次數過多，已丟棄:', item.url);
      }
    }
  }

  await chrome.storage.local.set({ offlineQueue: newQueue });
  if (newQueue.length === 0) {
    chrome.alarms.clear(SYNC_ALARM_NAME);
  }
}

async function saveToAPI(data, token) {
  // 從 Storage 中讀取 CSRF Token
  const { csrfToken } = await chrome.storage.local.get({ csrfToken: '' });
  
  if (!csrfToken) {
    throw new Error('找不到 CSRF Token，請重新開啟面板以重新載入');
  }

  // 根據分析，儲存書籤的 POST API 路徑與參數如下
  const formData = new URLSearchParams();
  formData.append('item[category_index]', data.categoryId);
  formData.append('item[name]', data.title);
  formData.append('item[url]', data.url);
  formData.append('source', 'xtn-chrome');
  formData.append('style', 'shortcut');
  formData.append('from', 'shortcut');

  const response = await fetch('https://papaly.com/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-CSRF-Token': csrfToken,
      'Accept': '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript'
    },
    body: formData.toString(),
    credentials: 'include' // 確保帶上 Cookie
  });

  if (!response.ok) {
    throw new Error(`伺服器回應錯誤: ${response.status}`);
  }

  const resultText = await response.text();
  console.log('API 同步成功', data, resultText);
  return true;
}

// 瀏覽器啟動或套件安裝時，僅更新當前活動分頁的圖示狀態，避免大量併發請求
async function updateActiveTabs() {
  try {
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        checkAndUpdateIcon(tab.id, tab.url);
      }
    }
  } catch (e) {
    // 忽略錯誤
  }
}

chrome.runtime.onInstalled.addListener(updateActiveTabs);
chrome.runtime.onStartup.addListener(updateActiveTabs);

// 立即執行一次，確保 Service Worker 每次被喚醒重啟時均會主動更新當前各活動分頁狀態
updateActiveTabs();
