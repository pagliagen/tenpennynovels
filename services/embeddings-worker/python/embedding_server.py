#!/usr/bin/env python3
"""
Python Embedding & Moderation Server - Subprocess per sentence-transformers + toxicity classifier
Comunica con Node.js via JSON su stdin/stdout
"""

import sys
import json
import logging
from sentence_transformers import SentenceTransformer
from typing import Dict, Any

# Setup logging (stderr per non interferire con stdout IPC)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Model configuration
MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
MODERATION_MODEL_NAME = 'MilaNLProc/hate-ita'
MAX_TEXT_LENGTH = 10000  # chars

class EmbeddingServer:
    def __init__(self):
        self.model = None
        self.moderation_pipeline = None

    def load_model(self):
        """Load embedding model from cache (offline mode preferred)"""
        try:
            logger.info(f"Loading embedding model: {MODEL_NAME}")
            self.model = SentenceTransformer(MODEL_NAME, local_files_only=True)
            logger.info("Embedding model loaded from cache (offline mode)")
        except Exception as e:
            logger.warning(f"Cache miss, downloading from HuggingFace: {e}")
            self.model = SentenceTransformer(MODEL_NAME)
            logger.info("Embedding model downloaded and cached")

        logger.info(f"Embedding dimension: {self.model.get_sentence_embedding_dimension()}")

    def load_moderation_model(self):
        """Load toxicity classification model"""
        try:
            from transformers import pipeline
            logger.info(f"Loading moderation model: {MODERATION_MODEL_NAME}")
            self.moderation_pipeline = pipeline(
                "text-classification",
                model=MODERATION_MODEL_NAME,
                truncation=True,
                max_length=512
            )
            logger.info("Moderation model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load moderation model: {e}")
            logger.warning("Moderation will be unavailable - embedding will still work")

    def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process request based on type: 'embed' (default) or 'moderate'"""
        try:
            req_type = request.get('type', 'embed')

            if req_type == 'moderate':
                return self._handle_moderation(request)
            else:
                return self._handle_embedding(request)

        except Exception as e:
            logger.error(f"Error processing request: {e}")
            return {'success': False, 'error': str(e)}

    def _handle_embedding(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate embedding for text"""
        text = request.get('text', '')

        if not text or not isinstance(text, str):
            return {'success': False, 'error': 'Invalid text parameter'}

        if len(text) > MAX_TEXT_LENGTH:
            return {'success': False, 'error': f'Text too long (max {MAX_TEXT_LENGTH} chars)'}

        embedding = self.model.encode(text, convert_to_numpy=True)

        return {
            'success': True,
            'embedding': embedding.tolist(),
            'dimensions': len(embedding)
        }

    # Label mapping: normalize model-specific labels to toxic/not-toxic
    TOXIC_LABELS = {'hateful', 'hate', 'toxic', 'offensive', 'LABEL_1'}
    NOT_TOXIC_LABELS = {'acceptable', 'not-toxic', 'not_toxic', 'normal', 'LABEL_0'}

    def _handle_moderation(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Classify text toxicity"""
        if not self.moderation_pipeline:
            return {'success': False, 'error': 'Moderation model not loaded'}

        text = request.get('text', '')

        if not text or not isinstance(text, str):
            return {'success': False, 'error': 'Invalid text parameter'}

        result = self.moderation_pipeline(text[:2000])[0]
        raw_label = result['label'].lower().strip()

        if raw_label in self.TOXIC_LABELS:
            normalized = 'toxic'
        elif raw_label in self.NOT_TOXIC_LABELS:
            normalized = 'not-toxic'
        else:
            normalized = 'toxic' if result['score'] > 0.5 else 'not-toxic'
            logger.warning(f"Unknown label '{raw_label}', mapped to '{normalized}'")

        return {
            'success': True,
            'label': normalized,
            'score': round(result['score'], 4)
        }

    def run(self):
        """Main loop - read from stdin, write to stdout"""
        logger.info("Embedding server started. Waiting for requests...")

        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                response = self.process_request(request)
                print(json.dumps(response), flush=True)

            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON: {e}")
                error_response = {'success': False, 'error': 'Invalid JSON'}
                print(json.dumps(error_response), flush=True)

            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                error_response = {'success': False, 'error': 'Internal server error'}
                print(json.dumps(error_response), flush=True)

if __name__ == '__main__':
    server = EmbeddingServer()
    server.load_model()
    server.load_moderation_model()
    # Signal readiness after both models are loaded
    logger.info("Model ready. All models loaded successfully")
    server.run()
