import { NextRequest, NextResponse } from 'next/server';
import type { GeneratedScenario } from '@/types/brief';

/**
 * API pour analyser un brief avec l'IA et générer un scénario structuré
 */
export async function POST(request: NextRequest) {
  try {
    const {
      briefContext,
      systemPrompt,
      model = 'gpt-5.1-2025-11-13',
      reasoningLevel = 'high',
      customInstructions,
    } = await request.json();

    console.log('[AI] Analyse brief avec', model, 'niveau:', reasoningLevel);

    // Construire le prompt final
    let fullPrompt = systemPrompt + '\n\n';
    fullPrompt += `## NIVEAU DE RAISONNEMENT: ${reasoningLevel.toUpperCase()}\n\n`;
    
    if (customInstructions) {
      fullPrompt += `## INSTRUCTIONS PERSONNALISÉES\n${customInstructions}\n\n`;
    }

    fullPrompt += `## BRIEF À ANALYSER\n\n${briefContext}\n\n`;
    fullPrompt += `## TÂCHE\nAnalyse ce brief et génère un scénario complet au format JSON selon la structure définie ci-dessus.`;

    // Appeler l'IA selon le modèle
    let scenario: GeneratedScenario;

    if (model.startsWith('gemini')) {
      // Vérifier si Gemini est configuré, sinon utiliser OpenAI
      const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!geminiKey && process.env.OPENAI_API_KEY) {
        console.log('[AI] Gemini non configuré, utilisation de GPT-5.1 à la place');
        scenario = await callOpenAI(fullPrompt, 'gpt-5.1-2025-11-13', reasoningLevel);
      } else {
        scenario = await callGemini(fullPrompt, model, reasoningLevel);
      }
    } else if (model.startsWith('gpt')) {
      scenario = await callOpenAI(fullPrompt, model, reasoningLevel);
    } else if (model.startsWith('claude')) {
      scenario = await callClaude(fullPrompt, model);
    } else {
      throw new Error(`Modèle non supporté: ${model}`);
    }

    console.log('[AI] Scénario généré:', {
      title: scenario.title,
      scenes: scenario.scenes.length,
      plans: scenario.totalPlans,
    });

    return NextResponse.json(scenario);
  } catch (error: any) {
    console.error('[AI] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'analyse' },
      { status: 500 }
    );
  }
}

/**
 * Appel à Gemini (via API Google AI)
 */
async function callGemini(
  prompt: string,
  model: string,
  reasoningLevel: string
): Promise<GeneratedScenario> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY non configuré');
  }

  // Mapper le nom du modèle
  const modelName = model === 'gemini-3' ? 'gemini-2.0-flash-exp' : model;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: reasoningLevel === 'high' ? 0.2 : reasoningLevel === 'medium' ? 0.4 : 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;

  // Extraire le JSON de la réponse
  return parseScenarioFromText(text);
}

/**
 * Appel à OpenAI GPT
 */
async function callOpenAI(prompt: string, model: string, reasoningLevel: string = 'medium'): Promise<GeneratedScenario> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY non configuré');
  }

  // GPT-5.1 utilise la nouvelle API Responses
  if (model.startsWith('gpt-5')) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        reasoning: {
          effort: reasoningLevel, // 'low', 'medium', 'high'
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const text = data.output || data.content;
    const reasoning = data.reasoning_content || data.reasoning || '';

    const scenario = parseScenarioFromText(text);
    
    // Ajouter le raisonnement au scénario
    return {
      ...scenario,
      reasoning: reasoning,
    };
  }

  // GPT-4 et antérieurs utilisent l'ancienne API Chat Completions
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en création de scénarios vidéo. Tu réponds UNIQUEMENT en JSON valide.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  return parseScenarioFromText(text);
}

/**
 * Appel à Claude (Anthropic)
 */
async function callClaude(prompt: string, model: string): Promise<GeneratedScenario> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configuré');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  return parseScenarioFromText(text);
}

/**
 * Parse le scénario JSON de la réponse de l'IA
 */
function parseScenarioFromText(text: string): GeneratedScenario {
  // Chercher un bloc JSON dans la réponse
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Aucun JSON trouvé dans la réponse de l\'IA');
  }

  const jsonText = jsonMatch[1] || jsonMatch[0];
  
  try {
    const scenario: GeneratedScenario = JSON.parse(jsonText);
    
    // Valider la structure minimale
    if (!scenario.title || !scenario.scenes || !scenario.characters || !scenario.locations) {
      throw new Error('Structure de scénario invalide');
    }

    return scenario;
  } catch (error: any) {
    console.error('[AI] Erreur parse JSON:', error);
    console.error('[AI] Texte reçu:', text);
    throw new Error(`Erreur de parsing: ${error.message}`);
  }
}

