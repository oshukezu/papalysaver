document.addEventListener('DOMContentLoaded', () => {
  const apiTokenInput = document.getElementById('apiToken');
  const saveBtn = document.getElementById('saveBtn');
  const statusMsg = document.getElementById('statusMsg');

  // 載入設定
  chrome.storage.local.get({ apiToken: '' }, (items) => {
    apiTokenInput.value = items.apiToken;
  });

  // 儲存設定
  saveBtn.addEventListener('click', () => {
    const token = apiTokenInput.value.trim();
    
    chrome.storage.local.set({ apiToken: token }, () => {
      showStatus('設定已儲存！', 'success');
    });
  });

  // 匯出與匯入 elements
  const exportHtmlBtn = document.getElementById('exportHtmlBtn');
  const exportMdBtn = document.getElementById('exportMdBtn');
  const importFile = document.getElementById('importFile');
  const chooseFileBtn = document.getElementById('chooseFileBtn');
  const copyTxtExample = document.getElementById('copyTxtExample');
  const copyMdExample = document.getElementById('copyMdExample');
  const exampleContainer = document.getElementById('exampleContainer');

  // 範例文字定義
  const txtExampleText = `https://gemini.google.com/app - Gemini
https://github.com - GitHub`;

  const mdExampleText = `- [Gemini](https://gemini.google.com/app)
- [GitHub](https://github.com)`;

  // 初始化範例展示
  exampleContainer.textContent = txtExampleText;

  // 複製 TXT 範例
  copyTxtExample.addEventListener('click', () => {
    exampleContainer.textContent = txtExampleText;
    navigator.clipboard.writeText(txtExampleText).then(() => {
      showStatus('已複製 TXT 範例至剪貼簿！', 'success');
    }).catch(err => {
      showStatus('複製失敗，請手動複製。', 'error');
    });
  });

  // 複製 MD 範例
  copyMdExample.addEventListener('click', () => {
    exampleContainer.textContent = mdExampleText;
    navigator.clipboard.writeText(mdExampleText).then(() => {
      showStatus('已複製 MD 範例至剪貼簿！', 'success');
    }).catch(err => {
      showStatus('複製失敗，請手動複製。', 'error');
    });
  });

  // 公用雲端書籤抓取邏輯
  async function fetchPapalyBookmarks() {
    const response = await fetch('https://papaly.com/', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('NETWORK_ERROR');
    }
    
    const html = await response.text();
    
    // 檢查是否登入
    if (html.includes('/users/sign_in') && !html.includes('csrf-token')) {
      throw new Error('NOT_LOGGED_IN');
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const boardElements = doc.querySelectorAll('.board[board-id]');
    if (boardElements.length === 0) {
      throw new Error('NO_BOARDS');
    }
    
    const data = [];
    boardElements.forEach(boardEl => {
      const boardName = boardEl.getAttribute('board-name') || '未命名畫布';
      const categories = [];
      
      const categoryElements = boardEl.querySelectorAll('.card[category-index]');
      categoryElements.forEach(catEl => {
        const catName = catEl.getAttribute('category-name') || '未命名分類';
        const items = [];
        
        const links = catEl.querySelectorAll('a[href^="http://"], a[href^="https://"]');
        links.forEach(link => {
          const href = link.getAttribute('href');
          // 排除常見社交分享連結
          if (href.includes('facebook.com/sharer') || 
              href.includes('twitter.com/intent') || 
              href.includes('pinterest.com/pin/create') ||
              href.includes('linkedin.com/shareArticle') ||
              href.includes('plus.google.com/share')) {
            return;
          }
          
          const title = link.textContent.trim() || href;
          items.push({ title, url: href });
        });
        
        categories.push({ name: catName, items });
      });
      
      data.push({ name: boardName, categories });
    });
    
    return data;
  }

  // 1. 導出為 HTML 書籤
  exportHtmlBtn.addEventListener('click', async () => {
    showStatus('正在從 papaly.com 讀取雲端書籤，請稍候...', 'info', true);
    
    try {
      const bookmarksData = await fetchPapalyBookmarks();
      const dateNow = Math.floor(Date.now() / 1000);
      let htmlContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>

<DL><p>
`;

      const escapeHtml = (str) => {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
      };

      let bookmarkCount = 0;
      
      bookmarksData.forEach(board => {
        htmlContent += `    <DT><H3 ADD_DATE="${dateNow}" LAST_MODIFIED="${dateNow}">${escapeHtml(board.name)}</H3>\n    <DL><p>\n`;
        board.categories.forEach(category => {
          htmlContent += `        <DT><H3 ADD_DATE="${dateNow}" LAST_MODIFIED="${dateNow}">${escapeHtml(category.name)}</H3>\n        <DL><p>\n`;
          category.items.forEach(item => {
            htmlContent += `            <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${dateNow}">${escapeHtml(item.title)}</A>\n`;
            bookmarkCount++;
          });
          htmlContent += `        </DL><p>\n`;
        });
        htmlContent += `    </DL><p>\n`;
      });
      
      htmlContent += `</DL>\n`;
      
      if (bookmarkCount === 0) {
        showStatus('您的 Papaly 帳號中沒有任何書籤可供導出。', 'error');
        return;
      }
      
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: blobUrl,
        filename: 'papaly_bookmarks.html',
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          showStatus('導出失敗：' + chrome.runtime.lastError.message, 'error');
        } else {
          showStatus(`成功導出 ${bookmarkCount} 個書籤！已開啟另存新檔視窗。`, 'success');
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      });
      
    } catch (err) {
      handleExportError(err);
    }
  });

  // 2. 導出為 MD 書籤
  exportMdBtn.addEventListener('click', async () => {
    showStatus('正在從 papaly.com 讀取雲端書籤，請稍候...', 'info', true);
    
    try {
      const bookmarksData = await fetchPapalyBookmarks();
      let mdContent = '';
      let bookmarkCount = 0;
      
      bookmarksData.forEach(board => {
        mdContent += `# ${board.name}\n\n`;
        board.categories.forEach(category => {
          mdContent += `## ${category.name}\n`;
          category.items.forEach(item => {
            mdContent += `- [${item.title}](${item.url})\n`;
            bookmarkCount++;
          });
          mdContent += `\n`;
        });
      });
      
      if (bookmarkCount === 0) {
        showStatus('您的 Papaly 帳號中沒有任何書籤可供導出。', 'error');
        return;
      }
      
      const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: blobUrl,
        filename: 'papaly_bookmarks.md',
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          showStatus('導出失敗：' + chrome.runtime.lastError.message, 'error');
        } else {
          showStatus(`成功導出 ${bookmarkCount} 個書籤為 Markdown 格式！已開啟儲存對話框。`, 'success');
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      });
      
    } catch (err) {
      handleExportError(err);
    }
  });

  // 統一處理導出錯誤
  function handleExportError(err) {
    console.error(err);
    if (err.message === 'NOT_LOGGED_IN') {
      showStatus('您尚未登入 papaly.com，請先登入官方網站再進行導出！', 'error');
    } else if (err.message === 'NO_BOARDS') {
      showStatus('找不到雲端書籤資料，請確認您已登入且頁面載入正常。', 'error');
    } else {
      showStatus('讀取 papaly.com 失敗，可能因為伺服器當機或網路異常！', 'error');
    }
  }

  // 觸發選擇檔案
  chooseFileBtn.addEventListener('click', () => {
    importFile.click();
  });

  // 處理檔案匯入
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const content = evt.target.result;
      const extension = file.name.split('.').pop().toLowerCase();
      let importedBookmarks = [];

      if (extension === 'md') {
        // 解析 Markdown [標題](網址)
        const mdRegex = /\[([^\]]+)\]\(((?:https?:\/\/|ftp:\/\/|[^\)]+)\))/g;
        let match;
        while ((match = mdRegex.exec(content)) !== null) {
          const title = match[1].trim();
          let url = match[2].trim();
          if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
          }
          importedBookmarks.push({ title, url });
        }
      } else {
        // 解析 TXT (支援 https://example.com - 標題 或 每行僅網址)
        const lines = content.split(/\r?\n/);
        lines.forEach(line => {
          line = line.trim();
          if (!line) return;

          if (/^https?:\/\//i.test(line)) {
            const separatorIndex = line.indexOf(' - ');
            if (separatorIndex !== -1) {
              const url = line.substring(0, separatorIndex).trim();
              const title = line.substring(separatorIndex + 3).trim();
              importedBookmarks.push({ title, url });
            } else {
              importedBookmarks.push({ title: line, url: line });
            }
          } else {
            const separatorIndex = line.indexOf(' - ');
            if (separatorIndex !== -1) {
              let url = line.substring(0, separatorIndex).trim();
              const title = line.substring(separatorIndex + 3).trim();
              if (url.includes('.') && !url.includes(' ')) {
                if (!/^https?:\/\//i.test(url)) {
                  url = 'https://' + url;
                }
                importedBookmarks.push({ title, url });
              }
            }
          }
        });
      }

      if (importedBookmarks.length === 0) {
        showStatus('找不到符合格式的書籤，請確認檔案內容！', 'error');
        importFile.value = '';
        return;
      }

      chrome.storage.local.get({ offlineQueue: [] }, (result) => {
        let queue = result.offlineQueue;
        let addedCount = 0;

        importedBookmarks.forEach(book => {
          const isDuplicate = queue.some(item => item.url === book.url);
          if (!isDuplicate) {
            queue.push({
              title: book.title,
              url: book.url,
              boardId: '',
              categoryId: '',
              timestamp: Date.now(),
              retries: 0
            });
            addedCount++;
          }
        });

        chrome.storage.local.set({ offlineQueue: queue }, () => {
          const skipCount = importedBookmarks.length - addedCount;
          const msg = `成功匯入 ${addedCount} 個書籤，背景正自動排隊同步！` + (skipCount > 0 ? ` (忽略 ${skipCount} 個重複項目)` : '');
          showStatus(msg, 'success');
          importFile.value = '';
        });
      });
    };
    reader.readAsText(file);
  });

  function showStatus(msg, type, isPermanent = false) {
    statusMsg.textContent = msg;
    statusMsg.className = `status ${type}`;
    if (!isPermanent) {
      setTimeout(() => {
        statusMsg.className = 'status';
      }, 4000);
    }
  }
});
