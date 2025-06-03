// content.js - Injected into web pages to extract and fill fields

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});

// Extract fields from the page
async function extractFields(fieldNumbers) {
  const fields = {};
  
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
      if (Object.keys(extracted).length > 0) {
        // Merge extracted fields
        Object.assign(fields, extracted);
      }
    } catch (error) {
      console.warn(`Strategy ${strategy.name} failed:`, error);
    }
  }
  
  // Log what we found for debugging
  console.log('All extracted fields:', fields);
  
  // Filter to only requested field numbers
  const requestedFields = {};
  fieldNumbers.forEach(num => {
    if (fields[num]) {
      requestedFields[num] = fields[num];
    }
  });
  
  console.log('Requested fields:', requestedFields);
  
  if (Object.keys(requestedFields).length === 0) {
    // Provide more helpful error message
    const availableFields = Object.keys(fields).join(', ');
    throw new Error(`No fields found for numbers ${fieldNumbers.join(', ')}. Available fields: ${availableFields || 'none'}`);
  }
  
  return requestedFields;
}

// Strategy 1: Extract by input/textarea index
function extractByInputIndex() {
  const fields = {};
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type]), textarea, select');
  
  inputs.forEach((input, index) => {
    const fieldNumber = index + 1;
    // Skip hidden or disabled inputs
    if (input.type !== 'hidden' && !input.disabled && input.offsetParent !== null) {
      fields[fieldNumber] = input.value || '';
    }
  });
  
  console.log('extractByInputIndex found:', Object.keys(fields).length, 'fields');
  return fields;
}

// Strategy 2: Extract only textareas (common in tasking platforms)
function extractByTextareaIndex() {
  const fields = {};
  const textareas = document.querySelectorAll('textarea');
  
  textareas.forEach((textarea, index) => {
    const fieldNumber = index + 1;
    if (!textarea.disabled && textarea.offsetParent !== null) {
      fields[fieldNumber] = textarea.value || '';
    }
  });
  
  console.log('extractByTextareaIndex found:', Object.keys(fields).length, 'fields');
  return fields;
}

// Strategy 3: Extract inputs with labels
function extractByLabeledInputs() {
  const fields = {};
  const labels = document.querySelectorAll('label');
  let fieldNumber = 1;
  
  labels.forEach(label => {
    const input = label.querySelector('input, textarea, select') || 
                  (label.htmlFor ? document.getElementById(label.htmlFor) : null);
    if (input && input.type !== 'hidden' && !input.disabled) {
      fields[fieldNumber++] = input.value || '';
    }
  });
  
  console.log('extractByLabeledInputs found:', Object.keys(fields).length, 'fields');
  return fields;
}

// Strategy 4: Extract by data attributes
function extractByDataAttributes() {
  const fields = {};
  const elements = document.querySelectorAll('[data-field-number], [data-question-number], [data-task-number], [data-field-id]');
  
  elements.forEach(element => {
    const num = element.dataset.fieldNumber || 
                element.dataset.questionNumber || 
                element.dataset.taskNumber ||
                element.dataset.fieldId;
    if (num) {
      const input = element.querySelector('input, textarea, select') || element;
      if (input.value !== undefined) {
        fields[parseInt(num) || num] = input.value || '';
      } else {
        fields[parseInt(num) || num] = input.textContent || '';
      }
    }
  });
  
  console.log('extractByDataAttributes found:', Object.keys(fields).length, 'fields');
  return fields;
}

// Strategy 5: Extract by aria-labels
function extractByAriaLabels() {
  const fields = {};
  const elements = document.querySelectorAll('[aria-label*="Field"], [aria-label*="Question"], [aria-label*="Answer"], [aria-label*="Input"]');
  
  elements.forEach((element, index) => {
    const fieldNumber = index + 1;
    if (element.value !== undefined) {
      fields[fieldNumber] = element.value || '';
    } else {
      fields[fieldNumber] = element.textContent || '';
    }
  });
  
  console.log('extractByAriaLabels found:', Object.keys(fields).length, 'fields');
  return fields;
}

// Fill fields in the destination page
async function fillFields(fieldData) {
  let filledCount = 0;
  
  console.log('Attempting to fill fields:', fieldData);
  
  // For Google Forms specifically
  if (window.location.hostname.includes('docs.google.com') && window.location.pathname.includes('/forms/')) {
    filledCount = fillGoogleForm(fieldData);
  } else {
    // Generic form filling
    filledCount = fillGenericForm(fieldData);
  }
  
  if (filledCount === 0) {
    throw new Error('No fields could be filled. The form structure might be different than expected.');
  }
  
  console.log(`Successfully filled ${filledCount} fields`);
  return filledCount;
}

// Fill Google Forms specifically
function fillGoogleForm(fieldData) {
  let filledCount = 0;
  
  // Google Forms uses specific class names and structures
  const formFields = document.querySelectorAll(
    '.freebirdFormviewerComponentsQuestionBaseRoot, ' +
    '.freebirdFormviewerViewItemsItemItem, ' +
    '[role="listitem"]'
  );
  
  formFields.forEach((field, index) => {
    const fieldNumber = index + 1;
    if (!fieldData[fieldNumber]) return;
    
    // Try different input types within the field
    const input = field.querySelector('input[type="text"], input:not([type]), textarea');
    const radioInputs = field.querySelectorAll('input[type="radio"]');
    const checkboxInputs = field.querySelectorAll('input[type="checkbox"]');
    
    if (input && !input.disabled) {
      input.value = fieldData[fieldNumber];
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // For Google Forms, we might need to trigger a blur event
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      filledCount++;
    } else if (radioInputs.length > 0) {
      // For radio buttons, try to match by label text
      const valueToMatch = fieldData[fieldNumber].toLowerCase();
      radioInputs.forEach(radio => {
        const label = radio.closest('label') || radio.parentElement;
        if (label && label.textContent.toLowerCase().includes(valueToMatch)) {
          radio.click();
          filledCount++;
        }
      });
    } else if (checkboxInputs.length > 0) {
      // For checkboxes, check if the value matches
      const valueToMatch = fieldData[fieldNumber].toLowerCase();
      checkboxInputs.forEach(checkbox => {
        const label = checkbox.closest('label') || checkbox.parentElement;
        if (label && label.textContent.toLowerCase().includes(valueToMatch)) {
          checkbox.click();
          filledCount++;
        }
      });
    }
  });
  
  return filledCount;
}

// Fill generic forms
function fillGenericForm(fieldData) {
  let filledCount = 0;
  
  // Get all fillable inputs
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type]), textarea, select');
  
  inputs.forEach((input, index) => {
    const fieldNumber = index + 1;
    // Skip hidden or disabled inputs
    if (input.type === 'hidden' || input.disabled || input.offsetParent === null) {
      return;
    }
    
    if (fieldData[fieldNumber] !== undefined) {
      // Handle select elements differently
      if (input.tagName === 'SELECT') {
        // Try to find matching option
        const options = input.querySelectorAll('option');
        options.forEach(option => {
          if (option.value === fieldData[fieldNumber] || option.textContent === fieldData[fieldNumber]) {
            input.value = option.value;
          }
        });
      } else {
        input.value = fieldData[fieldNumber];
      }
      
      // Dispatch multiple events to ensure the form registers the change
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      
      filledCount++;
      console.log(`Filled field ${fieldNumber} with value:`, fieldData[fieldNumber]);
    }
  });
  
  return filledCount;
}

// Log that content script is loaded
console.log('Tasking Assistant content script loaded on:', window.location.href);