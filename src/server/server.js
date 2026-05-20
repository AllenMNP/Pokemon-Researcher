require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { scrapeBulbapedia } = require('./scraper');
const { categorizePokemonData, mergeLLMWithScraped } = require('./llmService');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.join(__dirname, '../../data');
const POKEMON_FILE = path.join(DATA_DIR, 'pokemon.json');
const TRANSCRIPTS_FILE = path.join(DATA_DIR, 'transcripts.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(POKEMON_FILE)) {
  fs.writeFileSync(POKEMON_FILE, JSON.stringify({ pokemon: [] }, null, 2));
}

if (!fs.existsSync(TRANSCRIPTS_FILE)) {
  fs.writeFileSync(TRANSCRIPTS_FILE, JSON.stringify({ transcripts: [] }, null, 2));
}

function loadPokemonData() {
  try {
    const data = fs.readFileSync(POKEMON_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { pokemon: [] };
  }
}

function savePokemonData(data) {
  fs.writeFileSync(POKEMON_FILE, JSON.stringify(data, null, 2));
}

function loadTranscripts() {
  try {
    const data = fs.readFileSync(TRANSCRIPTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { transcripts: [] };
  }
}

function saveTranscripts(data) {
  fs.writeFileSync(TRANSCRIPTS_FILE, JSON.stringify(data, null, 2));
}

function searchTranscriptsForPokemon(pokemonName) {
  const data = loadTranscripts();
  const results = [];
  const searchName = pokemonName.toLowerCase();
  
  for (const transcript of data.transcripts) {
    const content = transcript.content.toLowerCase();
    if (content.includes(searchName)) {
      // Extract excerpts containing the Pokemon name (with context)
      const excerpts = [];
      const sentences = transcript.content.split(/[.!?]+/);
      
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(searchName) && sentence.trim().length > 20) {
          excerpts.push(sentence.trim() + '.');
        }
      }
      
      if (excerpts.length > 0) {
        results.push({
          transcriptId: transcript.id,
          title: transcript.title,
          source: transcript.source,
          excerpts: excerpts.slice(0, 10) // Limit to 10 excerpts per transcript
        });
      }
    }
  }
  
  return results;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/pokemon', (req, res) => {
  const data = loadPokemonData();
  res.json(data);
});

app.get('/api/pokemon/:id', (req, res) => {
  const data = loadPokemonData();
  const pokemon = data.pokemon.find(p => p.id === req.params.id);
  if (pokemon) {
    res.json(pokemon);
  } else {
    res.status(404).json({ error: 'Pokemon not found' });
  }
});

app.post('/api/pokemon/scrape', async (req, res) => {
  const { url, useLLM = true, apiKey } = req.body;
  
  if (!url || !url.includes('bulbapedia.bulbagarden.net')) {
    return res.status(400).json({ error: 'Invalid Bulbapedia URL' });
  }

  try {
    console.log(`Scraping Pokemon from: ${url}`);
    let scrapedData = await scrapeBulbapedia(url);
    
    if (useLLM) {
      console.log('Processing with LLM...');
      const llmResult = await categorizePokemonData(scrapedData, apiKey);
      if (llmResult) {
        scrapedData = mergeLLMWithScraped(scrapedData, llmResult);
        console.log('LLM categorization complete');
      } else {
        console.log('LLM unavailable, using keyword-based categorization');
      }
    }
    
    // Search transcripts for this Pokemon
    const transcriptData = searchTranscriptsForPokemon(scrapedData.name);
    if (transcriptData.length > 0) {
      console.log(`Found ${transcriptData.length} transcript(s) mentioning ${scrapedData.name}`);
      scrapedData.transcriptData = transcriptData;
    } else {
      scrapedData.transcriptData = [];
    }
    
    const data = loadPokemonData();
    
    const existingIndex = data.pokemon.findIndex(
      p => p.name.toLowerCase() === scrapedData.name.toLowerCase()
    );
    
    const pokemonEntry = {
      id: existingIndex >= 0 ? data.pokemon[existingIndex].id : uuidv4(),
      ...scrapedData,
      sourceUrl: url,
      createdAt: existingIndex >= 0 ? data.pokemon[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      data.pokemon[existingIndex] = pokemonEntry;
    } else {
      data.pokemon.push(pokemonEntry);
    }

    savePokemonData(data);
    res.json(pokemonEntry);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: error.message || 'Failed to scrape Pokemon data' });
  }
});

app.get('/api/settings', (req, res) => {
  res.json({
    hasEnvApiKey: !!process.env.ANTHROPIC_API_KEY
  });
});

// Transcript CRUD endpoints
app.get('/api/transcripts', (req, res) => {
  const data = loadTranscripts();
  res.json(data);
});

app.get('/api/transcripts/:id', (req, res) => {
  const data = loadTranscripts();
  const transcript = data.transcripts.find(t => t.id === req.params.id);
  if (transcript) {
    res.json(transcript);
  } else {
    res.status(404).json({ error: 'Transcript not found' });
  }
});

app.post('/api/transcripts', (req, res) => {
  const { title, source, content } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  
  const data = loadTranscripts();
  const newTranscript = {
    id: uuidv4(),
    title: title.trim(),
    source: source?.trim() || '',
    content: content.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.transcripts.push(newTranscript);
  saveTranscripts(data);
  res.json(newTranscript);
});

app.put('/api/transcripts/:id', (req, res) => {
  const { title, source, content } = req.body;
  const data = loadTranscripts();
  const index = data.transcripts.findIndex(t => t.id === req.params.id);
  
  if (index < 0) {
    return res.status(404).json({ error: 'Transcript not found' });
  }
  
  data.transcripts[index] = {
    ...data.transcripts[index],
    title: title?.trim() || data.transcripts[index].title,
    source: source?.trim() ?? data.transcripts[index].source,
    content: content?.trim() || data.transcripts[index].content,
    updatedAt: new Date().toISOString()
  };
  
  saveTranscripts(data);
  res.json(data.transcripts[index]);
});

app.delete('/api/transcripts/:id', (req, res) => {
  const data = loadTranscripts();
  const index = data.transcripts.findIndex(t => t.id === req.params.id);
  
  if (index >= 0) {
    data.transcripts.splice(index, 1);
    saveTranscripts(data);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Transcript not found' });
  }
});

app.get('/api/transcripts/search/:pokemonName', (req, res) => {
  const results = searchTranscriptsForPokemon(req.params.pokemonName);
  res.json(results);
});

app.delete('/api/pokemon/:id', (req, res) => {
  const data = loadPokemonData();
  const index = data.pokemon.findIndex(p => p.id === req.params.id);
  
  if (index >= 0) {
    data.pokemon.splice(index, 1);
    savePokemonData(data);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Pokemon not found' });
  }
});

app.get('/api/export', (req, res) => {
  const data = loadPokemonData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=pokemon-data.json');
  res.json(data);
});

app.post('/api/import', (req, res) => {
  const { data: importedData, mode } = req.body;
  
  if (!importedData || !importedData.pokemon) {
    return res.status(400).json({ error: 'Invalid import data format' });
  }

  const currentData = loadPokemonData();

  if (mode === 'replace') {
    savePokemonData(importedData);
  } else {
    importedData.pokemon.forEach(newPokemon => {
      const existingIndex = currentData.pokemon.findIndex(
        p => p.name.toLowerCase() === newPokemon.name.toLowerCase()
      );
      if (existingIndex >= 0) {
        currentData.pokemon[existingIndex] = { ...newPokemon, id: currentData.pokemon[existingIndex].id };
      } else {
        currentData.pokemon.push({ ...newPokemon, id: uuidv4() });
      }
    });
    savePokemonData(currentData);
  }

  res.json({ success: true, count: importedData.pokemon.length });
});

app.listen(PORT, () => {
  console.log(`Pokemon Researcher server running on http://localhost:${PORT}`);
});
