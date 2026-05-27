├── manifest.json         # V3 配置核心
├── background.js         # Service Worker (處理異步認證、佇列重試，隨開隨滅)
├── popup/
│   ├── popup.html        # 極簡收藏面板 UI
│   ├── popup.js          # DOM 互動、資料校驗、調用背景 Service Worker
│   └── popup.css         # 原生 CSS (避免載入外部 Framework 拖慢渲染)
└── options/
    ├── options.html      # 帳戶認證、快取清理、API 端點配置頁
    └── options.js