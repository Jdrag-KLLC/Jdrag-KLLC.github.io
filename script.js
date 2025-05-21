document.addEventListener('DOMContentLoaded', function() {
  // DOM elements for Sheet integration and Gemini API key input
  const sheetIdInput = document.getElementById('sheet-id');
  const connectBtn = document.getElementById('connect-btn');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const setGeminiApiKeyBtn = document.getElementById('set-gemini-api-key');

  // New popout panel elements
  const popoutPanel = document.getElementById('popout-panel');
  const closePopout = document.querySelector('.close-popout');

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
  const aiModal = document.getElementById('ai-modal');
  const closeModal = document.querySelector('.close-modal');
  const aiPromptInput = document.getElementById('ai-prompt');
  const runAiSearchBtn = document.getElementById('run-ai-search');
  const aiResults = document.getElementById('ai-results');
  const aiResultsContent = document.getElementById('ai-results-content');

  // RAG-related DOM elements
  const ragDropdownHeader = document.querySelector('.rag-dropdown .dropdown-header');
  const ragDropdownContent = document.querySelector('.rag-dropdown .dropdown-content');
  const documentUpload = document.getElementById('document-upload');
  const uploadTrigger = document.getElementById('upload-trigger');
  const fileList = document.getElementById('file-list');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendQuestionBtn = document.getElementById('send-question');
  const clearDocumentsBtn = document.getElementById('clear-documents');
  const downloadChatBtn = document.getElementById('download-chat');

  // Application state for Sheet data and Gemini API key
  let sheetData = { headers: [], data: [] };
  let currentSelectedRow = null;
  let geminiApiKey = ""; // Stores the user-supplied Gemini API key
  let uploadedDocuments = []; // Stores information about uploaded documents
  let documentTexts = []; // Stores the extracted text from the documents
  let currentFilter = 'all'; // Track current filter state

  // Add the appStorage abstraction object
  const appStorage = {
      getItem: function(key) {
          try {
              return localStorage.getItem(key);
          } catch (e) {
              console.error(`Error getting item from localStorage for key "${key}":`, e);
              return null; // Return null or appropriate default on error
          }
      },
      setItem: function(key, value) {
          try {
              localStorage.setItem(key, value);
          } catch (e) {
              console.error(`Error setting item in localStorage for key "${key}":`, e);
              // Optionally handle specific errors like QuotaExceededError
              alert('Storage limit reached. Please clear some data.');
          }
      }
  };

  // Modify state variable initialization to use appStorage
  let favorites = new Set(JSON.parse(appStorage.getItem('favorites') || '[]')); // Load favorites from appStorage
  let currentView = 'all'; // Track current view (all or dashboard)
  let favoriteChats = JSON.parse(appStorage.getItem('favoriteChats') || '{}'); // Store chat history for favorites
  let opportunityStates = JSON.parse(appStorage.getItem('opportunityStates') || '{}'); // Store state for each opportunity
  let sortBy = 'date'; // Default sort by date
  let sortDirection = 'desc'; // Default sort direction (descending)
  let scoreRange = { min: 0, max: 1 }; // Will be updated with actual score range

  // DOM elements for navigation
  const allOpportunitiesBtn = document.getElementById('all-opportunities-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const dashboardView = document.getElementById('dashboard-view');
  const detailContent = document.getElementById('detail-content');
  const favoritesContainer = document.getElementById('favorites-container');
  const favoriteCount = document.getElementById('favorite-count');
  const sortBySelect = document.getElementById('sort-by');
  const sortDirectionBtn = document.getElementById('sort-direction');

  // Add unread view elements
  const unreadBtn = document.getElementById('unread-btn');
  const unreadView = document.getElementById('unread-view');
  const unreadContainer = document.getElementById('unread-container');
  const unreadCount = document.getElementById('unread-count');

  // Add undecided view elements
  const undecidedBtn = document.getElementById('undecided-btn');
  const undecidedView = document.getElementById('undecided-view');
  const undecidedContainer = document.getElementById('undecided-container');
  const undecidedCount = document.getElementById('undecided-count');

  // Add unread state to application state
  let unreadItems = new Set(JSON.parse(appStorage.getItem('unreadItems') || '[]'));
  let currentUnreadIndex = 0;

  // Add undecided state to application state
  let undecidedItems = new Set(JSON.parse(appStorage.getItem('undecidedItems') || '[]'));

  // Add rejected state to application state (near the top with other state variables)
  let rejectedItems = new Set(JSON.parse(appStorage.getItem('rejectedItems') || '[]'));

  // Set up event listeners
  connectBtn.addEventListener('click', connectToSheet);
  searchInput.addEventListener('input', renderFilteredData);
  closeModal.addEventListener('click', closeAiModal);
  runAiSearchBtn.addEventListener('click', performAiSearch);

  // Navigation event listeners
  allOpportunitiesBtn.addEventListener('click', () => switchView('all'));
  dashboardBtn.addEventListener('click', () => switchView('dashboard'));
  unreadBtn.addEventListener('click', () => switchView('unread'));
  undecidedBtn.addEventListener('click', () => switchView('undecided'));

  // Sort controls event listeners
  sortBySelect.addEventListener('change', function() {
    sortBy = this.value;
    renderDashboard();
  });

  sortDirectionBtn.addEventListener('click', function() {
    sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    this.classList.toggle('asc', sortDirection === 'asc');
    renderDashboard();
  });

  // Filter button event listeners
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.filter;
      renderFilteredData();
    });
  });

  // Popout panel event listeners
  closePopout.addEventListener('click', closePopoutPanel);

  // RAG-related event listeners
  uploadTrigger.addEventListener('click', function() {
    documentUpload.click();
  });

  documentUpload.addEventListener('change', handleFileUpload);
  sendQuestionBtn.addEventListener('click', sendQuestion);
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendQuestion();
    }
  });
  clearDocumentsBtn.addEventListener('click', clearDocuments);
  
  // Add event listener for download chat history button
  downloadChatBtn.addEventListener('click', downloadChatHistory);

  // Event listener to store the Gemini API key when the user clicks the button
  setGeminiApiKeyBtn.addEventListener('click', function() {
    geminiApiKey = geminiApiKeyInput.value.trim();
    if (geminiApiKey) {
      alert('Gemini API key set.');
      // Hide the entire Gemini API container like the sheet id container
      document.getElementById('gemini-api-container').style.display = 'none';
    } else {
      alert('Please enter a valid Gemini API key.');
    }
  });

  // Toggle RAG dropdown in the detail view
  ragDropdownHeader.addEventListener('click', function() {
    const isVisible = ragDropdownContent.style.display !== 'none';
    ragDropdownContent.style.display = isVisible ? 'none' : 'block';
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-chevron-down', isVisible);
    icon.classList.toggle('fa-chevron-up', !isVisible);
  });

  window.addEventListener('click', function(event) {
    if (event.target === aiModal) {
      closeAiModal();
    }
  });

  // Function to switch between views
  function switchView(view) {
    currentView = view;
    allOpportunitiesBtn.classList.toggle('active', view === 'all');
    unreadBtn.classList.toggle('active', view === 'unread');
    undecidedBtn.classList.toggle('active', view === 'undecided');
    dashboardBtn.classList.toggle('active', view === 'dashboard');
    
    // Hide all views first
    dashboardView.style.display = 'none';
    detailContent.style.display = 'none';
    unreadView.style.display = 'none';
    undecidedView.style.display = 'none';
    
    // Show the selected view
    if (view === 'dashboard') {
      dashboardView.style.display = 'block';
      popoutPanel.classList.remove('popout-open');
      popoutPanel.classList.add('popout-closed');
      renderDashboard();
    } else if (view === 'unread') {
      unreadView.style.display = 'block';
      popoutPanel.classList.remove('popout-open');
      popoutPanel.classList.add('popout-closed');
      renderUnreadView();
    } else if (view === 'undecided') {
      undecidedView.style.display = 'block';
      popoutPanel.classList.remove('popout-open');
      popoutPanel.classList.add('popout-closed');
      renderUndecidedView();
    } else {
      // For 'all' view
      detailContent.style.display = 'block';
      // Always refresh the list when switching to all opportunities view
      renderFilteredData();
      
      // Only show popout if no item is selected or explicitly switching to all view
      if (!currentSelectedRow || view === 'all') {
        if (popoutPanel.classList.contains('popout-closed')) {
          popoutPanel.classList.remove('popout-closed');
          popoutPanel.classList.add('popout-open');
        }
      }
    }
  }

  // Function to toggle the popout panel
  function togglePopout() {
    if (popoutPanel.classList.contains('popout-closed')) {
      popoutPanel.classList.remove('popout-closed');
      popoutPanel.classList.add('popout-open');
    } else {
      closePopoutPanel();
    }
  }

  // Function to close the popout panel
  function closePopoutPanel() {
    popoutPanel.classList.remove('popout-open');
    popoutPanel.classList.add('popout-closed');
  }

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
    
    const data = rows.map((row, index) => {
      const rowData = {};
      row.c.forEach((cell, index) => {
        const header = headers[index];
        rowData[header] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
      });
      // Add a unique ID for each row if not present
      rowData.id = rowData.id || `row_${index}`;
      return rowData;
    });
    
    sheetData = { headers, data };

    // Calculate score range
    const scoreField = headers.find(h => h.toLowerCase().includes('score') || h.toLowerCase().includes('rating'));
    console.log('Score field found:', scoreField);
    
    if (scoreField) {
      const scores = data
        .map(row => parseFloat(row[scoreField]))
        .filter(score => !isNaN(score));
      
      if (scores.length > 0) {
        scoreRange.min = Math.min(...scores);
        scoreRange.max = Math.max(...scores);
        console.log('Score range:', scoreRange);
      }
    }

    // Initialize states for all items
    data.forEach(row => {
        if (!opportunityStates[row.id]) {
            opportunityStates[row.id] = { read: false };
            unreadItems.add(row.id);
        }
        
        // Check if item should be marked as undecided
        const titleField = headers.find(h => h.toLowerCase().includes('title')) || headers[0];
        const rowTitle = row[titleField] || 'Untitled Item';
        const isFavorited = favorites.has(rowTitle);
        const isRejected = rejectedItems.has(row.id);
        
        if (!isFavorited && !isRejected && opportunityStates[row.id].read) {
            undecidedItems.add(row.id);
            opportunityStates[row.id].undecided = true;
        }
    });
    
    appStorage.setItem('unreadItems', JSON.stringify(Array.from(unreadItems))); // Use appStorage
    appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
    appStorage.setItem('undecidedItems', JSON.stringify(Array.from(undecidedItems))); // Use appStorage
    updateUnreadCount();
    if (undecidedCount) undecidedCount.textContent = undecidedItems.size;
  }

  // Helper function to parse date from Google Sheets format
  function parseGoogleSheetsDate(dateStr) {
    if (!dateStr) return null;
    
    // Handle Date(YYYY,M,D) format
    const dateMatch = dateStr.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (dateMatch) {
      const [_, year, month, day] = dateMatch;
      return new Date(year, month, day);
    }
    
    // Handle Date(YYYY.M.D) format
    const dateMatch2 = dateStr.match(/Date\((\d+)\.(\d+)\.(\d+)\)/);
    if (dateMatch2) {
      const [_, year, month, day] = dateMatch2;
      return new Date(year, month - 1, day);
    }
    
    // Handle direct date string (e.g., "6/4/2025")
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    return null;
  }

  // Helper function to format date for display
  function formatDate(date) {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Modified renderFilteredData function to handle rejected items
  function renderFilteredData() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredData = sheetData.data.filter(row => {
        const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
        const rowTitle = row[titleField] || 'Untitled Item';
        
        // Apply search filter
        const matchesSearch = Object.values(row).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
        
        // Apply favorites filter
        const matchesFavorites = currentFilter === 'all' || 
            (currentFilter === 'favorites' && favorites.has(rowTitle));
        
        // Apply rejected filter - show rejected items in the list but with visual indication
        const isRejected = rejectedItems.has(row.id);
        
        return matchesSearch && matchesFavorites;
    });
    
    titlesContainer.innerHTML = '';
    // Re-add filter buttons
    const filterButtons = document.createElement('div');
    filterButtons.className = 'filter-buttons';
    filterButtons.innerHTML = `
        <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="filter-btn ${currentFilter === 'favorites' ? 'active' : ''}" data-filter="favorites">Favorites</button>
    `;
    titlesContainer.appendChild(filterButtons);
    
    // Add event listeners to filter buttons
    filterButtons.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderFilteredData();
        });
    });
    
    filteredData.forEach(row => {
        const titleItem = createTitleItem(row);
        // Add rejected class if the item is in rejectedItems
        if (rejectedItems.has(row.id)) {
            titleItem.classList.add('rejected');
        }
        titlesContainer.appendChild(titleItem);
    });
    
    resultsCount.textContent = `Showing ${filteredData.length} items`;

    // When rendering items, add them to unread if they're not already marked
    filteredData.forEach(row => {
        if (!unreadItems.has(row.id) && !opportunityStates[row.id]?.read) {
            unreadItems.add(row.id);
        }
    });
    appStorage.setItem('unreadItems', JSON.stringify(Array.from(unreadItems))); // Use appStorage
    updateUnreadCount();
  }

  // Function to get current opportunity title
  function getCurrentOpportunityTitle() {
    if (!currentSelectedRow) return null;
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    return currentSelectedRow[titleField] || 'Untitled Item';
  }

  // Function to save current opportunity state
  function saveOpportunityState() {
    const title = getCurrentOpportunityTitle();
    if (!title) return;
    
    opportunityStates[title] = {
      chatMessages: Array.from(chatMessages.children).map(msg => ({
        type: msg.classList.contains('user-message') ? 'user' : 'ai',
        content: msg.innerHTML
      })),
      uploadedDocuments: uploadedDocuments,
      documentTexts: documentTexts
    };
    
    appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
  }

  // Function to load opportunity state
  function loadOpportunityState(row) {
    if (!row) return;
    
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    const title = row[titleField] || 'Untitled Item';
    
    // Clear current state
    chatMessages.innerHTML = '<div class="message ai-message">Upload documents and ask questions about this record. I\'ll use the documents to provide detailed answers.</div>';
    uploadedDocuments = [];
    documentTexts = [];
    fileList.innerHTML = '';
    
    // Load saved state if it exists
    const state = opportunityStates[title]; // opportunityStates is already loaded via appStorage
    if (state) {
      // Restore chat messages
      chatMessages.innerHTML = state.chatMessages.map(msg => 
        `<div class="message ${msg.type}-message">${msg.content}</div>`
      ).join('');
      
      // Restore uploaded documents
      uploadedDocuments = state.uploadedDocuments;
      documentTexts = state.documentTexts;
      
      // Update file list
      uploadedDocuments.forEach(doc => {
        createFileItem(doc);
      });
    }
  }

  // Generate the detailed HTML content for a record
  function generateDetailContent(row) {
    let html = '<div class="data-grid">';
    
    // Add favorite and ignore buttons at the top
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    const rowTitle = row[titleField] || 'Untitled Item';
    const isFavorited = favorites.has(rowTitle);
    const isRejected = rejectedItems.has(row.id);
    
    html += `
      <div class="data-label">Actions</div>
      <div class="data-value">
        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-title="${escapeHtml(rowTitle)}">
          <i class="fas fa-star"></i> ${isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
        </button>
        <button class="reject-btn ${isRejected ? 'rejected' : ''}" data-id="${row.id}">
          <i class="fas fa-times"></i> ${isRejected ? 'Ignored' : 'Ignore'}
        </button>
      </div>
    `;
    
    // Add the rest of the data
    sheetData.headers.forEach(header => {
      const value = row[header] || '';
      const renderedValue = renderSpecialFields(header, value);
      html += `<div class="data-label">${escapeHtml(header)}</div>
               <div class="data-value">${renderedValue}</div>`;
    });
    html += '</div>';
    
    // Add event listeners for the buttons
    setTimeout(() => {
      const favoriteBtn = detailData.querySelector('.favorite-btn');
      const rejectBtn = detailData.querySelector('.reject-btn');
      
      if (favoriteBtn) {
        favoriteBtn.addEventListener('click', function() {
          const title = this.dataset.title;
          if (favorites.has(title)) {
            favorites.delete(title);
            this.classList.remove('favorited');
            this.innerHTML = '<i class="fas fa-star"></i> Add to Favorites';
            
            // If removing from favorites and not rejected, mark as undecided
            if (!rejectedItems.has(row.id)) {
                undecidedItems.add(row.id);
                opportunityStates[row.id].undecided = true;
            }
          } else {
            favorites.add(title);
            this.classList.add('favorited');
            this.innerHTML = '<i class="fas fa-star"></i> Remove from Favorites';
            
            // Remove from undecided when favorited
            undecidedItems.delete(row.id);
            opportunityStates[row.id].undecided = false;
          }
          
          // Save states
          appStorage.setItem('favorites', JSON.stringify([...favorites])); // Use appStorage
          appStorage.setItem('undecidedItems', JSON.stringify(Array.from(undecidedItems))); // Use appStorage
          appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
          
          // Update counts
          if (favoriteCount) favoriteCount.textContent = favorites.size;
          if (undecidedCount) undecidedCount.textContent = undecidedItems.size;
        });
      }

      if (rejectBtn) {
        rejectBtn.addEventListener('click', function() {
          const id = this.dataset.id;
          if (rejectedItems.has(id)) {
            rejectedItems.delete(id);
            this.innerHTML = '<i class="fas fa-times"></i> Ignore';
            this.classList.remove('rejected');
            
            // If not favorited, mark as undecided when un-ignoring
            const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
            const rowTitle = row[titleField] || 'Untitled Item';
            if (!favorites.has(rowTitle)) {
                undecidedItems.add(id);
                opportunityStates[id].undecided = true;
            }
          } else {
            rejectedItems.add(id);
            this.innerHTML = '<i class="fas fa-times"></i> Ignored';
            this.classList.add('rejected');
            
            // Remove from undecided when ignored
            undecidedItems.delete(id);
            opportunityStates[id].undecided = false;
          }
          
          // Save states
          appStorage.setItem('rejectedItems', JSON.stringify([...rejectedItems])); // Use appStorage
          appStorage.setItem('undecidedItems', JSON.stringify(Array.from(undecidedItems))); // Use appStorage
          appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
          
          // Update count
          if (undecidedCount) undecidedCount.textContent = undecidedItems.size;
        });
      }
    }, 0);
    
    return html;
  }

  // Modified renderSpecialFields function to handle dates
  function renderSpecialFields(header, value) {
    if (!value) return '';
    
    const valueStr = String(value);
    const urlPattern = /^(https?:\/\/[^\s]+)$/;
    
    if (urlPattern.test(valueStr)) {
      return `<a href="${escapeHtml(valueStr)}" target="_blank">${escapeHtml(valueStr)}</a>`;
    }
    
    // Handle dates
    const headerLower = header.toLowerCase();
    if (headerLower.includes('date') || headerLower.includes('deadline')) {
      const date = parseGoogleSheetsDate(valueStr);
      if (date) {
        return formatDate(date);
      }
    }
    
    // Simple newline to <br> conversion without splitting and joining
    if (valueStr.includes('\n')) {
      return escapeHtml(valueStr).replace(/\n/g, '<br>');
    }
      
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

  // Modified createTitleItem function to include score indicator
  function createTitleItem(row) {
    const titleItem = document.createElement('div');
    titleItem.className = 'title-item';
    
    // Add rejected class if the item is in rejectedItems
    if (rejectedItems.has(row.id)) {
      titleItem.classList.add('rejected');
    }
    
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
    
    // Get score for indicator
    const scoreField = sheetData.headers.find(h => h.toLowerCase().includes('score') || h.toLowerCase().includes('rating'));
    const score = scoreField ? parseFloat(row[scoreField]) : null;
    console.log('Row score:', score); // Debug log
    
    // Create favorite button
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'favorite-btn';
    favoriteBtn.innerHTML = '<i class="fas fa-star"></i>';
    if (favorites.has(rowTitle)) {
      favoriteBtn.classList.add('favorited');
    }
    
    favoriteBtn.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent title item click
      if (favorites.has(rowTitle)) {
        favorites.delete(rowTitle);
        this.classList.remove('favorited');
        // If removing from favorites and it's undecided, keep it as undecided
        if (undecidedItems.has(row.id)) {
          opportunityStates[row.id].undecided = true;
        }
      } else {
        favorites.add(rowTitle);
        this.classList.add('favorited');
        // If adding to favorites, remove from undecided
        undecidedItems.delete(row.id);
        opportunityStates[row.id].undecided = false;
      }
      // Save to localStorage
      appStorage.setItem('favorites', JSON.stringify([...favorites])); // Use appStorage
      appStorage.setItem('undecidedItems', JSON.stringify(Array.from(undecidedItems))); // Use appStorage
      appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
      
      // Update counts
      if (favoriteCount) favoriteCount.textContent = favorites.size;
      if (undecidedCount) undecidedCount.textContent = undecidedItems.size;
      
      // Re-render if we're in the relevant views
      if (currentFilter === 'favorites') {
        if (currentView === 'all') renderFilteredData();
        else if (currentView === 'undecided') renderUndecidedItems();
      }
    });
    
    // Create title content with score indicator
    const titleContentDiv = document.createElement('div');
    titleContentDiv.className = 'title-content';
    
    if (score !== null) {
      const scoreIndicator = document.createElement('div');
      scoreIndicator.className = 'score-indicator';
      scoreIndicator.style.backgroundColor = getScoreColor(score);
      titleContentDiv.appendChild(scoreIndicator);
    }
    
    const titleText = document.createElement('span');
    titleText.className = 'title-text';
    titleText.innerHTML = titleContent;
    titleContentDiv.appendChild(titleText);
    
    const titleIcon = document.createElement('i');
    titleIcon.className = 'fas fa-chevron-right title-icon';
    
    titleItem.appendChild(favoriteBtn);
    titleItem.appendChild(titleContentDiv);
    titleItem.appendChild(titleIcon);
    
    titleItem.addEventListener('click', function(e) {
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
      
      // Save current state before switching
      if (currentSelectedRow) {
        saveOpportunityState();
      }
      
      currentSelectedRow = row;
      detailData.innerHTML = generateDetailContent(row);
      document.querySelectorAll('.title-item').forEach(item => {
        item.classList.remove('active');
      });
      titleItem.classList.add('active');
      
      // Update opportunity states when an item is selected
      handleItemSelection(row);
      
      // Load the state for the selected opportunity
      loadOpportunityState(row);
      
      // Close the popout panel when a selection is made
      closePopoutPanel();
    });
    
    return titleItem;
  }

  // Modified sendQuestion function to save state after each message
  async function sendQuestion() {
    const question = chatInput.value.trim();
    if (!question) return;
    
    chatInput.value = '';
    
    const userMessageEl = document.createElement('div');
    userMessageEl.className = 'message user-message';
    userMessageEl.textContent = question;
    chatMessages.appendChild(userMessageEl);
    
    const loadingMessageEl = document.createElement('div');
    loadingMessageEl.className = 'message ai-message';
    loadingMessageEl.innerHTML = '<div class="loading-spinner" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px;"></div> Processing...';
    chatMessages.appendChild(loadingMessageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
      let context = '';
      
      if (currentSelectedRow) {
        context += "RECORD INFORMATION:\n";
        for (const header of sheetData.headers) {
          if (currentSelectedRow[header]) {
            context += `${header}: ${currentSelectedRow[header]}\n`;
          }
        }
        context += "\n";
      }
      
      if (documentTexts.length > 0) {
        context += "DOCUMENT CONTENT:\n";
        documentTexts.forEach((text, index) => {
          context += `Document ${index + 1}: ${text}\n\n`;
        });
      }
      
      const fullPrompt = `You are an assistant helping with questions about a specific record ${
        documentTexts.length > 0 ? 'and uploaded documents' : ''
      }. 
      
${context}

Based on the provided information, answer the following question:
${question}

Format your response using markdown (include headings with #, lists with *, bold with **, italic with *, code with \`\`\`, etc.)
If the answer includes tables, format them using markdown tables.
Only provide information found in the record or uploaded documents. If the answer is not in the provided information, say "I don't have enough information to answer that question."`;
      
      const responseText = await makeGeminiApiRequest(fullPrompt);
      loadingMessageEl.innerHTML = markdownToHtml(responseText);
      
      // Save state after each message
      saveOpportunityState();
      
    } catch (error) {
      console.error('Error calling Gemini API for RAG:', error);
      loadingMessageEl.textContent = `Error: ${error.message}. Please try again later.`;
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Modified handleFileUpload function to save state after file upload
  async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const processingMessage = document.createElement('div');
    processingMessage.className = 'message ai-message';
    processingMessage.textContent = 'Processing files...';
    chatMessages.appendChild(processingMessage);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const file of files) {
      try {
        if (uploadedDocuments.some(doc => doc.name === file.name)) {
          failCount++;
          continue;
        }
        
        let text;
        if (fileProcessors[file.type]) {
          text = await fileProcessors[file.type](file);
        } else {
          text = await readFileAsText(file);
        }
        
        uploadedDocuments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          text: text
        });
        
        documentTexts.push(text);
        createFileItem(file);
        successCount++;
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        failCount++;
      }
    }
    
    updateProcessingMessage(processingMessage, successCount, failCount);
    event.target.value = '';
    
    // Save state after file upload
    saveOpportunityState();
  }

  // Modified clearDocuments function to save state after clearing
  function clearDocuments() {
    uploadedDocuments = [];
    documentTexts = [];
    fileList.innerHTML = '';
    chatMessages.innerHTML = '<div class="message ai-message">Upload documents and ask questions about this record. I\'ll use the documents to provide detailed answers.</div>';
    
    // Save state after clearing
    saveOpportunityState();
  }

  // Consolidated file type processing
  const fileProcessors = {
    'application/pdf': async (file) => {
      const typedArray = new Uint8Array(await readFileAsArrayBuffer(file));
      const pdf = await pdfjsLib.getDocument({data: typedArray}).promise;
      let textContent = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textContent += content.items.map(item => item.str).join(' ') + ' ';
      }
      return textContent;
    },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': async (file) => {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const result = await mammoth.extractRawText({arrayBuffer});
      return result.value;
    }
  };

  // Helper function to read file as ArrayBuffer
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Helper function to create file item
  function createFileItem(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span>${escapeHtml(file.name)}</span>
      <i class="fas fa-times" data-filename="${escapeHtml(file.name)}"></i>
    `;
    
    fileItem.querySelector('i').addEventListener('click', function() {
      removeDocument(this.getAttribute('data-filename'));
      fileItem.remove();
    });
    
    fileList.appendChild(fileItem);
  }

  // Helper function to update processing message
  function updateProcessingMessage(message, successCount, failCount) {
    if (successCount > 0 || failCount > 0) {
      message.textContent = `Processing complete: ${successCount} file(s) successfully processed, ${failCount} file(s) failed.`;
    } else {
      message.textContent = 'No files were processed.';
    }
  }

  // Read a file and return its contents as text based on file type
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      // For text files, use FileReader directly
      if (file.type === 'text/plain' || file.type === 'text/csv' || file.type === 'application/json' || file.type.includes('text/')) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          resolve(e.target.result);
        };
        
        reader.onerror = function(e) {
          reject(new Error("Failed to read text file"));
        };
        
        reader.readAsText(file);
        return;
      }
      
      // For PDF files
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          const typedArray = new Uint8Array(e.target.result);
          
          // Make sure pdfjsLib is available
          if (typeof pdfjsLib === 'undefined') {
            reject(new Error("PDF.js library not loaded"));
            return;
          }
          
          // Load the PDF with proper error handling
          pdfjsLib.getDocument({data: typedArray}).promise
            .then(pdf => {
              let textContent = '';
              const numPages = pdf.numPages;
              let loadedPages = 0;
              
              // For small PDFs, just extract sequentially to avoid memory issues
              const extractPage = (pageNum) => {
                if (pageNum > numPages) {
                  resolve(textContent);
                  return;
                }
                
                pdf.getPage(pageNum).then(page => {
                  page.getTextContent().then(content => {
                    // Concatenate the text items
                    content.items.forEach(item => {
                      textContent += item.str + ' ';
                    });
                    
                    loadedPages++;
                    processingMessage.textContent = `Processing PDF: page ${loadedPages}/${numPages}`;
                    
                    // Process next page or resolve if done
                    extractPage(pageNum + 1);
                  }).catch(err => {
                    console.error(`Error extracting text from page ${pageNum}:`, err);
                    // Continue with next page despite errors
                    extractPage(pageNum + 1);
                  });
                }).catch(err => {
                  console.error(`Error getting page ${pageNum}:`, err);
                  // Continue with next page despite errors
                  extractPage(pageNum + 1);
                });
              };
              
              // Start extracting from page 1
              extractPage(1);
            })
            .catch(err => reject(new Error("Failed to load PDF: " + err.message)));
        };
        
        reader.onerror = function() {
          reject(new Error("Failed to read PDF file"));
        };
        
        reader.readAsArrayBuffer(file);
        return;
      }
      
      // For Word documents (docx)
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          // Make sure mammoth is available
          if (typeof mammoth === 'undefined') {
            reject(new Error("Mammoth.js library not loaded"));
            return;
          }
          
          mammoth.extractRawText({arrayBuffer: e.target.result})
            .then(result => {
              resolve(result.value);
            })
            .catch(err => {
              reject(new Error("Failed to extract Word document text: " + err.message));
            });
        };
        
        reader.onerror = function() {
          reject(new Error("Failed to read Word file"));
        };
        
        reader.readAsArrayBuffer(file);
        return;
      }
      
      // For any other file type, try to read as text
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          resolve(e.target.result);
        } catch (error) {
          reject(new Error("Unsupported file format"));
        }
      };
      
      reader.onerror = function() {
        reject(new Error("Failed to read file"));
      };
      
      reader.readAsText(file);
    });
  }

  // Global reference to processing message element for updating during long operations
  let processingMessage = null;

  // Remove a document from the uploaded documents array
  function removeDocument(filename) {
    const index = uploadedDocuments.findIndex(doc => doc.name === filename);
    if (index !== -1) {
      // Remove document and its text
      documentTexts.splice(index, 1);
      uploadedDocuments.splice(index, 1);
    }
  }

  // Function to download chat history as a text file
  function downloadChatHistory() {
    // Get all messages from the chat container
    const messages = document.querySelectorAll('#chat-messages .message');
    if (messages.length === 0) {
      alert('No chat messages to download.');
      return;
    }
    
    // Get the title of the current selected row for filename, or use a default
    let titleForFilename = 'Untitled Entry';
    if (currentSelectedRow) {
      const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
      titleForFilename = currentSelectedRow[titleField] || 'Untitled Entry';
      // Clean up the title to make it suitable for a filename
      titleForFilename = titleForFilename.replace(/[^\w\s-]/g, '').trim().substring(0, 50);
    }
    
    // Format current date and time for the chat log
    const now = new Date();
    const dateString = now.toLocaleDateString();
    const timeString = now.toLocaleTimeString();
    
    // Prepare the chat content with header
    let chatContent = `Chat History for: ${titleForFilename}\n`;
    chatContent += `Generated on: ${dateString} at ${timeString}\n\n`;
    
    // Process each message and add to content
    messages.forEach((message, index) => {
      const timestamp = new Date().toLocaleTimeString();
      const isUserMessage = message.classList.contains('user-message');
      const sender = isUserMessage ? 'User' : 'AI Assistant';
      chatContent += `[${index + 1}] ${sender} (${timestamp}):\n${message.textContent.trim()}\n\n`;
    });
    
    // Create a list of uploaded documents if any
    if (uploadedDocuments && uploadedDocuments.length > 0) {
      chatContent += '\n--- Uploaded Documents ---\n';
      uploadedDocuments.forEach((doc, index) => {
        chatContent += `${index + 1}. ${doc.name} (${formatFileSize(doc.size)})\n`;
      });
    }
    
    // Create a Blob with the chat content
    const blob = new Blob([chatContent], { type: 'text/plain' });
    
    // Create a download link and trigger the download
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${titleForFilename} chat results.txt`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  // Helper function to format file size
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // Convert markdown text to HTML
  function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    // Process code blocks (```)
    markdown = markdown.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
      return `<pre class="code-block${language ? ' language-' + language : ''}"><code>${escapeHtml(code.trim())}</code></pre>`;
    });
    
    // Process inline code (`)
    markdown = markdown.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Process headers (# Header)
    markdown = markdown.replace(/^(#{1,6})\s+(.*?)$/gm, function(match, hashes, content) {
      const level = hashes.length;
      return `<h${level} class="md-heading">${content}</h${level}>`;
    });
    
    // Process bold (**text**)
    markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Process italic (*text*)
    markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Process unordered lists
    markdown = markdown.replace(/^[\*\-]\s+(.*?)$/gm, '<li>$1</li>');
    markdown = markdown.replace(/(<li>.*?<\/li>)(?=\n(?!<li>))/gs, '<ul>$1</ul>');
    
    // Process ordered lists
    markdown = markdown.replace(/^\d+\.\s+(.*?)$/gm, '<li>$1</li>');
    markdown = markdown.replace(/(<li>.*?<\/li>)(?=\n(?!<li>))/gs, '<ol>$1</ol>');
    
    // Process markdown tables
    markdown = processMarkdownTables(markdown);
    
    // Process paragraphs and line breaks
    markdown = markdown.replace(/\n\n/g, '</p><p>');
    markdown = markdown.replace(/\n/g, '<br>');
    
    // Wrap in paragraph tags if not already wrapped
    if (!markdown.startsWith('<')) {
      markdown = `<p>${markdown}</p>`;
    }
    
    return markdown;
  }

  // Helper function to process markdown tables
  function processMarkdownTables(markdown) {
    // Find table blocks
    const tableRegex = /\|(.+)\|\n\|(-+\|)+\n((?:\|.+\|\n)+)/g;
    
    return markdown.replace(tableRegex, function(match, headerRow, separator, bodyRows) {
      // Process header row
      const headers = headerRow.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
      
      // Process body rows
      const rows = bodyRows.trim().split('\n').map(row => {
        return row.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell !== '');
      });
      
      // Build HTML table
      let tableHtml = '<table class="md-table"><thead><tr>';
      
      // Add headers
      headers.forEach(header => {
        tableHtml += `<th>${escapeHtml(header)}</th>`;
      });
      
      tableHtml += '</tr></thead><tbody>';
      
      // Add rows
      rows.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
          tableHtml += `<td>${escapeHtml(cell)}</td>`;
        });
        tableHtml += '</tr>';
      });
      
      tableHtml += '</tbody></table>';
      return tableHtml;
    });
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

  // Consolidated event listeners for modals and panels
  function setupModalAndPanelListeners() {
    // Modal close handlers
    const modalCloseHandlers = {
      'ai-modal': closeAiModal,
      'popout-panel': closePopoutPanel
    };

    // Add click handlers for modal backgrounds
    Object.keys(modalCloseHandlers).forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.addEventListener('click', function(event) {
          if (event.target === modal) {
            modalCloseHandlers[modalId]();
          }
        });
      }
    });

    // Add close button handlers
    document.querySelectorAll('.close-modal, .close-popout').forEach(closeBtn => {
      closeBtn.addEventListener('click', function() {
        const modalId = this.closest('.modal, .popout-panel').id;
        if (modalCloseHandlers[modalId]) {
          modalCloseHandlers[modalId]();
        }
      });
    });
  }

  // Call the setup function after DOM is loaded
  setupModalAndPanelListeners();

  // Function to render the dashboard
  function renderDashboard() {
    favoritesContainer.innerHTML = '';
    
    // Get all favorited items that exist in current sheet data
    let favoritedItems = sheetData.data.filter(row => {
      const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
      const rowTitle = row[titleField] || 'Untitled Item';
      return favorites.has(rowTitle);
    });

    // Update favorites set to only include items that exist in current data
    const validFavorites = new Set(favoritedItems.map(row => {
      const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
      return row[titleField] || 'Untitled Item';
    }));
    
    // Remove any favorites that no longer exist in the data
    favorites.forEach(title => {
      if (!validFavorites.has(title)) {
        favorites.delete(title);
        delete favoriteChats[title];
      }
    });
    
    // Save updated favorites to localStorage
    appStorage.setItem('favorites', JSON.stringify([...favorites])); // Use appStorage
    appStorage.setItem('favoriteChats', JSON.stringify(favoriteChats)); // Use appStorage
    
    // Update the displayed count
    favoriteCount.textContent = favorites.size;
    
    if (favorites.size === 0) {
      favoritesContainer.innerHTML = `
        <div class="no-favorites">
          <i class="fas fa-star"></i>
          <p>No favorited opportunities yet. Click the star icon next to any opportunity to add it to your favorites.</p>
        </div>
      `;
      return;
    }

    // Sort the favorited items
    favoritedItems.sort((a, b) => {
      if (sortBy === 'date') {
        const dueDateField = 'Due Date'; // Fixed field name
        const dateA = parseGoogleSheetsDate(a[dueDateField]);
        const dateB = parseGoogleSheetsDate(b[dueDateField]);
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        return sortDirection === 'desc' ? dateA - dateB : dateB - dateA;
      } else if (sortBy === 'score') {
        const scoreField = sheetData.headers.find(h => h.toLowerCase().includes('score') || h.toLowerCase().includes('rating'));
        const scoreA = parseFloat(a[scoreField]) || 0;
        const scoreB = parseFloat(b[scoreField]) || 0;
        
        return sortDirection === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      }
      return 0;
    });
    
    favoritedItems.forEach(row => {
      const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
      const rowTitle = row[titleField] || 'Untitled Item';
      
      // Get due date, score, and agency
      const dueDateField = 'Due Date'; // Fixed field name
      const scoreField = sheetData.headers.find(h => h.toLowerCase().includes('score') || h.toLowerCase().includes('rating'));
      const agencyField = 'Agency'; // Fixed field name
      
      const dueDate = dueDateField ? row[dueDateField] : null;
      const score = scoreField ? row[scoreField] : null;
      const agency = agencyField ? row[agencyField] : null;
      
      // Format due date
      let dueDateDisplay = '';
      let dueDateClass = '';
      if (dueDate) {
        const date = parseGoogleSheetsDate(dueDate);
        if (date) {
          const now = new Date();
          const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            dueDateDisplay = `Overdue by ${Math.abs(diffDays)} days`;
            dueDateClass = 'overdue';
          } else if (diffDays === 0) {
            dueDateDisplay = 'Due today';
            dueDateClass = 'overdue';
          } else if (diffDays <= 7) {
            dueDateDisplay = `Due in ${diffDays} days`;
            dueDateClass = 'upcoming';
          } else {
            dueDateDisplay = formatDate(date);
          }
        }
      }
      
      const card = document.createElement('div');
      card.className = 'favorite-card';
      card.innerHTML = `
        <div class="favorite-card-header">
          <div class="favorite-card-title-container">
            <h3 class="favorite-card-title">${escapeHtml(rowTitle)}</h3>
            ${score ? `
              <div class="score-indicator" style="background-color: ${getScoreColor(parseFloat(score))}"></div>
            ` : ''}
          </div>
          <div class="favorite-card-actions">
            <button class="remove-btn" data-title="${escapeHtml(rowTitle)}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div class="favorite-card-info">
          ${agency ? `
            <div class="favorite-card-agency">
              <i class="fas fa-building"></i>
              ${escapeHtml(agency)}
            </div>
          ` : ''}
          ${dueDate ? `
            <div class="favorite-card-due-date ${dueDateClass}">
              <i class="fas fa-calendar"></i>
              ${escapeHtml(dueDateDisplay)}
            </div>
          ` : ''}
          ${score ? `
            <div class="favorite-card-score">
              <i class="fas fa-star"></i>
              ${escapeHtml(score)}
            </div>
          ` : ''}
        </div>
      `;
      
      // Add event listeners
      const removeBtn = card.querySelector('.remove-btn');
      
      // Make the entire card clickable
      card.addEventListener('click', function(e) {
        // Don't trigger if clicking the remove button
        if (e.target.closest('.remove-btn')) return;
        
        switchView('all');
        currentSelectedRow = row;
        detailData.innerHTML = generateDetailContent(row);
        document.querySelectorAll('.title-item').forEach(item => {
          item.classList.remove('active');
        });
      });
      
      removeBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent card click
        favorites.delete(rowTitle);
        appStorage.setItem('favorites', JSON.stringify([...favorites])); // Use appStorage
        delete favoriteChats[rowTitle];
        appStorage.setItem('favoriteChats', JSON.stringify(favoriteChats)); // Use appStorage
        renderDashboard();
      });
      
      favoritesContainer.appendChild(card);
    });
  }

  // Helper function to generate context for AI
  function generateContext(row) {
    let context = "Record Information:\n";
    for (const header of sheetData.headers) {
      if (row[header]) {
        context += `${header}: ${row[header]}\n`;
      }
    }
    return context;
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

  // Consolidated Gemini API request function
  async function makeGeminiApiRequest(prompt, context = '') {
    if (!geminiApiKey) {
      throw new Error('Please set your Gemini API key.');
    }

    const fullPrompt = context ? `${context}\n\nAnswer the following question: ${prompt}` : prompt;
    
    const payload = {
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    };
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    
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
    
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('No response text received from API');
  }

  // Modified performAiSearch function
  async function performAiSearch() {
    const aiPrompt = aiPromptInput.value.trim();
    if (!aiPrompt) return;
    
    aiResultsContent.innerHTML = '<div class="loading-spinner"></div>';
    aiResults.style.display = 'block';
    
    try {
      let context = '';
      if (currentSelectedRow) {
        context = "Record Information:\n";
        for (const header of sheetData.headers) {
          if (currentSelectedRow[header]) {
            context += `${header}: ${currentSelectedRow[header]}\n`;
          }
        }
      }
      
      const responseText = await makeGeminiApiRequest(aiPrompt, context);
      aiResultsContent.innerHTML = `<p>${responseText}</p>`;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      aiResultsContent.innerHTML = `<p>Error: ${error.message}. Please try again later.</p>`;
    }
  }

  // Helper function to get color based on score
  function getScoreColor(score) {
    if (isNaN(score)) return 'rgb(128, 128, 128)'; // Gray for invalid scores
    
    // Normalize score to 0-1 range using actual min/max
    const normalizedScore = (score - scoreRange.min) / (scoreRange.max - scoreRange.min);
    console.log('Score:', score, 'Normalized:', normalizedScore); // Debug log
    
    // Calculate RGB values
    // Green (0, 128, 0) to Red (128, 0, 0)
    const r = Math.round(128 * (1 - normalizedScore));
    const g = Math.round(128 * normalizedScore);
    const b = 0;
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Update renderUnreadView function to reuse existing variables
  function renderUnreadView() {
    unreadContainer.innerHTML = '';
    const unreadArray = Array.from(unreadItems);
    
    if (unreadArray.length === 0) {
      unreadContainer.innerHTML = `
        <div class="no-unread">
          <i class="fas fa-check-circle"></i>
          <p>No unread opportunities. You're all caught up!</p>
        </div>
      `;
      unreadCount.textContent = '0';
      return;
    }

    // Reset current index if it's out of bounds
    if (currentUnreadIndex >= unreadArray.length) {
      currentUnreadIndex = 0;
    }

    // Get the current unread item
    const currentItem = sheetData.data.find(row => row.id === unreadArray[currentUnreadIndex]);
    if (!currentItem) return;

    // Get the title field and row title once
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    const rowTitle = currentItem[titleField] || 'Untitled Item';

    // Create the detail view container
    const detailView = document.createElement('div');
    detailView.className = 'detail-view';
    
    // Add the header with unread count
    const header = document.createElement('div');
    header.className = 'dashboard-header';
    header.innerHTML = `
      <h2><i class="fas fa-envelope"></i> Unread Opportunities</h2>
      <div class="dashboard-stats">
        <span class="stat-item">
          <i class="fas fa-envelope"></i>
          <span>${unreadArray.length}</span> Unread
        </span>
      </div>
    `;
    detailView.appendChild(header);

    // Add the detail content
    const detailContent = document.createElement('div');
    detailContent.className = 'data-grid';
    
    // Add all the item details
    sheetData.headers.forEach(header => {
      const value = currentItem[header] || '';
      const renderedValue = renderSpecialFields(header, value);
      detailContent.innerHTML += `
        <div class="data-label">${escapeHtml(header)}</div>
        <div class="data-value">${renderedValue}</div>
      `;
    });

    detailView.appendChild(detailContent);

    // Add RAG dropdown and chat interface
    const ragContainer = document.createElement('div');
    ragContainer.className = 'rag-dropdown';
    ragContainer.innerHTML = `
      <div class="dropdown-header">
        <h3><i class="fas fa-robot"></i> Ask Questions About This Opportunity</h3>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown-content" style="display: none;">
        <div class="file-upload-area">
          <input type="file" id="document-upload" multiple style="display: none;">
          <button id="upload-trigger" class="btn">
            <i class="fas fa-upload"></i> Upload Documents
          </button>
          <p class="helper-text">Upload relevant documents to ask questions about this opportunity.</p>
          <div id="file-list" class="file-list"></div>
        </div>
        
        <div class="chat-container">
          <div id="chat-messages" class="chat-messages">
            <div class="message ai-message">Upload documents and ask questions about this record. I'll use the documents to provide detailed answers.</div>
          </div>
          <div class="chat-input-container">
            <input type="text" id="chat-input" class="chat-input" placeholder="Ask a question...">
            <button id="send-question" class="btn primary-btn">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
        
        <div class="actions-container">
          <button id="clear-documents" class="btn">
            <i class="fas fa-trash"></i> Clear Documents
          </button>
          <button id="download-chat" class="btn">
            <i class="fas fa-download"></i> Download Chat
          </button>
        </div>
      </div>
    `;
    detailView.appendChild(ragContainer);

    // Add the action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'unread-actions';
    
    actionsDiv.innerHTML = `
      <button class="favorite-btn ${favorites.has(rowTitle) ? 'favorited' : ''}" data-title="${escapeHtml(rowTitle)}">
        <i class="fas fa-star"></i> ${favorites.has(rowTitle) ? 'Favorited' : 'Favorite'}
      </button>
      <button class="reject-btn ${rejectedItems.has(currentItem.id) ? 'rejected' : ''}" data-id="${currentItem.id}">
        <i class="fas fa-times"></i> ${rejectedItems.has(currentItem.id) ? 'Rejected' : 'Reject'}
      </button>
      <button class="next-btn" data-id="${currentItem.id}">
        <i class="fas fa-arrow-right"></i> Next
      </button>
    `;

    // Add event listeners for the buttons
    const favoriteBtn = actionsDiv.querySelector('.favorite-btn');
    const rejectBtn = actionsDiv.querySelector('.reject-btn');
    const nextBtn = actionsDiv.querySelector('.next-btn');

    favoriteBtn.addEventListener('click', function() {
      const title = this.dataset.title;
      if (favorites.has(title)) {
        favorites.delete(title);
        this.innerHTML = '<i class="fas fa-star"></i> Favorite';
        this.classList.remove('favorited');
      } else {
        favorites.add(title);
        this.innerHTML = '<i class="fas fa-star"></i> Favorited';
        this.classList.add('favorited');
        
        // Mark current item as read and move to next
        const id = currentItem.id;
        unreadItems.delete(id);
        opportunityStates[id].read = true;
        
        // Save states
        appStorage.setItem('favorites', JSON.stringify([...favorites])); // Use appStorage
        appStorage.setItem('unreadItems', JSON.stringify(Array.from(unreadItems))); // Use appStorage
        appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
        
        // Update the favorite count in the dashboard
        if (favoriteCount) {
          favoriteCount.textContent = favorites.size;
        }
        
        // Move to next item
        currentUnreadIndex++;
        updateUnreadCount();
        renderUnreadView();
      }
    });

    rejectBtn.addEventListener('click', function() {
      const id = this.dataset.id;
      if (rejectedItems.has(id)) {
        rejectedItems.delete(id);
        this.innerHTML = '<i class="fas fa-times"></i> Reject';
        this.classList.remove('rejected');
      } else {
        rejectedItems.add(id);
        this.innerHTML = '<i class="fas fa-times"></i> Rejected';
        this.classList.add('rejected');
        
        // Mark current item as read and move to next
        unreadItems.delete(id);
        opportunityStates[id].read = true;
        
        // Save states
        appStorage.setItem('unreadItems', JSON.stringify(Array.from(unreadItems))); // Use appStorage
        appStorage.setItem('rejectedItems', JSON.stringify([...rejectedItems])); // Use appStorage
        appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
        
        // Move to next item
        currentUnreadIndex++;
        updateUnreadCount();
        renderUnreadView();
      }
    });

    nextBtn.addEventListener('click', function() {
      const id = this.dataset.id;
      // Mark current item as read
      unreadItems.delete(id);
      opportunityStates[id].read = true;
      
      // If not favorited and not rejected, mark as undecided
      if (!favorites.has(rowTitle) && !rejectedItems.has(id)) {
        undecidedItems.add(id);
        opportunityStates[id].undecided = true;
      }
      
      appStorage.setItem('unreadItems', JSON.stringify(Array.from(unreadItems))); // Use appStorage
      appStorage.setItem('undecidedItems', JSON.stringify(Array.from(undecidedItems))); // Use appStorage
      appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
      
      // Move to next item
      currentUnreadIndex++;
      updateUnreadCount();
      renderUnreadView();
    });

    detailView.appendChild(actionsDiv);
    unreadContainer.appendChild(detailView);

    // Set up RAG dropdown and chat functionality
    const dropdownHeader = ragContainer.querySelector('.dropdown-header');
    const dropdownContent = ragContainer.querySelector('.dropdown-content');
    const documentUpload = ragContainer.querySelector('#document-upload');
    const uploadTrigger = ragContainer.querySelector('#upload-trigger');
    const fileList = ragContainer.querySelector('#file-list');
    const chatMessages = ragContainer.querySelector('#chat-messages');
    const chatInput = ragContainer.querySelector('#chat-input');
    const sendQuestionBtn = ragContainer.querySelector('#send-question');
    const clearDocumentsBtn = ragContainer.querySelector('#clear-documents');
    const downloadChatBtn = ragContainer.querySelector('#download-chat');

    // Toggle RAG dropdown
    dropdownHeader.addEventListener('click', function() {
      const isVisible = dropdownContent.style.display !== 'none';
      dropdownContent.style.display = isVisible ? 'none' : 'block';
      const icon = this.querySelector('i.fa-chevron-down, i.fa-chevron-up');
      icon.classList.toggle('fa-chevron-down', isVisible);
      icon.classList.toggle('fa-chevron-up', !isVisible);
    });

    // Set up file upload
    uploadTrigger.addEventListener('click', () => documentUpload.click());
    documentUpload.addEventListener('change', handleFileUpload);

    // Set up chat functionality
    sendQuestionBtn.addEventListener('click', () => {
      const question = chatInput.value.trim();
      if (!question) return;
      
      // Create a context with the current item's data
      let context = '';
      if (currentItem) {
        context += "RECORD INFORMATION:\n";
        for (const header of sheetData.headers) {
          if (currentItem[header]) {
            context += `${header}: ${currentItem[header]}\n`;
          }
        }
        context += "\n";
      }
      
      if (documentTexts.length > 0) {
        context += "DOCUMENT CONTENT:\n";
        documentTexts.forEach((text, index) => {
          context += `Document ${index + 1}: ${text}\n\n`;
        });
      }
      
      const fullPrompt = `You are an assistant helping with questions about a specific record ${
        documentTexts.length > 0 ? 'and uploaded documents' : ''
      }. 
      
${context}

Based on the provided information, answer the following question:
${question}

Format your response using markdown (include headings with #, lists with *, bold with **, italic with *, code with \`\`\`, etc.)
If the answer includes tables, format them using markdown tables.
Only provide information found in the record or uploaded documents. If the answer is not in the provided information, say "I don't have enough information to answer that question."`;

      // Add user message
      const userMessageEl = document.createElement('div');
      userMessageEl.className = 'message user-message';
      userMessageEl.textContent = question;
      chatMessages.appendChild(userMessageEl);
      
      // Add loading message
      const loadingMessageEl = document.createElement('div');
      loadingMessageEl.className = 'message ai-message';
      loadingMessageEl.innerHTML = '<div class="loading-spinner" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px;"></div> Processing...';
      chatMessages.appendChild(loadingMessageEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Clear input
      chatInput.value = '';
      
      // Make API request
      makeGeminiApiRequest(fullPrompt)
        .then(responseText => {
          loadingMessageEl.innerHTML = markdownToHtml(responseText);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        })
        .catch(error => {
          console.error('Error calling Gemini API:', error);
          loadingMessageEl.textContent = `Error: ${error.message}. Please try again later.`;
        });
    });

    // Handle Enter key in chat input
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendQuestionBtn.click();
      }
    });

    // Set up clear documents button
    clearDocumentsBtn.addEventListener('click', () => {
      uploadedDocuments = [];
      documentTexts = [];
      fileList.innerHTML = '';
      chatMessages.innerHTML = '<div class="message ai-message">Upload documents and ask questions about this record. I\'ll use the documents to provide detailed answers.</div>';
    });

    // Set up download chat button
    downloadChatBtn.addEventListener('click', () => {
      const messages = chatMessages.querySelectorAll('.message');
      if (messages.length === 0) {
        alert('No chat messages to download.');
        return;
      }
      
      let chatContent = `Chat History for: ${rowTitle}\n`;
      chatContent += `Generated on: ${new Date().toLocaleString()}\n\n`;
      
      messages.forEach((message, index) => {
        const isUserMessage = message.classList.contains('user-message');
        const sender = isUserMessage ? 'User' : 'AI Assistant';
        chatContent += `[${index + 1}] ${sender}:\n${message.textContent.trim()}\n\n`;
      });
      
      if (uploadedDocuments.length > 0) {
        chatContent += '\n--- Uploaded Documents ---\n';
        uploadedDocuments.forEach((doc, index) => {
          chatContent += `${index + 1}. ${doc.name} (${formatFileSize(doc.size)})\n`;
        });
      }
      
      const blob = new Blob([chatContent], { type: 'text/plain' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `${rowTitle} chat results.txt`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    });

    updateUnreadCount();
  }

  // Add function to update unread count
  function updateUnreadCount() {
    unreadCount.textContent = unreadItems.size;
  }

  // Modify the existing function that handles item selection to mark as read
  function handleItemSelection(row) {
    if (!row) return;
    
    // Initialize opportunity state if it doesn't exist
    if (!opportunityStates[row.id]) {
        opportunityStates[row.id] = {};
    }
    
    // Mark as read when selected
    if (unreadItems.has(row.id)) {
        unreadItems.delete(row.id);
        opportunityStates[row.id].read = true;
        appStorage.setItem('unreadItems', JSON.stringify(Array.from(unreadItems))); // Use appStorage
        updateUnreadCount();
    }
    
    // Update opportunity state
    const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
    const rowTitle = row[titleField] || 'Untitled Item';
    
    // Check current state
    const isFavorited = favorites.has(rowTitle);
    const isRejected = rejectedItems.has(row.id);
    
    // If not favorited and not rejected, mark as undecided
    if (!isFavorited && !isRejected) {
        undecidedItems.add(row.id);
        opportunityStates[row.id].undecided = true;
    } else {
        undecidedItems.delete(row.id);
        opportunityStates[row.id].undecided = false;
    }
    
    // Save states
    appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
    appStorage.setItem('undecidedItems', JSON.stringify(Array.from(undecidedItems))); // Use appStorage
    
    // Update counts
    if (undecidedCount) undecidedCount.textContent = undecidedItems.size;
  }

  // Update renderUndecidedView to show items similar to all opportunities view
  function renderUndecidedView() {
    undecidedContainer.innerHTML = '';
    const undecidedArray = Array.from(undecidedItems);
    undecidedCount.textContent = undecidedArray.length;
    
    if (undecidedArray.length === 0) {
      undecidedContainer.innerHTML = `
        <div class="no-undecided">
          <i class="fas fa-check-circle"></i>
          <p>No undecided opportunities.</p>
        </div>
      `;
      return;
    }

    // Create a full-width content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.id = 'content-wrapper';
    contentWrapper.style.display = 'flex';
    contentWrapper.style.width = '100%';
    
    // Create titles container
    const titlesContainer = document.createElement('div');
    titlesContainer.className = 'titles-container';
    titlesContainer.style.flex = '0 0 350px';
    titlesContainer.style.maxHeight = '80vh';
    titlesContainer.style.overflowY = 'auto';
    
    // Create detail content container
    const detailContent = document.createElement('div');
    detailContent.className = 'detail-content';
    detailContent.style.flex = '1';
    detailContent.style.paddingLeft = '20px';
    
    // Add containers to the content wrapper
    contentWrapper.appendChild(titlesContainer);
    contentWrapper.appendChild(detailContent);
    
    // Add the content wrapper to the undecided container
    undecidedContainer.appendChild(contentWrapper);

    // Function to render detail view for an item
    function renderDetailView(row) {
        const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
        const rowTitle = row[titleField] || 'Untitled Item';
        
        let detailHtml = `
          <div class="detail-view">
            <div class="dashboard-header">
              <h2><i class="fas fa-question-circle"></i> Undecided Opportunity</h2>
            </div>
            <div class="data-grid">
        `;
        
        // Add all fields from the item
        sheetData.headers.forEach(header => {
          const value = row[header] || '';
          const renderedValue = renderSpecialFields(header, value);
          detailHtml += `
            <div class="data-label">${escapeHtml(header)}</div>
            <div class="data-value">${renderedValue}</div>
          `;
        });
        
        detailHtml += `
            </div>
            <div class="unread-actions">
              <button class="favorite-btn ${favorites.has(rowTitle) ? 'favorited' : ''}" data-title="${escapeHtml(rowTitle)}">
                <i class="fas fa-star"></i> ${favorites.has(rowTitle) ? 'Favorited' : 'Favorite'}
              </button>
              <button class="reject-btn ${rejectedItems.has(row.id) ? 'rejected' : ''}" data-id="${row.id}">
                <i class="fas fa-times"></i> ${rejectedItems.has(row.id) ? 'Rejected' : 'Reject'}
              </button>
            </div>
          </div>
        `;
        
        // Add RAG dropdown and chat interface
        detailHtml += `
          <div class="rag-dropdown">
            <div class="dropdown-header">
              <h3><i class="fas fa-robot"></i> Ask Questions About This Opportunity</h3>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="dropdown-content" style="display: none;">
              <div class="file-upload-area">
                <input type="file" id="document-upload" multiple style="display: none;">
                <button id="upload-trigger" class="btn">
                  <i class="fas fa-upload"></i> Upload Documents
                </button>
                <p class="helper-text">Upload relevant documents to ask questions about this opportunity.</p>
                <div id="file-list" class="file-list"></div>
              </div>
              
              <div class="chat-container">
                <div id="chat-messages" class="chat-messages">
                  <div class="message ai-message">Upload documents and ask questions about this record. I'll use the documents to provide detailed answers.</div>
                </div>
                <div class="chat-input-container">
                  <input type="text" id="chat-input" class="chat-input" placeholder="Ask a question...">
                  <button id="send-question" class="btn primary-btn">
                    <i class="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
              
              <div class="actions-container">
                <button id="clear-documents" class="btn">
                  <i class="fas fa-trash"></i> Clear Documents
                </button>
                <button id="download-chat" class="btn">
                  <i class="fas fa-download"></i> Download Chat
                </button>
              </div>
            </div>
          </div>
        `;
        
        detailContent.innerHTML = detailHtml;
        detailContent.style.display = 'block';
        
        // Load the state for the selected opportunity
        loadOpportunityState(row);
        
        // Set up action buttons
        const favoriteBtn = detailContent.querySelector('.favorite-btn');
        const rejectBtn = detailContent.querySelector('.reject-btn');

        favoriteBtn.addEventListener('click', function() {
          const title = this.dataset.title;
          if (favorites.has(title)) {
            favorites.delete(title);
            this.innerHTML = '<i class="fas fa-star"></i> Favorite';
            this.classList.remove('favorited');
          } else {
            favorites.add(title);
            this.innerHTML = '<i class="fas fa-star"></i> Favorited';
            this.classList.add('favorited');
            
            // Remove from undecided
            undecidedItems.delete(row.id);
            opportunityStates[row.id].undecided = false;
            
            // Save states
            appStorage.setItem('favorites', JSON.stringify([...favorites])); // Use appStorage
            appStorage.setItem('undecidedItems', JSON.stringify(Array.from(undecidedItems))); // Use appStorage
            appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
            
            // Update counts
            if (favoriteCount) favoriteCount.textContent = favorites.size;
            if (undecidedCount) undecidedCount.textContent = undecidedItems.size;
            
            // Update the titles list
            updateTitlesList();
          }
        });

        rejectBtn.addEventListener('click', function() {
          const id = this.dataset.id;
          if (rejectedItems.has(id)) {
            rejectedItems.delete(id);
            this.innerHTML = '<i class="fas fa-times"></i> Reject';
            this.classList.remove('rejected');
          } else {
            rejectedItems.add(id);
            this.innerHTML = '<i class="fas fa-times"></i> Rejected';
            this.classList.add('rejected');
            
            // Remove from undecided
            undecidedItems.delete(id);
            opportunityStates[id].undecided = false;
            
            // Save states
            appStorage.setItem('rejectedItems', JSON.stringify([...rejectedItems])); // Use appStorage
            appStorage.setItem('undecidedItems', JSON.stringify(Array.from(undecidedItems))); // Use appStorage
            appStorage.setItem('opportunityStates', JSON.stringify(opportunityStates)); // Use appStorage
            
            // Update count
            if (undecidedCount) undecidedCount.textContent = undecidedItems.size;
            
            // Update the titles list
            updateTitlesList();
          }
        });

        // Function to set up RAG functionality for a detail view
        setupRagFunctionality(detailContent, row);
    }

    // Function to update the titles list
    function updateTitlesList() {
        const filteredData = sheetData.data.filter(row => undecidedItems.has(row.id));
        
        // Clear the titles container
        titlesContainer.innerHTML = '';
        
        // If no items left, re-render the whole view
        if (filteredData.length === 0) {
          renderUndecidedView();
          return;
        }

        // Add all undecided items to the titles list
        filteredData.forEach(row => {
            const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
            const rowTitle = row[titleField] || 'Untitled Item';
            
            const titleItem = document.createElement('div');
            titleItem.className = 'title-item';
            titleItem.innerHTML = `
                <div class="title-content">
                    <div class="title-text">${escapeHtml(rowTitle)}</div>
                    <i class="fas fa-chevron-right title-icon"></i>
                </div>
            `;
            
            // Add click handler to show details
            titleItem.addEventListener('click', () => {
                // Remove active class from all items
                titlesContainer.querySelectorAll('.title-item').forEach(item => {
                    item.classList.remove('active');
                });
                // Add active class to clicked item
                titleItem.classList.add('active');
                // Show details for this item
                renderDetailView(row);
            });
            
            titlesContainer.appendChild(titleItem);
        });

        // Show details of the first item by default if none is selected
        if (!titlesContainer.querySelector('.title-item.active') && filteredData.length > 0) {
            const firstItem = titlesContainer.querySelector('.title-item');
            if (firstItem) {
                firstItem.classList.add('active');
                renderDetailView(filteredData[0]);
            }
        }
    }

    // Initial render of titles
    updateTitlesList();
  }

  // Initial render of undecided items
  renderUndecidedItems();
    
  // Add containers to the content wrapper
  contentWrapper.appendChild(titlesContainer);
  contentWrapper.appendChild(detailContent);
    
  // Add the content wrapper to the undecided container
  undecidedContainer.appendChild(contentWrapper);

  // Function to set up RAG functionality for a detail view
  function setupRagFunctionality(container, row) {
      const dropdownHeader = container.querySelector('.rag-dropdown .dropdown-header');
      const dropdownContent = container.querySelector('.rag-dropdown .dropdown-content');
      const documentUpload = container.querySelector('#document-upload');
      const uploadTrigger = container.querySelector('#upload-trigger');
      const fileList = container.querySelector('#file-list');
      const chatMessages = container.querySelector('#chat-messages');
      const chatInput = container.querySelector('#chat-input');
      const sendQuestionBtn = container.querySelector('#send-question');
      const clearDocumentsBtn = container.querySelector('#clear-documents');
      const downloadChatBtn = container.querySelector('#download-chat');

      // Toggle RAG dropdown
      dropdownHeader.addEventListener('click', function() {
          const isVisible = dropdownContent.style.display !== 'none';
          dropdownContent.style.display = isVisible ? 'none' : 'block';
          const icon = this.querySelector('i.fa-chevron-down, i.fa-chevron-up');
          icon.classList.toggle('fa-chevron-down', isVisible);
          icon.classList.toggle('fa-chevron-up', !isVisible);
      });

      // Set up file upload
      uploadTrigger.addEventListener('click', () => documentUpload.click());
      documentUpload.addEventListener('change', handleFileUpload);

      // Set up chat functionality
      sendQuestionBtn.addEventListener('click', async () => {
          const question = chatInput.value.trim();
          if (!question) return;
          
          // Add user message
          const userMessageEl = document.createElement('div');
          userMessageEl.className = 'message user-message';
          userMessageEl.textContent = question;
          chatMessages.appendChild(userMessageEl);
          
          // Add loading message
          const loadingMessageEl = document.createElement('div');
          loadingMessageEl.className = 'message ai-message';
          loadingMessageEl.innerHTML = '<div class="loading-spinner" style="width: 24px; height: 24px; display: inline-block; margin-right: 8px;"></div> Processing...';
          chatMessages.appendChild(loadingMessageEl);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          
          // Clear input
          chatInput.value = '';
          
          try {
              // Create context with the current item's data
              let context = '';
              if (row) {
                  context += "RECORD INFORMATION:\n";
                  for (const header of sheetData.headers) {
                      if (row[header]) {
                          context += `${header}: ${row[header]}\n`;
                      }
                  }
                  context += "\n";
              }
              
              if (documentTexts.length > 0) {
                  context += "DOCUMENT CONTENT:\n";
                  documentTexts.forEach((text, index) => {
                      context += `Document ${index + 1}: ${text}\n\n`;
                  });
              }
              
              const fullPrompt = `You are an assistant helping with questions about a specific record ${
                  documentTexts.length > 0 ? 'and uploaded documents' : ''
              }. 
              
${context}

Based on the provided information, answer the following question:
${question}

Format your response using markdown (include headings with #, lists with *, bold with **, italic with *, code with \`\`\`, etc.)
If the answer includes tables, format them using markdown tables.
Only provide information found in the record or uploaded documents. If the answer is not in the provided information, say "I don't have enough information to answer that question."`;

              const responseText = await makeGeminiApiRequest(fullPrompt);
              loadingMessageEl.innerHTML = markdownToHtml(responseText);
              chatMessages.scrollTop = chatMessages.scrollHeight;
              
              // Save state after each message
              saveOpportunityState();
          } catch (error) {
              console.error('Error calling Gemini API:', error);
              loadingMessageEl.textContent = `Error: ${error.message}. Please try again later.`;
          }
      });

      // Handle Enter key in chat input
      chatInput.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
              sendQuestionBtn.click();
          }
      });

      // Set up clear documents button
      clearDocumentsBtn.addEventListener('click', () => {
          uploadedDocuments = [];
          documentTexts = [];
          fileList.innerHTML = '';
          chatMessages.innerHTML = '<div class="message ai-message">Upload documents and ask questions about this record. I\'ll use the documents to provide detailed answers.</div>';
          saveOpportunityState();
      });

      // Set up download chat button
      downloadChatBtn.addEventListener('click', () => {
          const messages = chatMessages.querySelectorAll('.message');
          if (messages.length === 0) {
              alert('No chat messages to download.');
              return;
          }
          
          const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
          const rowTitle = row[titleField] || 'Untitled Item';
          
          let chatContent = `Chat History for: ${rowTitle}\n`;
          chatContent += `Generated on: ${new Date().toLocaleString()}\n\n`;
          
          messages.forEach((message, index) => {
              const isUserMessage = message.classList.contains('user-message');
              const sender = isUserMessage ? 'User' : 'AI Assistant';
              chatContent += `[${index + 1}] ${sender}:\n${message.textContent.trim()}\n\n`;
          });
          
          if (uploadedDocuments.length > 0) {
              chatContent += '\n--- Uploaded Documents ---\n';
              uploadedDocuments.forEach((doc, index) => {
                  chatContent += `${index + 1}. ${doc.name} (${formatFileSize(doc.size)})\n`;
              });
          }
          
          const blob = new Blob([chatContent], { type: 'text/plain' });
          const downloadLink = document.createElement('a');
          downloadLink.href = URL.createObjectURL(blob);
          downloadLink.download = `${rowTitle} chat results.txt`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
      });

      // Load any existing state
      loadOpportunityState(row);
  }

  // Function to render detail view for an item
  function renderDetailView(row) {
    // ... existing code ...
    // Set up RAG dropdown and chat functionality
    setupRagFunctionality(detailContent, row);
  }
});
