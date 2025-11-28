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

// Modèles GPT pour le mode local via OpenAI (2025)
const mockModels = [
  // GPT-5.1
  {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    specification: { provider: 'openai' },
    pricing: { input: '0.00125', output: '0.01' },
  },
  {
    id: 'openai/gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    specification: { provider: 'openai' },
    pricing: { input: '0.003', output: '0.012' },
  },
  {
    id: 'openai/gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    specification: { provider: 'openai' },
    pricing: { input: '0.0015', output: '0.006' },
  },
  // GPT-5
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    specification: { provider: 'openai' },
    pricing: { input: '0.00125', output: '0.01' },
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    specification: { provider: 'openai' },
    pricing: { input: '0.00025', output: '0.001' },
    default: true,
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    specification: { provider: 'openai' },
    pricing: { input: '0.0001', output: '0.0004' },
  },
  {
    id: 'openai/gpt-5-pro',
    name: 'GPT-5 Pro',
    specification: { provider: 'openai' },
    pricing: { input: '0.005', output: '0.02' },
  },
  // GPT-4.1
  {
    id: 'openai/gpt-4.1',
    name: 'GPT-4.1',
    specification: { provider: 'openai' },
    pricing: { input: '0.002', output: '0.008' },
  },
  {
    id: 'openai/gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    specification: { provider: 'openai' },
    pricing: { input: '0.0004', output: '0.0016' },
  },
  {
    id: 'openai/gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    specification: { provider: 'openai' },
    pricing: { input: '0.0001', output: '0.0004' },
  },
  // o3/o4
  {
    id: 'openai/o3',
    name: 'o3',
    specification: { provider: 'openai' },
    pricing: { input: '0.01', output: '0.04' },
  },
  {
    id: 'openai/o3-mini',
    name: 'o3 Mini',
    specification: { provider: 'openai' },
    pricing: { input: '0.0011', output: '0.0044' },
  },
  {
    id: 'openai/o4-mini',
    name: 'o4 Mini',
    specification: { provider: 'openai' },
    pricing: { input: '0.0011', output: '0.0044' },
  },
  {
    id: 'openai/o1',
    name: 'o1',
    specification: { provider: 'openai' },
    pricing: { input: '0.015', output: '0.06' },
  },
  {
    id: 'openai/o1-pro',
    name: 'o1 Pro',
    specification: { provider: 'openai' },
    pricing: { input: '0.15', output: '0.6' },
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

