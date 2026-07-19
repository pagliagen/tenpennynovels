import { MongoClient } from 'mongodb';

export interface ConnectionConfig {
  uri: string;
  database: string;
}

/**
 * Get MongoDB connection with auto-detection of environment
 * Supports both local (Docker) and production (direct MongoDB) connections
 *
 * @returns {Promise<{client: MongoClient; db: any}>} MongoDB client and database
 */
export async function getConnection(): Promise<{ client: MongoClient; db: any }> {
  const uri = process.env.MONGO_URI || 'mongodb://mongo:27017/tenpennynovels';

  // Auto-detect environment
  // lgtm[js/incomplete-url-substring-sanitization] - Seeding script; URI from env (trusted); validated with new URL()
  const isLocal = uri.includes('mongo:27017') || uri.includes('localhost:27017');
  const isProduction = uri.includes('mongodb+srv://') || uri.includes('mongodb.net');

  console.log(`[Connection] Mode: ${isLocal ? 'LOCAL (Docker)' : isProduction ? 'PRODUCTION' : 'CUSTOM'}`);
  console.log(`[Connection] URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials

  const client = new MongoClient(uri);
  await client.connect();

  // Extract database name from URI or use default
  const dbName = new URL(uri).pathname.substring(1) || 'tenpennynovels';
  const db = client.db(dbName);

  return { client, db };
}
