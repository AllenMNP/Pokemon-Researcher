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

// Header AI Toggle
const headerAIToggle = document.getElementById('headerAIToggle');

// Transcript Elements
const transcriptsBtn = document.getElementById('transcriptsBtn');
const transcriptsModal = document.getElementById('transcriptsModal');
const closeTranscripts = document.getElementById('closeTranscripts');
const transcriptsList = document.getElementById('transcriptsList');
const addTranscriptBtn = document.getElementById('addTranscriptBtn');
const transcriptFormModal = document.getElementById('transcriptFormModal');
const closeTranscriptForm = document.getElementById('closeTranscriptForm');
const transcriptForm = document.getElementById('transcriptForm');
const transcriptFormTitle = document.getElementById('transcriptFormTitle');
const transcriptId = document.getElementById('transcriptId');
const transcriptTitle = document.getElementById('transcriptTitle');
const transcriptSource = document.getElementById('transcriptSource');
const transcriptContent = document.getElementById('transcriptContent');
const cancelTranscriptForm = document.getElementById('cancelTranscriptForm');
const deleteTranscriptModal = document.getElementById('deleteTranscriptModal');
const cancelDeleteTranscript = document.getElementById('cancelDeleteTranscript');
const confirmDeleteTranscript = document.getElementById('confirmDeleteTranscript');
const transcriptDataCard = document.getElementById('transcriptDataCard');
const transcriptExcerpts = document.getElementById('transcriptExcerpts');

// Assumptions Elements
const assumptionsSection = document.getElementById('assumptionsSection');
const assumptionsHeader = document.getElementById('assumptionsHeader');
const assumptionsCount = document.getElementById('assumptionsCount');
const assumptionsContent = document.getElementById('assumptionsContent');
const assumptionsList = document.getElementById('assumptionsList');

let transcriptToDelete = null;

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

  // Header AI Toggle
  headerAIToggle.addEventListener('change', () => {
    settings.useLLM = headerAIToggle.checked;
    useLLMToggle.checked = headerAIToggle.checked;
    localStorage.setItem('pokemonResearcherSettings', JSON.stringify(settings));
  });

  // Transcript event listeners
  transcriptsBtn.addEventListener('click', openTranscriptsModal);
  closeTranscripts.addEventListener('click', closeTranscriptsModal);
  transcriptsModal.addEventListener('click', (e) => {
    if (e.target === transcriptsModal) closeTranscriptsModal();
  });
  addTranscriptBtn.addEventListener('click', () => openTranscriptForm());
  closeTranscriptForm.addEventListener('click', closeTranscriptFormModal);
  cancelTranscriptForm.addEventListener('click', closeTranscriptFormModal);
  transcriptFormModal.addEventListener('click', (e) => {
    if (e.target === transcriptFormModal) closeTranscriptFormModal();
  });
  transcriptForm.addEventListener('submit', handleTranscriptSubmit);
  cancelDeleteTranscript.addEventListener('click', () => deleteTranscriptModal.classList.remove('visible'));
  confirmDeleteTranscript.addEventListener('click', handleDeleteTranscript);
  deleteTranscriptModal.addEventListener('click', (e) => {
    if (e.target === deleteTranscriptModal) deleteTranscriptModal.classList.remove('visible');
  });

  // Assumptions toggle
  assumptionsHeader.addEventListener('click', () => {
    assumptionsContent.classList.toggle('collapsed');
    const toggle = assumptionsHeader.querySelector('.assumptions-toggle');
    toggle.textContent = assumptionsContent.classList.contains('collapsed') ? '▶' : '▼';
  });
}

function loadSettings() {
  const saved = localStorage.getItem('pokemonResearcherSettings');
  if (saved) {
    settings = JSON.parse(saved);
    useLLMToggle.checked = settings.useLLM;
    headerAIToggle.checked = settings.useLLM;
    apiKeyInput.value = settings.apiKey || '';
  } else {
    // Default: AI enabled
    headerAIToggle.checked = true;
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
  headerAIToggle.checked = settings.useLLM; // Sync header toggle
  localStorage.setItem('pokemonResearcherSettings', JSON.stringify(settings));
  closeSettingsModal();
  
  // Show brief confirmation
  const originalText = saveSettingsBtn.textContent;
  saveSettingsBtn.textContent = 'Saved!';
  setTimeout(() => {
    saveSettingsBtn.textContent = originalText;
  }, 1500);
}

// ============ TRANSCRIPT FUNCTIONS ============

async function openTranscriptsModal() {
  transcriptsModal.classList.add('visible');
  await loadTranscriptsList();
}

function closeTranscriptsModal() {
  transcriptsModal.classList.remove('visible');
}

async function loadTranscriptsList() {
  try {
    const response = await fetch(`${API_BASE}/api/transcripts`);
    const data = await response.json();
    renderTranscriptsList(data.transcripts);
  } catch (error) {
    console.error('Failed to load transcripts:', error);
    transcriptsList.innerHTML = '<p class="error-text">Failed to load transcripts</p>';
  }
}

function renderTranscriptsList(transcripts) {
  if (transcripts.length === 0) {
    transcriptsList.innerHTML = `
      <div class="empty-transcripts">
        <p>No transcripts yet</p>
        <p class="hint">Add YouTube video transcripts to enhance Pokemon research</p>
      </div>
    `;
    return;
  }

  transcriptsList.innerHTML = transcripts.map(t => `
    <div class="transcript-item" data-id="${t.id}">
      <div class="transcript-info">
        <h4 class="transcript-title">${escapeHtml(t.title)}</h4>
        ${t.source ? `<a href="${escapeHtml(t.source)}" target="_blank" class="transcript-source">${escapeHtml(t.source)}</a>` : ''}
        <p class="transcript-preview">${escapeHtml(t.content.substring(0, 150))}${t.content.length > 150 ? '...' : ''}</p>
      </div>
      <div class="transcript-actions">
        <button class="btn btn-small btn-secondary" onclick="openTranscriptForm('${t.id}')">Edit</button>
        <button class="btn btn-small btn-danger" onclick="promptDeleteTranscript('${t.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function openTranscriptForm(id = null) {
  transcriptForm.reset();
  transcriptId.value = '';
  
  if (id) {
    // Edit mode
    transcriptFormTitle.textContent = 'Edit Transcript';
    try {
      const response = await fetch(`${API_BASE}/api/transcripts/${id}`);
      const transcript = await response.json();
      transcriptId.value = transcript.id;
      transcriptTitle.value = transcript.title;
      transcriptSource.value = transcript.source || '';
      transcriptContent.value = transcript.content;
    } catch (error) {
      console.error('Failed to load transcript:', error);
      return;
    }
  } else {
    // Add mode
    transcriptFormTitle.textContent = 'Add Transcript';
  }
  
  transcriptFormModal.classList.add('visible');
}

function closeTranscriptFormModal() {
  transcriptFormModal.classList.remove('visible');
  transcriptForm.reset();
}

async function handleTranscriptSubmit(e) {
  e.preventDefault();
  
  const id = transcriptId.value;
  const data = {
    title: transcriptTitle.value.trim(),
    source: transcriptSource.value.trim(),
    content: transcriptContent.value.trim()
  };
  
  try {
    const url = id ? `${API_BASE}/api/transcripts/${id}` : `${API_BASE}/api/transcripts`;
    const method = id ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save transcript');
    }
    
    closeTranscriptFormModal();
    await loadTranscriptsList();
  } catch (error) {
    console.error('Failed to save transcript:', error);
    alert('Failed to save transcript. Please try again.');
  }
}

function promptDeleteTranscript(id) {
  transcriptToDelete = id;
  deleteTranscriptModal.classList.add('visible');
}

async function handleDeleteTranscript() {
  if (!transcriptToDelete) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/transcripts/${transcriptToDelete}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete transcript');
    }
    
    deleteTranscriptModal.classList.remove('visible');
    transcriptToDelete = null;
    await loadTranscriptsList();
  } catch (error) {
    console.error('Failed to delete transcript:', error);
    alert('Failed to delete transcript. Please try again.');
  }
}

// ============ POKEMON FUNCTIONS ============

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
    let badgeText = 'Processed with AI';
    if (pokemon.hasTranscriptInsights) {
      badgeText += ' + Transcript Analysis';
    }
    processingBadgeText.textContent = badgeText;
  } else {
    processingBadge.classList.add('visible', 'keyword-mode');
    processingBadgeText.textContent = 'Keyword-based categorization';
  }

  // Assumptions Section
  if (pokemon.transcriptAssumptions && pokemon.transcriptAssumptions.length > 0) {
    assumptionsSection.style.display = 'block';
    assumptionsCount.textContent = pokemon.transcriptAssumptions.length;
    assumptionsList.innerHTML = pokemon.transcriptAssumptions.map(a => `
      <li class="assumption-item">
        <span class="assumption-original">"${escapeHtml(a.original)}"</span>
        <span class="assumption-arrow">→</span>
        <span class="assumption-interpreted">"${escapeHtml(a.interpreted)}"</span>
        <span class="assumption-source">in ${escapeHtml(a.source)}</span>
        ${a.context ? `<p class="assumption-context">"${escapeHtml(a.context)}"</p>` : ''}
      </li>
    `).join('');
    assumptionsContent.classList.remove('collapsed');
  } else {
    assumptionsSection.style.display = 'none';
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

  // Transcript Data
  if (pokemon.transcriptData && pokemon.transcriptData.length > 0) {
    transcriptDataCard.style.display = 'block';
    transcriptExcerpts.innerHTML = '';
    
    pokemon.transcriptData.forEach(transcript => {
      const transcriptEl = document.createElement('div');
      transcriptEl.className = 'transcript-excerpt-group';
      
      const headerHtml = transcript.source 
        ? `<a href="${escapeHtml(transcript.source)}" target="_blank" class="transcript-excerpt-title">${escapeHtml(transcript.title)}</a>`
        : `<span class="transcript-excerpt-title">${escapeHtml(transcript.title)}</span>`;
      
      transcriptEl.innerHTML = `
        <div class="transcript-excerpt-header">
          ${headerHtml}
        </div>
        <div class="transcript-excerpt-list">
          ${transcript.excerpts.map(excerpt => `
            <div class="transcript-excerpt-item">
              <span class="excerpt-quote">"</span>
              <p>${escapeHtml(excerpt)}</p>
              <span class="excerpt-quote">"</span>
            </div>
          `).join('')}
        </div>
      `;
      transcriptExcerpts.appendChild(transcriptEl);
    });
  } else {
    transcriptDataCard.style.display = 'none';
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
