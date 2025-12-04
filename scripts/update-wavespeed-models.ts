/**
 * Script pour mettre à jour les modèles WaveSpeed
 * 
 * Usage:
 *   npx ts-node scripts/update-wavespeed-models.ts
 *   npx ts-node scripts/update-wavespeed-models.ts --new-only   # Affiche seulement les nouveaux
 *   npx ts-node scripts/update-wavespeed-models.ts --apply      # Applique les changements
 * 
 * Ce script récupère la liste des modèles depuis l'API WaveSpeed
 * et les compare avec notre fichier local.
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Charger les variables d'environnement depuis .env.local
config({ path: '.env.local' });

const MODELS_FILE = path.join(process.cwd(), 'lib/data/wavespeed-models.json');
const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/models';

interface WaveSpeedModel {
  model_id: number;
  model_uuid: string;
  model_name: string;
  base_price: number;
  description: string;
  type: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  release_stage: string;
  [key: string]: unknown;
}

interface ModelsResponse {
  code: number;
  message: string;
  data: {
    page: number;
    page_size: number;
    total: number;
    items: WaveSpeedModel[];
  };
}

// Arguments CLI
const args = process.argv.slice(2);
const NEW_ONLY = args.includes('--new-only');
const APPLY = args.includes('--apply');
const SEARCH = args.find(a => a.startsWith('--search='))?.split('=')[1];

async function main() {
  console.log('🔄 Mise à jour des modèles WaveSpeed...\n');

  // 1. Charger les modèles existants
  let existingModels: ModelsResponse;
  if (fs.existsSync(MODELS_FILE)) {
    existingModels = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf-8'));
    console.log(`📦 Modèles existants: ${existingModels.data.items.length}`);
  } else {
    console.log('⚠️  Fichier de modèles non trouvé, création...');
    existingModels = { code: 200, message: 'success', data: { page: 0, page_size: 0, total: 0, items: [] } };
  }

  const existingUuids = new Set(existingModels.data.items.map(m => m.model_uuid));

  // 2. Récupérer les modèles depuis l'API WaveSpeed
  console.log(`\n🌐 Récupération depuis ${WAVESPEED_API_URL}...`);
  
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    console.error('❌ WAVESPEED_API_KEY non définie dans l\'environnement');
    console.log('   Export la variable: export WAVESPEED_API_KEY=votre_clé');
    process.exit(1);
  }

  const response = await fetch(WAVESPEED_API_URL, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`❌ Erreur API: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const apiResponse = await response.json();
  
  // La nouvelle API retourne data comme un tableau direct
  // avec model_id comme UUID (pas model_uuid)
  let modelsList: any[];
  
  if (Array.isArray(apiResponse.data)) {
    // Nouvelle structure: data est un tableau
    modelsList = apiResponse.data.map((m: any) => ({
      ...m,
      model_uuid: m.model_id || m.name, // Normaliser
      model_name: m.name || m.model_id,
    }));
  } else if (apiResponse.data?.items) {
    // Ancienne structure: data.items
    modelsList = apiResponse.data.items;
  } else {
    console.log('⚠️  Structure de réponse inattendue:');
    console.log(JSON.stringify(apiResponse, null, 2).substring(0, 500));
    process.exit(1);
  }
  
  console.log(`✅ Modèles récupérés depuis l'API: ${modelsList.length}`);
  
  // Convertir en structure compatible
  const newModels = {
    data: { items: modelsList }
  };

  // 3. Identifier les nouveaux modèles
  const newItems = newModels.data.items.filter(m => !existingUuids.has(m.model_uuid));
  const updatedItems = newModels.data.items.filter(m => {
    if (!existingUuids.has(m.model_uuid)) return false;
    const existing = existingModels.data.items.find(e => e.model_uuid === m.model_uuid);
    return existing && existing.updated_at !== m.updated_at;
  });

  console.log(`\n📊 Résultats:`);
  console.log(`   ✨ Nouveaux modèles: ${newItems.length}`);
  console.log(`   🔄 Modèles mis à jour: ${updatedItems.length}`);

  // 4. Afficher les résultats
  if (SEARCH) {
    const searchLower = SEARCH.toLowerCase();
    const matches = newModels.data.items.filter(m => 
      m.model_uuid.toLowerCase().includes(searchLower) ||
      m.model_name.toLowerCase().includes(searchLower) ||
      m.description.toLowerCase().includes(searchLower)
    );
    
    console.log(`\n🔍 Recherche "${SEARCH}": ${matches.length} résultat(s)`);
    for (const m of matches) {
      const isNew = !existingUuids.has(m.model_uuid);
      const tags = Array.isArray(m.tags) ? m.tags.join(', ') : (m.tags || 'N/A');
      console.log(`   ${isNew ? '✨ [NEW]' : '      '} ${m.model_uuid}`);
      console.log(`      Type: ${m.type || 'N/A'} | Tags: ${tags}`);
      if (m.description) {
        console.log(`      Desc: ${m.description.substring(0, 100)}...`);
      }
    }
    return;
  }

  if (newItems.length > 0) {
    console.log('\n✨ Nouveaux modèles:');
    for (const m of newItems.slice(0, 20)) { // Limiter l'affichage
      const tags = Array.isArray(m.tags) ? m.tags.join(', ') : (m.tags || 'N/A');
      console.log(`   📌 ${m.model_uuid}`);
      console.log(`      Type: ${m.type || 'N/A'} | Tags: ${tags}`);
    }
    if (newItems.length > 20) {
      console.log(`   ... et ${newItems.length - 20} autres`);
    }
  }

  if (updatedItems.length > 0 && !NEW_ONLY) {
    console.log('\n🔄 Modèles mis à jour:');
    for (const m of updatedItems.slice(0, 10)) {
      console.log(`   📝 ${m.model_uuid}`);
    }
    if (updatedItems.length > 10) {
      console.log(`   ... et ${updatedItems.length - 10} autres`);
    }
  }

  // 5. Appliquer les changements si demandé
  if (APPLY) {
    console.log('\n💾 Application des changements...');
    
    // Fusionner: garder les anciens, ajouter les nouveaux, mettre à jour les existants
    const mergedItems = [...newModels.data.items];
    
    const mergedData: ModelsResponse = {
      code: 200,
      message: 'success',
      data: {
        page: 0,
        page_size: 0,
        total: mergedItems.length,
        items: mergedItems,
      },
    };

    fs.writeFileSync(MODELS_FILE, JSON.stringify(mergedData, null, 4));
    console.log(`✅ Fichier mis à jour: ${MODELS_FILE}`);
    console.log(`   Total: ${mergedItems.length} modèles`);
  } else {
    console.log('\n💡 Pour appliquer les changements, utilisez: --apply');
    console.log('   Pour chercher un modèle: --search=kling-image');
  }
}

main().catch(console.error);

