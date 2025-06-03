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

// Safe DOM element getter
function getElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id "${id}" not found`);
  }
  return element;
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load saved data
    const saved = await chrome.storage.local.get(['fieldMapping', 'presets', 'lastUsedPreset']);
    
    // Initialize presets
    presets = saved.presets || DEFAULT_PRESETS;
    
    // Set up tab switching
    setupTabs();
    
    // Load configuration
    const configInput = getElement('configInput');
    if (configInput) {
      if (saved.lastUsedPreset && presets[saved.lastUsedPreset]) {
        configInput.value = presets[saved.lastUsedPreset].config;
      } else {
        configInput.value = saved.fieldMapping || DEFAULT_PRESETS['outlier-to-form'].config;
      }
    }
    
    // Load presets list
    loadPresetsList();
    
    // Parse and validate configuration
    parseConfig();
    
    // Find matching tabs
    await findTabs();
    
    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Error initializing extension. Please refresh the page.', 'error');
  }
});

// Set up tab switching functionality
function setupTabs() {
  try {
    const tabs = document.querySelectorAll('.config-tab');
    const contents = document.querySelectorAll('.config-content');
    
    if (!tabs.length || !contents.length) {
      console.warn('Tab elements not found');
      return;
    }
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        try {
          // Remove active class from all
          tabs.forEach(t => t.classList.remove('active'));
          contents.forEach(c => c.classList.remove('active'));
          
          // Add active class to clicked tab
          tab.classList.add('active');
          const contentId = `${tab.dataset.tab}-tab`;
          const content = document.getElementById(contentId);
          if (content) {
            content.classList.add('active');
          }
        } catch (error) {
          console.error('Error switching tabs:', error);
        }
      });
    });
  } catch (error) {
    console.error('Error setting up tabs:', error);
  }
}

// Set up all event listeners
function setupEventListeners() {
  try {
    const saveConfigBtn = getElement('saveConfig');
    const copyButton = getElement('copyButton');
    const configInput = getElement('configInput');
    const loadConfigBtn = getElement('loadConfig');
    
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener('click', saveConfiguration);
    }
    if (copyButton) {
      copyButton.addEventListener('click', copyFields);
    }
    if (configInput) {
      configInput.addEventListener('input', parseConfig);
    }
    if (loadConfigBtn) {
      loadConfigBtn.addEventListener('click', loadFromUrl);
    }
    
    // Auto-refresh tabs when window gains focus
    window.addEventListener('focus', async () => {
      try {
        await findTabs();
      } catch (error) {
        console.error('Error refreshing tabs:', error);
      }
    });
  } catch (error) {
    console.error('Error setting up event listeners:', error);
  }
}

// Load configuration from URL (Google Docs, GitHub, etc.)
async function loadFromUrl() {
  try {
    const urlInput = getElement('configUrl');
    if (!urlInput) {
      showStatus('Configuration URL input not found', 'error');
      return;
    }

    const url = urlInput.value.trim();
    if (!url) {
      showStatus('Please enter a URL', 'error');
      return;
    }
    
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
    const configInput = getElement('configInput');
    if (configInput) {
      configInput.value = configText;
      parseConfig();
      await findTabs();
      
      // Save the URL for future use
      await chrome.storage.local.set({ lastConfigUrl: url });
      
      showStatus('Configuration loaded successfully!', 'success');
      
      // Switch to manual tab to show the loaded config
      const manualTab = document.querySelector('[data-tab="manual"]');
      if (manualTab) {
        manualTab.click();
      }
    }
  } catch (error) {
    console.error('Failed to load configuration:', error);
    showStatus('Failed to load configuration. Check the URL and try again.', 'error');
  }
}

// Load presets list
function loadPresetsList() {
  try {
    const presetList = getElement('presetList');
    if (!presetList) return;
    
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
  } catch (error) {
    console.error('Error loading presets list:', error);
    showStatus('Error loading presets', 'error');
  }
}

// Load a preset
async function loadPreset(presetKey) {
  try {
    const preset = presets[presetKey];
    if (!preset) return;
    
    const configInput = getElement('configInput');
    if (configInput) {
      configInput.value = preset.config;
      parseConfig();
      await findTabs();
      
      // Save as last used preset
      await chrome.storage.local.set({ lastUsedPreset: presetKey });
      
      showStatus(`Loaded preset: ${preset.name}`, 'success');
      
      // Switch to manual tab
      const manualTab = document.querySelector('[data-tab="manual"]');
      if (manualTab) {
        manualTab.click();
      }
    }
  } catch (error) {
    console.error('Error loading preset:', error);
    showStatus('Error loading preset', 'error');
  }
}

// Save current config as preset
async function saveAsPreset() {
  try {
    const name = prompt('Enter a name for this preset:');
    if (!name) return;
    
    const key = name.toLowerCase().replace(/\s+/g, '-');
    const configInput = getElement('configInput');
    if (!configInput) return;
    
    const configText = configInput.value;
    
    presets[key] = {
      name: name,
      config: configText
    };
    
    await chrome.storage.local.set({ presets: presets });
    loadPresetsList();
    
    showStatus(`Saved preset: ${name}`, 'success');
  } catch (error) {
    console.error('Error saving preset:', error);
    showStatus('Error saving preset', 'error');
  }
}

// Parse configuration from textarea
function parseConfig() {
  try {
    const configInput = getElement('configInput');
    if (!configInput) {
      showStatus('Configuration input not found', 'error');
      return false;
    }

    const configText = configInput.value;
    const lines = configText.trim().split('\n').filter(line => line.trim());
    
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
  try {
    const configInput = getElement('configInput');
    if (!configInput) {
      showStatus('Configuration input not found', 'error');
      return;
    }

    const configText = configInput.value;
    await chrome.storage.local.set({ fieldMapping: configText });
    showStatus('Configuration saved!', 'success');
    
    // Re-parse and find tabs
    if (parseConfig()) {
      await findTabs();
    }
  } catch (error) {
    console.error('Error saving configuration:', error);
    showStatus('Error saving configuration', 'error');
  }
}

// Find matching tabs based on configuration
async function findTabs() {
  if (!config) {
    updateTabStatus('source', 'error', 'Invalid configuration');
    updateTabStatus('dest', 'error', 'Invalid configuration');
    return;
  }

  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Find source tabs
    sourceTabs = tabs.filter(tab => 
      tab.title && tab.title.toLowerCase().includes(config.sourceTabName.toLowerCase())
    );
    
    // Find destination tabs
    destTabs = tabs.filter(tab => 
      tab.title && tab.title.toLowerCase().includes(config.destTabName.toLowerCase())
    );
    
    // Update UI based on matches
    if (sourceTabs.length === 0) {
      updateTabStatus('source', 'error', `No tabs found matching "${config.sourceTabName}"`);
    } else if (sourceTabs.length > 1) {
      updateTabStatus('source', 'error', `Multiple tabs found matching "${config.sourceTabName}". Please close duplicate tabs.`);
    } else {
      updateTabStatus('source', 'success', `Found source tab: ${sourceTabs[0].title}`);
    }
    
    if (destTabs.length === 0) {
      updateTabStatus('dest', 'error', `No tabs found matching "${config.destTabName}"`);
    } else if (destTabs.length > 1) {
      updateTabStatus('dest', 'error', `Multiple tabs found matching "${config.destTabName}". Please close duplicate tabs.`);
    } else {
      updateTabStatus('dest', 'success', `Found destination tab: ${destTabs[0].title}`);
    }
    
    // Enable/disable copy button based on tab matches
    const copyButton = getElement('copyButton');
    if (copyButton) {
      copyButton.disabled = sourceTabs.length !== 1 || destTabs.length !== 1;
    }
  } catch (error) {
    console.error('Error finding tabs:', error);
    updateTabStatus('source', 'error', 'Error finding tabs');
    updateTabStatus('dest', 'error', 'Error finding tabs');
  }
}

// Update tab status in UI
function updateTabStatus(type, status, message) {
  try {
    const element = getElement(`${type}Status`);
    if (element) {
      element.className = `tab-info ${status}`;
      element.textContent = message;
    }
  } catch (error) {
    console.error(`Error updating ${type} status:`, error);
  }
}

// Copy fields from source to destination
async function copyFields() {
  if (sourceTabs.length !== 1 || destTabs.length !== 1) {
    showStatus('Please ensure exactly one source and one destination tab are found', 'error');
    return;
  }

  try {
    showStatus('Copying fields...', 'info');
    
    // Extract fields from source tab
    const sourceFields = await extractFieldsFromTab(sourceTabs[0].id);
    if (!sourceFields.success) {
      showStatus(`Error extracting fields: ${sourceFields.error}`, 'error');
      return;
    }
    
    // Map fields according to configuration
    const mappedFields = mapFields(sourceFields.fields);
    
    // Fill fields in destination tab
    const fillResult = await fillFieldsInTab(destTabs[0].id, mappedFields);
    if (!fillResult.success) {
      showStatus(`Error filling fields: ${fillResult.error}`, 'error');
      return;
    }
    
    showStatus('Fields copied successfully!', 'success');
    
  } catch (error) {
    console.error('Error copying fields:', error);
    showStatus('Error copying fields. Please try again.', 'error');
  }
}

// Extract fields from a tab
async function extractFieldsFromTab(tabId) {
  try {
    const fieldNumbers = config.mappings.map(m => m.source);
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'extractFields',
      fieldNumbers: fieldNumbers
    });
    return response;
  } catch (error) {
    console.error('Error extracting fields:', error);
    return { success: false, error: 'Failed to extract fields from source tab' };
  }
}

// Map fields according to configuration
function mapFields(sourceFields) {
  const mappedFields = {};
  config.mappings.forEach(mapping => {
    if (sourceFields[mapping.source] !== undefined) {
      mappedFields[mapping.dest] = sourceFields[mapping.source];
    }
  });
  return mappedFields;
}

// Fill fields in a tab
async function fillFieldsInTab(tabId, fields) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'fillFields',
      fields: fields
    });
    return response;
  } catch (error) {
    console.error('Error filling fields:', error);
    return { success: false, error: 'Failed to fill fields in destination tab' };
  }
}

// Show status message
function showStatus(message, type) {
  try {
    const statusElement = getElement('statusMessage');
    if (statusElement) {
      statusElement.className = `status ${type}`;
      statusElement.textContent = message;
    }
  } catch (error) {
    console.error('Error showing status:', error);
  }
}