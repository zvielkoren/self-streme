# Hebrew Subtitle Support

## Overview

Self-Streme now includes comprehensive Hebrew subtitle support, making it ideal for Israeli users and Hebrew content. The subtitle service integrates with popular Hebrew subtitle providers to deliver high-quality subtitles for movies, series, and anime.

## Features

- **Multiple Hebrew Providers**: Integrates with Ktuvit and Subscene
- **Automatic Language Detection**: Defaults to Hebrew subtitles
- **Multi-Language Support**: Hebrew, English, and more
- **Series & Anime Support**: Works with episodes and season packs
- **Stremio Integration**: Subtitles appear directly in Stremio interface
- **Caching**: Subtitle results are cached for better performance

## Subtitle Providers

### 1. Ktuvit (Hebrew Subtitles)
- **Description**: Leading Israeli Hebrew subtitle provider
- **Language**: עברית (Hebrew)
- **Content**: Movies, TV series, anime
- **Quality**: High-quality community-contributed subtitles

### 2. Subscene
- **Description**: International subtitle database
- **Languages**: Hebrew, English, and many more
- **Content**: Extensive movie and series library
- **Quality**: Professional and community subtitles

## API Endpoint

### Get Subtitles

```
GET /subtitles/:type/:imdbId/:season?/:episode?
```

**Parameters:**
- `type` (required): Content type - `movie` or `series`
- `imdbId` (required): IMDB ID (e.g., `tt0111161`)
- `season` (optional): Season number for series
- `episode` (optional): Episode number for series

**Query Parameters:**
- `lang` (optional): Language code - `heb` (default), `eng`, etc.

## Usage Examples

### Example 1: Get Hebrew Subtitles for a Movie

```bash
curl "http://localhost:7000/subtitles/movie/tt0111161"
```

**Response:**
```json
{
  "subtitles": [
    {
      "id": "tt0111161-heb-ktuvit",
      "url": "https://www.ktuvit.me/Services/GetModuleAjax.ashx?request=1&imdb=tt0111161",
      "lang": "heb",
      "label": "עברית (Ktuvit)",
      "provider": "ktuvit"
    },
    {
      "id": "tt0111161-heb-subscene",
      "url": "https://subscene.com/subtitles/title?q=tt0111161&l=heb",
      "lang": "heb",
      "label": "עברית (Subscene)",
      "provider": "subscene"
    },
    {
      "id": "tt0111161-eng-subscene",
      "url": "https://subscene.com/subtitles/title?q=tt0111161&l=eng",
      "lang": "eng",
      "label": "English (Subscene)",
      "provider": "subscene"
    }
  ],
  "count": 3,
  "imdbId": "tt0111161",
  "type": "movie",
  "language": "heb"
}
```

### Example 2: Get Hebrew Subtitles for a Series Episode

```bash
curl "http://localhost:7000/subtitles/series/tt0903747/1/1"
```

This fetches subtitles for Breaking Bad Season 1 Episode 1.

### Example 3: Get English Subtitles

```bash
curl "http://localhost:7000/subtitles/movie/tt0111161?lang=eng"
```

### Example 4: Get Subtitles for Anime

```bash
curl "http://localhost:7000/subtitles/series/tt0409591/1/5"
```

Fetches subtitles for an anime series (e.g., Naruto S1E5).

## Integration with Streams

Subtitles are automatically integrated into stream responses when available. When you fetch streams, subtitle information can be included:

```javascript
// Stream objects can include subtitle metadata
{
  "name": "Movie Title 1080p",
  "url": "http://localhost:7000/stream/proxy/hash",
  "subtitles": [
    {
      "id": "tt0111161-heb-ktuvit",
      "url": "https://www.ktuvit.me/...",
      "lang": "heb",
      "label": "עברית (Ktuvit)"
    }
  ]
}
```

## Stremio Integration

Subtitles from the service can be used in Stremio:

1. The addon manifest includes `subtitles` in the resources list
2. Subtitles are fetched automatically when content is selected
3. Hebrew subtitles appear as "עברית (Ktuvit)" or "עברית (Subscene)"
4. Users can select subtitles from the Stremio interface

## Programmatic Usage

### In Your Application

```javascript
import subtitleService from './services/subtitleService.js';

// Get Hebrew subtitles for a movie
const subtitles = await subtitleService.getSubtitles(
  'tt0111161',  // IMDB ID
  'movie',      // Type
  null,         // Season (for series)
  null,         // Episode (for series)
  'heb'         // Language
);

// Get subtitles for series episode
const episodeSubtitles = await subtitleService.getSubtitles(
  'tt0903747',  // Breaking Bad
  'series',
  1,            // Season 1
  1,            // Episode 1
  'heb'
);

// Get Stremio-formatted subtitles (includes both Hebrew and English)
const stremioSubs = await subtitleService.getStremioSubtitles(
  'tt0111161',
  'movie'
);
```

## Supported Languages

The subtitle service supports multiple languages:

| Language | Code | Providers |
|----------|------|-----------|
| Hebrew | `heb`, `he`, `hebrew` | Ktuvit, Subscene |
| English | `eng`, `en`, `english` | Subscene |

More languages can be added by extending the subtitle providers.

## Provider URLs

### Ktuvit URL Format

**Movies:**
```
https://www.ktuvit.me/Services/GetModuleAjax.ashx?request=1&imdb={IMDB_ID}
```

**Series:**
```
https://www.ktuvit.me/Services/GetModuleAjax.ashx?request=1&imdb={IMDB_ID}&season={S}&episode={E}
```

### Subscene URL Format

```
https://subscene.com/subtitles/title?q={IMDB_ID}&l={LANG}
```

## Caching

The subtitle service includes built-in caching:

- **Cache Duration**: 1 hour (3600 seconds)
- **Cache Key**: `{imdbId}:{season}:{episode}:{language}`
- **Cache Storage**: In-memory Map
- **Cache Invalidation**: Automatic after timeout

### Clear Cache

```javascript
import subtitleService from './services/subtitleService.js';

subtitleService.clearCache();
```

## Error Handling

The service gracefully handles errors:

```javascript
// If providers are unavailable, returns empty array
{
  "subtitles": [],
  "count": 0,
  "imdbId": "tt0111161",
  "type": "movie",
  "language": "heb"
}
```

## Performance

- **Initial Request**: 100-500ms (network request to providers)
- **Cached Request**: <10ms (memory cache hit)
- **Multiple Providers**: Requests run in parallel for speed
- **Timeout**: No timeout - providers return immediately with URLs

## Anime Support

The subtitle service works excellently with anime content:

### Benefits for Anime
- **Hebrew Fansubs**: Access to Hebrew anime fansub communities via Ktuvit
- **Episode Tracking**: Proper season/episode support
- **Multiple Sources**: Choose between different subtitle versions
- **Series Integration**: Works with anime series catalogs

### Example: Get Anime Subtitles

```bash
# Get subtitles for Attack on Titan S1E1
curl "http://localhost:7000/subtitles/series/tt2560140/1/1?lang=heb"
```

## Configuration

No additional configuration is required. The service works out of the box with these defaults:

```javascript
{
  providers: {
    opensubtitles: 'https://api.opensubtitles.com/api/v1',
    ktuvit: 'https://www.ktuvit.me',
    subscene: 'https://subscene.com'
  },
  cacheTimeout: 3600000  // 1 hour
}
```

## Extending the Service

### Add New Provider

Edit `src/services/subtitleService.js`:

```javascript
// Add provider URL
this.providers.newProvider = 'https://newprovider.com';

// Add provider method
getNewProviderUrl(imdbId, type, season, episode) {
  return `${this.providers.newProvider}/search?imdb=${imdbId}`;
}

// Add to getSubtitles method
subtitles.push({
  id: `${imdbId}-heb-newprovider`,
  url: this.getNewProviderUrl(imdbId, type, season, episode),
  lang: 'heb',
  label: 'עברית (NewProvider)',
  provider: 'newprovider'
});
```

## Troubleshooting

### No Subtitles Returned

**Possible Causes:**
1. Invalid IMDB ID format
2. Content not available in providers
3. Network connectivity issues
4. Provider websites down

**Solutions:**
- Verify IMDB ID: should be `tt` followed by digits
- Try different providers
- Check network connectivity
- Wait and retry if providers are temporarily down

### Wrong Language Subtitles

**Solution:**
Specify the language parameter:
```bash
curl "http://localhost:7000/subtitles/movie/tt0111161?lang=eng"
```

### Cache Issues

**Solution:**
The cache automatically expires after 1 hour. To manually clear:
```javascript
subtitleService.clearCache();
```

## API Client Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function getHebrewSubtitles(imdbId, type, season, episode) {
  const url = `http://localhost:7000/subtitles/${type}/${imdbId}`;
  const params = {};
  
  if (season) params.season = season;
  if (episode) params.episode = episode;
  params.lang = 'heb';
  
  const response = await axios.get(url, { params });
  return response.data.subtitles;
}

// Usage
const subs = await getHebrewSubtitles('tt0111161', 'movie');
console.log(subs);
```

### Python

```python
import requests

def get_hebrew_subtitles(imdb_id, content_type, season=None, episode=None):
    url = f"http://localhost:7000/subtitles/{content_type}/{imdb_id}"
    
    params = {'lang': 'heb'}
    if season:
        url += f"/{season}"
    if episode:
        url += f"/{episode}"
    
    response = requests.get(url, params=params)
    return response.json()['subtitles']

# Usage
subs = get_hebrew_subtitles('tt0111161', 'movie')
print(subs)
```

### cURL

```bash
# Simple movie subtitle request
curl "http://localhost:7000/subtitles/movie/tt0111161"

# Series episode with season and episode
curl "http://localhost:7000/subtitles/series/tt0903747/1/1"

# English subtitles instead of Hebrew
curl "http://localhost:7000/subtitles/movie/tt0111161?lang=eng"

# Pretty print JSON
curl "http://localhost:7000/subtitles/movie/tt0111161" | python3 -m json.tool
```

## Best Practices

1. **Cache Results**: The service caches automatically, but consider client-side caching too
2. **Handle Empty Results**: Always check if `count > 0` before using subtitles
3. **Provide Fallbacks**: If Hebrew subtitles not found, try English
4. **Use IMDB IDs**: Always use standard IMDB format (`tt1234567`)
5. **Error Handling**: Wrap API calls in try-catch blocks

## Future Enhancements

Planned improvements:
- Direct subtitle file download
- Subtitle format conversion (SRT, VTT, ASS)
- OpenSubtitles API v2 integration
- Automatic subtitle selection based on video hash
- Subtitle synchronization tools

## See Also

- [Anime Support Documentation](./ANIME-SUPPORT.md)
- [API Reference](../README.md#api-endpoints)
- [Subtitle Service Source](../src/services/subtitleService.js)
