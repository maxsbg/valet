# Freistell-Server: BiRefNet General-dynamic (MIT-Lizenz), Prozessor-Version
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 HF_HUB_OFFLINE=1 MODEL_DIR=/model
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Modell beim Bauen ins Image legen: kein Download beim Start, unabhängig von Hugging Face
RUN HF_HUB_OFFLINE=0 python -c "from huggingface_hub import snapshot_download; snapshot_download('ZhengPeng7/BiRefNet_dynamic', local_dir='/model', allow_patterns=['*.py','*.json','model.safetensors'])"
COPY server.py .
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
