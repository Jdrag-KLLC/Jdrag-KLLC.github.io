const sheetIdInput = document.getElementById('sheetId');
const sheetNameInput = document.getElementById('sheetName');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const loadDataBtn = document.getElementById('loadDataBtn');
const statusDiv = document.getElementById('status');
const ragSection = document.querySelector('.rag-section');
const userQueryInput = document.getElementById('userQuery');
const askBtn = document.getElementById('askBtn');
const answerDiv = document.getElementById('answer');

let sentenceEncoderModel = null;
let sheetData = []; // Array of { text: "...", embedding: [...] }

// --- Helper Functions ---
function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? 'red' : 'green';
    console.log(message);
}

async function loadSentenceEncoder() {
    updateStatus('Loading sentence encoder model...');
    try {
        sentenceEncoderModel = await use.load();
        updateStatus('Sentence encoder model loaded.');
        return true;
    } catch (error) {
        updateStatus('Error loading sentence encoder model: ' + error, true);
        console.error("USE load error:", error);
        return false;
    }
}

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        // console.warn("Invalid vectors for cosine similarity:", vecA, vecB);
        return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
}

// --- Core Logic ---
async function fetchAndProcessSheetData() {
    const sheetId = sheetIdInput.value.trim();
    const sheetNameOrGid = sheetNameInput.value.trim(); // Can be sheet name or GID (e.g., 0 for first sheet)

    if (!sheetId || !sheetNameOrGid) {
        updateStatus('Please enter Sheet ID and Sheet Name/GID.', true);
        return;
    }

    if (!sentenceEncoderModel) {
        updateStatus('Sentence encoder not loaded. Please wait or reload.', true);
        if (!await loadSentenceEncoder()) return; // Try loading again if not loaded
    }

    updateStatus('Fetching sheet data...');
    // Using Google Sheets gviz API for public CSV export (Column C only)
    // For specific sheet name: &sheet=SheetName
    // For specific GID: &gid=0
    // For a specific range (Column C): &range=C:C
    const sheetParam = isNaN(parseInt(sheetNameOrGid)) ? `sheet=${encodeURIComponent(sheetNameOrGid)}` : `gid=${sheetNameOrGid}`;
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&${sheetParam}&range=C:C`;


    try {
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. Check if sheet is public & link is correct.`);
        }
        const csvText = await response.text();
        
        // Parse CSV (simple parser, assumes no commas within cells for column C)
        const rows = csvText.split('\n').map(row => row.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
        
        if (rows.length === 0 || (rows.length === 1 && rows[0] === '')) {
            updateStatus('No data found in column C or sheet is empty/inaccessible.', true);
            return;
        }
        
        const texts = rows.filter(text => text && text.trim() !== ''); // Filter out empty rows
        if (texts.length === 0) {
            updateStatus('Column C contains only empty cells after filtering.', true);
            return;
        }

        updateStatus(`Found ${texts.length} entries in column C. Generating embeddings...`);

        const embeddings = await sentenceEncoderModel.embed(texts);
        const embeddingsArray = await embeddings.array(); // Convert tensor to JS array
        embeddings.dispose(); // Clean up tensor

        sheetData = texts.map((text, i) => ({
            text: text,
            embedding: embeddingsArray[i]
        }));

        updateStatus(`Data loaded and indexed for ${sheetData.length} items. Ready to ask questions.`);
        ragSection.style.display = 'block';
        loadDataBtn.disabled = true; // Prevent re-loading

    } catch (error) {
        updateStatus('Error fetching or processing sheet data: ' + error, true);
        console.error("Sheet data error:", error);
    }
}

async function handleUserQuery() {
    const query = userQueryInput.value.trim();
    const geminiApiKey = geminiApiKeyInput.value.trim();

    if (!query) {
        updateStatus('Please enter a question.', true);
        return;
    }
    if (!geminiApiKey) {
        updateStatus('Please enter your Gemini API Key.', true);
        return;
    }
    if (sheetData.length === 0) {
        updateStatus('No data loaded from sheet. Please load data first.', true);
        return;
    }

    updateStatus('Processing query...');
    answerDiv.textContent = 'Thinking...';

    try {
        // 1. Embed user query
        const queryEmbeddingTensor = await sentenceEncoderModel.embed([query]);
        const queryEmbedding = (await queryEmbeddingTensor.array())[0];
        queryEmbeddingTensor.dispose();

        // 2. Find relevant context (simple vector search)
        const topN = 3; // Number of most relevant chunks to retrieve
        const similarities = sheetData.map(item => ({
            text: item.text,
            similarity: cosineSimilarity(queryEmbedding, item.embedding)
        }));

        similarities.sort((a, b) => b.similarity - a.similarity); // Sort by descending similarity
        const relevantContexts = similarities.slice(0, topN).map(item => item.text);
        
        if (relevantContexts.length === 0 || similarities[0].similarity < 0.3) { // Adjust threshold as needed
             updateStatus('Could not find sufficiently relevant context in the sheet. Asking Gemini directly.', false);
             // Fallback: Ask Gemini without specific context or with a generic instruction
        }


        // 3. Augment: Prepare prompt for Gemini
        const contextText = relevantContexts.join("\n\n"); // Join contexts with double newline
        const prompt = `Based on the following information from a document:
---
${contextText}
---
Please answer the question: "${query}"

If the information isn't sufficient or not found in the provided context, state that and try to answer generally if possible, or say you cannot answer based on the provided text.`;

        console.log("Prompt for Gemini:", prompt);

        // 4. Generate: Call Gemini API
        // Using gemini-1.5-flash-latest for faster responses and lower cost. Change if needed.
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
        
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            // Optional: Add safetySettings, generationConfig if needed
            // generationConfig: {
            //     "temperature": 0.7,
            //     "maxOutputTokens": 250,
            // }
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            answerDiv.textContent = data.candidates[0].content.parts[0].text;
            updateStatus('Answer received.', false);
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            answerDiv.textContent = `Blocked by API: ${data.promptFeedback.blockReason}`;
            if(data.promptFeedback.blockReason === "SAFETY" && data.promptFeedback.safetyRatings) {
                answerDiv.textContent += `\nDetails: ${JSON.stringify(data.promptFeedback.safetyRatings)}`;
            }
            updateStatus('Query blocked by API.', true);
        }
        else {
            answerDiv.textContent = 'No content received from Gemini.';
            updateStatus('Empty response from Gemini.', true);
            console.log("Gemini Raw Response:", data);
        }

    } catch (error) {
        updateStatus('Error during RAG process: ' + error, true);
        answerDiv.textContent = 'Error: ' + error.message;
        console.error("RAG error:", error);
    }
}


// --- Event Listeners ---
loadDataBtn.addEventListener('click', fetchAndProcessSheetData);
askBtn.addEventListener('click', handleUserQuery);

// --- Initial Load ---
// Load the sentence encoder model as soon as the page loads
// but don't block user from entering sheet ID etc.
loadSentenceEncoder().then(loaded => {
    if (loaded) {
        // You could enable the loadDataBtn here if you want,
        // but fetchAndProcessSheetData also checks and loads if necessary.
    }
});
