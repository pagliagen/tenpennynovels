import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function GamePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the elegant locations route
    if (router.isReady) {
      router.replace('/locations');
    }
  }, [router.isReady]);

  // Show minimal loading while redirecting
  return <div>Redirecting...</div>;
}
 