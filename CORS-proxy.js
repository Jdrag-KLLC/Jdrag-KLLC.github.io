// This is a simple Node.js CORS proxy for Google Sheets
// You can deploy this to a service like Render, Heroku, or Vercel

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Enable CORS for all routes
app.use(cors());

// Serve static files
app.use(express.static('.'));

// Define the proxy route
app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }
  
  try {
    // Forward the request to Google Sheets
    const response = await axios.get(url);
    res.send(response.data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send(`Error fetching data: ${error.message}`);
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CORS proxy server running on port ${PORT}`);
});

// For easy deployment to services like Vercel, export the Express app
module.exports = app;
