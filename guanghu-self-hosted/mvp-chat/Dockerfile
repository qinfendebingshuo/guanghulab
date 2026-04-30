# 光湖 MVP Chat · Dockerfile
# 工单: YD-A05-20260430-MVP

FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 复制代码
COPY . /app/

# 前端静态文件位置
ENV PYTHONPATH=/app

EXPOSE 3000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "3000"]
