const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeBulbapedia(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);
  
  const pokemonData = {
    name: '',
    category: '',
    number: '',
    types: [],
    height: '',
    weight: '',
    pokedexColor: '',
    verboseData: {
      anatomy: '',
      capabilities: '',
      pokedexEntries: [],
      fullBiologyText: ''
    },
    categorizedData: {
      maleFemalesDifferences: null,
      matingHabits: null,
      combatCapabilities: null,
      survivalCapabilities: null,
      pokemonWorldUses: null,
      majorEvents: null,
      survivalAdaptation: null,
      preferredHabitat: null,
      folklore: null,
      rivalries: null,
      uniqueBehaviors: null,
      uniqueInformation: null
    }
  };

  pokemonData.name = $('h1#firstHeading').text().replace(/\s*\(Pokémon\)/, '').trim();

  const infobox = $('table.roundy').first();
  
  infobox.find('a[href*="category"]').each((i, el) => {
    const text = $(el).text().trim();
    if (text.includes('Pokémon') && !pokemonData.category) {
      pokemonData.category = text;
    }
  });

  const pageText = $('body').text();
  const ndexMatch = pageText.match(/National\s*(?:Pokédex|Dex)\s*#?\s*(\d{3,4})/i);
  if (ndexMatch) {
    pokemonData.number = ndexMatch[1].padStart(4, '0');
  }

  $('a[href*="/wiki/"][title*="type"]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const typeMatch = href.match(/\/wiki\/(\w+)_\(type\)/i);
    if (typeMatch) {
      const type = typeMatch[1];
      if (!pokemonData.types.includes(type) && pokemonData.types.length < 2) {
        pokemonData.types.push(type);
      }
    }
  });

  const heightMatch = pageText.match(/(\d+'\d+"|[\d.]+\s*m)/);
  if (heightMatch) {
    pokemonData.height = heightMatch[1];
  }

  const weightMatch = pageText.match(/([\d.]+\s*(?:lbs?|kg))/i);
  if (weightMatch) {
    pokemonData.weight = weightMatch[1];
  }

  const colorMatch = pageText.match(/Pokédex\s*color[:\s]*(\w+)/i);
  if (colorMatch) {
    pokemonData.pokedexColor = colorMatch[1];
  }

  let biologyText = '';
  const biologyHeader = $('span#Biology').parent();
  if (biologyHeader.length) {
    let nextEl = biologyHeader.next();
    while (nextEl.length && !nextEl.find('span.mw-headline').length) {
      if (nextEl.is('p')) {
        biologyText += nextEl.text().trim() + '\n\n';
      }
      nextEl = nextEl.next();
    }
  }

  pokemonData.verboseData.fullBiologyText = biologyText.trim();
  
  const sentences = biologyText.split(/(?<=[.!?])\s+/);
  const anatomySentences = [];
  const capabilitySentences = [];

  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    if (lower.includes('body') || lower.includes('head') || lower.includes('tail') || 
        lower.includes('wing') || lower.includes('eye') || lower.includes('leg') ||
        lower.includes('arm') || lower.includes('feather') || lower.includes('fur') ||
        lower.includes('scale') || lower.includes('color') || lower.includes('appear')) {
      anatomySentences.push(sentence);
    }
    if (lower.includes('can ') || lower.includes('able to') || lower.includes('capable') ||
        lower.includes('fly') || lower.includes('swim') || lower.includes('run') ||
        lower.includes('attack') || lower.includes('defend') || lower.includes('speed')) {
      capabilitySentences.push(sentence);
    }
  });

  pokemonData.verboseData.anatomy = anatomySentences.join(' ').trim();
  pokemonData.verboseData.capabilities = capabilitySentences.join(' ').trim();

  $('table').each((i, table) => {
    const tableText = $(table).text();
    if (tableText.includes('Pokédex entries') || tableText.includes('Game locations')) {
      $(table).find('tr').each((j, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const game = $(cells[0]).text().trim();
          const entry = $(cells[1]).text().trim();
          if (game && entry && entry.length > 20) {
            pokemonData.verboseData.pokedexEntries.push({ game, entry });
          }
        }
      });
    }
  });

  pokemonData.categorizedData = categorizeBiologyData(biologyText, pokemonData.name);

  return pokemonData;
}

function categorizeBiologyData(biologyText, pokemonName) {
  const categories = {
    maleFemalesDifferences: null,
    matingHabits: null,
    combatCapabilities: null,
    survivalCapabilities: null,
    pokemonWorldUses: null,
    majorEvents: null,
    survivalAdaptation: null,
    preferredHabitat: null,
    folklore: null,
    rivalries: null,
    uniqueBehaviors: null,
    uniqueInformation: null
  };

  const sentences = biologyText.split(/(?<=[.!?])\s+/);

  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();

    if (lower.includes('male') || lower.includes('female') || lower.includes('gender')) {
      categories.maleFemalesDifferences = categories.maleFemalesDifferences 
        ? categories.maleFemalesDifferences + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('mate') || lower.includes('breed') || lower.includes('egg') || 
        lower.includes('courtship') || lower.includes('attract')) {
      categories.matingHabits = categories.matingHabits 
        ? categories.matingHabits + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('attack') || lower.includes('battle') || lower.includes('fight') ||
        lower.includes('strike') || lower.includes('powerful') || lower.includes('strength') ||
        lower.includes('combat') || lower.includes('opponent')) {
      categories.combatCapabilities = categories.combatCapabilities 
        ? categories.combatCapabilities + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('flee') || lower.includes('escape') || lower.includes('hide') ||
        lower.includes('avoid') || lower.includes('camouflage') || lower.includes('protect')) {
      categories.survivalCapabilities = categories.survivalCapabilities 
        ? categories.survivalCapabilities + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('used by') || lower.includes('humans use') || lower.includes('people use') ||
        lower.includes('taxi') || lower.includes('transport') || lower.includes('work') ||
        lower.includes('help people') || lower.includes('assist')) {
      categories.pokemonWorldUses = categories.pokemonWorldUses 
        ? categories.pokemonWorldUses + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('legend') || lower.includes('ancient') || lower.includes('history') ||
        lower.includes('event') || lower.includes('war') || lower.includes('disaster')) {
      categories.majorEvents = categories.majorEvents 
        ? categories.majorEvents + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('adapt') || lower.includes('evolve') || lower.includes('survive') ||
        lower.includes('environment') || lower.includes('climate') || lower.includes('developed')) {
      categories.survivalAdaptation = categories.survivalAdaptation 
        ? categories.survivalAdaptation + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('habitat') || lower.includes('live') || lower.includes('found in') ||
        lower.includes('dwell') || lower.includes('nest') || lower.includes('home') ||
        lower.includes('region') || lower.includes('forest') || lower.includes('mountain') ||
        lower.includes('ocean') || lower.includes('cave')) {
      categories.preferredHabitat = categories.preferredHabitat 
        ? categories.preferredHabitat + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('legend') || lower.includes('myth') || lower.includes('story') ||
        lower.includes('folklore') || lower.includes('tale') || lower.includes('believed')) {
      categories.folklore = categories.folklore 
        ? categories.folklore + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('rival') || lower.includes('enemy') || lower.includes('compete') ||
        lower.includes('territorial') || lower.includes('conflict')) {
      categories.rivalries = categories.rivalries 
        ? categories.rivalries + ' ' + sentence 
        : sentence;
    }

    if (lower.includes('behavior') || lower.includes('ritual') || lower.includes('habit') ||
        lower.includes('tendency') || lower.includes('known to') || lower.includes('often')) {
      categories.uniqueBehaviors = categories.uniqueBehaviors 
        ? categories.uniqueBehaviors + ' ' + sentence 
        : sentence;
    }
  });

  return categories;
}

module.exports = { scrapeBulbapedia };
