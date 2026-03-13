'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Backward Compatibility Redirect Page
 *
 * Vecchi link /bacheca/* vengono reindirizzati a /#bacheca/*
 * Temporaneo: rimuovere dopo 1-2 mesi dalla migrazione
 *
 * @module pages/bacheca/[[...slug]]
 */
export default function BachecaRedirectPage(): null {
  const router = useRouter();

  useEffect(() => {
    // Converti /bacheca/topic/discussion → /#bacheca/topic/discussion
    const fullPath = router.asPath; // es: /bacheca/topic/discussion?q=test
    const hashPath = fullPath.replace('/bacheca', '#bacheca');

    // Redirect a home page con hash
    window.location.href = `/${hashPath}`;
  }, [router.asPath]);

  return null;
}
