#!/usr/bin/env python3
"""
Setup script to pre-download HuggingFace models for embeddings-worker
Run this once after installing requirements.txt on a new server
"""

import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def download_embedding_model():
    """Download sentence-transformers embedding model"""
    try:
        logger.info("Downloading embedding model: paraphrase-multilingual-MiniLM-L12-v2")
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        logger.info(f"✅ Embedding model downloaded (dimension: {model.get_sentence_embedding_dimension()})")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to download embedding model: {e}")
        return False

def download_moderation_model():
    """Download toxicity classification model"""
    try:
        logger.info("Downloading moderation model: MilaNLProc/hate-ita")
        from transformers import pipeline
        classifier = pipeline('text-classification', model='MilaNLProc/hate-ita', truncation=True, max_length=512)

        # Test the model
        test_result = classifier("Questo è un test")[0]
        logger.info(f"✅ Moderation model downloaded (test label: {test_result['label']})")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to download moderation model: {e}")
        logger.warning("Moderation will be unavailable - embedding will still work")
        return False

if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("TenpennyNovels Embeddings Worker - Model Setup")
    logger.info("=" * 60)

    success_count = 0
    total_count = 2

    if download_embedding_model():
        success_count += 1

    if download_moderation_model():
        success_count += 1

    logger.info("=" * 60)
    if success_count == total_count:
        logger.info(f"✅ All models downloaded successfully ({success_count}/{total_count})")
        sys.exit(0)
    else:
        logger.warning(f"⚠️  Some models failed ({success_count}/{total_count} succeeded)")
        sys.exit(1)
