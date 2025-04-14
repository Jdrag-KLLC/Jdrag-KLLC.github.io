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
  // Updated containers for new layout:
  const titlesContainer = document.getElementById('titles-container'); // Left panel for titles
  const detailData = document.getElementById('detail-data'); // Right panel for details
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
  
  // Event listeners
  connectBtn.addEventListener('click', connectToSheet);
  searchInput.addEventListener('input', renderFilteredData);
  aiSearchBtn.addEventListener('click', openAiModal);
  closeModal.addEventListener('click', closeAiModal);
  runAiSearchBtn.addEventListener('click', performAiSearch);
  
  // Toggle PDF dropdown in the detail view
  const pdfDropdownHeader = document.querySelector('.pdf-dropdown .dropdown-header');
  const pdfDropdownContent = document.querySelector('.pdf-dropdown .dropdown-content');
  pdfDropdownHeader.addEventListener('click', function(){
    if(pdfDropdownContent.style.display === 'none'){
      pdfDropdownContent.style.display = 'block';
      this.querySelector('i').classList.remove('fa-chevron-down');
      this.querySelector('i').classList.add('fa-chevron-up');
    } else {
      pdfDropdownContent.style.display = 'none';
      this.querySelector('i').classList.remove('fa-chevron-up');
      this.querySelector('i').classList.add('fa-chevron-down');
    }
  });
  
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

    // ✅ Set up auto-refresh if not already active
    if (!window.sheetRefreshInterval) {
      window.sheetRefreshInterval = setInterval(() => {
        connectToSheet(); // Re-fetch the sheet every 60 seconds
      }, 5000); // 60000 ms = 60 seconds
    }

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
    const headers = cols.map(col => col.label || '');
    
    const data = rows.map(row => {
      const rowData = {};
      row.c.forEach((cell, index) => {
        const header = headers[index];
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
  
  // Create a clickable title item for the left panel.
  function createTitleItem(row, index) {
    const titleItem = document.createElement('div');
    titleItem.className = 'title-item';
    
    // Determine row title (using 'Title' field if available)
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    const rowTitle = row[titleField] || 'Untitled Item';
    
    // Check if there's a URL (from 'URL' or 'Link') and make clickable if so.
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
    
    let titleContent;
    if (url) {
      titleContent = `<a href="${escapeHtml(url)}" target="_blank" class="title-link">${escapeHtml(rowTitle)}</a>`;
    } else {
      titleContent = escapeHtml(rowTitle);
    }
    
    titleItem.innerHTML = `<span class="title-text">${titleContent}</span> <i class="fas fa-chevron-right title-icon"></i>`;
    
    // When clicked, update the detail view (right panel) with the row's details.
    titleItem.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') return;
      detailData.innerHTML = generateDetailContent(row);
      
      // Visual feedback for selected item:
      document.querySelectorAll('.title-item').forEach(item => {
        item.classList.remove('active');
      });
      titleItem.classList.add('active');
    });
    
    return titleItem;
  }
  
  // Generate detailed HTML similar to the original accordion content.
  function generateDetailContent(row) {
    let html = '<div class="data-grid">';
    sheetData.headers.forEach(header => {
      const value = row[header] || '';
      let renderedValue = renderSpecialFields(header, value);
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
    
    if (header.toLowerCase() === 'tags' && valueStr.includes(',')) {
      const tags = valueStr.split(',').map(tag => tag.trim());
      return tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ');
    }
    
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
