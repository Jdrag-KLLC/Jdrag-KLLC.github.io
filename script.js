document.addEventListener('DOMContentLoaded', function() {
  // DOM elements for Sheet integration and Gemini API key input
  const sheetIdInput = document.getElementById('sheet-id');
  const connectBtn = document.getElementById('connect-btn');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const setGeminiApiKeyBtn = document.getElementById('set-gemini-api-key');

  // Other DOM elements
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

  // Application state for Sheet data and API key
  let sheetData = { headers: [], data: [] };
  let currentSelectedRow = null;
  let geminiApiKey = "";
  let uploadedDocuments = []; // Array to store file metadata and extracted text
  let documentTexts = [];   // Context texts for RAG

  // Event listeners for Sheet connection and AI
  connectBtn.addEventListener('click', connectToSheet);
  searchInput.addEventListener('input', renderFilteredData);
  aiSearchBtn.addEventListener('click', openAiModal);
  closeModal.addEventListener('click', closeAiModal);
  runAiSearchBtn.addEventListener('click', performAiSearch);

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
  downloadChatBtn.addEventListener('click', downloadChatHistory);

  setGeminiApiKeyBtn.addEventListener('click', function() {
    geminiApiKey = geminiApiKeyInput.value.trim();
    if (geminiApiKey) {
      alert('Gemini API key set.');
    } else {
      alert('Please enter a valid Gemini API key.');
    }
  });

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

  // Google Sheet connection and processing functions
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
    titlesContainer.innerHTML = '';
    
    if (filteredData.length === 0) {
      titlesContainer.innerHTML = '<div class="no-results">No matching records found</div>';
    } else {
      filteredData.forEach((row) => {
        titlesContainer.appendChild(createTitleItem(row));
      });
    }
  }

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
      document.querySelectorAll('.title-item').forEach(item => item.classList.remove('active'));
      titleItem.classList.add('active');
      clearDocuments();
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
      if (priority.includes('high')) priorityClass = 'priority-high';
      else if (priority.includes('medium') || priority.includes('med')) priorityClass = 'priority-medium';
      else if (priority.includes('low')) priorityClass = 'priority-low';
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

  function showError(message) {
    errorTextElement.textContent = message;
    errorElement.style.display = 'flex';
  }

  // AI Modal functions
  function openAiModal() {
    aiModal.style.display = 'block';
    aiPromptInput.focus();
    aiResults.style.display = 'none';
  }

  function closeAiModal() {
    aiModal.style.display = 'none';
  }

  async function performAiSearch() {
    const aiPrompt = aiPromptInput.value.trim();
    if (!aiPrompt) return;
    
    aiResultsContent.innerHTML = '<div class="loading-spinner"></div>';
    aiResults.style.display = 'block';
    
    if (!geminiApiKey) {
      aiResultsContent.innerHTML = '<p>Please set your Gemini API key.</p>';
      return;
    }
    
    let contextText = "";
    if (currentSelectedRow) {
      contextText = "Record Information:\n";
      for (const header of sheetData.headers) {
        if (currentSelectedRow[header]) {
          contextText += `${header}: ${currentSelectedRow[header]}\n`;
        }
      }
    }
    
    let fullPrompt = aiPrompt;
    if (contextText) {
      fullPrompt = `Based on the following record information:\n${contextText}\nAnswer the following question: ${aiPrompt}`;
    }
    
    const payload = {
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    };
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.candidates && data.candidates.length > 0 && 
          data.candidates[0].content && 
          data.candidates[0].content.parts && 
          data.candidates[0].content.parts.length > 0) {
        const responseText = data.candidates[0].content.parts[0].text;
        aiResultsContent.innerHTML = `<p>${responseText}</p>`;
      } else {
        aiResultsContent.innerHTML = '<p>No response text received from API.</p>';
        console.error('Unexpected API response structure:', data);
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      aiResultsContent.innerHTML = `<p>Error: ${error.message}. Please try again later.</p>`;
    }
  }

  // --- UPDATED FILE UPLOAD AND PARSING FUNCTIONS ---

  // Function to extract text from a file based on its type.
  async function extractFileText(file) {
    // For text-based files
    if (file.type.startsWith("text/") || file.name.match(/\.(txt|csv|json)$/i)) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          resolve(e.target.result);
        };
        reader.onerror = function() {
          reject(new Error("Failed to read file as text"));
        };
        reader.readAsText(file);
      });
    }
    // For PDFs using PDF.js
    else if (file.type === "application/pdf" || file.name.match(/\.(pdf)$/i)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map(item => item.str);
          text += strings.join(" ") + "\n";
        }
        return text;
      } catch (e) {
        throw new Error("Failed to extract text from PDF: " + e.message);
      }
    }
    // For DOCX files using Mammoth.js
    else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
             file.name.match(/\.(docx)$/i)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value;
      } catch (e) {
        throw new Error("Failed to extract text from DOCX: " + e.message);
      }
    }
    // For legacy DOC files, not supported
    else if (file.type === "application/msword" || file.name.match(/\.(doc)$/i)) {
      throw new Error("DOC file format is not supported for text extraction.");
    }
    // Fallback: attempt to read the file as text
    else {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          resolve(e.target.result);
        };
        reader.onerror = function() {
          reject(new Error("Failed to read file as text (fallback)"));
        };
        reader.readAsText(file);
      });
    }
  }

  // Updated file upload handler.
  async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Skip duplicates.
      if (uploadedDocuments.some(doc => doc.name === file.name)) continue;
      
      try {
        const text = await extractFileText(file);
        
        uploadedDocuments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          text: text
        });
        
        documentTexts.push(text);
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
          <span>${escapeHtml(file.name)}</span>
          <i class="fas fa-times" data-filename="${escapeHtml(file.name)}"></i>
        `;
        
        fileItem.querySelector('i').addEventListener('click', function() {
          const filename = this.getAttribute('data-filename');
          removeDocument(filename);
          fileItem.remove();
        });
        
        fileList.appendChild(fileItem);
      } catch (error) {
        console.error('Error processing file:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'message ai-message';
        errorMessage.textContent = `Error processing file ${file.name}: ${error.message}`;
        chatMessages.appendChild(errorMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
    
    event.target.value = '';
    
    if (uploadedDocuments.length > 0) {
      const message = document.createElement('div');
      message.className = 'message ai-message';
      message.textContent = `${uploadedDocuments.length} document(s) uploaded. You can now ask questions about them.`;
      chatMessages.appendChild(message);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function removeDocument(filename) {
    const index = uploadedDocuments.findIndex(doc => doc.name === filename);
    if (index !== -1) {
      documentTexts.splice(index, 1);
      uploadedDocuments.splice(index, 1);
    }
  }

  function clearDocuments() {
    uploadedDocuments = [];
    documentTexts = [];
    fileList.innerHTML = '';
    chatMessages.innerHTML = '<div class="message ai-message">Upload documents and ask questions about this record. I\'ll use the documents to provide detailed answers.</div>';
  }

  // Function to download chat history
  function downloadChatHistory() {
    const messages = document.querySelectorAll('#chat-messages .message');
    if (messages.length === 0) {
      alert('No chat messages to download.');
      return;
    }
    
    let titleForFilename = 'Untitled Entry';
    if (currentSelectedRow) {
      const titleField = sheetData.headers.includes('Title') ? 'Title' : sheetData.headers[0];
      titleForFilename = currentSelectedRow[titleField] || 'Untitled Entry';
      titleForFilename = titleForFilename.replace(/[^\w\s-]/g, '').trim().substring(0, 50);
    }
    
    const now = new Date();
    const dateString = now.toLocaleDateString();
    const timeString = now.toLocaleTimeString();
    
    let chatContent = `Chat History for: ${titleForFilename}\n`;
    chatContent += `Generated on: ${dateString} at ${timeString}\n\n`;
    
    messages.forEach((message, index) => {
      const timestamp = new Date().toLocaleTimeString();
      const isUserMessage = message.classList.contains('user-message');
      const sender = isUserMessage ? 'User' : 'AI Assistant';
      chatContent += `[${index + 1}] ${sender} (${timestamp}):\n${message.textContent.trim()}\n\n`;
    });
    
    if (uploadedDocuments && uploadedDocuments.length > 0) {
      chatContent += '\n--- Uploaded Documents ---\n';
      uploadedDocuments.forEach((doc, index) => {
        chatContent += `${index + 1}. ${doc.name} (${formatFileSize(doc.size)})\n`;
      });
    }
    
    const blob = new Blob([chatContent], { type: 'text/plain' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${titleForFilename} chat results.txt`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
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
