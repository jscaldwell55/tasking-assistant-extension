// Enhanced popup.js with configuration management

let sourceTabs = [];
let destTabs = [];
let config = null;
let presets = {};

// Default configurations for common platforms
const DEFAULT_PRESETS = {
  'outlier-to-form': {
    name: 'Outlier to Google Form',
    config: `SOURCE_TAB_NAME: Outlier
DESTINATION_TAB_NAME: Submission Form

SOURCE -> DESTINATION
1 -> 1
2 -> 3
3 -> 2
4 -> 4`
  },
  'feather-to-form': {
    name: 'Feather to Google Form',
    config: `SOURCE_TAB_NAME: Feather
DESTINATION_TAB_NAME: Submission Form

SOURCE -> DESTINATION
1 -> 1
2 -> 2
3 -> 3
4 -> 4`
  }
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved data
  const saved = await chrome.storage.local.get(['fieldMapping', 'presets', 'lastUsedPreset']);
  
  // Initialize presets
  presets = saved.presets || DEFAULT_PRESETS;
  
  // Set up tab switching
  setupTabs();
  
  // Load configuration
  const configInput = document.getElementById('configInput');
  if (saved.lastUsedPreset && presets[saved.lastUsedPreset]) {
    configInput.value = presets[saved.lastUsedPreset].config;
  } else {
    configInput.value = saved.fieldMapping || DEFAULT_PRESETS['outlier-to-form'].config;
  }
  
  // Load presets list
  loadPresetsList();
  
  // Parse and validate configuration
  parseConfig();
  
  // Find matching tabs
  await findTabs();
  
  // Set up event listeners
  setupEventListeners();
});

// Set up tab switching functionality
function setupTabs() {
  const tabs = document.querySelectorAll('.config-tab');
  const contents = document.querySelectorAll('.config-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      const contentId = `${tab.dataset.tab}-tab`;
      document.getElementById(contentId).classList.add('active');
    });
  });
}

// Set up all event listeners
function setupEventListeners() {
  document.getElementById('saveConfig').addEventListener('click', saveConfiguration);
  document.getElementById('copyButton').addEventListener('click', copyFields);
  document.getElementById('configInput').addEventListener('input', parseConfig);
  document.getElementById('loadConfig').addEventListener('click', loadFromUrl);
  
  // Auto-refresh tabs when window gains focus
  window.addEventListener('focus', async () => {
    await findTabs();
  });
}

// Load configuration from URL (Google Docs, GitHub, etc.)
async function loadFromUrl() {
  const urlInput = document.getElementById('configUrl');
  const url = urlInput.value.trim();
  
  if (!url) {
    showStatus('Please enter a URL', 'error');
    return;
  }
  
  try {
    showStatus('Loading configuration...', 'info');
    
    let configText = '';
    
    // Handle Google Docs URLs
    if (url.includes('docs.google.com')) {
      // Convert to export URL
      const docId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      if (docId) {
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const response = await fetch(exportUrl);
        configText = await response.text();
      }
    } 
    // Handle GitHub raw URLs
    else if (url.includes('github.com')) {
      // Convert to raw URL if needed
      const rawUrl = url.replace('github.com', 'raw.githubusercontent.com')
                        .replace('/blob/', '/');
      const response = await fetch(rawUrl);
      configText = await response.text();
    }
    // Handle direct URLs
    else {
      const response = await fetch(url);
      configText = await response.text();
    }
    
    // Set the configuration
    document.getElementById('configInput').value = configText;
    parseConfig();
    await findTabs();
    
    // Save the URL for future use
    await chrome.storage.local.set({ lastConfigUrl: url });
    
    showStatus('Configuration loaded successfully!', 'success');
    
    // Switch to manual tab to show the loaded config
    document.querySelector('[data-tab="manual"]').click();
    
  } catch (error) {
    console.error('Failed to load configuration:', error);
    showStatus('Failed to load configuration. Check the URL and try again.', 'error');
  }
}

// Load presets list
function loadPresetsList() {
  const presetList = document.getElementById('presetList');
  presetList.innerHTML = '';
  
  Object.entries(presets).forEach(([key, preset]) => {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    presetItem.textContent = preset.name;
    presetItem.addEventListener('click', () => loadPreset(key));
    presetList.appendChild(presetItem);
  });
  
  // Add option to save current as preset
  const savePresetBtn = document.createElement('button');
  savePresetBtn.textContent = 'Save Current as Preset';
  savePresetBtn.style.marginTop = '10px';
  savePresetBtn.style.fontSize = '13px';
  savePresetBtn.addEventListener('click', saveAsPreset);
  presetList.appendChild(savePresetBtn);
}

// Load a preset
async function loadPreset(presetKey) {
  const preset = presets[presetKey];
  if (!preset) return;
  
  document.getElementById('configInput').value = preset.config;
  parseConfig();
  await findTabs();
  
  // Save as last used preset
  await chrome.storage.local.set({ lastUsedPreset: presetKey });
  
  showStatus(`Loaded preset: ${preset.name}`, 'success');
  
  // Switch to manual tab
  document.querySelector('[data-tab="manual"]').click();
}

// Save current config as preset
async function saveAsPreset() {
  const name = prompt('Enter a name for this preset:');
  if (!name) return;
  
  const key = name.toLowerCase().replace(/\s+/g, '-');
  const configText = document.getElementById('configInput').value;
  
  presets[key] = {
    name: name,
    config: configText
  };
  
  await chrome.storage.local.set({ presets: presets });
  loadPresetsList();
  
  showStatus(`Saved preset: ${name}`, 'success');
}

// Parse configuration from textarea
function parseConfig() {
  const configText = document.getElementById('configInput').value;
  const lines = configText.trim().split('\n').filter(line => line.trim());
  
  try {
    const newConfig = {
      sourceTabName: '',
      destTabName: '',
      mappings: []
    };
    
    let inMappingSection = false;
    
    for (const line of lines) {
      if (line.includes('SOURCE_TAB_NAME:')) {
        newConfig.sourceTabName = line.split(':')[1].trim();
      } else if (line.includes('DESTINATION_TAB_NAME:')) {
        newConfig.destTabName = line.split(':')[1].trim();
      } else if (line.includes('SOURCE -> DESTINATION')) {
        inMappingSection = true;
      } else if (inMappingSection && line.includes('->')) {
        const [source, dest] = line.split('->').map(s => s.trim());
        newConfig.mappings.push({
          source: parseInt(source),
          dest: parseInt(dest)
        });
      }
    }
    
    config = newConfig;
    return true;
  } catch (error) {
    console.error('Config parse error:', error);
    showStatus('Invalid configuration format', 'error');
    return false;
  }
}

// Save configuration to storage
async function saveConfiguration() {
  const configText = document.getElementById('configInput').value;
  await chrome.storage.local.set({ fieldMapping: configText });
  showStatus('Configuration saved!', 'success');
  
  // Re-parse and find tabs
  if (parseConfig()) {
    await findTabs();
  }
}

// Find tabs matching the configuration
async function findTabs() {
  if (!config) return;
  
  const tabs = await chrome.tabs.query({});
  
  // Find source tabs
  sourceTabs = tabs.filter(tab => 
    tab.title && tab.title.toLowerCase().includes(config.sourceTabName.toLowerCase())
  );
  
  // Find destination tabs
  destTabs = tabs.filter(tab => 
    tab.title && tab.title.toLowerCase().includes(config.destTabName.toLowerCase())
  );
  
  // Update UI
  updateTabStatus();
}

// Update tab status in UI
function updateTabStatus() {
  const sourceStatus = document.getElementById('sourceStatus');
  const destStatus = document.getElementById('destStatus');
  const copyButton = document.getElementById('copyButton');
  
  // Source tab status
  if (sourceTabs.length === 0) {
    sourceStatus.textContent = `No tabs found matching "${config.sourceTabName}"`;
    sourceStatus.className = 'tab-info error';
  } else if (sourceTabs.length === 1) {
    sourceStatus.textContent = `Found: ${sourceTabs[0].title}`;
    sourceStatus.className = 'tab-info success';
  } else {
    sourceStatus.textContent = `Multiple tabs found (${sourceTabs.length}). Please close extras.`;
    sourceStatus.className = 'tab-info error';
  }
  
  // Destination tab status
  if (destTabs.length === 0) {
    destStatus.textContent = `No tabs found matching "${config.destTabName}"`;
    destStatus.className = 'tab-info error';
  } else if (destTabs.length === 1) {
    destStatus.textContent = `Found: ${destTabs[0].title}`;
    destStatus.className = 'tab-info success';
  } else {
    destStatus.textContent = `Multiple tabs found (${destTabs.length}). Please close extras.`;
    destStatus.className = 'tab-info error';
  }
  
  // Enable/disable copy button
  copyButton.disabled = !(sourceTabs.length === 1 && destTabs.length === 1);
}

// Copy fields from source to destination
async function copyFields() {
  if (!config || sourceTabs.length !== 1 || destTabs.length !== 1) return;
  
  const sourceTab = sourceTabs[0];
  const destTab = destTabs[0];
  
  try {
    // Send message to content script in source tab to extract fields
    const sourceData = await chrome.tabs.sendMessage(sourceTab.id, {
      action: 'extractFields',
      fieldNumbers: config.mappings.map(m => m.source)
    });
    
    if (!sourceData.success) {
      throw new Error(sourceData.error || 'Failed to extract fields');
    }
    
    // Prepare mapped data
    const mappedData = {};
    config.mappings.forEach(mapping => {
      if (sourceData.fields[mapping.source]) {
        mappedData[mapping.dest] = sourceData.fields[mapping.source];
      }
    });
    
    // Send mapped data to destination tab
    const result = await chrome.tabs.sendMessage(destTab.id, {
      action: 'fillFields',
      fields: mappedData
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fill fields');
    }
    
    showStatus(`Successfully copied ${Object.keys(mappedData).length} fields!`, 'success');
    
  } catch (error) {
    console.error('Copy error:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
}

// Show status message
function showStatus(message, type) {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  
  // Clear status after 3 seconds for success/error
  if (type !== 'info') {
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  }
}