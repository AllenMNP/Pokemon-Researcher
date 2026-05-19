const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeBulbapedia(url) {
  // Decode URL first to handle encoded characters like %C3%A9
  const decodedUrl = decodeURIComponent(url);
  
  // Extract Pokemon name from URL - handle both encoded and decoded formats
  const urlMatch = decodedUrl.match(/\/wiki\/([^/]+)_\(Pok[eé]mon\)/i);
  if (!urlMatch) {
    throw new Error('Invalid Bulbapedia Pokemon URL format. Expected format: .../wiki/PokemonName_(Pokémon)');
  }
  
  const pokemonName = urlMatch[1].replace(/_/g, ' ');
  
  // Use MediaWiki API to get page content (bypasses Cloudflare)
  const apiUrl = `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${encodeURIComponent(pokemonName)}_(Pokémon)&format=json&prop=text|categories&origin=*`;
  
  const response = await axios.get(apiUrl, {
    headers: {
      'User-Agent': 'PokemonResearcher/1.0 (Educational Pokemon Research Tool)',
      'Accept': 'application/json'
    },
    timeout: 30000
  });

  if (response.data.error) {
    throw new Error(`Page not found: ${response.data.error.info}`);
  }

  const htmlContent = response.data.parse.text['*'];
  const $ = cheerio.load(htmlContent);
  
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
      fullBiologyText: '',
      animeInfo: '',
      triviaInfo: ''
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
    },
    processedWithLLM: false
  };

  // Use the name from URL since API doesn't include page title in parsed content
  pokemonData.name = pokemonName;

  // Get page text for fallback searches
  const pageText = $.text();
  
  // === POKEMON CATEGORY ===
  // Look for the category link which appears right after the Pokemon name in the infobox
  $('a[href*="Pok%C3%A9mon_category"], a[href*="Pokemon_category"], a[href*="Pokémon_category"]').each((i, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    // The category text is usually in a span inside the link, like "Seven Spot Pokémon"
    if (text && !pokemonData.category && text.includes('Pokémon') && !text.includes('category')) {
      pokemonData.category = text;
    }
  });
  
  // Fallback: look for pattern "XXX Pokémon" near the Pokemon name
  if (!pokemonData.category) {
    const categoryMatch = pageText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+Pokémon(?=\s|$)/);
    if (categoryMatch && categoryMatch[1] !== 'the') {
      pokemonData.category = categoryMatch[1] + ' Pokémon';
    }
  }

  // === NATIONAL DEX NUMBER ===
  // Look for the Ndex number in tables
  $('a[href*="List_of_Pok"]').each((i, el) => {
    const text = $(el).text().trim();
    const numMatch = text.match(/^#?(\d{3,4})$/);
    if (numMatch && !pokemonData.number) {
      pokemonData.number = numMatch[1].padStart(4, '0');
    }
  });
  
  if (!pokemonData.number) {
    // Look for pattern like "#824" or "824" near "National" or "Ndex"
    const ndexMatch = pageText.match(/(?:National|Ndex)[^\d]*#?(\d{3,4})/i);
    if (ndexMatch) {
      pokemonData.number = ndexMatch[1].padStart(4, '0');
    }
  }

  // === POKEMON TYPES ===
  // Find types from the Type row in infobox
  $('table').each((i, table) => {
    const tableText = $(table).text();
    if (tableText.includes('Type') && pokemonData.types.length === 0) {
      $(table).find('a[href*="(type)"]').each((j, el) => {
        const href = $(el).attr('href') || '';
        const typeMatch = href.match(/\/wiki\/(\w+)_\(type\)/i);
        if (typeMatch && pokemonData.types.length < 2) {
          const type = typeMatch[1];
          if (!pokemonData.types.includes(type) && type !== 'Unknown') {
            pokemonData.types.push(type);
          }
        }
      });
    }
  });

  // === HEIGHT AND WEIGHT ===
  // Look for Height and Weight rows specifically
  $('table').each((i, table) => {
    $(table).find('tr').each((j, row) => {
      const rowText = $(row).text();
      
      // Height extraction
      if (rowText.includes('Height') && !pokemonData.height) {
        const heightMatch = rowText.match(/(\d+'\d+")[^\d]*([\d.]+\s*m)/);
        if (heightMatch) {
          pokemonData.height = `${heightMatch[1]} (${heightMatch[2]})`;
        } else {
          const simpleHeight = rowText.match(/(\d+'\d+")/);
          if (simpleHeight) pokemonData.height = simpleHeight[1];
        }
      }
      
      // Weight extraction
      if (rowText.includes('Weight') && !pokemonData.weight) {
        const weightMatch = rowText.match(/([\d.]+)\s*lbs?[^\d]*([\d.]+)\s*kg/i);
        if (weightMatch) {
          pokemonData.weight = `${weightMatch[1]} lbs (${weightMatch[2]} kg)`;
        } else {
          const simpleWeight = rowText.match(/([\d.]+)\s*(?:lbs?|kg)/i);
          if (simpleWeight) pokemonData.weight = simpleWeight[0];
        }
      }
    });
  });

  // === POKEDEX COLOR ===
  const validColors = ['Red', 'Blue', 'Yellow', 'Green', 'Black', 'Brown', 'Purple', 'Gray', 'Grey', 'White', 'Pink'];
  
  // The color appears in a td after the "Pokédex color" link, in format: <span style="background:...">&#8195;</span> ColorName
  $('a[href*="by_color"]').each((i, el) => {
    if (!pokemonData.pokedexColor) {
      const $link = $(el);
      const $parentTd = $link.closest('td');
      // The color is in a nested table inside this td
      const innerText = $parentTd.text();
      for (const color of validColors) {
        // Check if color name appears after "Pokédex color" or "color"
        if (innerText.includes(color)) {
          pokemonData.pokedexColor = color;
          return false; // break
        }
      }
    }
  });

  let biologyText = '';
  const biologyHeader = $('span#Biology').parent();
  if (biologyHeader.length) {
    let nextEl = biologyHeader.next();
    while (nextEl.length) {
      if (nextEl.is('h2') || nextEl.find('span.mw-headline').length) {
        break;
      }
      if (nextEl.is('p')) {
        biologyText += nextEl.text().trim() + '\n\n';
      }
      if (nextEl.is('h3')) {
        const subheading = nextEl.text().trim();
        biologyText += `\n[${subheading}]\n`;
      }
      nextEl = nextEl.next();
    }
  }

  pokemonData.verboseData.fullBiologyText = biologyText.trim();

  let animeText = '';
  const animeHeader = $('span#In_the_anime').parent();
  if (animeHeader.length) {
    let nextEl = animeHeader.next();
    while (nextEl.length) {
      if (nextEl.is('h2') || (nextEl.is('h3') && !nextEl.parents('.mw-parser-output').length)) {
        break;
      }
      if (nextEl.is('p')) {
        animeText += nextEl.text().trim() + '\n\n';
      }
      nextEl = nextEl.next();
    }
  }
  pokemonData.verboseData.animeInfo = animeText.trim();

  let triviaText = '';
  const triviaHeader = $('span#Trivia').parent();
  if (triviaHeader.length) {
    let nextEl = triviaHeader.next();
    while (nextEl.length) {
      if (nextEl.is('h2') || nextEl.find('span.mw-headline').length) {
        break;
      }
      if (nextEl.is('ul')) {
        nextEl.find('li').each((i, li) => {
          triviaText += '• ' + $(li).text().trim() + '\n';
        });
      }
      if (nextEl.is('p')) {
        triviaText += nextEl.text().trim() + '\n\n';
      }
      nextEl = nextEl.next();
    }
  }
  pokemonData.verboseData.triviaInfo = triviaText.trim();

  // === POKEDEX ENTRIES ===
  const pokedexEntries = [];
  
  // Find the specific Pokedex entry rows - they have structure:
  // <th> with game name link (background color indicates game) </th>
  // <td> with the actual entry text </td>
  // The entry text is descriptive (30+ chars) and talks about the Pokemon
  
  $('th').each((i, th) => {
    const $th = $(th);
    const thText = $th.text().trim();
    
    // Check if this th contains a game name (Sword, Shield, Scarlet, Violet, etc.)
    const gamePatterns = [
      { pattern: /^Sword\s*$/, name: 'Sword' },
      { pattern: /^Shield\s*$/, name: 'Shield' },
      { pattern: /^Scarlet\s*$/, name: 'Scarlet' },
      { pattern: /^Violet\s*$/, name: 'Violet' },
      { pattern: /^Red\s*$/, name: 'Red' },
      { pattern: /^Blue\s*$/, name: 'Blue' },
      { pattern: /^Yellow\s*$/, name: 'Yellow' },
      { pattern: /^Gold\s*$/, name: 'Gold' },
      { pattern: /^Silver\s*$/, name: 'Silver' },
      { pattern: /^Crystal\s*$/, name: 'Crystal' },
      { pattern: /^Ruby\s*$/, name: 'Ruby' },
      { pattern: /^Sapphire\s*$/, name: 'Sapphire' },
      { pattern: /^Emerald\s*$/, name: 'Emerald' },
      { pattern: /^FireRed\s*$/, name: 'FireRed' },
      { pattern: /^LeafGreen\s*$/, name: 'LeafGreen' },
      { pattern: /^Diamond\s*$/, name: 'Diamond' },
      { pattern: /^Pearl\s*$/, name: 'Pearl' },
      { pattern: /^Platinum\s*$/, name: 'Platinum' },
      { pattern: /^HeartGold\s*$/, name: 'HeartGold' },
      { pattern: /^SoulSilver\s*$/, name: 'SoulSilver' },
      { pattern: /^Black\s*$/, name: 'Black' },
      { pattern: /^White\s*$/, name: 'White' },
      { pattern: /^Black 2\s*$/, name: 'Black 2' },
      { pattern: /^White 2\s*$/, name: 'White 2' },
      { pattern: /^X\s*$/, name: 'X' },
      { pattern: /^Y\s*$/, name: 'Y' },
      { pattern: /^Omega Ruby\s*$/, name: 'Omega Ruby' },
      { pattern: /^Alpha Sapphire\s*$/, name: 'Alpha Sapphire' },
      { pattern: /^Sun\s*$/, name: 'Sun' },
      { pattern: /^Moon\s*$/, name: 'Moon' },
      { pattern: /^Ultra Sun\s*$/, name: 'Ultra Sun' },
      { pattern: /^Ultra Moon\s*$/, name: 'Ultra Moon' },
      { pattern: /^Brilliant Diamond\s*$/, name: 'Brilliant Diamond' },
      { pattern: /^Shining Pearl\s*$/, name: 'Shining Pearl' },
      { pattern: /^Legends: Arceus\s*$/, name: 'Legends: Arceus' }
    ];
    
    let foundGame = null;
    for (const { pattern, name } of gamePatterns) {
      if (pattern.test(thText)) {
        foundGame = name;
        break;
      }
    }
    
    if (foundGame) {
      // Look for the adjacent <td> in the same row
      const $row = $th.closest('tr');
      const $td = $row.find('td').first();
      
      if ($td.length) {
        const entryText = $td.text().trim();
        
        // Valid Pokedex entry criteria:
        // - At least 30 characters (real descriptions are longer)
        // - Contains actual descriptive text about the Pokemon
        // - Not a location or availability note
        if (entryText.length >= 30 && 
            !entryText.includes('Route') &&
            !entryText.includes('Wild Area') &&
            !entryText.includes('Max Raid') &&
            !entryText.includes('Giant\'s Cap') &&
            !entryText.includes('Lake of') &&
            !entryText.includes('Slumbering') &&
            !entryText.includes('Dappled Grove') &&
            !entryText.includes('Bridge Field') &&
            !entryText.includes('Rolling Fields') &&
            !entryText.includes('South Lake') &&
            !entryText.includes('Raid Battle') &&
            !entryText.includes('Gigantamax Factor') &&
            !entryText.includes('This Pokémon was unavailable') &&
            !entryText.includes('Same as') &&
            !entryText.match(/^(Trade|Evolve|Breed)/i) &&
            // Entry should read like a description, not a location list
            !entryText.match(/^[A-Z][a-z]+('s)?\s+(Cap|Grove|Field|Lake|Weald|Forest|Cave|Tower)/)) {
          
          // Check if we already have this exact entry text
          const exists = pokedexEntries.some(e => e.entry === entryText);
          if (!exists) {
            pokedexEntries.push({ game: foundGame, entry: entryText });
          }
        }
      }
    }
  });

  pokemonData.verboseData.pokedexEntries = pokedexEntries;

  const sentences = biologyText.split(/(?<=[.!?])\s+/);
  const anatomySentences = [];
  const capabilitySentences = [];

  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    if (lower.includes('body') || lower.includes('head') || lower.includes('tail') || 
        lower.includes('wing') || lower.includes('eye') || lower.includes('leg') ||
        lower.includes('arm') || lower.includes('feather') || lower.includes('fur') ||
        lower.includes('scale') || lower.includes('beak') || lower.includes('claw') ||
        lower.includes('horn') || lower.includes('skin') || lower.includes('appear') ||
        lower.includes('resemble') || lower.includes('covered') || lower.includes('coloration')) {
      anatomySentences.push(sentence);
    }
    if (lower.includes('can ') || lower.includes('able to') || lower.includes('capable') ||
        lower.includes('fly') || lower.includes('swim') || lower.includes('run') ||
        lower.includes('attack') || lower.includes('defend') || lower.includes('speed') ||
        lower.includes('powerful') || lower.includes('strong') || lower.includes('fast')) {
      capabilitySentences.push(sentence);
    }
  });

  pokemonData.verboseData.anatomy = anatomySentences.join(' ').trim();
  pokemonData.verboseData.capabilities = capabilitySentences.join(' ').trim();

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
