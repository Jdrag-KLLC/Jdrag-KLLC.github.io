document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const sheetIdInput = document.getElementById('sheet-id');
  const connectBtn = document.getElementById('connect-btn');
  const apiKeyContainer = document.getElementById('api-key-container');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');
  const resultsCount = document.getElementById('results-count');
  const loadingElement = document.getElementById('loading');
  const errorElement = document.getElementById('error-message');
  const errorTextElement = document.getElementById('error-text');
  // Layout containers
  const titlesContainer = document.getElementById('titles-container');
  const detailData = document.getElementById('detail-data');
  const aiSearchBtn = document.getElementById('ai-search');
  const aiModal = document.getElementById('ai-modal');
  const closeModal = document.querySelector('.close-modal');
  const aiPromptInput = document.getElementById('ai-prompt');
  const runAiSearchBtn = document.getElementById('run-ai-search');
  const aiResults = document.getElementById('ai-results');
  const aiResultsContent = document.getElementById('ai-results-content');
  const formIframe = document.querySelector('.pdf-dropdown iframe');

  // App state
  let sheetData = {
    headers: [],
    data: []
  };
  
  let currentSelectedRow = null;
  
  // Event listeners
  connectBtn.addEventListener('click', connectToSheet);
  searchInput.addEventListener('input', renderFilteredData);
  aiSearchBtn.addEventListener('click', openAiModal);
  closeModal.addEventListener('click', closeAiModal);
  runAiSearchBtn.addEventListener('click', performAiSearch);
  
  // Toggle PDF dropdown in the detail view
  const pdfDropdownHeader = document.querySelector('.pdf-dropdown .dropdown-header');
  const pdfDropdownContent = document.querySelector('.pdf-dropdown .dropdown-content');
  pdfDropdownHeader.addEventListener('click', function() {
    const isVisible = pdfDropdownContent.style.display !== 'none';
    pdfDropdownContent.style.display = isVisible ? 'none' : 'block';
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-chevron-down', isVisible);
    icon.classList.toggle('fa-chevron-up', !isVisible);
    
    // When form is opened and we have selected data, try to populate form fields
    if (!isVisible && currentSelectedRow) {
      setTimeout(() => {
        populateGoogleForm(currentSelectedRow);
      }, 1000); // Give the iframe some time to fully load
    }
  });
  
  // Listen for iframe load event to ensure it's ready
  if (formIframe) {
    formIframe.addEventListener('load', function() {
      if (currentSelectedRow) {
        populateGoogleForm(currentSelectedRow);
      }
    });
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === aiModal) {
      closeAiModal();
    }
  });

  // Functions
  async function connectToSheet() {
    const sheetId = sheetIdInput.value.trim();
    
    if (!sheetId) {
      showError('Please enter a valid Google Sheet ID');
      return;
    }
    
    try {
      // Show loading state
      loadingElement.style.display = 'flex';
      errorElement.style.display = 'none';
      titlesContainer.innerHTML = '';
      detailData.innerHTML = '';
      
      // Fetch data from Google Sheet
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=cleaned`;
      
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch the spreadsheet. Make sure the Sheet ID is correct and the sheet is published to the web.');
      }
      
      const text = await response.text();
      const jsonText = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
      
      if (!jsonText || !jsonText[1]) {
        throw new Error('Invalid data format received from Google Sheets');
      }
      
      const jsonData = JSON.parse(jsonText[1]);
      
      // Process the data
      processSheetData(jsonData);
      
      // Hide loading, show search and content
      loadingElement.style.display = 'none';
      apiKeyContainer.style.display = 'none';
      searchContainer.style.display = 'block';
      resultsCount.style.display = 'block';
      
      // Render the data in the titles (left panel)
      renderFilteredData();
      
    } catch (error) {
      loadingElement.style.display = 'none';
      showError(error.message || 'Failed to connect to the Google Sheet');
      console.error('Error connecting to sheet:', error);
    }
  }
  
  function processSheetData(jsonData) {
    if (!jsonData.table || !jsonData.table.rows || jsonData.table.rows.length === 0) {
      throw new Error('No data found in the sheet');
    }
    
    const { rows, cols } = jsonData.table;
    const headers = cols.map(col => col.label || '');
    
    const data = rows.map(row => {
      const rowData = {};
      row.c.forEach((cell, index) => {
        const header = headers[index];
        rowData[header] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
      });
      return rowData;
    });
    
    sheetData = { headers, data };
  }
  
  function renderFilteredData() {
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    
    const filteredData = sheetData.data.filter(row => {
      if (!searchTerm) return true;
      return Object.values(row).some(value => 
        String(value).toLowerCase().includes(searchTerm)
      );
    });
    
    resultsCount.textContent = `Showing ${filteredData.length} of ${sheetData.data.length} items`;
    
    // Clear the titles container
    titlesContainer.innerHTML = '';
    
    if (filteredData.length === 0) {
      titlesContainer.innerHTML = '<div class="no-results">No matching records found</div>';
    } else {
      filteredData.forEach((row, index) => {
        titlesContainer.appendChild(createTitleItem(row, index));
      });
    }
  }
  
  function createTitleItem(row) {
    const titleItem = document.createElement('div');
    titleItem.className = 'title-item';
    
    // Determine row title (using 'Title' field if available)
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    const rowTitle = row[titleField] || 'Untitled Item';
    
    // Check if there's a URL (from 'URL' or 'Link') and make clickable if so
    const urlField = sheetData.headers.includes('URL') ? 'URL' : 
                     sheetData.headers.includes('Link') ? 'Link' : null;
    let url = null;
    
    if (urlField && row[urlField]) {
      url = row[urlField];
    } else {
      const urlMatches = rowTitle.match(/(https?:\/\/[^\s]+)/);
      if (urlMatches) {
        url = urlMatches[0];
      }
    }
    
    let titleContent = url ? 
      `<a href="${escapeHtml(url)}" target="_blank" class="title-link">${escapeHtml(rowTitle)}</a>` : 
      escapeHtml(rowTitle);
    
    titleItem.innerHTML = `<span class="title-text">${titleContent}</span> <i class="fas fa-chevron-right title-icon"></i>`;
    
    // When clicked, update the detail view (right panel) with the row's details
    titleItem.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') return;
      
      // Update current selected row for form auto-filling
      currentSelectedRow = row;
      
      detailData.innerHTML = generateDetailContent(row);
      
      // Visual feedback for selected item
      document.querySelectorAll('.title-item').forEach(item => {
        item.classList.remove('active');
      });
      titleItem.classList.add('active');
      
      // If the form is already visible, try to populate it
      if (pdfDropdownContent.style.display !== 'none' && formIframe) {
        setTimeout(() => {
          populateGoogleForm(row);
        }, 500); // Small delay to ensure DOM is updated
      }
    });
    
    return titleItem;
  }
  
  function generateDetailContent(row) {
    let html = '<div class="data-grid">';
    sheetData.headers.forEach(header => {
      const value = row[header] || '';
      const renderedValue = renderSpecialFields(header, value);
      html += `<div class="data-label">${escapeHtml(header)}</div>
               <div class="data-value">${renderedValue}</div>`;
    });
    html += '</div>';
    return html;
  }
  
  function renderSpecialFields(header, value) {
    if (!value) return '';
    
    const valueStr = String(value);
    const urlPattern = /^(https?:\/\/[^\s]+)$/;
    
    if (urlPattern.test(valueStr)) {
      return `<a href="${escapeHtml(valueStr)}" target="_blank">${escapeHtml(valueStr)}</a>`;
    }
    
    const headerLower = header.toLowerCase();
    if (headerLower === 'priority') {
      const priority = valueStr.toLowerCase();
      let priorityClass = '';
      
      if (priority.includes('high')) {
        priorityClass = 'priority-high';
      } else if (priority.includes('medium') || priority.includes('med')) {
        priorityClass = 'priority-medium';
      } else if (priority.includes('low')) {
        priorityClass = 'priority-low';
      }
      
      if (priorityClass) {
        return `<span class="tag ${priorityClass}">${escapeHtml(valueStr)}</span>`;
      }
    }
    
    if (headerLower === 'tags' && valueStr.includes(',')) {
      const tags = valueStr.split(',').map(tag => tag.trim());
      return tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ');
    }
    
    return escapeHtml(valueStr);
  }
  
  function populateGoogleForm(row) {
    // Skip if no form iframe is present
    if (!formIframe) return;
    
    try {
      // Attempt to access the iframe content
      const iframeDoc = formIframe.contentDocument || formIframe.contentWindow.document;
      
      // Check if we have access to the iframe (might be restricted by cross-origin policy)
      if (!iframeDoc) {
        console.warn('Cannot access iframe content due to cross-origin policy.');
        
        // For Google Forms, we can try URL parameters approach as a fallback
        tryGoogleFormsURLParameters(row);
        return;
      }
      
      // Find all form inputs, textareas, and selects in the iframe
      const inputs = iframeDoc.querySelectorAll('input[type="text"], input[type="email"], textarea, select');
      
      inputs.forEach(input => {
        // Try to identify the field name from various attributes or surrounding label
        const fieldName = getFieldName(input, iframeDoc);
        if (!fieldName) return;
        
        // Look for matching data in our row
        const matchingData = findMatchingData(fieldName, row);
        if (matchingData) {
          // Set the value based on the input type
          if (input.tagName === 'SELECT') {
            // For select elements, we need to find the matching option
            setSelectValue(input, matchingData);
          } else {
            input.value = matchingData;
            // Trigger input event to ensure any listeners are notified
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
          }
        }
      });
      
      // Handle radio buttons and checkboxes
      const radioButtons = iframeDoc.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      radioButtons.forEach(radio => {
        const fieldName = getFieldName(radio, iframeDoc);
        if (!fieldName) return;
        
        const matchingData = findMatchingData(fieldName, row);
        if (matchingData) {
          const radioValue = radio.value.toLowerCase();
          const matchingValue = String(matchingData).toLowerCase();
          
          // Check if this option matches our data
          if (radioValue === matchingValue || 
              matchingValue.includes(radioValue) || 
              radioValue.includes(matchingValue)) {
            radio.checked = true;
            const event = new Event('change', { bubbles: true });
            radio.dispatchEvent(event);
          }
        }
      });
      
    } catch (error) {
      console.error('Error while populating Google Form:', error);
      // Try URL parameters as a fallback
      tryGoogleFormsURLParameters(row);
    }
  }
  
  function getFieldName(input, doc) {
    // Try to get field name from various sources
    
    // 1. Check for aria-label
    if (input.getAttribute('aria-label')) {
      return input.getAttribute('aria-label').trim();
    }
    
    // 2. Check for name attribute
    if (input.name) {
      return input.name.replace(/entry\.\d+/, '').replace(/[-_]/g, ' ').trim();
    }
    
    // 3. Check for id and corresponding label
    if (input.id) {
      const label = doc.querySelector(`label[for="${input.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }
    
    // 4. Look for parent or ancestor with question text
    let element = input.parentElement;
    while (element && element.tagName !== 'FORM') {
      // Check for question text in this element
      const questionElement = element.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle');
      if (questionElement) {
        return questionElement.textContent.trim();
      }
      
      // Also check for any div with text that might be a label
      const possibleLabels = element.querySelectorAll('div');
      for (const div of possibleLabels) {
        if (div.textContent && div.textContent.length > 0 && div.textContent.length < 100) {
          return div.textContent.trim();
        }
      }
      
      element = element.parentElement;
    }
    
    return null;
  }
  
  function findMatchingData(fieldName, row) {
    // Normalize the field name
    const normalizedFieldName = fieldName.toLowerCase().replace(/[-_\s]+/g, '');
    
    // Look for exact matches first
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase() === normalizedFieldName) {
        return value;
      }
    }
    
    // Then look for partial matches
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.toLowerCase().replace(/[-_\s]+/g, '');
      
      if (normalizedKey.includes(normalizedFieldName) || normalizedFieldName.includes(normalizedKey)) {
        return value;
      }
    }
    
    return null;
  }
  
  function setSelectValue(selectElement, value) {
    const options = selectElement.options;
    const valueString = String(value).toLowerCase();
    
    // First try exact match
    for (let i = 0; i < options.length; i++) {
      if (options[i].value.toLowerCase() === valueString || 
          options[i].text.toLowerCase() === valueString) {
        selectElement.selectedIndex = i;
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
        return;
      }
    }
    
    // Then try partial match
    for (let i = 0; i < options.length; i++) {
      if (options[i].value.toLowerCase().includes(valueString) || 
          valueString.includes(options[i].value.toLowerCase()) ||
          options[i].text.toLowerCase().includes(valueString) || 
          valueString.includes(options[i].text.toLowerCase())) {
        selectElement.selectedIndex = i;
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
        return;
      }
    }
  }
  
  function tryGoogleFormsURLParameters(row) {
    // This is a fallback method for Google Forms using URL parameters
    // Google Forms accept prefilled values via URL parameters
    
    // Check if we're dealing with a Google Form
    if (!formIframe.src.includes('docs.google.com/forms')) {
      return;
    }
    
    // Start with the base URL of the form
    const formUrl = new URL(formIframe.src);
    const baseUrl = formUrl.origin + formUrl.pathname;
    
    // We need to manually observe the form to extract entry IDs
    // For demonstration, we'll just add a message to notify the user
    console.log('Cross-origin restrictions prevent direct form population. Consider implementing the Google Forms prefill URL approach if needed.');
    
    // An actual implementation would require:
    // 1. Knowing the form entry IDs (which follow pattern 'entry.12345678')
    // 2. Mapping your data fields to these entry IDs
    // 3. Creating a new URL with these parameters and updating the iframe src
    
    // This is just a placeholder for where you'd implement that logic:
    /*
    const prefillParams = new URLSearchParams();
    
    // Example mapping (you would need the actual entry IDs):
    // prefillParams.append('entry.123456789', row['Title']);
    // prefillParams.append('entry.987654321', row['Description']);
    
    const prefillUrl = `${baseUrl}?${prefillParams.toString()}`;
    formIframe.src = prefillUrl;
    */
  }
  
  function showError(message) {
    errorTextElement.textContent = message;
    errorElement.style.display = 'flex';
  }
  
  function openAiModal() {
    aiModal.style.display = 'block';
    aiPromptInput.focus();
    aiResults.style.display = 'none';
  }
  
  function closeAiModal() {
    aiModal.style.display = 'none';
  }
  
  function performAiSearch() {
    const aiPrompt = aiPromptInput.value.trim();
    if (!aiPrompt) return;
    simulateAiSearch(aiPrompt);
  }
  
  function simulateAiSearch(prompt) {
    aiResultsContent.innerHTML = '<div class="loading-spinner"></div>';
    aiResults.style.display = 'block';
    
    setTimeout(() => {
      const lowercasePrompt = prompt.toLowerCase();
      let matchedData = [];
      
      if (lowercasePrompt.includes('high priority')) {
        matchedData = sheetData.data.filter(row => {
          const priority = row['Priority']?.toLowerCase() || '';
          return priority.includes('high');
        });
      } else if (lowercasePrompt.includes('recent')) {
        matchedData = [...sheetData.data].sort((a, b) => {
          const dateA = new Date(a['Date'] || 0);
          const dateB = new Date(b['Date'] || 0);
          return dateB - dateA;
        }).slice(0, 3);
      } else {
        const keywords = lowercasePrompt.split(' ');
        matchedData = sheetData.data.filter(row => {
          return keywords.some(keyword => 
            Object.values(row).some(value => 
              String(value).toLowerCase().includes(keyword)
            )
          );
        });
      }
      
      if (matchedData.length === 0) {
        aiResultsContent.innerHTML = '<p>No matching items found. Try a different query.</p>';
      } else {
        aiResultsContent.innerHTML = `<p>Found ${matchedData.length} items matching your query:</p>`;
        
        const resultsList = document.createElement('div');
        resultsList.className = 'ai-results-list';
        
        matchedData.forEach((row, index) => {
          const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
          const resultItem = document.createElement('div');
          resultItem.className = 'ai-result-item';
          resultItem.innerHTML = `<p><strong>${index + 1}. ${escapeHtml(row[titleField] || 'Untitled')}</strong></p>`;
          resultsList.appendChild(resultItem);
        });
        
        aiResultsContent.appendChild(resultsList);
        const aiNote = document.createElement('p');
        aiNote.className = 'ai-note';
        aiNote.innerHTML = '<small>Note: This is a simulated AI search. In the full implementation, this will use a more sophisticated AI to understand and process your query.</small>';
        aiResultsContent.appendChild(aiNote);
      }
    }, 1000);
  }
  
  function escapeHtml(unsafe) {
    return unsafe
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
