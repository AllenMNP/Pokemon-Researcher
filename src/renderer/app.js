const API_BASE = 'http://localhost:3001';

let currentPokemon = null;
let importedData = null;

// Settings
let settings = {
  useLLM: true,
  apiKey: ''
};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const closeSidebar = document.getElementById('closeSidebar');
const pokemonList = document.getElementById('pokemonList');
const searchBtn = document.getElementById('searchBtn');
const bulbapediaUrl = document.getElementById('bulbapediaUrl');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const emptyState = document.getElementById('emptyState');
const pokemonContent = document.getElementById('pokemonContent');
const verboseToggle = document.getElementById('verboseToggle');
const categorizedToggle = document.getElementById('categorizedToggle');
const verboseView = document.getElementById('verboseView');
const categorizedView = document.getElementById('categorizedView');
const deleteBtn = document.getElementById('deleteBtn');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const importModal = document.getElementById('importModal');
const importMerge = document.getElementById('importMerge');
const importReplace = document.getElementById('importReplace');
const importCancel = document.getElementById('importCancel');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const useLLMToggle = document.getElementById('useLLMToggle');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const apiKeyHint = document.getElementById('apiKeyHint');
const processingBadge = document.getElementById('processingBadge');
const processingBadgeText = document.getElementById('processingBadgeText');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadPokemonList();
  checkServerSettings();
  setupEventListeners();
});

function setupEventListeners() {
  hamburgerBtn.addEventListener('click', () => sidebar.classList.add('open'));
  closeSidebar.addEventListener('click', () => sidebar.classList.remove('open'));
  
  searchBtn.addEventListener('click', searchPokemon);
  bulbapediaUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchPokemon();
  });

  verboseToggle.addEventListener('click', () => switchView('verbose'));
  categorizedToggle.addEventListener('click', () => switchView('categorized'));

  deleteBtn.addEventListener('click', deleteCurrentPokemon);

  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', handleFileImport);
  exportBtn.addEventListener('click', exportData);

  importMerge.addEventListener('click', () => processImport('merge'));
  importReplace.addEventListener('click', () => processImport('replace'));
  importCancel.addEventListener('click', () => importModal.classList.remove('visible'));

  // Settings event listeners
  settingsBtn.addEventListener('click', openSettings);
  closeSettings.addEventListener('click', closeSettingsModal);
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });
  toggleApiKeyVisibility.addEventListener('click', toggleApiKeyDisplay);
  saveSettingsBtn.addEventListener('click', saveSettings);
}

function loadSettings() {
  const saved = localStorage.getItem('pokemonResearcherSettings');
  if (saved) {
    settings = JSON.parse(saved);
    useLLMToggle.checked = settings.useLLM;
    apiKeyInput.value = settings.apiKey || '';
  }
}

async function checkServerSettings() {
  try {
    const response = await fetch(`${API_BASE}/api/settings`);
    const data = await response.json();
    if (data.hasEnvApiKey) {
      apiKeyHint.textContent = '✓ API key configured in environment';
      apiKeyHint.classList.add('success');
    }
  } catch (error) {
    console.error('Failed to check server settings:', error);
  }
}

function openSettings() {
  settingsModal.classList.add('visible');
  useLLMToggle.checked = settings.useLLM;
  apiKeyInput.value = settings.apiKey || '';
}

function closeSettingsModal() {
  settingsModal.classList.remove('visible');
}

function toggleApiKeyDisplay() {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleApiKeyVisibility.textContent = 'Hide';
  } else {
    apiKeyInput.type = 'password';
    toggleApiKeyVisibility.textContent = 'Show';
  }
}

function saveSettings() {
  settings.useLLM = useLLMToggle.checked;
  settings.apiKey = apiKeyInput.value.trim();
  localStorage.setItem('pokemonResearcherSettings', JSON.stringify(settings));
  closeSettingsModal();
  
  // Show brief confirmation
  const originalText = saveSettingsBtn.textContent;
  saveSettingsBtn.textContent = 'Saved!';
  setTimeout(() => {
    saveSettingsBtn.textContent = originalText;
  }, 1500);
}

async function loadPokemonList() {
  try {
    const response = await fetch(`${API_BASE}/api/pokemon`);
    const data = await response.json();
    renderPokemonList(data.pokemon);
  } catch (error) {
    console.error('Failed to load pokemon list:', error);
  }
}

function renderPokemonList(pokemon) {
  pokemonList.innerHTML = '';
  
  if (pokemon.length === 0) {
    pokemonList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No saved Pokemon yet</p>';
    return;
  }

  pokemon.forEach(p => {
    const item = document.createElement('div');
    item.className = 'pokemon-list-item';
    item.innerHTML = `
      <div class="pokemon-info">
        <span class="name">${p.name}</span>
        <span class="number">#${p.number || '????'}</span>
      </div>
      <button class="delete-btn" data-id="${p.id}">&times;</button>
    `;
    
    item.querySelector('.pokemon-info').addEventListener('click', () => {
      displayPokemon(p);
      sidebar.classList.remove('open');
    });
    
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deletePokemon(p.id);
    });
    
    pokemonList.appendChild(item);
  });
}

async function searchPokemon() {
  const url = bulbapediaUrl.value.trim();
  
  if (!url) {
    showError('Please enter a Bulbapedia URL');
    return;
  }

  if (!url.includes('bulbapedia.bulbagarden.net')) {
    showError('Please enter a valid Bulbapedia URL');
    return;
  }

  hideError();
  showLoading(true);

  try {
    const requestBody = { 
      url,
      useLLM: settings.useLLM
    };
    
    // Only send API key if user has one configured
    if (settings.apiKey) {
      requestBody.apiKey = settings.apiKey;
    }

    const response = await fetch(`${API_BASE}/api/pokemon/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to scrape Pokemon data');
    }

    const pokemon = await response.json();
    displayPokemon(pokemon);
    loadPokemonList();
    bulbapediaUrl.value = '';
  } catch (error) {
    showError(error.message);
  } finally {
    showLoading(false);
  }
}

function displayPokemon(pokemon) {
  currentPokemon = pokemon;
  emptyState.style.display = 'none';
  pokemonContent.style.display = 'block';

  // Required Information
  document.getElementById('pokemonName').textContent = pokemon.name;
  document.getElementById('pokemonNumber').textContent = pokemon.number ? `#${pokemon.number}` : '';
  document.getElementById('pokemonCategory').textContent = pokemon.category || 'Unknown';
  document.getElementById('pokemonHeight').textContent = pokemon.height || 'Unknown';
  document.getElementById('pokemonWeight').textContent = pokemon.weight || 'Unknown';
  document.getElementById('pokemonColor').textContent = pokemon.pokedexColor || 'Unknown';

  // Types
  const typesContainer = document.getElementById('pokemonTypes');
  typesContainer.innerHTML = '';
  if (pokemon.types && pokemon.types.length > 0) {
    pokemon.types.forEach(type => {
      const badge = document.createElement('span');
      badge.className = `type-badge type-${type.toLowerCase()}`;
      badge.textContent = type;
      typesContainer.appendChild(badge);
    });
  }

  // Processing Badge
  processingBadge.classList.remove('visible', 'keyword-mode');
  if (pokemon.processedWithLLM) {
    processingBadge.classList.add('visible');
    processingBadgeText.textContent = 'Processed with AI';
  } else {
    processingBadge.classList.add('visible', 'keyword-mode');
    processingBadgeText.textContent = 'Keyword-based categorization';
  }

  // Verbose View
  document.getElementById('anatomyText').textContent = pokemon.verboseData?.anatomy || '';
  document.getElementById('capabilitiesText').textContent = pokemon.verboseData?.capabilities || '';
  document.getElementById('fullBiologyText').textContent = pokemon.verboseData?.fullBiologyText || '';

  // Pokedex Entries
  const entriesContainer = document.getElementById('pokedexEntries');
  entriesContainer.innerHTML = '';
  if (pokemon.verboseData?.pokedexEntries && pokemon.verboseData.pokedexEntries.length > 0) {
    pokemon.verboseData.pokedexEntries.forEach(entry => {
      const entryEl = document.createElement('div');
      entryEl.className = 'pokedex-entry';
      entryEl.innerHTML = `
        <div class="game-name">${entry.game}</div>
        <div class="entry-text">${entry.entry}</div>
      `;
      entriesContainer.appendChild(entryEl);
    });
  } else {
    entriesContainer.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No Pokedex entries found</p>';
  }

  // Categorized View
  renderCategorizedView(pokemon.categorizedData, pokemon.processedWithLLM);

  // Reset to verbose view
  switchView('verbose');
}

function renderCategorizedView(categorizedData, isLLMProcessed = false) {
  const grid = document.getElementById('categoriesGrid');
  grid.innerHTML = '';

  const categoryLabels = {
    maleFemalesDifferences: 'Male/Female Differences',
    matingHabits: 'Mating Habits',
    combatCapabilities: 'Combat Capabilities',
    survivalCapabilities: 'Survival Capabilities',
    pokemonWorldUses: 'Pokemon World Uses',
    majorEvents: 'Major Events/History',
    survivalAdaptation: 'Survival/Adaptation',
    preferredHabitat: 'Preferred Habitat',
    folklore: 'Folklore',
    rivalries: 'Rivalries',
    uniqueBehaviors: 'Unique Behaviors',
    uniqueInformation: 'Unique Information'
  };

  let hasAnyCategory = false;

  for (const [key, label] of Object.entries(categoryLabels)) {
    const value = categorizedData?.[key];
    if (value) {
      // Handle both LLM format (object with summary/details) and keyword format (string)
      let content = '';
      let summary = '';
      
      if (typeof value === 'object' && value !== null) {
        summary = value.summary || '';
        content = value.details || value.summary || '';
      } else if (typeof value === 'string' && value.trim()) {
        content = value.trim();
      }
      
      if (content) {
        hasAnyCategory = true;
        const card = document.createElement('div');
        card.className = 'category-card';
        
        if (isLLMProcessed && summary && summary !== content) {
          card.innerHTML = `
            <h3>${label}</h3>
            <p class="category-summary"><strong>Summary:</strong> ${summary}</p>
            <p class="category-details">${content}</p>
          `;
        } else {
          card.innerHTML = `
            <h3>${label}</h3>
            <p>${content}</p>
          `;
        }
        grid.appendChild(card);
      }
    }
  }

  if (!hasAnyCategory) {
    grid.innerHTML = '<p style="color: var(--text-secondary); font-style: italic; grid-column: 1 / -1; text-align: center; padding: 40px;">No categorized information available for this Pokemon</p>';
  }
}

function switchView(view) {
  if (view === 'verbose') {
    verboseToggle.classList.add('active');
    categorizedToggle.classList.remove('active');
    verboseView.style.display = 'block';
    categorizedView.style.display = 'none';
  } else {
    verboseToggle.classList.remove('active');
    categorizedToggle.classList.add('active');
    verboseView.style.display = 'none';
    categorizedView.style.display = 'block';
  }
}

async function deletePokemon(id) {
  if (!confirm('Are you sure you want to delete this Pokemon?')) return;

  try {
    const response = await fetch(`${API_BASE}/api/pokemon/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      loadPokemonList();
      if (currentPokemon && currentPokemon.id === id) {
        currentPokemon = null;
        emptyState.style.display = 'block';
        pokemonContent.style.display = 'none';
      }
    }
  } catch (error) {
    showError('Failed to delete Pokemon');
  }
}

function deleteCurrentPokemon() {
  if (currentPokemon) {
    deletePokemon(currentPokemon.id);
  }
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      importedData = JSON.parse(event.target.result);
      if (!importedData.pokemon || !Array.isArray(importedData.pokemon)) {
        throw new Error('Invalid format');
      }
      importModal.classList.add('visible');
    } catch (error) {
      showError('Invalid JSON file format');
    }
  };
  reader.readAsText(file);
  importFile.value = '';
}

async function processImport(mode) {
  importModal.classList.remove('visible');
  
  try {
    const response = await fetch(`${API_BASE}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: importedData, mode })
    });

    if (response.ok) {
      loadPokemonList();
      alert(`Successfully imported ${importedData.pokemon.length} Pokemon!`);
    } else {
      throw new Error('Import failed');
    }
  } catch (error) {
    showError('Failed to import data');
  }
  
  importedData = null;
}

async function exportData() {
  try {
    const response = await fetch(`${API_BASE}/api/pokemon`);
    const data = await response.json();
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokemon-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    showError('Failed to export data');
  }
}

function showLoading(show) {
  loadingIndicator.classList.toggle('visible', show);
  searchBtn.disabled = show;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');
}

function hideError() {
  errorMessage.classList.remove('visible');
}
