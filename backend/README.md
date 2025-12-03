# Game OCR (PaddleOCR + FastAPI)

Python 工具与服务，用 PaddleOCR 识别游戏截图中的三个字段：“现金”“获得经验”“储备金”。

## 准备
- 已有 `.venv`（Python 3.13）。
- 从仓库根目录安装依赖：`./.venv/bin/python -m pip install -r backend/requirements.txt`
- 首次运行会自动下载 OCR 模型，需联网。

## 命令行提取
```
cd backend
../.venv/bin/python extract_game_values.py            # 默认读取 backend/testimage.png
../.venv/bin/python extract_game_values.py your.png   # 指定图片
```
输出示例：
```
现金: 23907041
获得经验: 136848530
储备金: 未识别
```

## FastAPI 服务
启动：
```
cd backend
../.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000
```
接口：
- `GET /health` 健康检查。
- `POST /ocr` 表单文件字段名 `file`，返回识别结果。

示例请求：
```
curl -X POST http://127.0.0.1:8000/ocr \
  -F "file=@testimage.png" | python3 -m json.tool
```
