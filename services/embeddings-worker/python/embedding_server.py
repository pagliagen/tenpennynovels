#!/usr/bin/env python3
"""
Python Embedding Server - Subprocess per sentence-transformers
Comunica con Node.js via JSON su stdin/stdout
"""

import sys
import json
import logging
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any

# Setup logging (stderr per non interferire con stdout IPC)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Model configuration
MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
MAX_TEXT_LENGTH = 10000  # chars

class EmbeddingServer:
    def __init__(self):
        self.model = None

    def load_model(self):
        """Load model from cache (offline mode preferred)"""
        try:
            logger.info(f"Loading model: {MODEL_NAME}")
            # Try offline first
            self.model = SentenceTransformer(MODEL_NAME, local_files_only=True)
            logger.info("Model loaded from cache (offline mode)")
        except Exception as e:
            logger.warning(f"Cache miss, downloading from HuggingFace: {e}")
            self.model = SentenceTransformer(MODEL_NAME)
            logger.info("Model downloaded and cached")

        logger.info(f"Model ready. Embedding dimension: {self.model.get_sentence_embedding_dimension()}")

    def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process embedding request"""
        try:
            text = request.get('text', '')

            # Validation
            if not text or not isinstance(text, str):
                return {'success': False, 'error': 'Invalid text parameter'}

            if len(text) > MAX_TEXT_LENGTH:
                return {'success': False, 'error': f'Text too long (max {MAX_TEXT_LENGTH} chars)'}

            # Generate embedding
            embedding = self.model.encode(text, convert_to_numpy=True)

            return {
                'success': True,
                'embedding': embedding.tolist(),
                'dimensions': len(embedding)
            }

        except Exception as e:
            logger.error(f"Error processing request: {e}")
            return {'success': False, 'error': str(e)}

    def run(self):
        """Main loop - read from stdin, write to stdout"""
        logger.info("Embedding server started. Waiting for requests...")

        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                response = self.process_request(request)
                # Write response as single line JSON
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
    server.run()
