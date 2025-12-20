#!/usr/bin/env python3
"""
Pre-download the sentence transformer model
Run this once to cache the model locally
"""

from sentence_transformers import SentenceTransformer
import sys

MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'

def download_model():
    """Download and cache the model"""
    print(f"📥 Downloading model: {MODEL_NAME}")
    print(f"   This will be cached for future use (~118MB)")

    try:
        model = SentenceTransformer(MODEL_NAME)

        print(f"\n✅ Model downloaded successfully!")
        print(f"   Model: {MODEL_NAME}")
        print(f"   Dimensions: {model.get_sentence_embedding_dimension()}")
        print(f"   Max sequence length: {model.max_seq_length}")
        print(f"\n🎯 Model is ready for use!")

        # Test generation
        print(f"\n🧪 Testing embedding generation...")
        test_embedding = model.encode("Test text", convert_to_numpy=True)
        print(f"✅ Test successful! Generated vector of {len(test_embedding)} dimensions")

    except Exception as e:
        print(f"\n❌ Error downloading model: {e}")
        sys.exit(1)

if __name__ == '__main__':
    download_model()
