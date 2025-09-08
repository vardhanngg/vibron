const axios = require('axios');

module.exports = async function handler(req, res) {
  const q = req.query.q?.trim().replace(/[<>"'&]/g, "") || "";
  if (!q) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  try {
    console.log(`[server] Searching JioSaavn for: ${q}`);
    const response = await axios.get(`https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(q)}`);
    const songs = response.data.data?.results || [];
    if (songs.length === 0) {
      return res.status(404).json({ error: "No songs found" });
    }

    res.status(200).json({
      songs: {
        results: songs.map(song => ({
          id: song.id,
          title: song.name,
          artist: typeof song.primaryArtists === 'string' ? song.primaryArtists : song.primaryArtists?.join(", ") || "Unknown",
          image: song.image?.[2]?.link || null,
          audioUrl: song.downloadUrl?.find(url => url.quality === '320kbps')?.link || song.downloadUrl?.[0]?.link || null,
        }))
      }
    });
  } catch (err) {
    console.error(`[server] JioSaavn search error: ${err.message}`);
    res.status(500).json({ error: "JioSaavn search failed", details: err.message });
  }
};
