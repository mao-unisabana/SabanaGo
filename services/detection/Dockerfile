FROM python:3.11-slim

# OpenCV necesita estas libs del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Descargar el modelo en el build para no depender de red en la demo
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

COPY sabanago_detection ./sabanago_detection

EXPOSE 8000
CMD ["python", "-m", "sabanago_detection"]
