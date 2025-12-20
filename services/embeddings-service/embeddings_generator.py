#!/usr/bin/env python3
"""
TenpennyNovels Embeddings Generator
Uses Sentence Transformers for semantic search on documents
"""

import sys
import json
import logging
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EmbeddingsGenerator:
    """Generate embeddings for text using Sentence Transformers"""

    def __init__(self, model_name: str = 'paraphrase-multilingual-MiniLM-L12-v2'):
        """
        Initialize the embeddings generator

        Args:
            model_name: Name of the sentence-transformers model to use
        """
        self.model_name = model_name
        self.model = None
        logger.info(f"Initializing EmbeddingsGenerator with model: {model_name}")

    def load_model(self):
        """Load the sentence transformer model"""
        if self.model is None:
            logger.info(f"Loading model: {self.model_name}")
            try:
                self.model = SentenceTransformer(self.model_name)
                logger.info(f"✅ Model loaded successfully")
                logger.info(f"   Model dimension: {self.model.get_sentence_embedding_dimension()}")
            except Exception as e:
                logger.error(f"❌ Failed to load model: {e}")
                raise

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text

        Args:
            text: Text to generate embedding for

        Returns:
            List of floats representing the embedding vector
        """
        if self.model is None:
            self.load_model()

        try:
            # Generate embedding
            embedding = self.model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"❌ Failed to generate embedding: {e}")
            raise

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts (batch processing)

        Args:
            texts: List of texts to generate embeddings for

        Returns:
            List of embedding vectors
        """
        if self.model is None:
            self.load_model()

        try:
            logger.info(f"Generating embeddings for {len(texts)} texts")
            embeddings = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=True)
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"❌ Failed to generate batch embeddings: {e}")
            raise

    def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Compute cosine similarity between two embeddings

        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector

        Returns:
            Similarity score between 0 and 1
        """
        from numpy import dot
        from numpy.linalg import norm

        # Cosine similarity
        similarity = dot(embedding1, embedding2) / (norm(embedding1) * norm(embedding2))
        return float(similarity)


def main():
    """
    CLI interface for embeddings generation

    Input format (JSON stdin):
    {
        "action": "generate" | "batch" | "similarity",
        "text": "text to embed",  // for single generation
        "texts": ["text1", "text2"],  // for batch generation
        "embedding1": [...],  // for similarity computation
        "embedding2": [...]   // for similarity computation
    }

    Output format (JSON stdout):
    {
        "success": true,
        "embedding": [...],  // for single generation
        "embeddings": [[...], [...]],  // for batch generation
        "similarity": 0.95  // for similarity computation
    }
    """
    generator = EmbeddingsGenerator()

    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        action = input_data.get('action', 'generate')

        if action == 'generate':
            # Single text embedding
            text = input_data.get('text', '')
            if not text:
                raise ValueError("No text provided for embedding generation")

            embedding = generator.generate_embedding(text)
            result = {
                'success': True,
                'embedding': embedding,
                'dimensions': len(embedding)
            }

        elif action == 'batch':
            # Batch text embeddings
            texts = input_data.get('texts', [])
            if not texts:
                raise ValueError("No texts provided for batch embedding generation")

            embeddings = generator.generate_embeddings_batch(texts)
            result = {
                'success': True,
                'embeddings': embeddings,
                'count': len(embeddings),
                'dimensions': len(embeddings[0]) if embeddings else 0
            }

        elif action == 'similarity':
            # Compute similarity between two embeddings
            embedding1 = input_data.get('embedding1')
            embedding2 = input_data.get('embedding2')

            if not embedding1 or not embedding2:
                raise ValueError("Two embeddings required for similarity computation")

            similarity = generator.compute_similarity(embedding1, embedding2)
            result = {
                'success': True,
                'similarity': similarity
            }

        else:
            raise ValueError(f"Unknown action: {action}")

        # Output result as JSON
        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    main()
