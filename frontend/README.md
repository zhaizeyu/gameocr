# Frontend (React + Vite + Tailwind v4)

基于 Vite 的 React 19 前端，用于录入/查看“现金、储备金、获得经验”数据并对接后端 OCR。

## 运行
```bash
cd frontend
npm install
npm run dev    # 本地开发，默认端口 5173
npm run build  # 生产构建
```

## 与后端对接（粘贴/选择图片 + 确认上传）
- 后端（FastAPI）默认跑在 `http://localhost:8000`，`POST /ocr` 接收 `file`（图片）。
- `src/App.jsx` 顶部：
  - `API_BASE_URL`：后端地址。
  - `USE_MOCK`：设为 `false` 使用真实 OCR（默认），设为 `true` 走前端模拟。
- 使用流程：
  1) 点击对应“识别 现金+经验”或“识别 储备金”按钮，锁定要填充的区域。
  2) 粘贴剪贴板图片，或点击“选择图片”挑选文件（不会立即上传）。
  3) 在顶部提示条点击“确定上传”后，前端再把图片发给后端 `/ocr` 完成识别；“取消”可重置。

## 主要功能
- 今日录入：初始/最终数据录入，点击“识别”按钮调用（或模拟）OCR，自动填充现金/经验/储备。
- 收益结算：计算净收益、时长、每小时收益。
- 周报表：展示一周的累计数据，可扩展导出功能（按钮预留）。

## 目录说明
- `src/App.jsx`：核心界面与业务逻辑（Tab、录入卡片、结果计算、周报表）。
- `src/main.jsx`：入口文件。
- `src/index.css`：导入 Tailwind v4。
- `vite.config.js` / `package.json`：Vite & 依赖配置。
