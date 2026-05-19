const Anthropic = require('@anthropic-ai/sdk');

let anthropicClient = null;

function initializeClient(apiKey) {
  if (apiKey) {
    anthropicClient = new Anthropic({ apiKey });
    return true;
  }
  return false;
}

function getClient(apiKey) {
  if (apiKey) {
    return new Anthropic({ apiKey });
  }
  if (anthropicClient) {
    return anthropicClient;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return anthropicClient;
  }
  return null;
}

async function categorizePokemonData(scrapedData, apiKey = null) {
  const client = getClient(apiKey);
  
  if (!client) {
    console.log('No Anthropic API key available, using keyword-based categorization');
    return null;
  }

  const prompt = buildCategorizationPrompt(scrapedData);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
    
    return null;
  } catch (error) {
    console.error('LLM categorization error:', error.message);
    return null;
  }
}

function buildCategorizationPrompt(scrapedData) {
  const { name, verboseData } = scrapedData;
  const biologyText = verboseData?.fullBiologyText || '';
  const pokedexEntries = verboseData?.pokedexEntries || [];
  const animeInfo = verboseData?.animeInfo || '';
  const triviaInfo = verboseData?.triviaInfo || '';

  const entriesText = pokedexEntries
    .map(e => `${e.game}: ${e.entry}`)
    .join('\n');

  return `You are a Pokemon researcher assistant. Analyze the following information about ${name} and categorize it into specific categories.

IMPORTANT RULES:
1. ONLY use information that is explicitly stated in the provided text
2. DO NOT make up or infer information that is not present
3. If a category has no relevant information, set it to null
4. Be concise but comprehensive in your summaries
5. For each category, provide both a "summary" (1-2 sentences) and "details" (relevant excerpts from the source)

=== BIOLOGY INFORMATION ===
${biologyText || 'No biology information available'}

=== POKEDEX ENTRIES ===
${entriesText || 'No Pokedex entries available'}

=== ANIME/MANGA INFORMATION ===
${animeInfo || 'No anime/manga information available'}

=== TRIVIA ===
${triviaInfo || 'No trivia available'}

Please categorize the above information into the following JSON structure. For each category, only include it if there is relevant information:

{
  "anatomy": {
    "summary": "Brief description of physical appearance",
    "details": "Detailed physical description from the text"
  },
  "capabilities": {
    "summary": "Brief description of abilities and what the Pokemon can do",
    "details": "Detailed capabilities from the text"
  },
  "maleFemalesDifferences": {
    "summary": "Differences between male and female",
    "details": "Specific differences mentioned"
  } or null if not mentioned,
  "matingHabits": {
    "summary": "Breeding or mating behaviors",
    "details": "Specific mating information"
  } or null if not mentioned,
  "combatCapabilities": {
    "summary": "How it fights, advantages/disadvantages",
    "details": "Combat-related information"
  } or null if not mentioned,
  "survivalCapabilities": {
    "summary": "How it avoids danger or protects itself",
    "details": "Survival mechanisms"
  } or null if not mentioned,
  "pokemonWorldUses": {
    "summary": "How humans use this Pokemon",
    "details": "Specific uses mentioned"
  } or null if not mentioned,
  "majorEvents": {
    "summary": "Historical events or major occurrences",
    "details": "Event details"
  } or null if not mentioned,
  "survivalAdaptation": {
    "summary": "Environmental adaptations",
    "details": "Specific adaptations"
  } or null if not mentioned,
  "preferredHabitat": {
    "summary": "Where it lives",
    "details": "Habitat information"
  } or null if not mentioned,
  "folklore": {
    "summary": "Legends or stories about this Pokemon",
    "details": "Folklore details"
  } or null if not mentioned,
  "rivalries": {
    "summary": "Rival Pokemon or conflicts",
    "details": "Rivalry information"
  } or null if not mentioned,
  "uniqueBehaviors": {
    "summary": "Unusual or distinctive behaviors",
    "details": "Behavior details"
  } or null if not mentioned,
  "uniqueInformation": {
    "summary": "Other interesting facts",
    "details": "Additional unique information"
  } or null if nothing else notable
}

Respond with ONLY the JSON object, no additional text.`;
}

function mergeLLMWithScraped(scrapedData, llmData) {
  if (!llmData) {
    return scrapedData;
  }

  const merged = { ...scrapedData };

  if (llmData.anatomy) {
    merged.verboseData.anatomy = llmData.anatomy.details || llmData.anatomy.summary || merged.verboseData.anatomy;
  }
  if (llmData.capabilities) {
    merged.verboseData.capabilities = llmData.capabilities.details || llmData.capabilities.summary || merged.verboseData.capabilities;
  }

  const categoryKeys = [
    'maleFemalesDifferences', 'matingHabits', 'combatCapabilities', 
    'survivalCapabilities', 'pokemonWorldUses', 'majorEvents',
    'survivalAdaptation', 'preferredHabitat', 'folklore',
    'rivalries', 'uniqueBehaviors', 'uniqueInformation'
  ];

  categoryKeys.forEach(key => {
    if (llmData[key]) {
      merged.categorizedData[key] = {
        summary: llmData[key].summary || null,
        details: llmData[key].details || null
      };
    }
  });

  merged.processedWithLLM = true;

  return merged;
}

module.exports = {
  initializeClient,
  categorizePokemonData,
  mergeLLMWithScraped
};
