const Anthropic = require('@anthropic-ai/sdk');

let anthropicClient = null;

// OpenAI-compatible endpoint configuration (TrueFoundry)
const OPENAI_CONFIG = {
  baseUrl: process.env.OPENAI_BASE_URL || 'https://truefoundry.riotgames.io/api/llm/v1',
  model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini'
};

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
  // Try OpenAI-compatible endpoint first (TrueFoundry)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    console.log('Using OpenAI-compatible endpoint (TrueFoundry)');
    return await categorizeWithOpenAI(scrapedData, openaiKey);
  }
  
  // Fall back to Anthropic
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  
  if (!key) {
    console.log('No API key available, using keyword-based categorization');
    return null;
  }

  const client = getClient(key);
  
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

async function categorizeWithOpenAI(scrapedData, apiKey) {
  const prompt = buildCategorizationPrompt(scrapedData);
  
  try {
    const response = await fetch(`${OPENAI_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Pokemon researcher assistant. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4096,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
    }
    
    return null;
  } catch (error) {
    console.error('OpenAI categorization error:', error.message);
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

async function analyzeTranscriptsForPokemon(pokemonName, transcripts) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || !transcripts || transcripts.length === 0) {
    return null;
  }

  // Combine all transcripts into one text block with source attribution
  const transcriptText = transcripts.map(t => 
    `=== TRANSCRIPT: "${t.title}" ===\n${t.content}\n`
  ).join('\n');

  const prompt = `You are a Pokemon researcher assistant. Analyze the following video transcripts to find information about the Pokemon "${pokemonName}".

IMPORTANT RULES:
1. Find ALL references to ${pokemonName}, including potential misspellings or phonetic variations (e.g., "Theevul" for "Thievul", "Orbeetl" for "Orbeetle")
2. When you find a misspelling or variation, mark it inline as [assumed: 'original_text']
3. For each piece of information, prefix it with [From Transcript: "Title"] to show the source
4. Extract information into the same categories as Bulbapedia data
5. If no relevant information is found for a category, set it to null
6. Track all assumptions you make about misspellings

=== TRANSCRIPTS ===
${transcriptText}

Respond with a JSON object in this exact format:
{
  "assumptions": [
    {
      "original": "the misspelled or variant text found",
      "interpreted": "${pokemonName}",
      "source": "Transcript title where found",
      "context": "Brief surrounding context"
    }
  ],
  "categories": {
    "anatomy": {
      "summary": "Brief description if found",
      "details": "[From Transcript: \"Title\"] Extracted text with [assumed: 'variant'] markers if applicable"
    } or null,
    "capabilities": { ... } or null,
    "maleFemalesDifferences": { ... } or null,
    "matingHabits": { ... } or null,
    "combatCapabilities": { ... } or null,
    "survivalCapabilities": { ... } or null,
    "pokemonWorldUses": { ... } or null,
    "majorEvents": { ... } or null,
    "survivalAdaptation": { ... } or null,
    "preferredHabitat": { ... } or null,
    "folklore": { ... } or null,
    "rivalries": { ... } or null,
    "uniqueBehaviors": { ... } or null,
    "uniqueInformation": { ... } or null
  }
}

Respond with ONLY the JSON object, no additional text.`;

  try {
    console.log(`Analyzing ${transcripts.length} transcript(s) for ${pokemonName}...`);
    
    const response = await fetch(`${OPENAI_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Pokemon researcher assistant. Find Pokemon references even with misspellings. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4096,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI transcript analysis error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`Found ${parsed.assumptions?.length || 0} assumption(s) in transcripts`);
        return parsed;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Transcript analysis error:', error.message);
    return null;
  }
}

function mergeTranscriptInsights(bulbapediaData, transcriptData) {
  if (!transcriptData || !transcriptData.categories) {
    return bulbapediaData;
  }

  const merged = { ...bulbapediaData };
  const transcriptCategories = transcriptData.categories;

  // Add transcript assumptions to the data
  merged.transcriptAssumptions = transcriptData.assumptions || [];

  const categoryKeys = [
    'maleFemalesDifferences', 'matingHabits', 'combatCapabilities', 
    'survivalCapabilities', 'pokemonWorldUses', 'majorEvents',
    'survivalAdaptation', 'preferredHabitat', 'folklore',
    'rivalries', 'uniqueBehaviors', 'uniqueInformation'
  ];

  categoryKeys.forEach(key => {
    const bulbapediaCategory = merged.categorizedData?.[key];
    const transcriptCategory = transcriptCategories[key];

    if (transcriptCategory) {
      if (bulbapediaCategory) {
        // Merge: add transcript info to existing Bulbapedia data
        merged.categorizedData[key] = {
          summary: bulbapediaCategory.summary,
          details: `[From Bulbapedia] ${bulbapediaCategory.details || bulbapediaCategory.summary}\n\n${transcriptCategory.details || transcriptCategory.summary}`,
          hasTranscriptData: true
        };
      } else {
        // Only transcript data exists
        merged.categorizedData[key] = {
          summary: transcriptCategory.summary,
          details: transcriptCategory.details || transcriptCategory.summary,
          hasTranscriptData: true,
          transcriptOnly: true
        };
      }
    }
  });

  // Also merge anatomy and capabilities if present
  if (transcriptCategories.anatomy) {
    const existing = merged.verboseData?.anatomy || '';
    merged.verboseData.anatomy = existing 
      ? `[From Bulbapedia] ${existing}\n\n${transcriptCategories.anatomy.details || transcriptCategories.anatomy.summary}`
      : transcriptCategories.anatomy.details || transcriptCategories.anatomy.summary;
  }

  if (transcriptCategories.capabilities) {
    const existing = merged.verboseData?.capabilities || '';
    merged.verboseData.capabilities = existing
      ? `[From Bulbapedia] ${existing}\n\n${transcriptCategories.capabilities.details || transcriptCategories.capabilities.summary}`
      : transcriptCategories.capabilities.details || transcriptCategories.capabilities.summary;
  }

  merged.hasTranscriptInsights = true;

  return merged;
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
  mergeLLMWithScraped,
  analyzeTranscriptsForPokemon,
  mergeTranscriptInsights
};
