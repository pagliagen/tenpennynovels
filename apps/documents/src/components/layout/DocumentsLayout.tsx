'use client';

import { ReactNode } from 'react';

import { useIsDesktop } from '@/hooks/useIsDesktop';

import { DocumentsLayoutDesktop } from './DocumentsLayoutDesktop';
import { DocumentsLayoutMobile } from './DocumentsLayoutMobile';

interface DocumentsLayoutProps {
  children: ReactNode;
}

export function DocumentsLayout({ children }: DocumentsLayoutProps): JSX.Element {
  const isDesktop = useIsDesktop(1024);

  if (isDesktop) {
    return <DocumentsLayoutDesktop>{children}</DocumentsLayoutDesktop>;
  }

  return <DocumentsLayoutMobile>{children}</DocumentsLayoutMobile>;
}
