FROM python:3.12-slim
WORKDIR /app
# CPU-only torch keeps the image a few GB smaller than the default CUDA wheel.
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.14.1 torchvision==0.29.1 pillow==13.0.0 \
    sentence-transformers==6.2.0 transformers==5.20.2
COPY server.py .
ENV HF_HOME=/models PYTHONUNBUFFERED=1
USER 1000:1000
EXPOSE 8000
CMD ["python", "server.py"]
