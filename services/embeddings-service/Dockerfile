# TenpennyNovels Embeddings Service Dockerfile
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the model to bake it into the image (optional but recommended)
# This makes startup much faster
RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# Copy application code
COPY embeddings_service.py .

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5001/health || exit 1

# Set environment variables
ENV EMBEDDINGS_SERVICE_HOST=0.0.0.0
ENV EMBEDDINGS_SERVICE_PORT=5001
ENV EMBEDDINGS_MODEL=paraphrase-multilingual-MiniLM-L12-v2
ENV LOG_LEVEL=INFO
ENV PYTHONUNBUFFERED=1

# Run the service
CMD ["python3", "embeddings_service.py"]
