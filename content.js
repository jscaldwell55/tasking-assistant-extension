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
    const extracted = strategy();
    if (Object.keys(extracted).length > 0) {
      // Merge extracted fields
      Object.assign(fields, extracted);
    }
  }
  
  // Filter to only requested field numbers
  const requestedFields = {};
  fieldNumbers.forEach(num => {
    if (fields[num]) {
      requestedFields[num] = fields[num];
    }
  });
  
  if (Object.keys(requestedFields).length === 0) {
    throw new Error('No fields found. The page structure might be different than expected.');
  }
  
  return requestedFields;
}

// Strategy 1: Extract by input/textarea index
function extractByInputIndex() {
  const fields = {};
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea, select');
  
  inputs.forEach((input, index) => {
    const fieldNumber = index + 1;
    fields[fieldNumber] = input.value || '';
  });
  
  return fields;
}

// Strategy 2: Extract only textareas (common in tasking platforms)
function extractByTextareaIndex() {
  const fields = {};
  const textareas = document.querySelectorAll('textarea');
  
  textareas.forEach((textarea, index) => {
    const fieldNumber = index + 1;
    fields[fieldNumber] = textarea.value || '';
  });
  
  return fields;
}

// Strategy 3: Extract inputs with labels
function extractByLabeledInputs() {
  const fields = {};
  const labels = document.querySelectorAll('label');
  let fieldNumber = 1;
  
  labels.forEach(label => {
    const input = label.querySelector('input, textarea, select') || 
                  document.getElementById(label.getAttribute('for'));
    if (input) {
      fields[fieldNumber++] = input.value || '';
    }
  });
  
  return fields;
}

// Strategy 4: Extract by data attributes
function extractByDataAttributes() {
  const fields = {};
  const elements = document.querySelectorAll('[data-field-number], [data-question-number], [data-task-number]');
  
  elements.forEach(element => {
    const num = element.dataset.fieldNumber || 
                element.dataset.questionNumber || 
                element.dataset.taskNumber;
    if (num) {
      const input = element.querySelector('input, textarea, select') || element;
      fields[parseInt(num)] = input.value || input.textContent || '';
    }
  });
  
  return fields;
}

// Strategy 5: Extract by aria-labels
function extractByAriaLabels() {
  const fields = {};
  const elements = document.querySelectorAll('[aria-label*="Field"], [aria-label*="Question"], [aria-label*="Answer"]');
  
  elements.forEach((element, index) => {
    const fieldNumber = index + 1;
    fields[fieldNumber] = element.value || element.textContent || '';
  });
  
  return fields;
}

// Fill fields in the destination page
async function fillFields(fieldData) {
  let filledCount = 0;
  
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
  
  return filledCount;
}

// Fill Google Forms specifically
function fillGoogleForm(fieldData) {
  let filledCount = 0;
  
  // Google Forms uses specific class names and structures
  const formFields = document.querySelectorAll(
    '.freebirdFormviewerComponentsQuestionBaseRoot'
  );
  
  formFields.forEach((field, index) => {
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
      radioInputs.forEach(radio => {
        const label = radio.closest('label');
        if (label && label.textContent.toLowerCase().includes(valueToMatch)) {
          radio.click();
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
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea, select');
  
  inputs.forEach((input, index) => {
    const fieldNumber = index + 1;
    if (fieldData[fieldNumber] !== undefined) {
      input.value = fieldData[fieldNumber];
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    }
  });
  
  return filledCount;
}
