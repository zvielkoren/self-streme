# Self Streme

Self Streme is a Stremio addon that allows you to stream your local media library and discover new content from various sources.

## Features

- Stream local media files (movies and series)
- Search and stream content from Stremio
- Support for multiple video qualities (1080p, 720p)
- Subtitles support
- Torrent streaming
- Private repository for your media collection

## Installation

1. Clone this repository:

```bash
git clone https://github.com/your-username/self-streme.git
cd self-streme
```

2. Install dependencies:

```bash
npm install
```

3. Create necessary directories:

```bash
mkdir media temp
```

4. Start the server:

```bash
npm start
```

5. Install the addon in Stremio:
   - Open Stremio
   - Go to Addons
   - Click "Install Addon"
   - Enter: `http://127.0.0.1:3001/manifest.json`

## Configuration

The addon can be configured by editing `src/config/index.js`:

- `server.port`: Port for the streaming server (default: 3000)
- `server.addonPort`: Port for the Stremio addon server (default: 3001)
- `media.libraryPath`: Path to your media library (default: "./media")
- `media.tempPath`: Path for temporary files (default: "./temp")

## Usage

1. Place your media files in the `media` directory
2. Search for content in Stremio
3. Select a stream source (local or torrent)
4. Enjoy!

## Security

This is a private repository. Please keep your media files and configuration secure.

## License

Private - All rights reserved
