import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { DocumentsLayout } from '@/components/DocumentsLayout';
import { getDocuments, Document } from '@/lib/documentApi';
import { AuthContext } from '@/lib/auth';

interface DocumentHomeProps {
  documents: Document[];
  authContext: AuthContext;
}

export default function DocumentHome({ documents = [], authContext = { isAuthenticated: false, tokens: {} } }: DocumentHomeProps) {
  const router = useRouter();

  // Redirect to ambientazione page
  useEffect(() => {
    router.replace('/ambientazione');
  }, [router]);

  // Show loading message during redirect
  return (
    <DocumentsLayout 
      authContext={authContext}
    >
      <Head>
        <title>TenpennyNovels Documenti</title>
        <meta name="description" content="Ambientazione e regolamento per il GDR di Londra Vittoriana" />
      </Head>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '200px',
        flexDirection: 'column',
        fontFamily: 'MedievalSharp, cursive',
        color: '#8B4513'
      }}>
        <h2>Caricamento documenti...</h2>
        <p>Reindirizzamento alla sezione Ambientazione</p>
      </div>
    </DocumentsLayout>
  );
}

