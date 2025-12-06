# Multi-stage build: backend (Python) + frontend (Vite static)

FROM node:20-bullseye AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./ 
RUN npm install --legacy-peer-deps
COPY frontend ./ 
RUN npm run build

FROM python:3.13-slim AS backend
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \ 
    build-essential \ 
    libglib2.0-0 libsm6 libxrender1 libxext6 \ 
    libgl1 \ 
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# App code
COPY backend /app/backend
COPY --from=frontend-build /app/frontend/dist /app/backend/static

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UVICORN_PORT=8000 \
    UVICORN_HOST=0.0.0.0 \
    DATA_DIR=/app/backend/data

WORKDIR /app/backend

# Create data/log dirs
RUN mkdir -p /app/backend/data/images /app/backend/logs

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
