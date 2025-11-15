# Anime Series Support

## Overview

Self-Streme provides comprehensive support for anime series, making it an excellent choice for anime enthusiasts. The platform handles anime content the same way as regular TV series, with additional features that enhance the anime streaming experience.

## Features

- **Series Detection**: Automatically recognizes anime as series content
- **Season/Episode Support**: Full support for multiple seasons and episodes
- **Hebrew Subtitles**: Integrated Hebrew subtitle support from Ktuvit and other providers
- **Quality Options**: Multiple quality streams (1080p, 720p, 480p)
- **Metadata Support**: IMDB integration for anime metadata
- **Cache Support**: Efficient caching for better performance

## How Anime Works in Self-Streme

Anime is treated as series content (`type: "series"`) in Self-Streme. This means all series features automatically work with anime:

### Content Types
```javascript
type: "series"  // Use this for anime
type: "movie"   // Use this for anime movies
```

### Season and Episode Structure
```
Anime Series/
├── Season 1/
│   ├── Episode 1
│   ├── Episode 2
│   └── ...
├── Season 2/
│   ├── Episode 1
│   └── ...
└── OVA/ (can be handled as separate season)
```

## Getting Anime Streams

### API Endpoint

```
GET /stream/series/:imdbId
GET /stream/series/:imdbId/:season/:episode
```

### Example: Attack on Titan

```bash
# Get all available streams for Attack on Titan
curl "http://localhost:7000/stream/series/tt2560140"

# Get streams for Season 1 Episode 1
curl "http://localhost:7000/stream/series/tt2560140/1/1"

# Play specific stream
curl "http://localhost:7000/play/series/tt2560140/0/1/1"
```

## Hebrew Subtitles for Anime

Hebrew subtitles are particularly useful for anime content, as they provide access to Hebrew fansub communities.

### Get Hebrew Subtitles for Anime

```bash
# Get Hebrew subtitles for Attack on Titan S1E1
curl "http://localhost:7000/subtitles/series/tt2560140/1/1"
```

**Response:**
```json
{
  "subtitles": [
    {
      "id": "tt2560140-heb-ktuvit",
      "url": "https://www.ktuvit.me/Services/GetModuleAjax.ashx?request=1&imdb=tt2560140&season=1&episode=1",
      "lang": "heb",
      "label": "עברית (Ktuvit)",
      "provider": "ktuvit"
    },
    {
      "id": "tt2560140-heb-subscene",
      "url": "https://subscene.com/subtitles/title?q=tt2560140&l=heb",
      "lang": "heb",
      "label": "עברית (Subscene)",
      "provider": "subscene"
    }
  ],
  "count": 2,
  "imdbId": "tt2560140",
  "type": "series",
  "language": "heb"
}
```

## Popular Anime IMDB IDs

Here are some popular anime series with their IMDB IDs for testing:

| Anime Title | IMDB ID | Type |
|-------------|---------|------|
| Attack on Titan | tt2560140 | series |
| Death Note | tt0877057 | series |
| Naruto | tt0409591 | series |
| One Piece | tt0388629 | series |
| My Hero Academia | tt5626028 | series |
| Demon Slayer | tt9335498 | series |
| Steins;Gate | tt1910272 | series |
| Fullmetal Alchemist: Brotherhood | tt1355642 | series |
| Cowboy Bebop | tt0213338 | series |
| Spirited Away | tt0245429 | movie |
| Your Name | tt5311514 | movie |

## Anime Catalog

The series catalog includes anime content:

```json
{
  "type": "series",
  "id": "local",
  "name": "Local Series & Anime",
  "extra": [
    {
      "name": "search",
      "isRequired": false
    },
    {
      "name": "genre",
      "isRequired": false
    }
  ]
}
```

### Searching for Anime

```bash
# Search in the series catalog
curl "http://localhost:7000/catalog/series/local/search=attack%20on%20titan"
```

## Cache-Only Mode for Anime

Anime can be pre-cached for offline viewing:

### Setup

1. **Enable P2P to Download**
   ```bash
   CACHE_ONLY_MODE=false npm start
   ```

2. **Stream Episodes to Cache Them**
   ```bash
   # Stream S1E1 - gets cached automatically
   curl "http://localhost:7000/stream/proxy/{infoHash}"
   ```

3. **Enable Cache-Only Mode**
   ```bash
   CACHE_ONLY_MODE=true npm start
   ```

4. **Stream from Cache**
   ```bash
   # Now streams from cache without P2P
   curl "http://localhost:7000/stream/proxy/{infoHash}"
   ```

### Benefits for Anime
- **Binge Watching**: Pre-cache entire seasons for smooth binge watching
- **Offline Viewing**: Watch without internet connection
- **Consistent Quality**: No buffering or quality drops
- **Bandwidth Savings**: Download once, watch many times

## Anime File Organization

If storing anime locally in the media directory:

```
media/
└── series/
    ├── Attack on Titan/
    │   ├── Season 1/
    │   │   ├── S01E01.mkv
    │   │   ├── S01E01.heb.srt  # Hebrew subtitles
    │   │   ├── S01E02.mkv
    │   │   └── ...
    │   ├── Season 2/
    │   │   ├── S02E01.mkv
    │   │   └── ...
    │   └── OVA/
    │       └── OVA01.mkv
    └── Death Note/
        └── Season 1/
            ├── S01E01.mkv
            └── ...
```

### Naming Conventions

Recommended file naming for anime:
- `S01E01.mkv` - Season 1 Episode 1
- `{Anime Name} - S01E01.mkv`
- `{Anime Name} - 01x01.mkv`

## Stremio Integration

### Adding the Addon to Stremio

1. Open Stremio
2. Go to Addons → Community Addons
3. Click "Install from URL"
4. Enter: `http://localhost:7000/manifest.json`
5. Click Install

### Using Anime in Stremio

1. **Search**: Search for anime by name in Stremio
2. **Select**: Choose the anime series
3. **Pick Episode**: Select season and episode
4. **Stream**: Multiple quality options will appear
5. **Subtitles**: Hebrew subtitles available in subtitle menu

## API Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Function to get anime streams
async function getAnimeStreams(imdbId, season, episode) {
  const url = `http://localhost:7000/stream/series/${imdbId}`;
  const response = await axios.get(url);
  return response.data.streams;
}

// Function to get anime subtitles
async function getAnimeSubtitles(imdbId, season, episode) {
  const url = `http://localhost:7000/subtitles/series/${imdbId}/${season}/${episode}`;
  const response = await axios.get(url);
  return response.data.subtitles;
}

// Usage
const streams = await getAnimeStreams('tt2560140', 1, 1);
const subtitles = await getAnimeSubtitles('tt2560140', 1, 1);

console.log(`Found ${streams.length} streams`);
console.log(`Found ${subtitles.length} subtitle sources`);
```

### Python

```python
import requests

def get_anime_streams(imdb_id, season=None, episode=None):
    url = f"http://localhost:7000/stream/series/{imdb_id}"
    response = requests.get(url)
    return response.json()['streams']

def get_anime_subtitles(imdb_id, season, episode):
    url = f"http://localhost:7000/subtitles/series/{imdb_id}/{season}/{episode}"
    response = requests.get(url)
    return response.json()['subtitles']

# Usage
streams = get_anime_streams('tt2560140', 1, 1)
subtitles = get_anime_subtitles('tt2560140', 1, 1)

print(f"Found {len(streams)} streams")
print(f"Found {len(subtitles)} subtitle sources")
```

## Quality Selection for Anime

Anime streams support multiple quality options:

```json
{
  "streams": [
    {
      "name": "Attack on Titan S01E01 - 1080p",
      "quality": "1080p",
      "size": "1.5 GB",
      "seeders": 50
    },
    {
      "name": "Attack on Titan S01E01 - 720p",
      "quality": "720p",
      "size": "800 MB",
      "seeders": 30
    },
    {
      "name": "Attack on Titan S01E01 - 480p",
      "quality": "480p",
      "size": "400 MB",
      "seeders": 20
    }
  ]
}
```

## Metadata for Anime

Anime metadata is fetched from IMDB when available:

```json
{
  "id": "tt2560140",
  "type": "series",
  "name": "Attack on Titan",
  "description": "After his hometown is destroyed...",
  "poster": "https://...",
  "genres": ["Animation", "Action", "Adventure"],
  "imdbRating": "9.0",
  "releaseInfo": "2013-"
}
```

## Troubleshooting

### Anime Not Appearing

**Solution:**
- Verify IMDB ID is correct
- Check that content type is set to `series`
- Ensure search providers support anime content

### No Hebrew Subtitles

**Solution:**
- Check Ktuvit availability for specific anime
- Try English subtitles as fallback: `?lang=eng`
- Some anime may not have Hebrew subtitles available

### Slow Streaming

**Solution:**
1. Enable cache-only mode after first download
2. Pre-cache episodes during off-peak hours
3. Choose lower quality streams if bandwidth limited
4. Use local media files in `./media/series/` directory

## Advanced Features

### Batch Download Episodes

```bash
#!/bin/bash
# Download entire season to cache

ANIME_ID="tt2560140"  # Attack on Titan
SEASON=1

for EPISODE in {1..25}; do
  echo "Downloading S${SEASON}E${EPISODE}..."
  curl "http://localhost:7000/play/series/${ANIME_ID}/0/${SEASON}/${EPISODE}" > /dev/null
  sleep 5
done

echo "Season ${SEASON} cached!"
```

### Monitor Cache

```bash
# Check cached anime files
ls -lh ./temp/ | grep -i "attack"

# Check cache status
curl "http://localhost:7000/api/cache-stats"
```

## Best Practices

1. **Use Quality Filtering**: Choose appropriate quality based on device and bandwidth
2. **Pre-cache Popular Series**: Download entire seasons during setup
3. **Enable Hebrew Subtitles**: Most anime viewers prefer subtitles over dubbing
4. **Organize Locally**: For personal collection, use proper folder structure
5. **Monitor Cache Size**: Anime files can be large, manage cache limits appropriately

## Integration with Other Services

### Kitsu API (Optional Enhancement)

For anime-specific metadata, consider integrating Kitsu API:

```javascript
// Example: Fetch anime metadata from Kitsu
const kitsuId = '7442'; // Attack on Titan
const response = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`);
```

### MyAnimeList (Optional Enhancement)

MAL integration for ratings and tracking:

```javascript
// Example: Fetch from MyAnimeList API
const malId = '16498'; // Attack on Titan
// Requires MAL API key
```

## Future Enhancements

Planned anime features:
- Anime-specific metadata providers (Kitsu, AniList)
- MAL/AniList watch history sync
- Anime-specific subtitle sources
- Fansub group filtering
- Opening/ending skip detection
- Next episode auto-play

## See Also

- [Hebrew Subtitles Documentation](./HEBREW-SUBTITLES.md)
- [Cache-Only Mode](./CACHE-ONLY-MODE.md)
- [Series Streaming Guide](../README.md#usage-guide)
- [Subtitle Service](../src/services/subtitleService.js)
