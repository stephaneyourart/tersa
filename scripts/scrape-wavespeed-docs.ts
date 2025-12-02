import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

// Chemins
const MODELS_FILE = path.join(process.cwd(), 'lib/data/wavespeed-models.json');
const DOCS_DB_FILE = path.join(process.cwd(), 'lib/data/wavespeed-docs-db.json');
const DOCS_INDEX_URL = 'https://wavespeed.ai/docs/docs-api';

// Types
interface ModelItem {
  model_id: number;
  model_uuid: string;
  model_name: string;
}

interface ApiDocParameter {
  name: string;
  type: string;
  required?: boolean;
  default?: string | boolean | number;
  range?: string;
  description: string;
}

interface ApiDoc {
  endpoint: string;
  method: string;
  parameters: ApiDocParameter[];
  responseParameters: ApiDocParameter[];
  scrapedAt: string;
  sourceUrl: string;
}

// Arguments CLI simples
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;
const FORCE = args.includes('--force');

// Charger la DB existante
let docsDb: Record<string, ApiDoc> = {};
if (fs.existsSync(DOCS_DB_FILE)) {
  docsDb = JSON.parse(fs.readFileSync(DOCS_DB_FILE, 'utf-8'));
}

// Charger les modèles cibles
const modelsData = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf-8'));
const models: ModelItem[] = modelsData.data.items;
const modelsMap = new Map(models.map(m => [m.model_uuid, m]));

console.log(`🎯 Target: ${models.length} models from JSON.`);
console.log(`📚 Existing docs: ${Object.keys(docsDb).length}.`);
if (LIMIT !== Infinity) console.log(`🛑 Limit set to: ${LIMIT}`);

// 1. DISCOVERY: Crawler l'index pour trouver les liens réels
async function discoverDocLinks(): Promise<Record<string, string>> {
  console.log(`\n🕵️  Crawling ${DOCS_INDEX_URL} to discover model links...`);
  
  const res = await fetch(DOCS_INDEX_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const discoveredLinks: Record<string, string> = {}; // model_uuid -> url

  // La sidebar contient les liens. On cherche tous les liens href commençant par /docs/docs-api/
  $('a[href^="/docs/docs-api/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    
    // ex: /docs/docs-api/kwaivgi/kwaivgi-kling-video-o1-video-edit
    // On doit extraire le model slug pour essayer de le matcher avec nos UUIDs
    // Nos UUIDs sont genre: kwaivgi/kling-video-o1/video-edit
    // L'URL est genre: kwaivgi/kwaivgi-kling-video-o1-video-edit
    
    // On garde l'URL complète
    const fullUrl = `https://wavespeed.ai${href}`;
    
    // Tenter de deviner à quel modèle cela correspond
    // Stratégie: On normalise tout et on cherche le match le plus proche
    const urlParts = href.replace('/docs/docs-api/', '').split('/');
    if (urlParts.length < 2) return;
    
    const provider = urlParts[0]; // kwaivgi
    const slug = urlParts[1]; // kwaivgi-kling-video-o1-video-edit
    
    // On cherche dans nos models celui qui correspond le mieux
    // 1. Match exact du provider
    const candidates = models.filter(m => m.model_uuid.startsWith(`${provider}/`));
    
    for (const candidate of candidates) {
      // Nettoyage pour comparaison
      // candidate: kwaivgi/kling-video-o1/video-edit -> kwaivgiklingvideoo1videoedit
      // slug: kwaivgi-kling-video-o1-video-edit -> kwaivgiklingvideoo1videoedit
      
      const cleanCandidate = candidate.model_uuid.replace(/[\/-]/g, '').toLowerCase();
      const cleanSlug = slug.replace(/[\/-]/g, '').toLowerCase();
      
      // Parfois le provider est répété dans le slug (kwaivgi/kwaivgi-...)
      const cleanSlugNoProvider = slug.replace(new RegExp(`^${provider}-?`), '').replace(/[\/-]/g, '').toLowerCase();
      
      if (cleanSlug.includes(cleanCandidate) || cleanCandidate.includes(cleanSlug) || cleanSlugNoProvider === cleanCandidate.replace(provider, '')) {
        // C'est un match probable !
        discoveredLinks[candidate.model_uuid] = fullUrl;
      }
    }
  });

  console.log(`✅ Discovered ${Object.keys(discoveredLinks).length} documentation links matching our models.`);
  return discoveredLinks;
}

// 2. SCRAPING: Visiter une page et extraire les infos
async function scrapeDoc(url: string): Promise<ApiDoc | null> {
  try {
    // console.log(`   🌐 Fetching ${url}...`);
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });
    
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Endpoint extraction
    let endpoint = '';
    let method = 'POST';
    
    const codeBlocks = $('pre code').toArray();
    for (const block of codeBlocks) {
      const text = $(block).text();
      if (text.includes('curl') && text.includes('api.wavespeed.ai')) {
        const match = text.match(/"(https:\/\/api\.wavespeed\.ai[^"]+)"/);
        if (match) endpoint = match[1];
        if (text.includes('--request GET')) method = 'GET';
        break;
      }
    }

    if (!endpoint) return null;

    // Parameters extraction
    const parameters: ApiDocParameter[] = [];
    const responseParameters: ApiDocParameter[] = [];

    $('table').each((i, table) => {
      // Check headers to identify table type
      const headers = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
      const headerText = headers.join(' ');
      
      // Determine table type based on surrounding text OR content
      const prevHeading = $(table).prevAll('h3, h4, h2').first().text().toLowerCase();
      
      const isRequest = (prevHeading.includes('request') && !prevHeading.includes('result')) || 
                        (headers.includes('required') && headers.includes('type'));
                        
      const isResponse = prevHeading.includes('response') || prevHeading.includes('result') || 
                         (headers.includes('type') && !headers.includes('required'));

      if (!isRequest && !isResponse) return;

      $(table).find('tbody tr').each((_, tr) => {
        const cols = $(tr).find('td');
        if (cols.length < 2) return;

        const param: ApiDocParameter = {
          name: $(cols[0]).text().trim(),
          type: $(cols[1]).text().trim(),
          description: ''
        };

        // Intelligent mapping based on headers
        headers.forEach((h, idx) => {
          const val = $(cols[idx]).text().trim();
          if (!val) return;
          
          if (h === 'required') param.required = val.toLowerCase().includes('yes');
          if (h === 'default') param.default = val !== '-' ? val : undefined;
          if (h === 'range') param.range = val !== '-' ? val : undefined;
          if (h === 'description') param.description = val;
        });

        // Fallback for missing headers (WaveSpeed standard)
        if (!param.description) {
            // Request: Param | Type | Required | Default | Range | Description
            if (isRequest && cols.length >= 6) {
                param.description = $(cols[5]).text().trim();
            } 
            // Response: Param | Type | Description
            else if (isResponse && cols.length >= 3) {
                param.description = $(cols[2]).text().trim();
            }
        }

        if (isRequest) parameters.push(param);
        if (isResponse) responseParameters.push(param);
      });
    });

    return {
      endpoint,
      method,
      parameters,
      responseParameters,
      scrapedAt: new Date().toISOString(),
      sourceUrl: url
    };

  } catch (e) {
    console.error(`⚠️ Error scraping ${url}:`, e);
    return null;
  }
}

// MAIN LOOP
async function main() {
  const discoveredDocs = await discoverDocLinks();
  
  let processed = 0;
  let success = 0;
  
  // Identifier les modèles à traiter
  const modelsToProcess = models.filter(m => {
    // Si on a l'URL de doc découverte ET (pas encore en DB ou FORCE)
    return discoveredDocs[m.model_uuid] && (!docsDb[m.model_uuid] || FORCE);
  });

  console.log(`\n📋 Processing ${Math.min(modelsToProcess.length, LIMIT)} models...`);

  for (const model of modelsToProcess) {
    if (processed >= LIMIT) break;
    
    const url = discoveredDocs[model.model_uuid];
    process.stdout.write(`   ⚙️  [${processed + 1}/${Math.min(modelsToProcess.length, LIMIT)}] ${model.model_uuid.split('/').pop()}... `);
    
    const doc = await scrapeDoc(url);
    
    if (doc) {
      docsDb[model.model_uuid] = doc;
      process.stdout.write(`✅ Scraped (${doc.parameters.length} params)\n`);
      success++;
      
      // Sauvegarde incrémentale
      if (success % 5 === 0) {
        fs.writeFileSync(DOCS_DB_FILE, JSON.stringify(docsDb, null, 2));
      }
    } else {
      process.stdout.write(`❌ Failed or no endpoint\n`);
    }
    
    processed++;
    // Petit délai pour être gentil avec le serveur
    await new Promise(r => setTimeout(r, 500));
  }

  // Sauvegarde finale
  fs.writeFileSync(DOCS_DB_FILE, JSON.stringify(docsDb, null, 2));
  console.log(`\n💾 Saved ${Object.keys(docsDb).length} docs to ${DOCS_DB_FILE}`);
}

main().catch(console.error);
