/**
 * Script d'initialisation pour le mode local de TersaFork
 * Usage: npx tsx scripts/init-local.ts
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = process.cwd();
const STORAGE_DIR = join(ROOT_DIR, 'storage');

console.log('🚀 Initialisation de TersaFork en mode local...\n');

// 1. Créer le dossier de stockage
console.log('📁 Création des dossiers de stockage...');
const storageFolders = ['images', 'videos', 'audio', 'documents', 'temp'];

if (!existsSync(STORAGE_DIR)) {
  mkdirSync(STORAGE_DIR);
  console.log(`   ✅ Créé: ${STORAGE_DIR}`);
}

for (const folder of storageFolders) {
  const folderPath = join(STORAGE_DIR, folder);
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
    console.log(`   ✅ Créé: ${folderPath}`);
  }
}

// 2. Créer le fichier .env.local s'il n'existe pas
const envLocalPath = join(ROOT_DIR, '.env.local');
const envExamplePath = join(ROOT_DIR, 'env.example');

if (!existsSync(envLocalPath)) {
  console.log('\n📝 Création du fichier .env.local...');
  if (existsSync(envExamplePath)) {
    copyFileSync(envExamplePath, envLocalPath);
    console.log('   ✅ Copié depuis env.example');
  } else {
    // Créer un fichier minimal
    const minimalEnv = `# TersaFork - Configuration locale
LOCAL_MODE=true
LOCAL_USER_ID=local-user-001
LOCAL_STORAGE_PATH=${STORAGE_DIR}
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/tersafork

# Batch Processing
BATCH_MAX_CONCURRENCY=10
BATCH_REQUEST_TIMEOUT=300000

# Ajoutez vos clés API ici
# FAL_API_KEY=
# OPENAI_API_KEY=
# WAVESPEED_API_KEY=
`;
    writeFileSync(envLocalPath, minimalEnv);
    console.log('   ✅ Créé avec configuration minimale');
  }
} else {
  console.log('\n📝 .env.local existe déjà');
}

// 3. Ajouter le dossier storage au .gitignore
const gitignorePath = join(ROOT_DIR, '.gitignore');
console.log('\n📄 Vérification du .gitignore...');
try {
  const gitignore = existsSync(gitignorePath) 
    ? require('fs').readFileSync(gitignorePath, 'utf-8')
    : '';
  
  const entriesToAdd = ['/storage/', '*.db', '*.sqlite'];
  const newEntries: string[] = [];
  
  for (const entry of entriesToAdd) {
    if (!gitignore.includes(entry)) {
      newEntries.push(entry);
    }
  }
  
  if (newEntries.length > 0) {
    const updated = gitignore + '\n# TersaFork Local\n' + newEntries.join('\n') + '\n';
    writeFileSync(gitignorePath, updated);
    console.log(`   ✅ Ajouté au .gitignore: ${newEntries.join(', ')}`);
  } else {
    console.log('   ✅ .gitignore déjà configuré');
  }
} catch (error) {
  console.log('   ⚠️ Impossible de modifier .gitignore');
}

// 4. Instructions finales
console.log('\n' + '='.repeat(60));
console.log('✨ Initialisation terminée!\n');
console.log('Prochaines étapes:');
console.log('');
console.log('1. Configurez votre base de données PostgreSQL locale:');
console.log('   createdb tersafork');
console.log('');
console.log('2. Éditez .env.local avec vos clés API:');
console.log('   - FAL_API_KEY (pour Kling, Pixverse, etc.)');
console.log('   - WAVESPEED_API_KEY (pour Seedream, Kling Turbo)');
console.log('   - OPENAI_API_KEY (pour DALL-E, GPT)');
console.log('');
console.log('3. Lancez les migrations:');
console.log('   pnpm migrate');
console.log('');
console.log('4. Démarrez le serveur de développement:');
console.log('   pnpm dev:local');
console.log('');
console.log('='.repeat(60));

