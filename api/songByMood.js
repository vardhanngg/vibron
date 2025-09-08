const axios = require('axios');
const { PLAYLIST_SEARCH_ENDPOINT, PLAYLIST_SONGS_ENDPOINT, SEARCH_ENDPOINT } = require('../public/config');

let lastPlaylistId = null;

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const { mood } = req.query;
    if (!mood || typeof mood !== 'string') {
      console.error('[server] Invalid or missing mood parameter:', mood);
      return res.status(400).json({ error: 'Mood is required and must be a string' });
    }

    console.log(`[server] Searching playlists for mood: ${mood}`);
    // Step 1: Fetch playlists from multiple pages
    const maxPages = 3;
    let allPlaylists = [];
    for (let page = 0; page < maxPages; page++) {
      try {
        const searchRes = await axios.get(`${PLAYLIST_SEARCH_ENDPOINT}?query=${encodeURIComponent(mood)}&page=${page}&limit=50`);
        if (!searchRes.data || searchRes.data.success === false) {
          console.error(`[server] Playlist search API returned error on page ${page}: ${JSON.stringify(searchRes.data.error || searchRes.data)}`);
          break;
        }
        if (!Array.isArray(searchRes.data.data?.results)) {
          console.error(`[server] Invalid playlist search response structure on page ${page}: ${JSON.stringify(searchRes.data)}`);
          break;
        }
        allPlaylists = allPlaylists.concat(searchRes.data.data.results);
        if (searchRes.data.data.results.length < 50) break; // Stop if fewer results than limit
      } catch (apiErr) {
        console.error(`[server] Playlist search API error on page ${page}: ${apiErr.message}`);
        break;
      }
    }

    if (allPlaylists.length === 0) {
      console.log(`[server] No playlists found for query: ${mood}`);
      throw new Error('No playlists found for this mood');
    }

    // Step 2: Select top 3 playlists, avoiding last played
    function getRandomPlaylists(playlists, lastId, count) {
      const filtered = playlists.filter(p => p.id !== lastId);
      if (filtered.length === 0) return playlists.slice(0, count);
      return filtered.sort(() => Math.random() - 0.5).slice(0, count);
    }

    const selectedPlaylists = getRandomPlaylists(allPlaylists, lastPlaylistId, 3);
    if (selectedPlaylists.length === 0) {
      console.error('[server] No valid playlists selected');
      throw new Error('No valid playlists available');
    }
    lastPlaylistId = selectedPlaylists[0].id; // Update lastPlaylistId to first selected

    // Step 3: Fetch songs from selected playlists with pagination
    let allSongs = [];
    for (const playlist of selectedPlaylists) {
      const playlistId = playlist.id;
      if (!playlistId) {
        console.error('[server] Selected playlist missing ID:', playlist);
        continue;
      }
      console.log(`[server] Fetching songs for playlist ID: ${playlistId}, Name: ${playlist.name}`);
      for (let page = 0; page < 3; page++) {
        try {
          const playlistRes = await axios.get(`${PLAYLIST_SONGS_ENDPOINT}?id=${encodeURIComponent(playlistId)}&page=${page}&limit=50`);
          if (!playlistRes.data || playlistRes.data.success === false) {
            console.error(`[server] Playlist songs API returned error for ID ${playlistId}, page ${page}: ${JSON.stringify(playlistRes.data.message || playlistRes.data)}`);
            break;
          }
          const songs = playlistRes.data.data?.songs || [];
          if (!Array.isArray(songs)) {
            console.error(`[server] Invalid playlist songs response structure for ID ${playlistId}, page ${page}: ${JSON.stringify(playlistRes.data)}`);
            break;
          }
          allSongs = allSongs.concat(songs);
          if (songs.length < 50) break; // Stop if fewer songs than limit
        } catch (apiErr) {
          console.error(`[server] Playlist songs API error for ID ${playlistId}, page ${page}: ${apiErr.message}`);
          break;
        }
      }
    }

    if (allSongs.length === 0) {
      console.log(`[server] No songs found in selected playlists`);
      throw new Error('No songs found in selected playlists');
    }

    // Step 4: Format the response
    res.status(200).json({
      songs: {
        results: allSongs.map(song => ({
          id: song.id || 'unknown',
          title: song.name || song.title || 'Unknown',
          artist: Array.isArray(song.artists?.primary)
            ? song.artists.primary.map(artist => artist.name || 'Unknown').join(', ')
            : typeof song.artists?.primary === 'string'
              ? song.artists.primary
              : 'Unknown',
          image: song.image?.find(img => img.quality === '500x500')?.url
            || song.image?.[0]?.url
            || song.image?.[0]?.link
            || null,
          audioUrl: song.downloadUrl?.find(url => url.quality === '320kbps')?.url
            || song.downloadUrl?.find(url => url.quality === '320kbps')?.link
            || song.downloadUrl?.[0]?.url
            || song.downloadUrl?.[0]?.link
            || song.url
            || null,
        })),
        playlist: {
          id: selectedPlaylists[0].id,
          name: selectedPlaylists[0].name || 'Unknown',
          image: selectedPlaylists[0].image?.find(img => img.quality === '500x500')?.url
            || selectedPlaylists[0].image?.[0]?.url
            || selectedPlaylists[0].image?.[0]?.link
            || null,
        }
      }
    });
  } catch (err) {
    console.error('[server] songByMood error:', err.message);
    // Fallback to JioSaavn with pagination
    try {
      console.log(`[server] Falling back to JioSaavn for query: ${mood}`);
      let allSongs = [];
      for (let page = 0; page < 3; page++) {
        const fallbackRes = await axios.get(`${SEARCH_ENDPOINT}?query=${encodeURIComponent(mood)}&page=${page}&limit=50`);
        if (!fallbackRes.data || !Array.isArray(fallbackRes.data.data?.results)) {
          console.error(`[server] Invalid JioSaavn response on page ${page}: ${JSON.stringify(fallbackRes.data)}`);
          break;
        }
        allSongs = allSongs.concat(fallbackRes.data.data.results);
        if (fallbackRes.data.data.results.length < 50) break;
      }
      if (allSongs.length === 0) {
        throw new Error('No songs found in fallback search');
      }

      res.status(200).json({
        songs: {
          results: allSongs.map(song => ({
            id: song.id || 'unknown',
            title: song.name || song.title || 'Unknown',
            artist: typeof song.primaryArtists === 'string'
              ? song.primaryArtists
              : Array.isArray(song.primaryArtists)
                ? song.primaryArtists.join(', ')
                : Array.isArray(song.artists?.primary)
                  ? song.artists.primary.map(a => a.name || 'Unknown').join(', ')
                  : 'Unknown',
            image: song.image?.find(img => img.quality === '500x500')?.url
              || song.image?.find(img => img.quality === '500x500')?.link
              || song.image?.[2]?.link
              || song.image?.[0]?.url
              || null,
            audioUrl: song.downloadUrl?.find(url => url.quality === '320kbps')?.link
              || song.downloadUrl?.find(url => url.quality === '320kbps')?.url
              || song.downloadUrl?.[0]?.link
              || song.downloadUrl?.[0]?.url
              || song.url
              || null,
          })),
          playlist: null // No playlist info in fallback
        }
      });
    } catch (fallbackErr) {
      console.error('[server] JioSaavn fallback error:', fallbackErr.message);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }
};
