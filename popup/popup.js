document.addEventListener('DOMContentLoaded', async () => {
  const titleInput = document.getElementById('titleInput');
  const urlInput = document.getElementById('urlInput');
  const boardSelect = document.getElementById('boardSelect');
  const categorySelect = document.getElementById('categorySelect');
  const saveBtn = document.getElementById('saveBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const statusMessage = document.getElementById('statusMessage');

  // 網址標準化，以進行精確且寬鬆的比對
  const normalizeUrl = (urlString) => {
    try {
      urlString = urlString.trim();
      if (!/^https?:\/\//i.test(urlString)) {
        urlString = 'https://' + urlString;
      }
      const url = new URL(urlString);
      
      let host = url.hostname.toLowerCase();
      if (host.startsWith('www.')) {
        host = host.slice(4);
      }
      
      let path = url.pathname;
      if (path.endsWith('/') && path.length > 1) {
        path = path.slice(0, -1);
      }
      
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
  };

  // 從搜尋結果 HTML/JSON 中提取所有真實書籤 URL (支援 http://, https://, 與 // 等各種格式)
  const extractUrlsFromHtml = (html) => {
    const urls = new Set();
    const regex = /((?:https?:)?\/\/[a-z0-9\-._~%!$&'()*+,;=:@/]+)/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      let urlStr = match[1];
      urlStr = urlStr.replace(/\\/g, '');
      if (urlStr.startsWith('//')) {
        urlStr = 'https:' + urlStr;
      }
      urls.add(urlStr);
    }
    return Array.from(urls);
  };

  // 輔助：檢查網址是否已被收藏
  const checkIsSaved = async (url) => {
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
        const extractedUrls = extractUrlsFromHtml(html);
        const isSaved = extractedUrls.some(extracted => normalizeUrl(extracted) === normalizedTarget);
        
        if (isSaved) {
          if (!localSavedUrls.includes(normalizedTarget)) {
            localSavedUrls.push(normalizedTarget);
            if (localSavedUrls.length > 1000) localSavedUrls.shift();
            await chrome.storage.local.set({ localSavedUrls });
          }
        }
        return isSaved;
      }
    } catch (e) {
      // 忽略 fetch 失敗 (避免在 Chrome 擴充功能管理頁面跳出黃色警告)
    }
    return false;
  };

  // 用來保存當前分頁資訊，方便 saveBookmark 中使用
  let activeTab = null;

  // 1. 取得當前分頁資訊
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      activeTab = tabs[0];
      titleInput.value = activeTab.title || '';
      urlInput.value = activeTab.url || '';
      
      // Focus 在 title 上，方便使用者修改
      setTimeout(() => titleInput.select(), 100);

      // 非同步檢查是否已收藏
      checkIsSaved(activeTab.url).then(isSaved => {
        if (isSaved && activeTab) {
          const titleHeader = document.querySelector('h1');
          if (titleHeader) {
            titleHeader.innerHTML = 'Papaly Saver <span style="color: #ff4d4f; font-size: 0.9em;">❤️</span>';
          }
          saveBtn.innerHTML = '<span>❤️ 已收藏 (再次儲存)</span><kbd>↵</kbd>';
          saveBtn.style.backgroundColor = '#ff4d4f';
          saveBtn.style.borderColor = '#d9363e';

          // 強制更新工具列圖示，確保狀態同步
          try {
            chrome.action.setIcon({
              tabId: activeTab.id,
              path: {
                "16": "../icons/icon_pink16.png",
                "48": "../icons/icon_pink48.png",
                "128": "../icons/icon_pink128.png"
              }
            }, () => { const err = chrome.runtime.lastError; });
            chrome.action.setBadgeText({ text: '', tabId: activeTab.id }, () => { const err = chrome.runtime.lastError; });
          } catch (e) {}
        }
      });
    }
  } catch (err) {
    console.error('無法獲取分頁資訊:', err);
    showStatus('無法獲取當前頁面資訊', 'error');
  }

  // 2. 抓取真實的 Boards 與 Categories (從 papaly.com)
  const fetchPapalyData = async () => {
    try {
      const response = await fetch('https://papaly.com/', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('請先登入 Papaly');
      }
      const html = await response.text();
      
      // 若回傳的是登入頁，通常會有登入表單或特定的標記
      if (html.includes('/users/sign_in') && !html.includes('csrf-token')) {
         throw new Error('尚未登入 Papaly');
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 取得 CSRF Token 並存入 storage，供 background.js 使用
      const csrfMeta = doc.querySelector('meta[name="csrf-token"]');
      const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';
      if (csrfToken) {
        await chrome.storage.local.set({ csrfToken });
      }

      const boards = [];
      const categories = {};

      // 解析 Boards 與 Categories
      // 根據分析，papaly 會把 board 資料放在 .board 或 #sidebar-nav 中。
      // 最直接的是透過 .board 元素
      const boardElements = doc.querySelectorAll('.board[board-id]');
      
      if (boardElements.length === 0) {
        throw new Error('找不到畫布，可能尚未登入或頁面結構改變');
      }

      boardElements.forEach(boardEl => {
        const boardId = boardEl.getAttribute('board-id');
        const boardName = boardEl.getAttribute('board-name') || '未命名畫布';
        
        boards.push({ id: boardId, name: boardName });
        categories[boardId] = [];

        // 該看板下的分類 (Categories)
        const categoryElements = boardEl.querySelectorAll('.card[category-index]');
        categoryElements.forEach(catEl => {
          const catId = catEl.getAttribute('category-index');
          const catName = catEl.getAttribute('category-name') || '未命名分類';
          categories[boardId].push({ id: catId, name: catName });
        });
      });

      return { boards, categories };
    } catch (err) {
      console.warn("Papaly user is not logged in yet:", err.message);
      
      // 隱藏主要表單與 Footer，顯示專屬的登入提示畫面
      document.getElementById('formContent').classList.add('hidden');
      document.getElementById('mainFooter').classList.add('hidden');
      document.getElementById('loginPrompt').classList.remove('hidden');
      
      return null;
    }
  };

  boardSelect.innerHTML = '<option value="" disabled selected>載入中...</option>';
  const papalyData = await fetchPapalyData();

  if (papalyData) {
    // 初始化 Boards 下拉選單，加入 Inbox 預設選項
    boardSelect.innerHTML = '<option value="">📥 預設：暫存區 (Inbox)</option>';
    papalyData.boards.forEach(board => {
      const option = document.createElement('option');
      option.value = board.id;
      option.textContent = board.name;
      boardSelect.appendChild(option);
    });

    // 初始化 Category
    categorySelect.innerHTML = '<option value="">📥 預設：暫存區 (Inbox)</option>';
    categorySelect.disabled = true;

    // 當選擇 Board 時，更新 Categories 下拉選單
    boardSelect.addEventListener('change', (e) => {
      const boardId = e.target.value;
      
      if (boardId && papalyData.categories[boardId]) {
        categorySelect.innerHTML = '';
        papalyData.categories[boardId].forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          categorySelect.appendChild(option);
        });
        categorySelect.disabled = false;
      } else {
        categorySelect.innerHTML = '<option value="">📥 預設：暫存區 (Inbox)</option>';
        categorySelect.disabled = true;
      }
    });
  }

  // 3. 儲存書籤邏輯
  const saveBookmark = async () => {
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();
    const boardId = boardSelect.value;
    const categoryId = categorySelect.value;

    if (!title || !url) {
      showStatus('標題與網址不能為空', 'error');
      return;
    }

    // UI 切換為 loading
    saveBtn.classList.add('loading');
    saveBtn.disabled = true;
    hideStatus();

    const data = { 
      title, 
      url, 
      boardId, 
      categoryId,
      tabId: activeTab ? activeTab.id : null
    };

    // 透過 Runtime message 傳遞給 Background
    chrome.runtime.sendMessage({ action: 'save_bookmark', data }, (response) => {
      saveBtn.classList.remove('loading');
      saveBtn.disabled = false;

      if (chrome.runtime.lastError) {
        showStatus('擴充功能內部錯誤', 'error');
        return;
      }

      if (response && response.success) {
        // 成功儲存後，本地同步寫入 Key-Value 持久化儲存以利 O(1) 查詢
        const normalizedTarget = normalizeUrl(urlInput.value.trim());
        const storageKey = 'saved_' + normalizedTarget;
        chrome.storage.local.set({ [storageKey]: true }, () => {
          showStatus(response.message, 'success');
          setTimeout(() => window.close(), 1000);
        });
      } else if (response && !response.success) {
        // 離線佇列同步狀況
        showStatus(response.message, 'success'); 
        setTimeout(() => window.close(), 1500);
      }
    });
  };

  saveBtn.addEventListener('click', saveBookmark);

  // 4. 全鍵盤操作支援
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBookmark();
    }
  });

  // 5. 設定頁面導向
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 輔助函式
  function showStatus(msg, type) {
    statusMessage.textContent = msg;
    statusMessage.className = `status-message ${type}`;
  }

  function hideStatus() {
    statusMessage.className = 'status-message hidden';
  }
});
