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

  const infobox = $('table.roundy').first();
  
  infobox.find('a[href*="Pokémon_category"]').each((i, el) => {
    const text = $(el).text().trim();
    if (text && !pokemonData.category) {
      pokemonData.category = text + ' Pokémon';
    }
  });

  if (!pokemonData.category) {
    const categoryMatch = $('body').text().match(/the\s+(\w+(?:\s+\w+)?)\s+Pokémon/i);
    if (categoryMatch) {
      pokemonData.category = categoryMatch[1] + ' Pokémon';
    }
  }

  // Try multiple methods to find National Dex number
  const ndexLink = $('a[href*="National_Pok"]').first();
  if (ndexLink.length) {
    const ndexText = ndexLink.parent().text();
    const ndexMatch = ndexText.match(/#?(\d{3,4})/);
    if (ndexMatch) {
      pokemonData.number = ndexMatch[1].padStart(4, '0');
    }
  }
  
  // Fallback: search in page text
  if (!pokemonData.number) {
    const pageText = $.text();
    const ndexMatch = pageText.match(/National\s*Dex[^\d]*#?(\d{3,4})/i) || 
                      pageText.match(/#(\d{3,4})\s/);
    if (ndexMatch) {
      pokemonData.number = ndexMatch[1].padStart(4, '0');
    }
  }

  const typeTable = $('table').filter((i, el) => {
    return $(el).find('a[href*="(type)"]').length > 0 && 
           $(el).find('small:contains("Type")').length > 0;
  }).first();

  if (typeTable.length) {
    typeTable.find('a[href*="(type)"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const typeMatch = href.match(/\/wiki\/(\w+)_\(type\)/i);
      if (typeMatch && pokemonData.types.length < 2) {
        const type = typeMatch[1];
        if (!pokemonData.types.includes(type)) {
          pokemonData.types.push(type);
        }
      }
    });
  }

  if (pokemonData.types.length === 0) {
    $('table.roundy a[href*="(type)"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const typeMatch = href.match(/\/wiki\/(\w+)_\(type\)/i);
      if (typeMatch && pokemonData.types.length < 2) {
        const type = typeMatch[1];
        if (!pokemonData.types.includes(type)) {
          pokemonData.types.push(type);
        }
      }
    });
  }

  const infoboxText = infobox.text();
  
  const heightPatterns = [
    /(\d+'\d+"\s*\([\d.]+\s*m\))/,
    /(\d+'\d+")/,
    /([\d.]+\s*m)/
  ];
  for (const pattern of heightPatterns) {
    const match = infoboxText.match(pattern);
    if (match) {
      pokemonData.height = match[1].trim();
      break;
    }
  }

  const weightPatterns = [
    /([\d.]+\s*lbs?\s*\([\d.]+\s*kg\))/i,
    /([\d.]+\s*lbs?)/i,
    /([\d.]+\s*kg)/i
  ];
  for (const pattern of weightPatterns) {
    const match = infoboxText.match(pattern);
    if (match) {
      pokemonData.weight = match[1].trim();
      break;
    }
  }

  $('table.roundy tr').each((i, row) => {
    const rowText = $(row).text();
    if (rowText.toLowerCase().includes('color')) {
      const colorLink = $(row).find('a[href*="List_of_Pokémon_by_color"]');
      if (colorLink.length) {
        pokemonData.pokedexColor = colorLink.text().trim();
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

  const pokedexEntries = [];
  
  $('h3').each((i, h3) => {
    const headerText = $(h3).text();
    if (headerText.includes('Pokédex entries') || headerText.includes('Game data')) {
      let nextEl = $(h3).next();
      while (nextEl.length && !nextEl.is('h2') && !nextEl.is('h3')) {
        if (nextEl.is('table')) {
          nextEl.find('tr').each((j, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
              const gameCell = $(cells[0]);
              const entryCell = $(cells[1]);
              
              let game = gameCell.find('a').first().text().trim() || gameCell.text().trim();
              game = game.replace(/\s+/g, ' ').trim();
              
              const entry = entryCell.text().trim();
              
              if (game && entry && entry.length > 15 && !entry.includes('This Pokémon was unavailable')) {
                const exists = pokedexEntries.some(e => 
                  e.game === game || e.entry === entry
                );
                if (!exists) {
                  pokedexEntries.push({ game, entry });
                }
              }
            }
          });
        }
        nextEl = nextEl.next();
      }
    }
  });

  $('table').each((i, table) => {
    const tableHtml = $(table).html() || '';
    if (tableHtml.includes('Pokédex') && tableHtml.includes('entry')) {
      $(table).find('tr').each((j, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 1) {
          const text = $(row).text();
          const gameMatch = text.match(/(Red|Blue|Yellow|Gold|Silver|Crystal|Ruby|Sapphire|Emerald|FireRed|LeafGreen|Diamond|Pearl|Platinum|HeartGold|SoulSilver|Black|White|Black 2|White 2|X|Y|Omega Ruby|Alpha Sapphire|Sun|Moon|Ultra Sun|Ultra Moon|Let's Go|Sword|Shield|Brilliant Diamond|Shining Pearl|Legends: Arceus|Scarlet|Violet)/i);
          
          if (gameMatch) {
            const game = gameMatch[1];
            const entryCell = cells.length > 1 ? $(cells[1]) : $(cells[0]);
            const entry = entryCell.text().trim();
            
            if (entry && entry.length > 15 && entry !== game) {
              const exists = pokedexEntries.some(e => e.entry === entry);
              if (!exists) {
                pokedexEntries.push({ game, entry });
              }
            }
          }
        }
      });
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
