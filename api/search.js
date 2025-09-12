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

    // Make parallel API calls for songs, artists, and albums
    const [songResponse, artistResponse, albumResponse] = await Promise.all([
      axios.get(`https://apivibron.vercel.app/api/search/songs?query=${encodeURIComponent(q)}`)
        .catch(() => ({ data: { data: { results: [], total: 0, start: 0 } } })),
      axios.get(`https://apivibron.vercel.app/search/api/artists?query=${encodeURIComponent(q)}`)
        .catch(() => ({ data: { data: { results: [], total: 0, start: 0 } } })),
      axios.get(`https://apivibron.vercel.app/search/api/albums?query=${encodeURIComponent(q)}`)
        .catch(() => ({ data: { data: { results: [], total: 0, start: 0 } } }))
    ]);

    const songs = songResponse.data.data?.results || [];
    const artists = artistResponse.data.data?.results || [];
    const albums = albumResponse.data.data?.results || [];
    const songTotal = songResponse.data.data?.total || 0;
    const artistTotal = artistResponse.data.data?.total || 0;
    const albumTotal = albumResponse.data.data?.total || 0;
    const songStart = songResponse.data.data?.start || 0;
    const artistStart = artistResponse.data.data?.start || 0;
    const albumStart = albumResponse.data.data?.start || 0;

    // Check if any results were found
    if (songs.length === 0 && artists.length === 0 && albums.length === 0) {
      return res.status(404).json({ error: "No results found" });
    }

    // Server-side pagination
    const start = (page - 1) * limit;
    const end = start + limit;

    res.status(200).json({
      songs: {
        results: songs.slice(start, end).map(song => ({
          id: song.id,
          title: song.name,
          artist: typeof song.primaryArtists === 'string' ? song.primaryArtists : song.primaryArtists?.join(", ") || "Unknown",
          image: song.image?.[2]?.link || null,
          audioUrl: song.downloadUrl?.find(url => url.quality === '320kbps')?.link || song.downloadUrl?.[0]?.link || null,
        })),
        next: songStart + songs.length < songTotal ? page + 1 : null
      },
      artists: {
        results: artists.slice(start, end).map(artist => ({
          id: artist.id,
          name: artist.name,
          url: artist.url,
          image: artist.image?.[2]?.link || null,
          role: artist.role,
          isRadioPresent: artist.isRadioPresent
        })),
        next: artistStart + artists.length < artistTotal ? page + 1 : null
      },
      albums: {
        results: albums.slice(start, end).map(album => ({
          id: album.id,
          title: album.name,
          year: album.year,
          language: album.language,
          songCount: album.songCount,
          url: album.url,
          image: album.image?.[2]?.link || null,
          primaryArtists: typeof album.primaryArtists === 'string' ? album.primaryArtists : album.primaryArtists?.map(a => a.name).join(", ") || "Unknown"
        })),
        next: albumStart + albums.length < albumTotal ? page + 1 : null
      }
    });
  } catch (err) {
    console.error(`[server] JioSaavn search error: ${err.message}`);
    res.status(500).json({ error: "JioSaavn search failed" });
  }
};