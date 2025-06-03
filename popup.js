
let sourceTabs = [];
let destTabs = [];
let config = null;

// Preset configurations
const PRESETS = {
  outlier: {
    name: 'Outlier to Form',
    config: `SOURCE_TAB_NAME: Outlier
DESTINATION_TAB_NAME: Submission Form

SOURCE -> DESTINATION
1 -> 1
2 -> 3
3 -> 2
4 -> 4`
  },
  scale: {
    name: 'Scale to Form',
    config: `SOURCE_TAB_NAME: Scale
DESTINATION_TAB_NAME: Submission Form

SOURCE -> DESTINATION
1 -> 1
2 -> 2
3 -> 3
4 -> 4`
  },
  custom: {
    name: 'Custom Configuration',
    config: `SOURCE_TAB_NAME: 
DESTINATION_TAB_NAME: 

SOURCE -> DESTINATION
1 -> 1
2 -> 2
3 -> 3
4 -> 4`
  }
};

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load saved configuration
    const saved = await chrome.storage.local.get(['fieldMapping', 'lastPreset']);
    const configInput = document.getElementById('configInput');
    
    // Set initial configuration
    if (saved.fieldMapping) {
      configInput.value = saved.fieldMapping;
    } else {
      // Load default preset without button element
      loadPreset('outlier', null);
    }
    
    // Highlight last used preset
    if (saved.lastPreset) {
      document.querySelectorAll('.preset-button').forEach(btn => {
        btn.classList.remove('active');
      });
      const activeButton = document.querySelector(`[onclick*="${saved.lastPreset}"]`);
      if (activeButton) {
        activeButton.classList.add('active');
      }
    }
    
    // Parse configuration and find tabs
    parseConfig();
    await findTabs();
    
    // Set up event listeners
    setupEventListeners();
    
    // Auto-refresh tabs periodically
    setInterval(async () => {
      await findTabs();
    }, 2000);
  } catch (error) {
    console.error('Error during initialization:', error);
    showStatus('Error initializing extension', 'error');
  }
});

// Set up event listeners
function setupEventListeners() {
  document.getElementById('saveConfig').addEventListener('click', saveConfiguration);
  document.getElementById('clearConfig').addEventListener('click', clearConfiguration);
  document.getElementById('copyButton').addEventListener('click', copyFields);
  document.getElementById('configInput').addEventListener('input', () => {
    parseConfig();
    findTabs();
  });
  
  // Make preset buttons work globally
  window.loadPreset = loadPreset;
}

// Load a preset configuration
function loadPreset(presetName, buttonElement) {
  const preset = PRESETS[presetName];
  if (!preset) return;
  
  // Update textarea
  const configInput = document.getElementById('configInput');
  if (configInput) {
    configInput.value = preset.config;
  }
  
  // Update active button
  document.querySelectorAll('.preset-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to the button
  if (buttonElement) {
    buttonElement.classList.add('active');
  } else {
    // If no button element provided, find the matching button
    const matchingButton = document.querySelector(`[onclick*="${presetName}"]`);
    if (matchingButton) {
      matchingButton.classList.add('active');
    }
  }
  
  // Save preset choice
  chrome.storage.local.set({ lastPreset: presetName });
  
  // Parse and find tabs
  parseConfig();
  findTabs();
  
  showStatus(`Loaded ${preset.name} configuration`, 'info');
}

// Clear configuration
function clearConfiguration() {
  document.getElementById('configInput').value = '';
  parseConfig();
  findTabs();
  showStatus('Configuration cleared', 'info');
}

// Parse configuration from textarea
function parseConfig() {
  const configInput = document.getElementById('configInput');
  if (!configInput) {
    config = null;
    return false;
  }
  
  const configText = configInput.value;
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
        const sourceNum = parseInt(source);
        const destNum = parseInt(dest);
        
        if (!isNaN(sourceNum) && !isNaN(destNum)) {
          newConfig.mappings.push({
            source: sourceNum,
            dest: destNum
          });
        }
      }
    }
    
    // Validate configuration
    if (!newConfig.sourceTabName || !newConfig.destTabName) {
      config = null;
      return false;
    }
    
    if (newConfig.mappings.length === 0) {
      config = null;
      return false;
    }
    
    config = newConfig;
    return true;
  } catch (error) {
    console.error('Config parse error:', error);
    config = null;
    return false;
  }
}

// Save configuration
async function saveConfiguration() {
  const configInput = document.getElementById('configInput');
  if (!configInput) return;
  
  const configText = configInput.value;
  
  if (!parseConfig()) {
    showStatus('Invalid configuration format. Please check your input.', 'error');
    return;
  }
  
  await chrome.storage.local.set({ fieldMapping: configText });
  showStatus('Configuration saved successfully!', 'success');
  
  // Find tabs again
  await findTabs();
}

// Find matching tabs
async function findTabs() {
  if (!config) {
    updateTabStatus('source', 'error', '⚠️', 'Invalid or missing configuration');
    updateTabStatus('dest', 'error', '⚠️', 'Invalid or missing configuration');
    const copyButton = document.getElementById('copyButton');
    if (copyButton) {
      copyButton.disabled = true;
    }
    return;
  }
  
  try {
    // Query tabs with proper error handling
    const tabs = await chrome.tabs.query({});
    
    if (!tabs || !Array.isArray(tabs)) {
      throw new Error('Invalid response from browser tabs API');
    }
    
    // Find source tabs with case-insensitive matching
    sourceTabs = tabs.filter(tab => 
      tab.title && tab.title.toLowerCase().includes(config.sourceTabName.toLowerCase())
    );
    
    // Find destination tabs with case-insensitive matching
    destTabs = tabs.filter(tab => 
      tab.title && tab.title.toLowerCase().includes(config.destTabName.toLowerCase())
    );
    
    // Update source tab status
    if (sourceTabs.length === 0) {
      updateTabStatus('source', 'error', '❌', `No tabs found matching "${config.sourceTabName}"`);
    } else if (sourceTabs.length === 1) {
      updateTabStatus('source', 'success', '✅', `Found: ${truncateTitle(sourceTabs[0].title)}`);
    } else {
      updateTabStatus('source', 'error', '⚠️', `${sourceTabs.length} tabs found - please close duplicates`);
    }
    
    // Update destination tab status
    if (destTabs.length === 0) {
      updateTabStatus('dest', 'error', '❌', `No tabs found matching "${config.destTabName}"`);
    } else if (destTabs.length === 1) {
      updateTabStatus('dest', 'success', '✅', `Found: ${truncateTitle(destTabs[0].title)}`);
    } else {
      updateTabStatus('dest', 'error', '⚠️', `${destTabs.length} tabs found - please close duplicates`);
    }
    
    // Enable/disable copy button
    const canCopy = sourceTabs.length === 1 && destTabs.length === 1;
    const copyButton = document.getElementById('copyButton');
    if (copyButton) {
      copyButton.disabled = !canCopy;
      
      // Update button text
      const copyButtonText = document.getElementById('copyButtonText');
      if (copyButtonText) {
        copyButtonText.textContent = canCopy ? 
          `COPY ${config.mappings.length} FIELDS` : 
          'COPY FIELDS';
      }
    }
    
  } catch (error) {
    console.error('Error finding tabs:', error);
    updateTabStatus('source', 'error', '❌', 'Error accessing tabs');
    updateTabStatus('dest', 'error', '❌', 'Error accessing tabs');
    
    const copyButton = document.getElementById('copyButton');
    if (copyButton) {
      copyButton.disabled = true;
    }
  }
}

// Update tab status display
function updateTabStatus(type, status, icon, message) {
  const element = document.getElementById(`${type}Status`);
  if (!element) return;
  
  element.className = `tab-status ${status}`;
  element.innerHTML = `
    <span class="status-icon">${icon}</span>
    <span>${message}</span>
  `;
}

// Truncate long titles
function truncateTitle(title, maxLength = 40) {
  if (!title) return '';
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}

// Copy fields from source to destination
async function copyFields() {
  if (!config || sourceTabs.length !== 1 || destTabs.length !== 1) {
    showStatus('Please ensure exactly one source and one destination tab are found', 'error');
    return;
  }
  
  const copyButton = document.getElementById('copyButton');
  const copyButtonText = document.getElementById('copyButtonText');
  const originalText = copyButtonText ? copyButtonText.textContent : 'COPY FIELDS';
  
  try {
    // Update button to show progress
    copyButton.disabled = true;
    if (copyButtonText) {
      copyButtonText.textContent = 'Copying...';
    }
    
    // First, ensure content script is injected in source tab
    try {
      await chrome.scripting.executeScript({
        target: { tabId: sourceTabs[0].id },
        files: ['content.js']
      });
    } catch (e) {
      // Script might already be injected, that's okay
      console.log('Content script injection attempted:', e.message);
    }
    
    // Wait a moment for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Extract fields from source tab
    const sourceData = await chrome.tabs.sendMessage(sourceTabs[0].id, {
      action: 'extractFields',
      fieldNumbers: config.mappings.map(m => m.source)
    }).catch(error => {
      console.error('Failed to communicate with source tab:', error);
      throw new Error('Could not connect to source tab. Please refresh the page and try again.');
    });
    
    if (!sourceData || !sourceData.success) {
      throw new Error(sourceData?.error || 'Failed to extract fields from source tab');
    }
    
    // Map fields according to configuration
    const mappedData = {};
    let mappedCount = 0;
    
    config.mappings.forEach(mapping => {
      if (sourceData.fields && sourceData.fields[mapping.source] !== undefined) {
        mappedData[mapping.dest] = sourceData.fields[mapping.source];
        mappedCount++;
      }
    });
    
    if (mappedCount === 0) {
      throw new Error('No fields could be extracted. Make sure the source page has input fields.');
    }
    
    // Ensure content script is injected in destination tab
    try {
      await chrome.scripting.executeScript({
        target: { tabId: destTabs[0].id },
        files: ['content.js']
      });
    } catch (e) {
      // Script might already be injected
      console.log('Content script injection attempted:', e.message);
    }
    
    // Wait a moment for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fill fields in destination tab
    const result = await chrome.tabs.sendMessage(destTabs[0].id, {
      action: 'fillFields',
      fields: mappedData
    }).catch(error => {
      console.error('Failed to communicate with destination tab:', error);
      throw new Error('Could not connect to destination tab. Please refresh the page and try again.');
    });
    
    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to fill fields in destination tab');
    }
    
    // Success!
    showStatus(`Successfully copied ${mappedCount} fields!`, 'success');
    
    // Flash success on button
    copyButton.style.background = '#28a745';
    if (copyButtonText) {
      copyButtonText.textContent = `✅ Copied ${mappedCount} fields!`;
    }
    
    setTimeout(() => {
      copyButton.style.background = '';
      if (copyButtonText) {
        copyButtonText.textContent = originalText;
      }
      copyButton.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Copy error:', error);
    showStatus(`Error: ${error.message}`, 'error');
    
    // Reset button
    if (copyButtonText) {
      copyButtonText.textContent = originalText;
    }
    copyButton.disabled = false;
  }
}

// Show status message
function showStatus(message, type) {
  const statusElement = document.getElementById('statusMessage');
  if (!statusElement) return;
  
  statusElement.textContent = message;
  statusElement.className = `status-message show ${type}`;
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusElement.classList.remove('show');
  }, 3000);
}