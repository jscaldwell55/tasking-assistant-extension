// background.js - Service worker for the extension

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Tasking Assistant extension installed');
  
  // Set default configuration if none exists
  chrome.storage.local.get(['fieldMapping'], (result) => {
    if (!result.fieldMapping) {
      const defaultConfig = `SOURCE_TAB_NAME: Blank Slate
DESTINATION_TAB_NAME: Greenfield – Submission Form

SOURCE -> DESTINATION
1 -> 1
2 -> 3
3 -> 2
4 -> 4`;
      
      chrome.storage.local.set({ fieldMapping: defaultConfig });
    }
  });
});

// Listen for tab updates to refresh popup if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Send message to any open popup to refresh tab list
    chrome.runtime.sendMessage({ action: 'tabUpdated' }).catch(() => {
      // Popup might not be open, ignore error
    });
  }
});

// Listen for tab removal to refresh popup if needed
chrome.tabs.onRemoved.addListener((tabId) => {
  // Send message to any open popup to refresh tab list
  chrome.runtime.sendMessage({ action: 'tabRemoved' }).catch(() => {
    // Popup might not be open, ignore error
  });
});