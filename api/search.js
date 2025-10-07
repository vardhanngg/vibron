const axios = require('axios');

module.exports = async function handler(req, res) {
  const q = req.query.q?.trim().replace(/[<>"'&]/g, "") || "";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  if (!q) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  try {
    console.log(`[server] Searching JioSaavn for: ${q}, page: ${page}, limit: ${limit}`);

    // Helper to safely get image URL (handles nested quality array or flat string)
    const getImageUrl = (item) => {
      if (!item?.image) return null;
      if (typeof item.image === 'string') return item.image;  // Legacy flat
      if (Array.isArray(item.image) && item.image.length >= 3) {
        // Detailed: Prefer 500x500 (index 2), use .url or .link
        const highRes = item.image[2];
        return highRes?.url || highRes?.link || null;
      }
      return item.image[0]?.url || item.image[0]?.link || null;  // Fallback to first
    };

    // Helper to get audio URL (for songs only)
    const getAudioUrl = (song) => {
      if (!song?.downloadUrl) return null;
      if (Array.isArray(song.downloadUrl)) {
        // Detailed: Find 320kbps, use .url or .link
        const highQuality = song.downloadUrl.find(url => url.quality === '320kbps');
        if (highQuality) return highQuality.url || highQuality.link || null;
        return song.downloadUrl[0]?.url || song.downloadUrl[0]?.link || null;
      }
      return song.downloadUrl;  // Legacy flat
    };

    // Helper to get primary artist(s)
    const getPrimaryArtists = (item) => {
      // Detailed song: From artists.primary
      if (item.artists?.primary?.length > 0) {
        return item.artists.primary.map(a => a.name).join(', ');
      }
      // Album/legacy: primaryArtists string or array
      if (typeof item.primaryArtists === 'string') return item.primaryArtists;
      if (Array.isArray(item.primaryArtists)) return item.primaryArtists.map(a => a.name || a).join(', ');
      return 'Unknown';
    };

    // Make parallel API calls for songs, artists, and albums
    const [songResponse, artistResponse, albumResponse] = await Promise.all([
      //axios.get(`https://apivibron.vercel.app/api/search/songs?query=${encodeURIComponent(q)}`)
      axios.get(`https://apivibron.vercel.app/api/search/songs?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`)
        .catch(() => ({ data: { results: [], total: 0, start: 0 } })),  // Flatten path for safety
    //  axios.get(`https://apivibron.vercel.app/api/search/artists?query=${encodeURIComponent(q)}`)
    axios.get(`https://apivibron.vercel.app/api/search/artists?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`)    
    .catch(() => ({ data: { results: [], total: 0, start: 0 } })),
   //   axios.get(`https://apivibron.vercel.app/api/search/albums?query=${encodeURIComponent(q)}`)
   axios.get(`https://apivibron.vercel.app/api/search/albums?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`)     
   .catch(() => ({ data: { results: [], total: 0, start: 0 } }))
    ]);

    // Safer extraction: Handle single vs double 'data' nesting
    const getData = (response, section) => {
      let data = response.data;
      if (data?.data) data = data.data;  // Double-nested (apivibron wrapper)
      if (data?.[section]) data = data[section];  // If sectioned
      return {
        results: data?.results || [],
        total: data?.total || 0,
        start: data?.start || 0
      };
    };

    const songData = getData(songResponse, 'songs');
    const artistData = getData(artistResponse, 'artists');
    const albumData = getData(albumResponse, 'albums');

    const { results: songs, total: songTotal, start: songStart } = songData;
    const { results: artists, total: artistTotal, start: artistStart } = artistData;
    const { results: albums, total: albumTotal, start: albumStart } = albumData;

    // Check if any results were found
    if (songs.length === 0 && artists.length === 0 && albums.length === 0) {
      return res.status(404).json({ error: "No results found" });
    }

    // Server-side pagination
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;

    res.status(200).json({
      songs: {
        results: songs.slice(startIdx, endIdx).map(song => ({
          id: song.id,
          title: song.name || song.title || 'Unknown',
          artist: getPrimaryArtists(song),
          image: getImageUrl(song),
          audioUrl: getAudioUrl(song),
        })),
        next: (startIdx + limit < songTotal) ? page + 1 : null  // Fixed: Use total, not fetched length
      },
      artists: {
        results: artists.slice(startIdx, endIdx).map(artist => ({
          id: artist.id,
          name: artist.name,
          url: artist.url,
          image: getImageUrl(artist),
          role: artist.role,
          isRadioPresent: artist.isRadioPresent
        })),
        next: (startIdx + limit < artistTotal) ? page + 1 : null
      },
      albums: {
        results: albums.slice(startIdx, endIdx).map(album => ({
          id: album.id,
          title: album.name || album.title || 'Unknown',
          year: album.year,
          language: album.language,
          songCount: album.songCount || 0,
          url: album.url,
          image: getImageUrl(album),
          primaryArtists: getPrimaryArtists(album)  // Reuse helper
        })),
        next: (startIdx + limit < albumTotal) ? page + 1 : null
      }
    });
  } catch (err) {
    console.error(`[server] JioSaavn search error: ${err.message}`, err.response?.data);  // More logging
    res.status(500).json({ error: "JioSaavn search failed" });
  }
};