import { getSubscribedUser } from '@/lib/auth';
import { parseError } from '@/lib/error/parse';
import { gateway } from '@/lib/gateway';
import { isLocalMode } from '@/lib/env-local';
import { createRateLimiter, slidingWindow } from '@/lib/rate-limit';
import { trackCreditUsage } from '@/lib/stripe';
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  streamText,
  wrapLanguageModel,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Create a rate limiter for the chat API
const rateLimiter = createRateLimiter({
  limiter: slidingWindow(10, '1 m'),
  prefix: 'api-chat',
});

// Modèles OpenAI disponibles en mode local
const LOCAL_OPENAI_MODELS: Record<string, string> = {
  // GPT-5.1
  'openai/gpt-5.1': 'gpt-5.1',
  'openai/gpt-5.1-codex': 'gpt-5.1-codex',
  'openai/gpt-5.1-codex-mini': 'gpt-5.1-codex-mini',
  // GPT-5
  'openai/gpt-5': 'gpt-5',
  'openai/gpt-5-mini': 'gpt-5-mini',
  'openai/gpt-5-nano': 'gpt-5-nano',
  'openai/gpt-5-pro': 'gpt-5-pro',
  // GPT-4.1
  'openai/gpt-4.1': 'gpt-4.1',
  'openai/gpt-4.1-mini': 'gpt-4.1-mini',
  'openai/gpt-4.1-nano': 'gpt-4.1-nano',
  // o3/o4/o1
  'openai/o3': 'o3',
  'openai/o3-mini': 'o3-mini',
  'openai/o4-mini': 'o4-mini',
  'openai/o1': 'o1',
  'openai/o1-pro': 'o1-pro',
};

export const POST = async (req: Request) => {
  const localMode = isLocalMode();

  // En mode non-local, vérifier l'authentification
  if (!localMode) {
    try {
      await getSubscribedUser();
    } catch (error) {
      const message = parseError(error);
      return new Response(message, { status: 401 });
    }
  }

  // Apply rate limiting (seulement en production)
  if (process.env.NODE_ENV === 'production' && !localMode) {
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
    const { success, limit, reset, remaining } = await rateLimiter.limit(ip);

    if (!success) {
      return new Response('Too many requests', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      });
    }
  }

  const { messages, modelId } = await req.json();

  if (typeof modelId !== 'string') {
    return new Response('Model must be a string', { status: 400 });
  }

  // Mode local : utiliser directement OpenAI
  if (localMode) {
    const openaiModelId = LOCAL_OPENAI_MODELS[modelId];
    
    if (!openaiModelId) {
      return new Response(`Invalid model: ${modelId}`, { status: 400 });
    }

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const enhancedModel = wrapLanguageModel({
      model: openai(openaiModelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    });

    const result = streamText({
      model: enhancedModel,
      system: [
        'You are a helpful assistant that synthesizes an answer or content.',
        'The user will provide a collection of data from disparate sources.',
        'They may also provide instructions for how to synthesize the content.',
        'If the instructions are a question, then your goal is to answer the question based on the context provided.',
        "You will then synthesize the content based on the user's instructions and the context provided.",
      ].join('\n'),
      messages: convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      sendSources: true,
    });
  }

  // Mode cloud : utiliser le gateway
  const { models } = await gateway.getAvailableModels();
  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Invalid model', { status: 400 });
  }

  const enhancedModel = wrapLanguageModel({
    model: gateway(model.id),
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  });

  const result = streamText({
    model: enhancedModel,
    system: [
      'You are a helpful assistant that synthesizes an answer or content.',
      'The user will provide a collection of data from disparate sources.',
      'They may also provide instructions for how to synthesize the content.',
      'If the instructions are a question, then your goal is to answer the question based on the context provided.',
      model.id.startsWith('grok') &&
        'The user may refer to you as @gork, you can ignore this',
      "You will then synthesize the content based on the user's instructions and the context provided.",
      'The output should be a concise summary of the content, no more than 100 words.',
    ].join('\n'),
    messages: convertToModelMessages(messages),
    onFinish: async ({ usage }) => {
      const inputCost = model.pricing?.input
        ? Number.parseFloat(model.pricing.input)
        : 0;
      const outputCost = model.pricing?.output
        ? Number.parseFloat(model.pricing.output)
        : 0;
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;

      await trackCreditUsage({
        action: 'chat',
        cost: inputCost * inputTokens + outputCost * outputTokens,
      });
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: true,
  });
};
