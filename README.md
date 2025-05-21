# Google Sheet Data Viewer

An interactive web application for viewing and searching Google Sheets data with AI integration capabilities.

## Features

- **Connect to any Google Sheet** using its ID
- **Accordion-style interface** for clean data presentation
- **Real-time search** across all data fields
- **URL detection** that automatically converts URLs to clickable links
- **Smart formatting** for priority levels and tags
- **AI search integration** framework (ready for your AI service)
- **Responsive design** that works on desktop and mobile devices

## Setup Instructions

### 1. Prepare your Google Sheet

1. Make sure your Google Sheet has a tab named 'cleaned'
2. The first row should contain your column headers
3. Publish your sheet to the web:
   - File > Share > Publish to web
   - Under "Link", select the 'cleaned' sheet
   - Click "Publish" and copy the URL
   - Extract the Sheet ID from the URL (the long string between `/d/` and `/edit`)

### 2. Deploy the Application

#### Using GitHub Pages:

1. Fork or clone this repository
2. Go to Settings > Pages
3. Select your branch (main/master) as the source
4. Your app will be available at `https://[your-username].github.io/[repo-name]/`

#### Local Development:

1. Clone this repository
2. Open `index.html` in your browser, or use a local server like Live Server for VS Code

### 3. Connect to Your Sheet

1. Open the deployed application
2. Paste your Google Sheet ID into the input field
3. Click "Connect"
4. The application will load and display your data

## AI Integration

This application includes a framework for AI integration. The current implementation simulates AI responses, but you can extend it by:

1. Modifying the `performAiSearch()` function in `script.js`
2. Connecting it to your preferred AI service (OpenAI, Anthropic, etc.)
3. Implementing server-side processing if needed

## Customization

- Edit `styles.css` to match your branding
- Modify the header in `index.html`
- Extend field rendering in `renderSpecialFields()` for custom field types

## Project Structure

- `index.html` - Main HTML structure
- `styles.css` - All styling and visual customization
- `script.js` - Application logic and data handling

## Security

Never embed API keys or other secrets directly in the client-side code.
Store sensitive credentials in environment variables on the server and
inject them during build or runtime. Exposing keys in the browser puts
your accounts at risk.

## License

MIT

## Contact

[Your Name/Organization] - [Your Email/Contact]
