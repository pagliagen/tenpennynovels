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
from embeddings_generator import EmbeddingsGenerator

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global embeddings generator (loaded once at startup)
generator = None

def get_generator() -> EmbeddingsGenerator:
    """Get or initialize the embeddings generator"""
    global generator
    if generator is None:
        model_name = os.getenv('EMBEDDINGS_MODEL', 'paraphrase-multilingual-MiniLM-L12-v2')
        logger.info(f"🚀 Initializing embeddings generator with model: {model_name}")
        generator = EmbeddingsGenerator(model_name)
        generator.load_model()
        logger.info("✅ Model loaded and ready")
    return generator


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'embeddings-service',
        'model': generator.model_name if generator else 'not-loaded'
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
        "dimensions": 384
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

        gen = get_generator()
        embedding = gen.generate_embedding(text)

        return jsonify({
            'success': True,
            'embedding': embedding,
            'dimensions': len(embedding)
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

        gen = get_generator()
        embeddings = gen.generate_embeddings_batch(texts)

        return jsonify({
            'success': True,
            'embeddings': embeddings,
            'count': len(embeddings),
            'dimensions': len(embeddings[0]) if embeddings else 0
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

        gen = get_generator()
        similarity = gen.compute_similarity(embedding1, embedding2)

        return jsonify({
            'success': True,
            'similarity': similarity
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
    get_generator()

    logger.info("✅ Service ready to accept requests")

    app.run(
        host=host,
        port=port,
        debug=False,
        threaded=True  # Handle multiple requests concurrently
    )
