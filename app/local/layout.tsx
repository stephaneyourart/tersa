/**
 * Layout pour le mode local
 * Fournit les providers nécessaires sans authentification
 */

'use client';

import { GatewayProviderClient } from '@/providers/gateway/client';
import { SubscriptionProvider } from '@/providers/subscription';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactNode } from 'react';

type LocalLayoutProps = {
  children: ReactNode;
};

// Modèles mock pour le mode local
const mockModels = [
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    specification: { provider: 'openai' },
    pricing: { input: '0.005', output: '0.015' },
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    specification: { provider: 'openai' },
    pricing: { input: '0.00015', output: '0.0006' },
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    specification: { provider: 'anthropic' },
    pricing: { input: '0.003', output: '0.015' },
  },
];

const LocalLayout = ({ children }: LocalLayoutProps) => {
  return (
    <SubscriptionProvider isSubscribed={true} plan="pro">
      <GatewayProviderClient models={mockModels as never}>
        <ReactFlowProvider>{children}</ReactFlowProvider>
      </GatewayProviderClient>
    </SubscriptionProvider>
  );
};

export default LocalLayout;

