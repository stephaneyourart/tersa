'use client';

import { type ReactNode, createContext, useContext } from 'react';

export type SubscriptionContextType = {
  isSubscribed: boolean;
  plan: 'hobby' | 'pro' | 'enterprise' | undefined;
};

// En mode local, tous les modèles sont accessibles (plan "pro")
const isLocalMode = typeof window !== 'undefined' 
  ? window.location.pathname.startsWith('/local')
  : false;

export const SubscriptionContext = createContext<SubscriptionContextType>({
  isSubscribed: isLocalMode ? true : false,
  plan: isLocalMode ? 'pro' : undefined,
});

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider'
    );
  }

  // En mode local, forcer le plan "pro" pour accéder à tous les modèles
  if (isLocalMode) {
    return {
      isSubscribed: true,
      plan: 'pro' as const,
    };
  }

  return context;
};

export const SubscriptionProvider = ({
  children,
  isSubscribed,
  plan,
}: {
  children: ReactNode;
  isSubscribed: boolean;
  plan: 'hobby' | 'pro' | 'enterprise' | undefined;
}) => {
  // En mode local, forcer le plan "pro"
  const effectivePlan = isLocalMode ? 'pro' : plan;
  const effectiveSubscribed = isLocalMode ? true : isSubscribed;

  return (
    <SubscriptionContext.Provider value={{ isSubscribed: effectiveSubscribed, plan: effectivePlan }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
