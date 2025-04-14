document.addEventListener('DOMContentLoaded', function() {
  // DOM elements for Sheet integration and Gemini API key input
  const sheetIdInput = document.getElementById('sheet-id');
  const connectBtn = document.getElementById('connect-btn');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const setGeminiApiKeyBtn = document.getElementById('set-gemini-api-key');

  // Other existing DOM elements
  const apiKeyContainer = document.getElementById('api-key-container');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');
  const resultsCount = document.getElementById('results-count');
  const loadingElement = document.getElementById('loading');
  const errorElement = document.getElementById('error-message');
  const errorTextElement = document.getElementById('error-text');
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

  // Application state for Sheet data and Gemini API key
  let sheetData = { headers: [], data: [] };
  let currentSelectedRow = null;
  let geminiApiKey = ""; // Stores the user-supplied Gemini API key

  // Set up event listeners
  connectBtn.addEventListener('click', connectToSheet);
  searchInput.addEventListener('input', renderFilteredData);
  aiSearchBtn.addEventListener('click', openAiModal);
  closeModal.addEventListener('click', closeAiModal);
  runAiSearchBtn.addEventListener('click', performAiSearch);

  // Event listener to store the Gemini API key when the user clicks the button
  setGeminiApiKeyBtn.addEventListener('click', function() {
    geminiApiKey = geminiApiKeyInput.value.trim();
    if (geminiApiKey) {
      alert('Gemini API key set.');
    } else {
      alert('Please enter a valid Gemini API key.');
    }
  });

  // Toggle PDF dropdown in the detail view
  const pdfDropdownHeader = document.querySelector('.pdf-dropdown .dropdown-header');
  const pdfDropdownContent = document.querySelector('.pdf-dropdown .dropdown-content');
  pdfDropdownHeader.addEventListener('click', function() {
    const isVisible = pdfDropdownContent.style.display !== 'none';
    pdfDropdownContent.style.display = isVisible ? 'none' : 'block';
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-chevron-down', isVisible);
    icon.classList.toggle('fa-chevron-up', !isVisible);
    
    // If form is open and a row is selected, try populating the form after a short delay
    if (!isVisible && currentSelectedRow) {
      setTimeout(() => {
        populateGoogleForm(currentSelectedRow);
      }, 1000);
    }
  });

  if (formIframe) {
    formIframe.addEventListener('load', function() {
      if (currentSelectedRow) {
        populateGoogleForm(currentSelectedRow);
      }
    });
  }

  window.addEventListener('click', function(event) {
    if (event.target === aiModal) {
      closeAiModal();
    }
  });

  // Connect to Google Sheet and fetch data
  async function connectToSheet() {
    const sheetId = sheetIdInput.value.trim();
    if (!sheetId) {
      showError('Please enter a valid Google Sheet ID');
      return;
    }
    
    try {
      loadingElement.style.display = 'flex';
      errorElement.style.display = 'none';
      titlesContainer.innerHTML = '';
      detailData.innerHTML = '';
      
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
      processSheetData(jsonData);
      
      loadingElement.style.display = 'none';
      apiKeyContainer.style.display = 'none';
      searchContainer.style.display = 'block';
      resultsCount.style.display = 'block';
      renderFilteredData();
      
    } catch (error) {
      loadingElement.style.display = 'none';
      showError(error.message || 'Failed to connect to the Google Sheet');
      console.error('Error connecting to sheet:', error);
    }
  }

  // Process the sheet's JSON data
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

  // Filter and render the data based on user input
  function renderFilteredData() {
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    const filteredData = sheetData.data.filter(row => {
      if (!searchTerm) return true;
      return Object.values(row).some(value =>
        String(value).toLowerCase().includes(searchTerm)
      );
    });
    
    resultsCount.textContent = `Showing ${filteredData.length} of ${sheetData.data.length} items`;
    titlesContainer.innerHTML = '';
    
    if (filteredData.length === 0) {
      titlesContainer.innerHTML = '<div class="no-results">No matching records found</div>';
    } else {
      filteredData.forEach((row, index) => {
        titlesContainer.appendChild(createTitleItem(row));
      });
    }
  }

  // Create a clickable title item for each record
  function createTitleItem(row) {
    const titleItem = document.createElement('div');
    titleItem.className = 'title-item';
    
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    const rowTitle = row[titleField] || 'Untitled Item';
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
    
    titleItem.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') return;
      currentSelectedRow = row;
      detailData.innerHTML = generateDetailContent(row);
      document.querySelectorAll('.title-item').forEach(item => {
        item.classList.remove('active');
      });
      titleItem.classList.add('active');
      if (pdfDropdownContent.style.display !== 'none' && formIframe) {
        setTimeout(() => { populateGoogleForm(row); }, 500);
      }
    });
    
    return titleItem;
  }

  // Generate the detailed HTML content for a record
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

  // Format special fields (e.g., URLs, priority, tags)
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

  // Populate the Google Form in the iframe with data from a record
  function populateGoogleForm(row) {
    if (!formIframe) return;
    try {
      const iframeDoc = formIframe.contentDocument || formIframe.contentWindow.document;
      if (!iframeDoc) {
        console.warn('Cannot access iframe content due to cross-origin policy.');
        tryGoogleFormsURLParameters(row);
        return;
      }
      
      const inputs = iframeDoc.querySelectorAll('input[type="text"], input[type="email"], textarea, select');
      inputs.forEach(input => {
        const fieldName = getFieldName(input, iframeDoc);
        if (!fieldName) return;
        const matchingData = findMatchingData(fieldName, row);
        if (matchingData) {
          if (input.tagName === 'SELECT') {
            setSelectValue(input, matchingData);
          } else {
            input.value = matchingData;
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
          }
        }
      });
      
      const radioButtons = iframeDoc.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      radioButtons.forEach(radio => {
        const fieldName = getFieldName(radio, iframeDoc);
        if (!fieldName) return;
        const matchingData = findMatchingData(fieldName, row);
        if (matchingData) {
          const radioValue = radio.value.toLowerCase();
          const matchingValue = String(matchingData).toLowerCase();
          if (radioValue === matchingValue || matchingValue.includes(radioValue) || radioValue.includes(matchingValue)) {
            radio.checked = true;
            const event = new Event('change', { bubbles: true });
            radio.dispatchEvent(event);
          }
        }
      });
      
    } catch (error) {
      console.error('Error while populating Google Form:', error);
      tryGoogleFormsURLParameters(row);
    }
  }

  // Attempt to extract a field label from an input element in the iframe
  function getFieldName(input, doc) {
    if (input.getAttribute('aria-label')) {
      return input.getAttribute('aria-label').trim();
    }
    if (input.name) {
      return input.name.replace(/entry\.\d+/, '').replace(/[-_]/g, ' ').trim();
    }
    if (input.id) {
      const label = doc.querySelector(`label[for="${input.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }
    let element = input.parentElement;
    while (element && element.tagName !== 'FORM') {
      const questionElement = element.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle');
      if (questionElement) {
        return questionElement.textContent.trim();
      }
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

  // Search for matching data in a record based on a field name
  function findMatchingData(fieldName, row) {
    const normalizedFieldName = fieldName.toLowerCase().replace(/[-_\s]+/g, '');
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase() === normalizedFieldName) {
        return value;
      }
    }
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.toLowerCase().replace(/[-_\s]+/g, '');
      if (normalizedKey.includes(normalizedFieldName) || normalizedFieldName.includes(normalizedKey)) {
        return value;
      }
    }
    return null;
  }

  // Set the selected value of a <select> element
  function setSelectValue(selectElement, value) {
    const options = selectElement.options;
    const valueString = String(value).toLowerCase();
    for (let i = 0; i < options.length; i++) {
      if (options[i].value.toLowerCase() === valueString || options[i].text.toLowerCase() === valueString) {
        selectElement.selectedIndex = i;
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
        return;
      }
    }
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

  // Fallback method for populating Google Forms using URL parameters
  function tryGoogleFormsURLParameters(row) {
    if (!formIframe.src.includes('docs.google.com/forms')) {
      return;
    }
    const formUrl = new URL(formIframe.src);
    const baseUrl = formUrl.origin + formUrl.pathname;
    console.log('Cross-origin restrictions prevent direct form population. Consider using Google Forms prefill URL parameters.');
    /*
    const prefillParams = new URLSearchParams();
    prefillParams.append('entry.123456789', row['Title']);
    prefillParams.append('entry.987654321', row['Description']);
    const prefillUrl = `${baseUrl}?${prefillParams.toString()}`;
    formIframe.src = prefillUrl;
    */
  }

  // Display an error message in the UI
  function showError(message) {
    errorTextElement.textContent = message;
    errorElement.style.display = 'flex';
  }

  // Open the AI search modal
  function openAiModal() {
    aiModal.style.display = 'block';
    aiPromptInput.focus();
    aiResults.style.display = 'none';
  }

  // Close the AI search modal
  function closeAiModal() {
    aiModal.style.display = 'none';
  }

  // Perform an AI search using the Gemini API endpoint with context from the selected record (if any)
  async function performAiSearch() {
    const aiPrompt = aiPromptInput.value.trim();
    if (!aiPrompt) return;
    
    aiResultsContent.innerHTML = '<div class="loading-spinner"></div>';
    aiResults.style.display = 'block';
    
    if (!geminiApiKey) {
      aiResultsContent.innerHTML = '<p>Please set your Gemini API key.</p>';
      return;
    }
    
    // Build a context string from the currently selected row (if available)
    let contextText = "";
    if (currentSelectedRow) {
      contextText = "Record Information:\n";
      for (const header of sheetData.headers) {
        if (currentSelectedRow[header]) {
          contextText += `${header}: ${currentSelectedRow[header]}\n`;
        }
      }
    }
    
    // Combine the context with the user query.
    // If a record is selected, instruct the API to answer based on that record.
    let fullPrompt = aiPrompt;
    if (contextText) {
      fullPrompt = `Based on the following record information:\n${contextText}\nAnswer the following question: ${aiPrompt}`;
    }
    
    // Build the payload to match the Gemini API request sample
    const payload = {
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    };
    
    // Construct the URL with the user-supplied Gemini API key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Assume the API returns an array of candidates and display the first candidate's output.
      if (data.candidates && data.candidates.length) {
        aiResultsContent.innerHTML = `<p>${data.candidates[0].output}</p>`;
      } else {
        aiResultsContent.innerHTML = '<p>No response received from API.</p>';
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      aiResultsContent.innerHTML = `<p>Error: ${error.message}. Please try again later.</p>`;
    }
  }

  // Utility function to escape HTML special characters
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
