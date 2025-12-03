import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database';
import { briefs, projectGenerationConfigs } from '@/schema';
import { eq } from 'drizzle-orm';
import { generateProjectFromBrief } from '@/lib/brief-generator';

/**
 * API pour générer un projet à partir d'un brief
 */
export async function POST(request: NextRequest) {
  try {
    const { briefId, projectName, config } = await request.json();

    console.log('[Generate] Démarrage génération pour brief:', briefId);

    // Charger le brief
    const [brief] = await database
      .select()
      .from(briefs)
      .where(eq(briefs.id, briefId));

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief non trouvé' },
        { status: 404 }
      );
    }

    // Marquer le brief comme "generating"
    await database
      .update(briefs)
      .set({ status: 'generating' })
      .where(eq(briefs.id, briefId));

    // Sauvegarder la config
    const [savedConfig] = await database
      .insert(projectGenerationConfigs)
      .values({
        briefId,
        aiModel: config.aiModel,
        reasoningLevel: config.reasoningLevel,
        generateMediaDirectly: config.generateMediaDirectly,
        systemPrompt: config.systemPrompt,
        customInstructions: config.customInstructions,
        settings: config.settings,
      })
      .returning();

    // Générer le projet
    try {
      const result = await generateProjectFromBrief({
        brief: {
          ...brief,
          documents: [], // Charger depuis la DB si nécessaire
        },
        config: {
          ...savedConfig,
          briefId,
        },
        projectName,
      });

      // Mettre à jour la config avec le projectId
      await database
        .update(projectGenerationConfigs)
        .set({ projectId: result.projectId })
        .where(eq(projectGenerationConfigs.id, savedConfig.id));

      // Marquer le brief comme "completed"
      await database
        .update(briefs)
        .set({ status: 'completed' })
        .where(eq(briefs.id, briefId));

      console.log('[Generate] Projet généré avec succès:', result.projectId);

      return NextResponse.json({
        success: true,
        projectId: result.projectId,
        scenario: result.scenario,
        nodesCount: result.nodes.length,
      });
    } catch (error: any) {
      console.error('[Generate] Erreur génération:', error);
      
      // Réinitialiser le statut du brief
      await database
        .update(briefs)
        .set({ status: 'draft' })
        .where(eq(briefs.id, briefId));

      throw error;
    }
  } catch (error: any) {
    console.error('[Generate] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération' },
      { status: 500 }
    );
  }
}

