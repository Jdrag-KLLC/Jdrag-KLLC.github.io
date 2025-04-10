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
  const accordionContainer = document.getElementById('accordion-container');
  const aiSearchBtn = document.getElementById('ai-search');
  const aiModal = document.getElementById('ai-modal');
  const closeModal = document.querySelector('.close-modal');
  const aiPromptInput = document.getElementById('ai-prompt');
  const runAiSearchBtn = document.getElementById('run-ai-search');
  const aiResults = document.getElementById('ai-results');
  const aiResultsContent = document.getElementById('ai-results-content');

  // App state
  let sheetData = {
    headers: [],
    data: []
  };
  let expandedRows = {};
  
  // Event listeners
  connectBtn.addEventListener('click', connectToSheet);
  searchInput.addEventListener('input', renderFilteredData);
  aiSearchBtn.addEventListener('click', openAiModal);
  closeModal.addEventListener('click', closeAiModal);
  runAiSearchBtn.addEventListener('click', performAiSearch);
  
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
      accordionContainer.innerHTML = '';
      
      // Fetch data from Google Sheet
      // Using public sheet URL format that returns JSON
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=cleaned`;
      
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch the spreadsheet. Make sure the Sheet ID is correct and the sheet is published to the web.');
      }
      
      const text = await response.text();
      
      // Google's response comes with some JS prefix we need to remove
      // It's in the format: google.visualization.Query.setResponse({...});
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
      
      // Render the data
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
    
    const rows = jsonData.table.rows;
    const cols = jsonData.table.cols;
    
    // Extract headers
    const headers = cols.map(col => col.label || '');
    
    // Extract data rows
    const data = rows.map(row => {
      const rowData = {};
      row.c.forEach((cell, index) => {
        const header = headers[index];
        // Cell value can be null or have different formats
        rowData[header] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
      });
      return rowData;
    });
    
    sheetData = {
      headers: headers,
      data: data
    };
    
    console.log('Processed data:', sheetData);
  }
  
  function renderFilteredData() {
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    
    const filteredData = sheetData.data.filter(row => {
      if (!searchTerm) return true;
      
      // Search in all fields
      return Object.values(row).some(value => 
        String(value).toLowerCase().includes(searchTerm)
      );
    });
    
    // Update results count
    resultsCount.textContent = `Showing ${filteredData.length} of ${sheetData.data.length} items`;
    
    // Clear container
    accordionContainer.innerHTML = '';
    
    // Render filtered data
    if (filteredData.length === 0) {
      accordionContainer.innerHTML = '<div class="no-results">No matching records found</div>';
    } else {
      filteredData.forEach((row, index) => {
        accordionContainer.appendChild(createAccordionItem(row, index));
      });
    }
  }
  
  function createAccordionItem(row, index) {
    const accordionItem = document.createElement('div');
    accordionItem.className = 'accordion-item';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'accordion-header';
    header.dataset.index = index;
    
    // Get row title (use Title field if available, otherwise first column, or fallback)
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    const rowTitle = row[titleField] || 'Untitled Item';
    
    // Check if the title contains a URL
    const urlPattern = /^(https?:\/\/[^\s]+)$/;
    let titleHtml;
    
    if (urlPattern.test(rowTitle)) {
      // If the title is a URL, make it a hyperlink
      titleHtml = `<a href="${escapeHtml(rowTitle)}" target="_blank" class="title-link">${escapeHtml(rowTitle)}</a>`;
    } else {
      // Otherwise, display as plain text
      titleHtml = escapeHtml(rowTitle);
    }
    
    header.innerHTML = `
      <span class="accordion-title">${titleHtml}</span>
      <i class="fas fa-chevron-down accordion-icon"></i>
    `;
    
    // Create content panel
    const content = document.createElement('div');
    content.className = 'accordion-content';
    
    // Add data fields
    let contentHtml = '<div class="data-grid">';
    
    sheetData.headers.forEach(header => {
      const value = row[header] || '';
      
      // Special rendering for different field types
      let renderedValue = renderSpecialFields(header, value);
      
      contentHtml += `
        <div class="data-label">${escapeHtml(header)}</div>
        <div class="data-value">${renderedValue}</div>
      `;
    });
    
    contentHtml += '</div>';
    content.innerHTML = contentHtml;
    
    // Set up click handler
    header.addEventListener('click', function(e) {
      // Check if the click was on a hyperlink
      if (e.target.tagName === 'A') {
        // If it was a link click, let the default action occur and don't toggle
        return;
      }
      
      // Otherwise toggle the accordion
      toggleAccordion(content, this.querySelector('.accordion-icon'));
    });
    
    // Assemble accordion item
    accordionItem.appendChild(header);
    accordionItem.appendChild(content);
    
    return accordionItem;
  }
  
  function toggleAccordion(contentElement, iconElement) {
    // Check if it's already open
    const isOpen = contentElement.style.maxHeight;
    
    if (isOpen) {
      contentElement.style.maxHeight = null;
      iconElement.className = 'fas fa-chevron-down accordion-icon';
    } else {
      contentElement.style.maxHeight = contentElement.scrollHeight + 'px';
      iconElement.className = 'fas fa-chevron-up accordion-icon';
    }
  }
  
  function renderSpecialFields(header, value) {
    if (!value) return '';
    
    const valueStr = String(value);
    
    // Handle URLs
    const urlPattern = /^(https?:\/\/[^\s]+)$/;
    if (urlPattern.test(valueStr)) {
      return `<a href="${escapeHtml(valueStr)}" target="_blank">${escapeHtml(valueStr)}</a>`;
    }
    
    // Handle Priority fields
    if (header.toLowerCase() === 'priority') {
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
    
    // Handle Tags fields
    if (header.toLowerCase() === 'tags' && valueStr.includes(',')) {
      const tags = valueStr.split(',').map(tag => tag.trim());
      return tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ');
    }
    
    // Default rendering
    return escapeHtml(valueStr);
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
    
    if (!aiPrompt) {
      return;
    }
    
    // In a real implementation, this would call your AI service
    // For now, we'll do a simple simulation
    simulateAiSearch(aiPrompt);
  }
  
  function simulateAiSearch(prompt) {
    // Show a loading state
    aiResultsContent.innerHTML = '<div class="loading-spinner"></div>';
    aiResults.style.display = 'block';
    
    // Simulate processing time
    setTimeout(() => {
      const lowercasePrompt = prompt.toLowerCase();
      let matchedData = [];
      
      // Simple keyword matching - in a real implementation, this would use AI
      if (lowercasePrompt.includes('high priority')) {
        matchedData = sheetData.data.filter(row => {
          const priority = row['Priority']?.toLowerCase() || '';
          return priority.includes('high');
        });
      } else if (lowercasePrompt.includes('recent')) {
        // Sort by date if available
        matchedData = [...sheetData.data].sort((a, b) => {
          const dateA = new Date(a['Date'] || 0);
          const dateB = new Date(b['Date'] || 0);
          return dateB - dateA;
        }).slice(0, 3); // Show 3 most recent
      } else {
        // Simple keyword search across all fields
        const keywords = lowercasePrompt.split(' ');
        matchedData = sheetData.data.filter(row => {
          return keywords.some(keyword => 
            Object.values(row).some(value => 
              String(value).toLowerCase().includes(keyword)
            )
          );
        });
      }
      
      // Display results
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
        
        // Add a note about future AI capabilities
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
