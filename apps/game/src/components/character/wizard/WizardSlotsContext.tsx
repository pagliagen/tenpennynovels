'use client';

import { createContext, useContext, useState, useLayoutEffect, type ReactNode } from 'react';

interface WizardSlotsContextValue {
  toolbarContent: ReactNode;
  footerActionsContent: ReactNode;
  setToolbarContent: (content: ReactNode) => void;
  setFooterActionsContent: (content: ReactNode) => void;
}

const WizardSlotsContext = createContext<WizardSlotsContextValue | null>(null);

export function WizardSlotsProvider({ children }: { children: ReactNode }) {
  const [toolbarContent, setToolbarContent] = useState<ReactNode>(null);
  const [footerActionsContent, setFooterActionsContent] = useState<ReactNode>(null);

  return (
    <WizardSlotsContext.Provider value={{ toolbarContent, footerActionsContent, setToolbarContent, setFooterActionsContent }}>
      {children}
    </WizardSlotsContext.Provider>
  );
}

function useWizardSlotsContext() {
  const ctx = useContext(WizardSlotsContext);
  if (!ctx) throw new Error('useWizardSlots must be used within WizardSlotsProvider');
  return ctx;
}

/**
 * Hook for reading slot content (used by WizardContainer/WizardFooter).
 */
export function useWizardSlots() {
  const { toolbarContent, footerActionsContent } = useWizardSlotsContext();
  return { toolbarContent, footerActionsContent };
}

/**
 * Hook for steps to register toolbar content.
 * Content is set on mount/deps change and cleared on unmount.
 *
 * @param contentFactory - Render function returning the toolbar JSX
 * @param deps - Dependency array (data values that trigger re-render of toolbar)
 */
 
export function useWizardToolbar(contentFactory: () => ReactNode, deps: unknown[]) {
  const { setToolbarContent } = useWizardSlotsContext();
   
  useLayoutEffect(() => {
    setToolbarContent(contentFactory());
    return () => setToolbarContent(null);
  }, deps);
}

/**
 * Hook for steps to register footer actions content.
 * Content is set on mount/deps change and cleared on unmount.
 *
 * @param contentFactory - Render function returning the footer actions JSX
 * @param deps - Dependency array (data values that trigger re-render of footer actions)
 */
 
export function useWizardFooterActions(contentFactory: () => ReactNode, deps: unknown[]) {
  const { setFooterActionsContent } = useWizardSlotsContext();
   
  useLayoutEffect(() => {
    setFooterActionsContent(contentFactory());
    return () => setFooterActionsContent(null);
  }, deps);
}
