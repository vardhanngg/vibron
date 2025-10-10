const axios = require('axios');

async function fetchLyrics(title, artist = "") {
  try {
    const res = await axios.get(`https://apilyrics-theta.vercel.app/v2/musixmatch/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
    if (res.status === 200 && res.data?.data?.lyrics) {
      return res.data.data.lyrics;
    }
    return null;
  } catch (error) {
    console.error(`Lyrics fetch error for ${title} by ${artist}:`, error.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  // ... your existing playlist/song fetching code ...

  // After getting `allSongs` (array), add lyrics to each song or to a few songs only:
  const songsWithLyrics = await Promise.all(
    allSongs.map(async (song) => {
      const artistName = Array.isArray(song.artists?.primary)
        ? song.artists.primary.map(a => a.name).join(', ')
        : song.artists?.primary || "Unknown";

      const lyrics = await fetchLyrics(song.name || song.title, artistName);

      return {
        ...song,
        lyrics: lyrics || "Lyrics not found",
      };
    })
  );

  // Respond with songs that include lyrics
  res.status(200).json({
    songs: {
      results: songsWithLyrics.map(song => ({
        id: song.id || 'unknown',
        title: song.name || song.title || 'Unknown',
        artist: Array.isArray(song.artists?.primary)
          ? song.artists.primary.map(artist => artist.name || 'Unknown').join(', ')
          : typeof song.artists?.primary === 'string'
            ? song.artists.primary
            : 'Unknown',
        image: song.image?.find(img => img.quality === '500x500')?.url
          || song.image?.[0]?.url
          || null,
        audioUrl: song.downloadUrl?.find(url => url.quality === '320kbps')?.url
          || song.downloadUrl?.[0]?.url
          || song.url
          || null,
        lyrics: song.lyrics
      })),
      playlist: {
        id: selectedPlaylists[0].id,
        name: selectedPlaylists[0].name || 'Unknown',
        image: selectedPlaylists[0].image?.find(img => img.quality === '500x500')?.url
          || selectedPlaylists[0].image?.[0]?.url
          || null,
      }
    }
  });
};
