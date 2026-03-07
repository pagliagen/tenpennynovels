import React from 'react';
import { useRouter } from 'next/router';

import { PageLayout } from '@/components/layouts/PageLayout';
import { Button } from '@/components/Button';

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <PageLayout
      title="404 - Pagina non trovata | Ten Penny Novels"
      description="La pagina che cerchi non esiste. Torna alla home di Ten Penny Novels."
      noindex
      nofollow
    >
      <div className="not-found-page">
        <h2>404</h2>
        <p>
          La pagina che cerchi sembra essersi perduta
          nelle nebbie di Londra...
        </p>
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="not-found-page__back"
        >
          Torna al Login
        </Button>
      </div>
    </PageLayout>
  );
}
