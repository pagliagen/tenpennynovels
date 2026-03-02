#!/usr/bin/env python3
"""
TenpennyNovels Embeddings Microservice
Persistent HTTP service for semantic embeddings generation
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
import numpy as np

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global model (loaded once at startup)
model = None

def get_model() -> SentenceTransformer:
    """Get or initialize the sentence transformer model"""
    global model
    if model is None:
        model_name = os.getenv('EMBEDDINGS_MODEL', 'paraphrase-multilingual-MiniLM-L12-v2')
        logger.info(f"🚀 Loading model: {model_name}")
        # Use local_files_only=True to avoid HuggingFace API calls after first download
        # Model will be cached in ~/.cache/huggingface/
        try:
            model = SentenceTransformer(model_name, local_files_only=True)
            logger.info(f"✅ Model loaded from cache (offline mode)")
        except Exception as e:
            logger.warning(f"⚠️  Cache miss, downloading from HuggingFace: {e}")
            model = SentenceTransformer(model_name)
            logger.info(f"✅ Model downloaded and cached")
        logger.info(f"   Embedding dimension: {model.get_sentence_embedding_dimension()}")
    return model

def chunk_text(text: str, max_length: int = 500, overlap: int = 50) -> List[str]:
    """
    Smart text chunking with overlap to preserve context

    Args:
        text: Text to chunk
        max_length: Maximum chunk length in characters
        overlap: Overlap between chunks in characters

    Returns:
        List of text chunks
    """
    if len(text) <= max_length:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + max_length
        chunks.append(text[start:end])
        start += (max_length - overlap)

    return chunks


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    model_name = os.getenv('EMBEDDINGS_MODEL', 'paraphrase-multilingual-MiniLM-L12-v2')
    return jsonify({
        'status': 'healthy',
        'service': 'embeddings-service',
        'model': model_name,
        'loaded': model is not None
    })


@app.route('/embed', methods=['POST'])
def generate_embedding():
    """
    Generate embedding for a single text

    Request body:
    {
        "text": "Text to embed"
    }

    Response:
    {
        "success": true,
        "embedding": [0.1, 0.2, ...],
        "dimensions": 384,
        "chunks": 1
    }
    """
    try:
        data = request.get_json()

        if not data or 'text' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing text field in request body'
            }), 400

        text = data['text']
        if not text or not isinstance(text, str):
            return jsonify({
                'success': False,
                'error': 'Text must be a non-empty string'
            }), 400

        # Smart text chunking (non hard-coded truncation)
        chunks = chunk_text(text, max_length=500, overlap=50)

        # Generate embeddings for all chunks
        model_instance = get_model()
        embeddings = [model_instance.encode(chunk, convert_to_numpy=True) for chunk in chunks]

        # Average embeddings if multi-chunk
        if len(embeddings) > 1:
            final_embedding = np.mean(embeddings, axis=0)
        else:
            final_embedding = embeddings[0]

        return jsonify({
            'success': True,
            'embedding': final_embedding.tolist(),
            'dimensions': len(final_embedding),
            'chunks': len(chunks)
        })

    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/embed/batch', methods=['POST'])
def generate_embeddings_batch():
    """
    Generate embeddings for multiple texts (batch processing)

    Request body:
    {
        "texts": ["Text 1", "Text 2", ...]
    }

    Response:
    {
        "success": true,
        "embeddings": [[0.1, ...], [0.2, ...]],
        "count": 2,
        "dimensions": 384
    }
    """
    try:
        data = request.get_json()

        if not data or 'texts' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing texts field in request body'
            }), 400

        texts = data['texts']
        if not isinstance(texts, list) or not texts:
            return jsonify({
                'success': False,
                'error': 'Texts must be a non-empty array'
            }), 400

        # Validate all texts are strings
        if not all(isinstance(t, str) and t for t in texts):
            return jsonify({
                'success': False,
                'error': 'All texts must be non-empty strings'
            }), 400

        # Chunk each text and generate embeddings
        model_instance = get_model()
        all_embeddings = []

        for text in texts:
            chunks = chunk_text(text, max_length=500, overlap=50)
            chunk_embeddings = [model_instance.encode(chunk, convert_to_numpy=True) for chunk in chunks]

            # Average if multi-chunk
            if len(chunk_embeddings) > 1:
                final_embedding = np.mean(chunk_embeddings, axis=0)
            else:
                final_embedding = chunk_embeddings[0]

            all_embeddings.append(final_embedding.tolist())

        return jsonify({
            'success': True,
            'embeddings': all_embeddings,
            'count': len(all_embeddings),
            'dimensions': len(all_embeddings[0]) if all_embeddings else 0
        })

    except Exception as e:
        logger.error(f"Error generating batch embeddings: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/similarity', methods=['POST'])
def compute_similarity():
    """
    Compute cosine similarity between two embeddings

    Request body:
    {
        "embedding1": [0.1, 0.2, ...],
        "embedding2": [0.3, 0.4, ...]
    }

    Response:
    {
        "success": true,
        "similarity": 0.95
    }
    """
    try:
        data = request.get_json()

        if not data or 'embedding1' not in data or 'embedding2' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing embedding1 or embedding2 in request body'
            }), 400

        embedding1 = data['embedding1']
        embedding2 = data['embedding2']

        if not isinstance(embedding1, list) or not isinstance(embedding2, list):
            return jsonify({
                'success': False,
                'error': 'Embeddings must be arrays'
            }), 400

        # Convert to numpy arrays
        emb1 = np.array(embedding1)
        emb2 = np.array(embedding2)

        if emb1.shape != emb2.shape:
            return jsonify({
                'success': False,
                'error': 'Embeddings must have same dimension'
            }), 400

        # Cosine similarity
        similarity = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

        return jsonify({
            'success': True,
            'similarity': float(similarity)
        })

    except Exception as e:
        logger.error(f"Error computing similarity: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.getenv('EMBEDDINGS_SERVICE_PORT', 5001))
    host = os.getenv('EMBEDDINGS_SERVICE_HOST', '127.0.0.1')

    logger.info(f"🚀 Starting TenpennyNovels Embeddings Service")
    logger.info(f"   Host: {host}")
    logger.info(f"   Port: {port}")

    # Pre-load the model at startup
    get_model()

    logger.info("✅ Service ready to accept requests")

    app.run(
        host=host,
        port=port,
        debug=False,
        threaded=True  # Handle multiple requests concurrently
    )
