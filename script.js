document.addEventListener('DOMContentLoaded', function() {
  // DOM elements for Sheet integration and Gemini API key input
  const sheetIdInput = document.getElementById('sheet-id');
  const connectBtn = document.getElementById('connect-btn');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const setGeminiApiKeyBtn = document.getElementById('set-gemini-api-key');

  // New popout panel elements
  const viewOpportunitiesBtn = document.getElementById('view-opportunities-btn');
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

  // Set up event listeners
  connectBtn.addEventListener('click', connectToSheet);
  searchInput.addEventListener('input', renderFilteredData);
  closeModal.addEventListener('click', closeAiModal);
  runAiSearchBtn.addEventListener('click', performAiSearch);

  // Popout panel event listeners
  viewOpportunitiesBtn.addEventListener('click', togglePopout);
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
      viewOpportunitiesBtn.style.display = 'flex'; // Show the toggle button after connection
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
      
      // When selecting a new item, clear documents and chat history
      clearDocuments();
      
      // Close the popout panel when a selection is made
      closePopoutPanel();
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
    
    // Simple newline to <br> conversion without splitting and joining
    if (valueStr.includes('\n')) {
      return escapeHtml(valueStr).replace(/\n/g, '<br>');
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

  // Modified sendQuestion function
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
    } catch (error) {
      console.error('Error calling Gemini API for RAG:', error);
      loadingMessageEl.textContent = `Error: ${error.message}. Please try again later.`;
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

  // Modified handleFileUpload function
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

  // Clear all uploaded documents
  function clearDocuments() {
    uploadedDocuments = [];
    documentTexts = [];
    fileList.innerHTML = '';
    chatMessages.innerHTML = '<div class="message ai-message">Upload documents and ask questions about this record. I\'ll use the documents to provide detailed answers.</div>';
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
});
