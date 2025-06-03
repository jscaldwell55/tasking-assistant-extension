// content.js - Injected into web pages to extract and fill fields

// Store message listener reference for cleanup
let messageListener = null;

// Safe DOM element getter
function getElement(selector) {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Element not found: ${selector}`);
    }
    return element;
  } catch (error) {
    console.warn(`Error getting element ${selector}:`, error);
    return null;
  }
}

// Safe DOM elements getter
function getElements(selector) {
  try {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements);
  } catch (error) {
    console.warn(`Error getting elements ${selector}:`, error);
    return [];
  }
}

// Initialize content script
function initialize() {
  try {
    // Remove any existing listener
    if (messageListener) {
      chrome.runtime.onMessage.removeListener(messageListener);
    }

    // Create new message listener
    messageListener = (request, sender, sendResponse) => {
      try {
        if (request.action === 'extractFields') {
          extractFields(request.fieldNumbers)
            .then(fields => sendResponse({ success: true, fields }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // Keep message channel open for async response
        } else if (request.action === 'fillFields') {
          fillFields(request.fields)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: 'Internal error handling message' });
      }
    };

    // Add message listener
    chrome.runtime.onMessage.addListener(messageListener);
  } catch (error) {
    console.error('Error initializing content script:', error);
  }
}

// Cleanup function
function cleanup() {
  try {
    if (messageListener) {
      chrome.runtime.onMessage.removeListener(messageListener);
      messageListener = null;
    }
  } catch (error) {
    console.error('Error cleaning up content script:', error);
  }
}

// Initialize on load
initialize();

// Cleanup on unload
window.addEventListener('unload', cleanup);

// Extract fields from the page
async function extractFields(fieldNumbers) {
  const fields = {};
  const missingFields = [];
  
  try {
    // Validate input
    if (!Array.isArray(fieldNumbers)) {
      throw new Error('Invalid field numbers format');
    }
    
    // Try different strategies to find form fields
    const strategies = [
      extractByInputIndex,
      extractByTextareaIndex,
      extractByLabeledInputs,
      extractByDataAttributes,
      extractByAriaLabels
    ];
    
    for (const strategy of strategies) {
      try {
        const extracted = strategy();
        if (extracted && Object.keys(extracted).length > 0) {
          // Merge extracted fields
          Object.assign(fields, extracted);
        }
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
        // Continue with next strategy
      }
    }
    
    // Check which fields were found and which were missing
    fieldNumbers.forEach(num => {
      if (fields[num] !== undefined) {
        fields[num] = fields[num];
      } else {
        missingFields.push(num);
      }
    });
    
    // If no fields were found at all
    if (Object.keys(fields).length === 0) {
      throw new Error('No fields found. The page structure might be different than expected.');
    }
    
    // If some fields were missing, include that in the response
    if (missingFields.length > 0) {
      return {
        success: true,
        fields: fields,
        missingFields: missingFields,
        warning: `Some fields (${missingFields.join(', ')}) could not be found`
      };
    }
    
    return { success: true, fields: fields };
  } catch (error) {
    console.error('Error extracting fields:', error);
    return { success: false, error: error.message };
  }
}

// Strategy 1: Extract by input/textarea index
function extractByInputIndex() {
  const fields = {};
  try {
    const inputs = getElements('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea, select');
    
    inputs.forEach((input, index) => {
      if (input && input.value !== undefined) {
        const fieldNumber = index + 1;
        fields[fieldNumber] = input.value || '';
      }
    });
  } catch (error) {
    console.warn('Error in extractByInputIndex:', error);
  }
  return fields;
}

// Strategy 2: Extract only textareas
function extractByTextareaIndex() {
  const fields = {};
  try {
    const textareas = getElements('textarea');
    
    textareas.forEach((textarea, index) => {
      if (textarea && textarea.value !== undefined) {
        const fieldNumber = index + 1;
        fields[fieldNumber] = textarea.value || '';
      }
    });
  } catch (error) {
    console.warn('Error in extractByTextareaIndex:', error);
  }
  return fields;
}

// Strategy 3: Extract inputs with labels
function extractByLabeledInputs() {
  const fields = {};
  try {
    const labels = getElements('label');
    let fieldNumber = 1;
    
    labels.forEach(label => {
      if (!label) return;
      
      try {
        const input = label.querySelector('input, textarea, select') || 
                      (label.getAttribute('for') ? document.getElementById(label.getAttribute('for')) : null);
        
        if (input && input.value !== undefined) {
          fields[fieldNumber++] = input.value || '';
        }
      } catch (error) {
        console.warn('Error processing label:', error);
      }
    });
  } catch (error) {
    console.warn('Error in extractByLabeledInputs:', error);
  }
  return fields;
}

// Strategy 4: Extract by data attributes
function extractByDataAttributes() {
  const fields = {};
  try {
    const elements = getElements('[data-field-number], [data-question-number], [data-task-number]');
    
    elements.forEach(element => {
      if (!element) return;
      
      try {
        const num = element.dataset.fieldNumber || 
                    element.dataset.questionNumber || 
                    element.dataset.taskNumber;
        
        if (num) {
          const input = element.querySelector('input, textarea, select') || element;
          if (input) {
            fields[parseInt(num)] = input.value || input.textContent || '';
          }
        }
      } catch (error) {
        console.warn('Error processing data attribute element:', error);
      }
    });
  } catch (error) {
    console.warn('Error in extractByDataAttributes:', error);
  }
  return fields;
}

// Strategy 5: Extract by aria-labels
function extractByAriaLabels() {
  const fields = {};
  try {
    const elements = getElements('[aria-label*="Field"], [aria-label*="Question"], [aria-label*="Answer"]');
    
    elements.forEach((element, index) => {
      if (element) {
        try {
          const fieldNumber = index + 1;
          fields[fieldNumber] = element.value || element.textContent || '';
        } catch (error) {
          console.warn('Error processing aria-label element:', error);
        }
      }
    });
  } catch (error) {
    console.warn('Error in extractByAriaLabels:', error);
  }
  return fields;
}

// Fill fields in the destination page
async function fillFields(fieldData) {
  if (!fieldData || typeof fieldData !== 'object') {
    throw new Error('Invalid field data format');
  }

  let filledCount = 0;
  let skippedFields = [];
  
  try {
    // For Google Forms specifically
    if (window.location.hostname.includes('docs.google.com') && window.location.pathname.includes('/forms/')) {
      const result = fillGoogleForm(fieldData);
      filledCount = result.filledCount;
      skippedFields = result.skippedFields;
    } else {
      // Generic form filling
      const result = fillGenericForm(fieldData);
      filledCount = result.filledCount;
      skippedFields = result.skippedFields;
    }
    
    // If no fields were filled at all
    if (filledCount === 0) {
      throw new Error('No fields could be filled. The form structure might be different than expected.');
    }
    
    // If some fields were skipped, include that in the response
    if (skippedFields.length > 0) {
      return {
        success: true,
        filledCount: filledCount,
        skippedFields: skippedFields,
        warning: `Some fields (${skippedFields.join(', ')}) could not be filled`
      };
    }
    
    return { success: true, filledCount: filledCount };
    
  } catch (error) {
    console.error('Error filling fields:', error);
    throw error;
  }
}

// Fill Google Forms specifically
function fillGoogleForm(fieldData) {
  let filledCount = 0;
  let skippedFields = [];
  
  try {
    // Google Forms uses specific class names and structures
    const formFields = getElements('.freebirdFormviewerComponentsQuestionBaseRoot');
    
    formFields.forEach((field, index) => {
      if (!field) return;
      
      try {
        const fieldNumber = index + 1;
        if (!fieldData[fieldNumber]) return;
        
        // Try different input types within the field
        const input = field.querySelector('input[type="text"], textarea');
        const radioInputs = field.querySelectorAll('input[type="radio"]');
        const checkboxInputs = field.querySelectorAll('input[type="checkbox"]');
        
        if (input) {
          input.value = fieldData[fieldNumber];
          input.dispatchEvent(new Event('input', { bubbles: true }));
          filledCount++;
        } else if (radioInputs.length > 0) {
          // For radio buttons, try to match by label text
          const valueToMatch = fieldData[fieldNumber].toLowerCase();
          let radioFilled = false;
          
          radioInputs.forEach(radio => {
            try {
              const label = radio.closest('label');
              if (label && label.textContent.toLowerCase().includes(valueToMatch)) {
                radio.click();
                filledCount++;
                radioFilled = true;
              }
            } catch (error) {
              console.warn('Error processing radio button:', error);
            }
          });
          
          if (!radioFilled) {
            skippedFields.push(fieldNumber);
          }
        } else {
          skippedFields.push(fieldNumber);
        }
      } catch (error) {
        console.warn(`Error processing field ${index + 1}:`, error);
        skippedFields.push(index + 1);
      }
    });
  } catch (error) {
    console.error('Error filling Google Form:', error);
    throw error;
  }
  
  return { filledCount, skippedFields };
}

// Fill generic forms
function fillGenericForm(fieldData) {
  let filledCount = 0;
  let skippedFields = [];
  
  try {
    // Get all fillable inputs
    const inputs = getElements('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea, select');
    
    inputs.forEach((input, index) => {
      if (!input) return;
      
      try {
        const fieldNumber = index + 1;
        if (fieldData[fieldNumber] !== undefined) {
          input.value = fieldData[fieldNumber];
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          filledCount++;
        }
      } catch (error) {
        console.warn(`Error filling field ${index + 1}:`, error);
        skippedFields.push(index + 1);
      }
    });
  } catch (error) {
    console.error('Error filling generic form:', error);
    throw error;
  }
  
  return { filledCount, skippedFields };
}
