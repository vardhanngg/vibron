/* =================== */
/* State */
let songHistory = JSON.parse(localStorage.getItem('songHistory') || '[]');
let currentSongIndex = parseInt(localStorage.getItem('currentSongIndex') || '-1');
let queue = JSON.parse(localStorage.getItem('queue') || '[]');
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let playlists = JSON.parse(localStorage.getItem('playlists') || '[]');
let currentArtistId = '';
let artistPage = 0;

const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('song-list');
const libraryView = document.getElementById('library-view');
const audioPlayer = document.getElementById('audio-player');
const albumArt = document.getElementById('album-art');
const nowPlaying = document.getElementById('now-playing');
const artistName = document.getElementById('artist-name');
const moreBtn = document.getElementById('more');
const queueList = document.getElementById('queue-list');
const playerBar = document.getElementById('player-bar');
const playPauseBtn = document.getElementById('play-pause-btn');
const loopBtn = document.getElementById('loop-btn');
const queueContainer = document.getElementById('queue-container');
const sidebar = document.getElementById('sidebar');

let currentQuery = '';
let currentPage = 0;
let isPlaying = false;

/* =================== */
/* Greeting */
function setGreeting() {
  const greetingElement = document.getElementById('greeting');
  const hour = new Date().getHours();
  let greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  greetingElement.textContent = greeting;
}

/* =================== */
/* Home Content */
async function loadHomeContent() {
  document.getElementById('home-content').style.display = 'block';
  resultsList.style.display = 'none';
  libraryView.style.display = 'none';
  moreBtn.style.display = 'none';

  await Promise.all([
    loadListenAgain(),
    //loadTrending(),
    //loadTopCharts(),
    //loadNewReleases()
  ]);
}

async function loadListenAgain() {
  const sectionList = document.querySelector('#listen-again .section-list');
  sectionList.innerHTML = '';

  // Filter songs that have been played (have lastPlayed timestamp)
  const recentSongs = [...new Set(songHistory.filter(s => s.lastPlayed).map(s => s.id))]
    .slice(-4) // Get the last 4 unique songs
    .map(id => songHistory.find(s => s.id === id))
    .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed)); // Sort by most recent playback

  if (recentSongs.length) {
    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';
    recentSongs.forEach(song => {
      const card = createSongCard(song);
      cards.appendChild(card);
    });
    container.appendChild(cards);
    sectionList.appendChild(container);
  } else {
    sectionList.innerHTML = '<span>No recently played songs.</span>';
  }
}

async function loadTrending() {
  const sectionList = document.querySelector('#trending .section-list');
  sectionList.innerHTML = '<span>Loading trending songs...</span>';
  try {
    const queries = ['trending songs', 'top hits', 'popular songs', 'top 50', 'english top songs'];
    let data = null;
    for (const query of queries) {
      const response = await fetch(`https://apivibron.vercel.app/api/search?q=${encodeURIComponent(query)}&limit=8`);
      if (!response.ok) continue;
      const result = await response.json();
      if (result.success !== false && (result.songs?.results?.length > 0 || result.albums?.results?.length > 0)) {
        data = result;
        break;
      }
    }
    if (!data || (!data.songs?.results?.length && !data.albums?.results?.length)) {
      sectionList.innerHTML = '<span>No trending songs found. Try searching!</span>';
      return;
    }

    const items = data.songs?.results || data.albums?.results || [];
    sectionList.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';
    items.forEach(item => {
      const normalizedItem = normalizeSong(item);
      if (!songHistory.some(s => s.id === normalizedItem.id)) {
        songHistory.push(normalizedItem);
      }
      const card = createSongCard(normalizedItem);
      cards.appendChild(card);
    });
    container.appendChild(cards);
    sectionList.appendChild(container);
  } catch (err) {
    sectionList.innerHTML = '<span>Error loading trending songs. Try searching!</span>';
    console.error('Error fetching trending:', err);
  }
}

async function loadTopCharts() {
  const sectionList = document.querySelector('#top-charts .section-list');
  sectionList.innerHTML = '<span>Loading top charts...</span>';
  try {
    const queries = ['top charts', 'trending playlists', 'top english playlists', 'top 50', 'weekly top songs'];
    let data = null;
    for (const query of queries) {
      const response = await fetch(`https://apivibron.vercel.app/api/search?q=${encodeURIComponent(query)}&limit=6`);
      if (!response.ok) continue;
      const result = await response.json();
      if (result.success !== false && (result.playlists?.results?.length > 0 || result.songs?.results?.length > 0 || result.albums?.results?.length > 0)) {
        data = result;
        break;
      }
    }
    if (!data || (!data.playlists?.results?.length && !data.songs?.results?.length && !data.albums?.results?.length)) {
      sectionList.innerHTML = '<span>No top charts found. Try searching!</span>';
      return;
    }

    let items = data.playlists?.results || data.songs?.results || data.albums?.results || [];
    sectionList.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      const normalizedItem = normalizeSong(item);
      card.innerHTML = `
        <img src="${item.image?.[2]?.url || item.image || 'default.png'}" alt="${item.title}" />
        <div class="card-body">
          <div class="song-name">${item.title}</div>
          <div class="artist-name">${item.primaryArtists || item.language || 'Various'}</div>
        </div>
        <div class="play-down">
          <div class="play-btn" onclick="event.stopPropagation(); searchInput.value = '${item.title}'; searchSongs();"><i class="fa-solid fa-play"></i></div>
        </div>
      `;
      card.addEventListener('click', () => {
        searchInput.value = item.title;
        searchSongs();
      });
      cards.appendChild(card);
    });
    container.appendChild(cards);
    sectionList.appendChild(container);
  } catch (err) {
    sectionList.innerHTML = '<span>Error loading top charts. Try searching!</span>';
    console.error('Error fetching top charts:', err);
  }
}

/*async function loadNewReleases() {
  const sectionList = document.querySelector('#new-releases .section-list');
  sectionList.innerHTML = '<span>Loading new releases...</span>';
  try {
    const queries = ['new releases', 'latest albums', 'new english songs', 'latest songs', 'new hindi songs'];
    let data = null;
    for (const query of queries) {
      const response = await fetch(`https://apivibron.vercel.app/api/search?q=${encodeURIComponent(query)}&limit=6`);
      if (!response.ok) continue;
      const result = await response.json();
      if (result.success !== false && (result.albums?.results?.length > 0 || result.songs?.results?.length > 0)) {
        data = result;
        break;
      }
    }
    if (!data || (!data.albums?.results?.length && !data.songs?.results?.length)) {
      sectionList.innerHTML = '<span>No new releases found. Try searching!</span>';
      return;
    }

    let items = data.albums?.results || data.songs?.results || [];
    sectionList.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      const normalizedItem = normalizeSong(item);
      card.innerHTML = `
        <img src="${item.image?.[2]?.url || item.image || 'default.png'}" alt="${item.title}" />
        <div class="card-body">
          <div class="song-name">${item.title}</div>
          <div class="artist-name">${item.primaryArtists || 'Various'}</div>
        </div>
        <div class="play-down">
          <div class="play-btn" onclick="event.stopPropagation(); fetchAlbumSongs('${item.id}', '${item.title}')"><i class="fa-solid fa-play"></i></div>
        </div>
      `;
      card.addEventListener('click', () => fetchAlbumSongs(item.id, item.title));
      cards.appendChild(card);
    });
    container.appendChild(cards);
    sectionList.appendChild(container);
  } catch (err) {
    sectionList.innerHTML = '<span>Error loading new releases. Try searching!</span>';
    console.error('Error fetching new releases:', err);
  }
}*/

async function fetchPlaylistSongs(playlistId, playlistTitle) {
  try {
    const response = await fetch(`https://apivibron.vercel.app/api/search?q=${encodeURIComponent(playlistTitle)}&limit=10`);
    if (!response.ok) throw new Error(`Playlist fetch failed: ${response.statusText}`);
    const data = await response.json();
    const songs = data.songs?.results || data.playlists?.results?.find(p => p.id === playlistId)?.songs || [];

    resultsList.innerHTML = '';
    libraryView.style.display = 'none';
    searchInput.value = `Songs from ${playlistTitle}`;
    moreBtn.style.display = 'none';

    if (songs.length) {
      const container = document.createElement('div');
      container.className = 'song-container';
      const cards = document.createElement('div');
      cards.className = 'cards';
      songs.forEach(song => {
        const normalizedSong = normalizeSong(song);
        if (!songHistory.some(s => s.id === normalizedSong.id)) {
          songHistory.push(normalizedSong);
        }
        const card = createSongCard(normalizedSong);
        cards.appendChild(card);
      });
      container.appendChild(cards);
      resultsList.appendChild(container);
    } else {
      resultsList.innerHTML = '<span>No songs found in this playlist.</span>';
    }
    resultsList.style.display = 'block';
    saveState();
  } catch (err) {
    resultsList.innerHTML = '<span>Error loading playlist songs.</span>';
    console.error('Error fetching playlist songs:', err);
  }
}

function normalizeSong(song) {
  return {
    id: song.id || song.encrypted_id || 'unknown',
    title: song.name || song.title || 'Unknown',
    artist: Array.isArray(song.artists?.primary)
      ? song.artists.primary.map(a => a.name).join(', ')
      : (song.primaryArtists || song.artist || 'Unknown'),
    image: Array.isArray(song.image) && song.image.length
      ? (song.image.find(img => img.quality === '500x500')?.url || song.image[song.image.length - 1]?.url || 'default.png')
      : (song.image || 'default.png'),
    audioUrl: Array.isArray(song.downloadUrl)
      ? (song.downloadUrl.find(url => url.quality === '320kbps' || url.bitrate === '320')?.url || song.downloadUrl[0]?.url || '')
      : (song.audioUrl || song.media_url || song.url || '')
  };
}

function createSongCard(song) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <img src="${song.image || 'default.png'}" alt="${song.title}" />
    <div class="card-body">
      <div class="song-name">${song.title}</div>
      <div class="artist-name">${song.artist}</div>
    </div>
    <div class="play-down">
      <div class="play-btn" onclick="event.stopPropagation(); playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, true)"><i class="fa-solid fa-play"></i></div>
      <div class="queue-btn" onclick="event.stopPropagation(); addToQueue('${song.id}')"><i class="fa-solid fa-plus"></i></div>
      <div class="add-fav${favorites.some(f => f.id === song.id) ? ' favorited' : ''}" onclick="event.stopPropagation(); addToFavorites('${song.id}')"><i class="fa-solid fa-heart"></i></div>
      <div class="download-btn" onclick="event.stopPropagation(); downloadSong('${song.id}')"><i class="fa-solid fa-download"></i></div>
    </div>
  `;
  card.addEventListener('click', () => playSong(song, true));
  return card;
}

/* =================== */
/* Download Functions */
function downloadSong(songId) {
  const song = songHistory.find(s => s.id === songId);
  if (song && song.audioUrl) {
    fetch(song.audioUrl, { mode: 'cors' })
      .then(response => {
        if (!response.ok) throw new Error(`Failed to fetch song: ${response.statusText}`);
        return response.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${song.title} - ${song.artist}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showNotification(`Downloading ${song.title}`);
      })
      .catch(err => {
        console.error('Download error:', err);
        showNotification('Download failed. Please try again.');
      });
  } else {
    showNotification('Download unavailable for this song.');
  }
}

function downloadPlaylist(songs, playlistName) {
  if (!songs.length) {
    showNotification('No songs to download.');
    return;
  }
  const zip = new JSZip();
  Promise.all(
    songs.map((song, index) =>
      fetch(song.audioUrl, { mode: 'cors' })
        .then(response => {
          if (!response.ok) throw new Error(`Failed to fetch ${song.title}`);
          return response.blob();
        })
        .then(blob => zip.file(`${index + 1}. ${song.title} - ${song.artist}.mp3`, blob))
        .catch(err => console.error(`Failed to fetch ${song.title}:`, err))
    )
  ).then(() => {
    zip.generateAsync({ type: 'blob' }).then(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${playlistName || 'Favorites'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification(`Downloading ${playlistName || 'Favorites'}`);
    });
  }).catch(err => {
    showNotification('Error downloading playlist.');
    console.error('Playlist download error:', err);
  });
}

/* =================== */
/* Initialization */
window.addEventListener('load', () => {
  setGreeting();
  loadHomeContent();
  renderQueue();

  if (currentSongIndex >= 0 && songHistory[currentSongIndex]) {
    loadSongWithoutPlaying(songHistory[currentSongIndex]);
  }

  setInterval(saveState, 5000);

  // Progress and volume handling
  audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    document.getElementById('progress').style.width = `${percentage}%`;
    document.getElementById('progress-circle').style.left = `calc(${percentage}% - 6px)`;
    document.getElementById('current-time').textContent = formatTime(audioPlayer.currentTime);
    document.getElementById('duration').textContent = formatTime(audioPlayer.duration);
  });

  document.querySelector('.player-progress').addEventListener('click', (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;
  });

  const volumeSlider = document.getElementById('volume-slider');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      audioPlayer.volume = parseFloat(volumeSlider.value) / 100;
    });
  }

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
});

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* =================== */
/* Save State */
function saveState() {
  localStorage.setItem('songHistory', JSON.stringify(songHistory));
  localStorage.setItem('currentSongIndex', currentSongIndex.toString());
  localStorage.setItem('queue', JSON.stringify(queue));
  localStorage.setItem('favorites', JSON.stringify(favorites));
  localStorage.setItem('playlists', JSON.stringify(playlists));
}

/* =================== */
/* Search & Fetch */
async function searchSongs() {
  const query = searchInput.value.trim();
  if (!query) return;

  currentQuery = query;
  searchSongsPage = 0;
  searchArtistsPage = 0;
  searchAlbumsPage = 0;
  resultsList.innerHTML = '';
  libraryView.style.display = 'none';
  document.getElementById('home-content').style.display = 'none';
  resultsList.style.display = 'block';

  await fetchResults();
}

async function fetchResults() {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}&limit=10`);
    if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);

    const data = await response.json();

    if (!data.songs?.results?.length && !data.artists?.results?.length && !data.albums?.results?.length) {
      moreBtn.style.display = 'none';
      resultsList.innerHTML = '<span>No results found.</span>';
      return;
    }

    displayResults(data);
    moreBtn.style.display = data.songs.next || data.artists.next || data.albums.next ? 'block' : 'none';
    currentPage++;
  } catch (err) {
    moreBtn.style.display = 'none';
    resultsList.innerHTML = '<span>Error loading results.</span>';
    console.error('Error fetching results:', err);
  }
}

async function fetchArtistSongs(artistId, artistName, page = 0, append = false) {
  try {
    // Assume API supports pagination like search (adjust if needed)
    const response = await fetch(`https://apivibron.vercel.app/api/artists/${artistId}/songs?page=${page}&limit=10`);
    if (!response.ok) throw new Error(`Artist fetch failed: ${response.statusText}`);

    const data = await response.json();
    const songs = data.data?.songs || [];

    if (!append) {
      resultsList.innerHTML = '';
      libraryView.style.display = 'none';
      document.getElementById('home-content').style.display = 'none';
      searchInput.value = `Songs by ${artistName}`;
      moreBtn.style.display = 'none'; // Hide global load more
      resultsList.style.display = 'block';
      currentArtistId = artistId;
      artistPage = page;
    }

    let cards;
    if (!append) {
      // Add header for new load
      const titleHeader = document.createElement('h3');
      titleHeader.textContent = `Songs by ${artistName}`;
      resultsList.appendChild(titleHeader);

      const container = document.createElement('div');
      container.className = 'song-container';
      cards = document.createElement('div');
      cards.className = 'cards';
      container.appendChild(cards);
      resultsList.appendChild(container);
    } else {
      // Append to existing cards
      cards = resultsList.querySelector('.cards');
    }

    // Remove existing "Load More" button if any
    const existingMoreBtn = document.getElementById('artist-more-btn');
    if (existingMoreBtn) existingMoreBtn.remove();

    songs.forEach(song => {
      const normalizedSong = normalizeSong(song);
      if (!songHistory.some(s => s.id === normalizedSong.id)) {
        songHistory.push(normalizedSong);
      }
      const card = createSongCard(normalizedSong);
      cards.appendChild(card);
    });

    // Add "Load More" button if there might be more (assuming if full limit returned)
    if (songs.length === 10) {
      const moreArtistBtn = document.createElement('button');
      moreArtistBtn.id = 'artist-more-btn';
      moreArtistBtn.className = 'load-more';
      moreArtistBtn.textContent = 'Load More Songs';
      moreArtistBtn.onclick = loadMoreArtistSongs;
      resultsList.appendChild(moreArtistBtn);
    }

    saveState();
  } catch (err) {
    resultsList.innerHTML = '<span>Error loading artist songs.</span>';
    console.error('Error fetching artist songs:', err);
  }
}

async function fetchAlbumSongs(albumId, albumTitle) {
  try {
    const response = await fetch(`https://apivibron.vercel.app/api/albums?id=${encodeURIComponent(albumId)}`);
    if (!response.ok) throw new Error(`Album fetch failed: ${response.statusText}`);

    const data = await response.json();
    if (!data.success) throw new Error('API returned success: false');

    const songs = data.data?.songs || [];

    resultsList.innerHTML = '';
    libraryView.style.display = 'none';
    document.getElementById('home-content').style.display = 'none';
    searchInput.value = `Songs from ${albumTitle}`;
    moreBtn.style.display = 'none'; // Hide global load more
    resultsList.style.display = 'block';

    // Add header and download button
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '1rem';

    const titleHeader = document.createElement('h3');
    titleHeader.textContent = `Songs from ${albumTitle}`;
    header.appendChild(titleHeader);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'playlist-download-btn'; // Reuse styling from playlists
    downloadBtn.textContent = 'Download Album';
    downloadBtn.disabled = songs.length === 0;
    downloadBtn.onclick = () => downloadPlaylist(songs.map(normalizeSong), albumTitle);
    header.appendChild(downloadBtn);

    resultsList.appendChild(header);

    if (songs.length) {
      const container = document.createElement('div');
      container.className = 'song-container';
      const cards = document.createElement('div');
      cards.className = 'cards';
      songs.forEach(song => {
        const normalizedSong = normalizeSong(song);
        if (!songHistory.some(s => s.id === normalizedSong.id)) {
          songHistory.push(normalizedSong);
        }
        const card = createSongCard(normalizedSong);
        cards.appendChild(card);
      });
      container.appendChild(cards);
      resultsList.appendChild(container);
    } else {
      resultsList.innerHTML = '<span>No songs found in this album.</span>';
    }
    saveState();
  } catch (err) {
    resultsList.innerHTML = '<span>Error loading album songs.</span>';
    console.error('Error fetching album songs:', err);
  }
}
async function loadMoreArtistSongs() {
  if (!currentArtistId) return;
  artistPage++;
  await fetchArtistSongs(currentArtistId, searchInput.value.replace('Songs by ', ''), artistPage, true); // Append mode
}

/*function loadMoreResults() {
  fetchResults();
}*/

function displayResults(data) {
  resultsList.innerHTML = '';

  if (data.songs.results.length > 0) {
    const songsHeader = document.createElement('h3');
    songsHeader.textContent = 'Songs';
    resultsList.appendChild(songsHeader);

    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';
    data.songs.results.slice(0, 4).forEach(song => {
      const normalizedSong = normalizeSong(song);
      if (!songHistory.some(s => s.id === normalizedSong.id)) {
        songHistory.push(normalizedSong);
      }
      const card = createSongCard(normalizedSong);
      cards.appendChild(card);
    });
    container.appendChild(cards);
    resultsList.appendChild(container);
  }

  if (data.artists.results.length > 0) {
    const artistsHeader = document.createElement('h3');
    artistsHeader.textContent = 'Artists';
    resultsList.appendChild(artistsHeader);

    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';
    data.artists.results.slice(0, 3).forEach(artist => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${artist.image || 'default.png'}" alt="${artist.name}" />
        <div class="card-body">
          <div class="song-name">${artist.name}</div>
          <div class="artist-name">${artist.role || 'Artist'}</div>
        </div>
        <div class="play-down">
          <div class="play-btn" onclick="event.stopPropagation(); fetchArtistSongs('${artist.id}', '${artist.name}')"><i class="fa-solid fa-play"></i></div>
        </div>
      `;
      card.addEventListener('click', () => fetchArtistSongs(artist.id, artist.name));
      cards.appendChild(card);
    });
    container.appendChild(cards);
    resultsList.appendChild(container);
  }

  if (data.albums.results.length > 0) {
    const albumsHeader = document.createElement('h3');
    albumsHeader.textContent = 'Albums';
    resultsList.appendChild(albumsHeader);

    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';
    data.albums.results.slice(0, 2).forEach(album => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${album.image || 'default.png'}" alt="${album.title}" />
        <div class="card-body">
          <div class="song-name">${album.title}</div>
          <div class="artist-name">${album.primaryArtists} (${album.year})</div>
        </div>
        <div class="play-down">
          <div class="play-btn" onclick="event.stopPropagation(); fetchAlbumSongs('${album.id}', '${album.title}')"><i class="fa-solid fa-play"></i></div>
        </div>
      `;
      card.addEventListener('click', () => fetchAlbumSongs(album.id, album.title));
      cards.appendChild(card);
    });
    container.appendChild(cards);
    resultsList.appendChild(container);
  }

  if (!data.songs.results.length && !data.artists.results.length && !data.albums.results.length) {
    resultsList.innerHTML = '<span>No results found.</span>';
  }

  saveState();
}

/* =================== */
/* Playback */
function loadSongWithoutPlaying(song) {
  currentSongIndex = songHistory.findIndex(s => s.id === song.id);
  if (currentSongIndex === -1) {
    songHistory.push(song);
    currentSongIndex = songHistory.length - 1;
  }
  audioPlayer.src = song.audioUrl;
  albumArt.src = song.image || 'default.png';
  nowPlaying.textContent = song.title;
  artistName.textContent = song.artist;
  playerBar.classList.add('playing');
  isPlaying = false;
  playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  updateFavoriteButton();
  saveState();
}

function playSong(song, fromSearch = false) {
  currentSongIndex = songHistory.findIndex(s => s.id === song.id);
  if (currentSongIndex === -1) {
    songHistory.push({ ...song, lastPlayed: new Date().toISOString() });
    currentSongIndex = songHistory.length - 1;
  } else {
    songHistory[currentSongIndex] = { ...songHistory[currentSongIndex], lastPlayed: new Date().toISOString() };
  }

  audioPlayer.src = song.audioUrl;
  audioPlayer.play().catch(() => {});

  albumArt.src = song.image || 'default.png';
  nowPlaying.textContent = song.title;
  artistName.textContent = song.artist;

  playerBar.classList.add('playing');
  isPlaying = true;
  playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  updateFavoriteButton();

  if (fromSearch) {
    queue = [];
    addToQueue(song.id);
    autoAddSimilar(song);
  } else {
    addToQueue(song.id);
    if (queue.length < 5) autoAddSimilar(song);
  }

  saveState();
}

function playPause() {
  if (isPlaying) {
    audioPlayer.pause();
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    playerBar.classList.remove('playing');
  } else {
    audioPlayer.play().catch(() => {});
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    playerBar.classList.add('playing');
  }
  isPlaying = !isPlaying;
}

function playNext() {
  if (queue.length > 0) {
    const nextSong = queue.shift();
    playSong(nextSong, false);
  } else if (currentSongIndex < songHistory.length - 1) {
    currentSongIndex++;
    playSong(songHistory[currentSongIndex], false);
  } else {
    showNotification('No next song. Try searching more!');
  }
  renderQueue();
  saveState();
}

function playPrevious() {
  if (currentSongIndex > 0) {
    currentSongIndex--;
    playSong(songHistory[currentSongIndex], false);
  }
}

/* =================== */
/* Queue Management */
function addToQueue(songId) {
  const song = [...songHistory, ...queue].find(s => s.id === songId);
  if (song && !queue.some(q => q.id === songId)) {
    queue.push(song);
    renderQueue();
    saveState();
  }
}

async function autoAddSimilar(currentSong) {
  try {
    const similarQuery = `${currentSong.artist} ${currentSong.genre || ''} similar songs`;
    const response = await fetch(`/api/search?q=${encodeURIComponent(similarQuery)}&page=0&limit=3`);
    const data = await response.json();

    data.songs?.results?.forEach(similarSong => {
      if (!queue.some(q => q.id === similarSong.id) && similarSong.id !== currentSong.id) {
        addToQueue(similarSong.id);
      }
    });
  } catch (err) {
    // Silently fail
  }
}

function renderQueue() {
  if (queue.length === 0) {
    queueList.innerHTML = '<span>No songs in queue</span>';
    return;
  }

  queueList.innerHTML = queue.map((song, idx) => `
    <div class="queue-item">
      <span onclick="playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false)">
        ${song.title} - ${song.artist}
      </span>
      <button onclick="removeFromQueue(${idx})"><i class="fa-solid fa-trash"></i></button>
      <button class="download-btn" onclick="downloadSong('${song.id}')"><i class="fa-solid fa-download"></i></button>
    </div>
  `).join('');
}

function removeFromQueue(idx) {
  queue.splice(idx, 1);
  renderQueue();
  saveState();
}

function dropQueue() {
  queueContainer.classList.toggle('open');
}

function emptyQueue() {
  queue = [];
  renderQueue();
  saveState();
  showNotification('Queue has been emptied!');
}

/* =================== */
/* Favorites & Playlists */
function createSongPickerModal(playlistIdx) {
  const modal = document.createElement('div');
  modal.className = 'song-picker-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h4>Select a Song</h4>
      <input type="text" id="song-picker-search" placeholder="Search songs..." oninput="filterSongPicker(this.value)">
      <div id="song-picker-list" class="song-picker-list" data-playlist-idx="${playlistIdx}">
        ${songHistory.length ? songHistory.map(song => `
          <div class="song-picker-item" onclick="addToPlaylist(${playlistIdx}, '${song.id}')">
            ${song.title} - ${song.artist}
          </div>
        `).join('') : '<span>No songs available</span>'}
      </div>
      <button onclick="closeSongPickerModal()">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function filterSongPicker(query) {
  const songPickerList = document.getElementById('song-picker-list');
  const lowerQuery = query.toLowerCase();
  songPickerList.innerHTML = songHistory
    .filter(song => song.title.toLowerCase().includes(lowerQuery) || song.artist.toLowerCase().includes(lowerQuery))
    .map(song => `
      <div class="song-picker-item" onclick="addToPlaylist(${songPickerList.dataset.playlistIdx}, '${song.id}')">
        ${song.title} - ${song.artist}
      </div>
    `).join('') || '<span>No matching songs</span>';
  songPickerList.dataset.playlistIdx = songPickerList.dataset.playlistIdx;
}

function closeSongPickerModal() {
  const modal = document.querySelector('.song-picker-modal');
  if (modal) modal.remove();
}

function createPlaylistModal() {
  const modal = document.createElement('div');
  modal.className = 'song-picker-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h4>Create Playlist</h4>
      <input type="text" id="playlist-name-input" placeholder="Enter playlist name..." />
      <div class="modal-buttons">
        <button onclick="createPlaylist(document.getElementById('playlist-name-input').value)">Create</button>
        <button onclick="closePlaylistModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closePlaylistModal() {
  const modal = document.querySelector('.song-picker-modal');
  if (modal) modal.remove();
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

function addToFavorites(songId) {
  const song = songHistory.find(s => s.id === songId);
  if (song && !favorites.some(f => f.id === songId)) {
    favorites.push(song);
    saveState();
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Favorites</h4>')) {
      loadFavorites();
    }
    showNotification('Added to favorites!');
    updateFavoriteButton();
  }
}

function removeFromFavorites(songId) {
  const index = favorites.findIndex(f => f.id === songId);
  if (index !== -1) {
    favorites.splice(index, 1);
    saveState();
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Favorites</h4>')) {
      loadFavorites();
    }
    showNotification('Removed from favorites!');
    updateFavoriteButton();
  }
}

function addToFavoritesFromPlayer() {
  if (currentSongIndex >= 0 && songHistory[currentSongIndex]) {
    addToFavorites(songHistory[currentSongIndex].id);
  } else {
    showNotification('No song is currently playing.');
  }
}

function updateFavoriteButton() {
  const favBtn = document.getElementById('fav-btn');
  const currentSong = songHistory[currentSongIndex];
  if (currentSong && favorites.some(f => f.id === currentSong.id)) {
    favBtn.classList.add('favorited');
    favBtn.querySelector('i').classList.add('fa-solid');
    favBtn.querySelector('i').classList.remove('fa-regular');
  } else {
    favBtn.classList.remove('favorited');
    favBtn.querySelector('i').classList.add('fa-regular');
    favBtn.querySelector('i').classList.remove('fa-solid');
  }
}

function playAllFavorites(shuffle = false) {
  if (favorites.length === 0) {
    showNotification('No songs in favorites.');
    return;
  }
  queue = [];
  const songsToQueue = shuffle ? [...favorites].sort(() => Math.random() - 0.5) : favorites;
  songsToQueue.forEach(song => {
    if (!queue.some(q => q.id === song.id)) {
      queue.push(song);
    }
  });
  playSong(songsToQueue[0], false);
  renderQueue();
  saveState();
}

function loadFavorites() {
  libraryView.style.display = 'block';
  resultsList.style.display = 'none';
  document.getElementById('home-content').style.display = 'none';
  libraryView.innerHTML = `
    <h4>Favorites</h4>
    <button onclick="playAllFavorites()" ${favorites.length === 0 ? 'disabled' : ''}>Play All</button>
    <button onclick="playAllFavorites(true)" ${favorites.length === 0 ? 'disabled' : ''}>Shuffle All</button>
    <button class="favorites-download-btn" onclick="downloadPlaylist(favorites, 'Favorites')" ${favorites.length === 0 ? 'disabled' : ''}>Download All</button>
    ${favorites.length ? `
      <div class="song-container">
        <div class="cards">
          ${favorites.map(song => `
            <div class="card">
              <img src="${song.image || 'default.png'}" alt="${song.title}" />
              <div class="card-body">
                <div class="song-name">${song.title}</div>
                <div class="artist-name">${song.artist}</div>
              </div>
              <div class="play-down">
                <div class="play-btn" onclick="event.stopPropagation(); playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false)"><i class="fa-solid fa-play"></i></div>
                <div class="queue-btn" onclick="event.stopPropagation(); addToQueue('${song.id}')"><i class="fa-solid fa-plus"></i></div>
                <div class="add-fav" onclick="event.stopPropagation(); removeFromFavorites('${song.id}')"><i class="fa-solid fa-trash"></i></div>
                <div class="download-btn" onclick="event.stopPropagation(); downloadSong('${song.id}')"><i class="fa-solid fa-download"></i></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '<span>No favorites yet</span>'}
  `;
  moreBtn.style.display = 'none';
}

function createPlaylist(name) {
  if (name.trim()) {
    playlists.push({ name, songs: [] });
    saveState();
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Playlists</h4>')) {
      loadPlaylists();
    }
    showNotification('Playlist created!');
    closePlaylistModal();
  } else {
    showNotification('Please enter a valid playlist name.');
  }
}

function addToPlaylist(playlistIdx, songId) {
  const song = songHistory.find(s => s.id === songId);
  if (song) {
    playlists[playlistIdx].songs.push(song);
    saveState();
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Playlists</h4>')) {
      loadPlaylists();
    }
    showNotification('Added to playlist!');
    closeSongPickerModal();
  }
}

function removeFromPlaylist(playlistIdx, songId) {
  const playlist = playlists[playlistIdx];
  const songIndex = playlist.songs.findIndex(s => s.id === songId);
  if (songIndex !== -1) {
    playlist.songs.splice(songIndex, 1);
    saveState();
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Playlists</h4>')) {
      loadPlaylists();
    }
    showNotification('Removed from playlist!');
  }
}

function deletePlaylist(playlistIdx) {
  const playlistName = playlists[playlistIdx].name;
  playlists.splice(playlistIdx, 1);
  saveState();
  if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Playlists</h4>')) {
    loadPlaylists();
  }
  showNotification(`Playlist "${playlistName}" deleted!`);
}

function loadPlaylists() {
  libraryView.style.display = 'block';
  resultsList.style.display = 'none';
  document.getElementById('home-content').style.display = 'none';
  libraryView.innerHTML = `
    <h4>Playlists</h4>
    <button onclick="createPlaylistModal()">+ New</button>
    ${playlists.map((pl, idx) => `
      <div class="playlist-item">
        <h5>${pl.name} (${pl.songs.length})</h5>
        <button class="delete-playlist" onclick="event.stopPropagation(); deletePlaylist(${idx})"><i class="fa-solid fa-trash"></i></button>
        <button class="playlist-download-btn" onclick="downloadPlaylist(playlists[${idx}].songs, '${pl.name}')" ${pl.songs.length === 0 ? 'disabled' : ''}>Download Playlist</button>
        <div class="song-container">
          <div class="cards">
            ${pl.songs.map(song => `
              <div class="card">
                <img src="${song.image || 'default.png'}" alt="${song.title}" />
                <div class="card-body">
                  <div class="song-name">${song.title}</div>
                  <div class="artist-name">${song.artist}</div>
                </div>
                <div class="play-down">
                  <div class="play-btn" onclick="event.stopPropagation(); playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false)"><i class="fa-solid fa-play"></i></div>
                  <div class="queue-btn" onclick="event.stopPropagation(); addToQueue('${song.id}')"><i class="fa-solid fa-plus"></i></div>
                  <div class="add-fav" onclick="event.stopPropagation(); removeFromPlaylist(${idx}, '${song.id}')"><i class="fa-solid fa-trash"></i></div>
                  <div class="download-btn" onclick="event.stopPropagation(); downloadSong('${song.id}')"><i class="fa-solid fa-download"></i></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <button onclick="createSongPickerModal(${idx})">+ Add Song</button>
      </div>
    `).join('')}
  `;
  moreBtn.style.display = 'none';
}

/* =================== */
/* Other Controls */
function toggleLoop() {
  audioPlayer.loop = !audioPlayer.loop;
  loopBtn.innerHTML = audioPlayer.loop
    ? '<i class="fa-solid fa-repeat"></i>'
    : '<i class="fa-regular fa-repeat"></i>';
}

function setVolume(value) {
  audioPlayer.volume = parseFloat(value);
}

function focusSearch() {
  searchInput.focus();
  libraryView.style.display = 'none';
  document.getElementById('home-content').style.display = 'none';
  resultsList.style.display = 'block';
}

/* =================== */
/* Event Listeners 
moreBtn.addEventListener('click', loadMoreResults);*/
audioPlayer.addEventListener('play', () => {
  isPlaying = true;
  playerBar.classList.add('playing');
});
audioPlayer.addEventListener('pause', () => {
  isPlaying = false;
  playerBar.classList.remove('playing');
});
audioPlayer.addEventListener('ended', playNext);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchSongs();
});