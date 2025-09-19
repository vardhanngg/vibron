/* =================== */
/* State */
let songHistory = JSON.parse(localStorage.getItem('songHistory') || '[]');
let currentSongIndex = parseInt(localStorage.getItem('currentSongIndex') || '-1');
let queue = JSON.parse(localStorage.getItem('queue') || '[]');
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let playlists = JSON.parse(localStorage.getItem('playlists') || '[]');
let currentArtistId = '';
let artistPage = 0;
//let isHost = false;
let visibleSongCount = 6;
let lastSongResults = [];
let searchSongsPage = 0;
let visibleArtistSongCount = 10;
let lastArtistSongs = [];
let visibleAlbumSongCount = 10;
let lastAlbumSongs = [];
let previousView = null;
const socket = io('https://vibron-sockets.onrender.com'); // Connect to Render backend
let currentSessionCode = null;
let isHost = true;
let participants = {};
let stateChanged = false; // For optimized state saving

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    searchSongs();
  }
});

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
/* State Management */
function markStateChanged() {
  stateChanged = true;
}

function saveState() {
  if (stateChanged) {
    localStorage.setItem('songHistory', JSON.stringify(songHistory));
    localStorage.setItem('currentSongIndex', currentSongIndex.toString());
    localStorage.setItem('queue', JSON.stringify(queue));
    localStorage.setItem('favorites', JSON.stringify(favorites));
    localStorage.setItem('playlists', JSON.stringify(playlists));
    stateChanged = false;
  }
}

/* =================== */
/* Greeting */
function setGreeting() {
  const greetingElement = document.getElementById('greeting');
  const hour = new Date().getHours();
  let greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  greetingElement.textContent = greeting;
}

/* =================== */
/* Back Button */
function showBackButton() {
  let backBtn = document.getElementById('back-btn');
  if (!backBtn) {
    backBtn = document.createElement('button');
    backBtn.id = 'back-btn';
    backBtn.className = 'back-btn';
    backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back';
    backBtn.onclick = goBack;
    resultsList.prepend(backBtn);
  }
  backBtn.style.display = 'block';
}

function hideBackButton() {
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.style.display = 'none';
  }
}

function goBack() {
  if (previousView) {
    if (previousView.type === 'home') {
      loadHomeContent();
    } else if (previousView.type === 'search') {
      searchInput.value = previousView.query;
      currentQuery = previousView.query;
      currentPage = previousView.page;
      visibleSongCount = previousView.visibleSongCount;
      lastSongResults = previousView.lastSongResults;
      fetchResults();
    }
    previousView = null;
    hideBackButton();
  } else {
    loadHomeContent();
    hideBackButton();
  }
}

/* =================== */
/* Home Content */
async function loadHomeContent() {
  document.getElementById('home-content').style.display = 'block';
  resultsList.style.display = 'none';
  libraryView.style.display = 'none';
  moreBtn.style.display = 'none';
  hideBackButton();

  await Promise.all([loadListenAgain()]);
}

async function loadListenAgain() {
  const sectionList = document.querySelector('#listen-again .section-list');
  sectionList.innerHTML = '';

  const recentSongs = [...new Set(songHistory.filter(s => s.lastPlayed).map(s => s.id))]
    .slice(-4)
    .map(id => songHistory.find(s => s.id === id))
    .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));

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

/* =================== */
/* Search & Fetch */
async function searchSongs() {
  const query = searchInput.value.trim();
  if (!query) return;

  previousView = { type: 'home' };
  currentQuery = query;
  currentPage = 1;   
  visibleSongCount = 6;
  searchSongsPage = 0;
  resultsList.innerHTML = '';
  libraryView.style.display = 'none';
document.getElementById('home-content').style.display = 'none';
resultsList.classList.remove('hidden');
resultsList.style.display = 'block'; // ✅ ensure results are visible


  hideBackButton();

  await fetchResults();
}

async function fetchResults() {
  try {
    // main search (songs / artists / albums)
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}&limit=10`
    );
    if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);
    const data = await response.json();

    // 🎵 extra call for playlists
    const plResponse = await fetch(
      `https://apivibron.vercel.app/api/search/playlists?query=${encodeURIComponent(currentQuery)}`
    );
    const plJson = await plResponse.json();
    // add playlists into the same object so displayResults can see it
    data.playlists = plJson?.data || { results: [] };

    // no results check (include playlists now)
    if (
      !data.songs?.results?.length &&
      !data.artists?.results?.length &&
      !data.albums?.results?.length &&
      !data.playlists?.results?.length        // ✅ new line
    ) {
      moreBtn.classList.add('hidden');
      resultsList.innerHTML = '<span>No results found.</span>';
      return;
    }

    // hand everything—including playlists—to your renderer
    displayResults(data);

    // show or hide the “Load More” button
    if (data.songs.next || data.artists.next || data.albums.next) {
      moreBtn.classList.remove('hidden');
      moreBtn.style.display = 'block';
    } else {
      moreBtn.classList.add('hidden');
    }

    //  keep currentPage handling exactly as you have it (don’t auto-increment)
  } catch (err) {
    moreBtn.classList.add('hidden');
    resultsList.innerHTML = '<span>Error loading results.</span>';
    console.error('Error fetching results:', err);
    showNotification('Failed to load search results.');
  }
}



async function fetchArtistSongs(artistId, artistName, page = 0, append = false) {
  if (!artistId || artistId === 'undefined') {
    resultsList.innerHTML = '<span>Invalid artist ID.</span>';
    console.error('Invalid artistId:', artistId);
    return;
  }

  if (!append) {
    previousView = {
      type: 'search',
      query: currentQuery,
      page: currentPage,
      visibleSongCount: visibleSongCount,
      lastSongResults: lastSongResults,
    };
  }

  try {
    const url = `https://apivibron.vercel.app/api/artists/${artistId}/songs`;
    console.log('Fetching artist songs:', url);
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Artist fetch failed: ${response.statusText} (${response.status}) - ${errorText}`);
    }

    const data = await response.json();
    const songs = data.data?.songs || [];
    console.log('Artist songs received:', songs.length, songs.map(s => s.id));
    lastArtistSongs = songs;
    visibleArtistSongCount = 10;

    if (!append) {
      resultsList.innerHTML = '';
      libraryView.style.display = 'none';
      document.getElementById('home-content').style.display = 'none';
      searchInput.value = `Songs by ${artistName}`;
     // resultsList.style.display = 'block';
      resultsList.classList.remove('hidden');

      currentArtistId = artistId;
      artistPage = page;
      showBackButton();
    }

    let cards;
    if (!append) {
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
      cards = resultsList.querySelector('.cards');
    }

    if (!append && songs.length) {
      queue = songs.map(normalizeSong).filter(song => !queue.some(q => q.id === song.id));
      console.log('Artist queue updated:', queue.map(q => q.id));
      renderQueue();
    }

    songs.slice(0, visibleArtistSongCount).forEach(song => {
      const normalizedSong = normalizeSong(song);
      if (!songHistory.some(s => s.id === normalizedSong.id)) {
        songHistory.push(normalizedSong);
      }
      const card = createSongCard(normalizedSong, true, false);
      cards.appendChild(card);
    });

    let loadMoreBtn = document.getElementById('artist-songs-load-more');
    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('button');
      //loadMoreBtn.id = 'artist-songs-load-more';
      loadMoreBtn.className = 'load-more-btn';
      loadMoreBtn.textContent = 'Load More';
      resultsList.appendChild(loadMoreBtn);
    }
    if (songs.length > visibleArtistSongCount) {
      loadMoreBtn.style.display = 'block';
      loadMoreBtn.onclick = () => {
        visibleArtistSongCount += 5;
        fetchArtistSongs(artistId, artistName, artistPage, true);
      };
    } else {
      loadMoreBtn.style.display = 'none';
    }

    markStateChanged();
    saveState();
  } catch (err) {
    resultsList.innerHTML = '<span>Error loading artist songs. Please try again.</span>';
    console.error(`Error fetching artist songs for ID ${artistId}:`, err.message);
    showNotification('Failed to load artist songs.');
  }
}

async function fetchAlbumSongs(albumId, albumTitle) {
  if (!albumId || albumId === 'undefined') {
    resultsList.innerHTML = '<span>Invalid album ID.</span>';
    console.error('Invalid albumId:', albumId);
    return;
  }

  previousView = {
    type: 'search',
    query: currentQuery,
    page: currentPage,
    visibleSongCount: visibleSongCount,
    lastSongResults: lastSongResults,
  };

  try {
    const url = `https://apivibron.vercel.app/api/albums?id=${encodeURIComponent(albumId)}`;
    console.log('Fetching album songs:', url);
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Album fetch failed: ${response.statusText} (${response.status}) - ${errorText}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error('API returned success: false');

    const songs = data.data?.songs || [];
    console.log('Album songs received:', songs.length, songs.map(s => s.id));

    resultsList.innerHTML = '';
    libraryView.style.display = 'none';
    document.getElementById('home-content').style.display = 'none';
    searchInput.value = `Songs from ${albumTitle}`;
    //resultsList.style.display = 'block';
    resultsList.classList.remove('hidden');

    showBackButton();

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '1rem';

    const titleHeader = document.createElement('h3');
    titleHeader.textContent = `Songs from ${albumTitle}`;
    header.appendChild(titleHeader);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'playlist-download-btn';
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
        const card = createSongCard(normalizedSong, false, true);
        cards.appendChild(card);
      });
      container.appendChild(cards);
      resultsList.appendChild(container);

      queue = songs.map(normalizeSong).filter(song => !queue.some(q => q.id === song.id));
      console.log('Album queue updated:', queue.map(q => q.id));
      renderQueue();
    } else {
      resultsList.innerHTML = '<span>No songs found in this album.</span>';
    }

    markStateChanged();
    saveState();
  } catch (err) {
    resultsList.innerHTML = '<span>Error loading album songs. Please try again.</span>';
    console.error(`Error fetching album songs for ID ${albumId}:`, err.message);
    showNotification('Failed to load album songs.');
  }
}

async function fetchPlaylistSongs(playlistId, playlistTitle) {
  try {
    const url = `https://apivibron.vercel.app/api/playlists?id=${playlistId}&page=0&limit=10`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Playlist fetch failed: ${response.statusText}`);
    const data = await response.json();
    const songs = data.data?.songs || [];

    resultsList.innerHTML = '';
    libraryView.style.display = 'none';
    document.getElementById('home-content').style.display = 'none';
    searchInput.value = `Songs from ${playlistTitle}`;
    resultsList.classList.remove('hidden');

    showBackButton();

    const header = document.createElement('h3');
    header.textContent = `Songs from ${playlistTitle}`;
    resultsList.appendChild(header);

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

    queue = songs.map(normalizeSong);
    renderQueue();
    markStateChanged();
    saveState();
  } catch (err) {
    resultsList.innerHTML = '<span>Error loading playlist songs. Please try again.</span>';
    console.error('Error fetching playlist songs:', err);
    showNotification('Failed to load playlist songs.');
  }
}


function normalizeSong(song) {
  return {
    id: song.id || song.encrypted_id || 'unknown',
    title: song.name || song.title || 'Unknown',
    artist: Array.isArray(song.artists?.primary)
      ? song.artists.primary.map(a => a.name).join(', ')
      : song.primaryArtists || song.artist || 'Unknown',
    image: Array.isArray(song.image) && song.image.length
      ? song.image.find(img => img.quality === '500x500')?.url || song.image[song.image.length - 1]?.url || 'default.png'
      : song.image || 'default.png',
    audioUrl: Array.isArray(song.downloadUrl)
      ? song.downloadUrl.find(url => url.quality === '320kbps' || url.bitrate === '320')?.url || song.downloadUrl[0]?.url || ''
      : song.audioUrl || song.media_url || song.url || '',
  };
}

function createSongCard(song, fromArtist = false, fromAlbum = false) {
  const isFavorited = favorites.some(f => f.id === song.id);
  const safeId = encodeURIComponent(song.id);
  const safeTitle = song.title.replace(/'/g, "\\'");
  const safeArtist = song.artist.replace(/'/g, "\\'");
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <img src="${song.image || 'default.png'}" alt="${safeTitle}" />
    <div class="card-body">
      <div class="song-name">${safeTitle}</div>
      <div class="artist-name">${safeArtist}</div>
    </div>
    <div class="play-down">
      <div class="play-btn" title="Play" onclick="event.stopPropagation(); playSong({id: '${safeId}', title: '${safeTitle}', artist: '${safeArtist}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false, ${fromArtist}, ${fromAlbum})"><i class="fa-solid fa-play"></i></div>
      <div class="playlist-btn" title="Add to Playlist" onclick="event.stopPropagation(); showAddToPlaylistModal('${safeId}')"><i class="fa-solid fa-plus"></i></div>
      <div class="add-fav${isFavorited ? ' favorited' : ''}" title="${isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}" onclick="event.stopPropagation(); toggleFavorites('${safeId}')"><i class="fa${isFavorited ? '-solid' : '-regular'} fa-heart"></i></div>
      <div class="queue-btn" title="Add to Queue" onclick="event.stopPropagation(); addToQueue('${safeId}')"><i class="fa-solid fa-list"></i></div>
      <div class="download-btn" title="Download" onclick="event.stopPropagation(); downloadSong('${safeId}')"><i class="fa-solid fa-download"></i></div>
    </div>
  `;
  card.addEventListener('click', () => playSong(song, false, fromArtist, fromAlbum));
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
  )
    .then(() => {
      zip.generateAsync({ type: 'blob' }).then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${playlistName || 'Favorites'}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification(`Downloading ${playlistName || 'Favorites'}`);
      });
    })
    .catch(err => {
      showNotification('Error downloading playlist.');
      console.error('Playlist download error:', err);
    });
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
  markStateChanged();
  saveState();
}

function playSong(song, fromSearch = false, fromArtist = false, fromAlbum = false) {
  if (!isHost && currentSessionCode) {
     showNotification('Only the host can control playback.');
    return; 
  }
  console.log('playSong called:', song.id, song.title, { fromSearch, fromArtist, fromAlbum });
  currentSongIndex = songHistory.findIndex(s => s.id === song.id);
  if (currentSongIndex === -1) {
    songHistory.push({ ...song, lastPlayed: new Date().toISOString() });
    currentSongIndex = songHistory.length - 1;
  } else {
    songHistory[currentSongIndex] = { ...songHistory[currentSongIndex], lastPlayed: new Date().toISOString() };
  }

  console.log('Setting audioPlayer.src:', song.audioUrl);
  audioPlayer.src = song.audioUrl;
  audioPlayer
    .play()
    .catch(err => console.error('Playback error:', err));

  albumArt.src = song.image || 'default.png';
  nowPlaying.textContent = song.title;
  artistName.textContent = song.artist;

  playerBar.classList.add('playing');
  isPlaying = true;
  playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  updateFavoriteButton();

  if (fromSearch) {
    console.log('Clearing queue for new search and adding song:', song.id);
    queue = [];
    addToQueue(song.id);
    autoAddSimilar(song);
  } else if (fromArtist || fromAlbum) {
    console.log('Preserving queue for artist/album:', queue.map(q => q.id));
    if (!queue.some(q => q.id === song.id)) {
      queue.unshift(song);
      console.log('Added current song to queue:', song.id);
      renderQueue();
    }
  } else {
    addToQueue(song.id);
    if (queue.length < 5) autoAddSimilar(song);
  }
  if (isHost && currentSessionCode) {
    socket.emit('playback-control', { action: 'play-song', song });
    socket.emit('sync-state', { song, currentTime: audioPlayer.currentTime, isPlaying: true });
  }

  console.log('Final queue state:', queue.map(q => q.id));
  markStateChanged();
  saveState();
}

function playPause() {
  if (!isHost && currentSessionCode) {
     showNotification('Only the host can control playback.');
    return; 
  }
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
  if (isHost && currentSessionCode) {
    socket.emit('playback-control', { action: isPlaying ? 'play' : 'pause' });
    socket.emit('sync-state', { song: songHistory[currentSongIndex], currentTime: audioPlayer.currentTime, isPlaying });
  }
}

function playNext() {
  if (!isHost && currentSessionCode) {
     showNotification('Only the host can control playback.');
    return; 
  }
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
  markStateChanged();
  saveState();
  if (isHost && currentSessionCode) {
    socket.emit('playback-control', { action: 'next' });
    socket.emit('sync-state', { song: songHistory[currentSongIndex], currentTime: audioPlayer.currentTime, isPlaying: true });
  }
}

function playPrevious() {
  if (!isHost && currentSessionCode) {
     showNotification('Only the host can control playback.');
    return; 
  }
  if (currentSongIndex > 0) {
    currentSongIndex--;
    playSong(songHistory[currentSongIndex], false);
  }
  if (isHost && currentSessionCode) {
    socket.emit('playback-control', { action: 'previous' });
    socket.emit('sync-state', { song: songHistory[currentSongIndex], currentTime: audioPlayer.currentTime, isPlaying: true });
  }
}
function showChatButton() {
  const chatBtn = document.getElementById('chat-open-btn');
  if (chatBtn) {
    chatBtn.style.display = 'inline-flex'; // makes the 💬 button visible
  }
 // showNotification('showchatbuttonfun');
}

function hideChatButton() {
  const chatBtn = document.getElementById('chat-open-btn');
  if (chatBtn) {
    chatBtn.style.display = 'none'; // hides it again
  }
  //showNotification('hidechatbuttonfun');
}



function seek(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  audioPlayer.currentTime = percent * audioPlayer.duration;
  if (isHost && currentSessionCode) {
    socket.emit('sync-state', {
      song: songHistory[currentSongIndex],
      currentTime: audioPlayer.currentTime,
      isPlaying: !audioPlayer.paused,
    });
  }
}

/* =================== */
/* Queue Management */
function addToQueue(songId) {
  const song = [...songHistory, ...queue].find(s => s.id === songId);
  if (song && !queue.some(q => q.id === songId)) {
    queue.push(song);
    renderQueue();
    markStateChanged();
    saveState();
    showNotification('Added to queue!');
  }
}

async function autoAddSimilar(currentSong) {
  console.log('autoAddSimilar called for song:', currentSong.id, currentSong.title);
  try {
    const url = `https://apivibron.vercel.app/api/songs/${currentSong.id}/suggestions?limit=3`;
    console.log('Fetching suggestions:', url);
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Suggestions fetch failed: ${response.statusText}`);

    const data = await response.json();
    const similarSongs = data.data || [];
    console.log('Suggestions received:', similarSongs.length, similarSongs.map(s => s.id));

    if (!Array.isArray(similarSongs)) {
      console.error('Invalid suggestions response:', data);
      return;
    }

    similarSongs.forEach(similarSong => {
      const normalizedSong = normalizeSong(similarSong);
      console.log('Adding to songHistory:', normalizedSong.id);
      if (!songHistory.some(s => s.id === normalizedSong.id)) {
        songHistory.push(normalizedSong);
      }
      console.log('Checking queue for:', normalizedSong.id);
      if (!queue.some(q => q.id === normalizedSong.id) && normalizedSong.id !== currentSong.id) {
        console.log('Adding to queue:', normalizedSong.id, normalizedSong.title);
        queue.push(normalizedSong);
      }
    });

    console.log('Queue after adding similar songs:', queue.map(q => q.id));
    if (similarSongs.length > 0) {
      showNotification(`Added ${similarSongs.length} similar songs to queue`);
      renderQueue();
      markStateChanged();
      saveState();
    } else {
      console.log('No similar songs to add');
    }
  } catch (err) {
    console.error('Error in autoAddSimilar:', err.message);
    showNotification('Failed to add similar songs.');
  }
}

function renderQueue() {
  if (queue.length === 0) {
    queueList.innerHTML = '<span>No songs in queue</span>';
    return;
  }

  queueList.innerHTML = queue
    .map(
      (song, idx) => `
    <div class="queue-item">
      <span onclick="playSong({id: '${encodeURIComponent(song.id)}', title: '${song.title.replace(/'/g, "\\'")}', artist: '${song.artist.replace(/'/g, "\\'")}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false)">
        ${song.title} - ${song.artist}
      </span>
      <button onclick="removeFromQueue(${idx})"><i class="fa-solid fa-trash"></i></button>
      <button class="download-btn" onclick="downloadSong('${encodeURIComponent(song.id)}')"><i class="fa-solid fa-download"></i></button>
    </div>
  `
    )
    .join('');
}

function removeFromQueue(idx) {
  queue.splice(idx, 1);
  renderQueue();
  markStateChanged();
  saveState();
}

function toggleQueue() {
  // close chat if open
  document.getElementById('chat-container').classList.remove('open');
  queueContainer.classList.toggle('open');
}
/*function toggleChat() {
  // close queue if open
  queueContainer.classList.remove('open');
  document.getElementById('chat-container').classList.toggle('open');
}*/
function toggleChat() {
  const chatContainer = document.getElementById('chat-container');
  if (!chatContainer) {
    console.error("Chat container not found");
    return;
  }

  // Toggle visibility
  if (chatContainer.classList.contains('hidden')) {
    chatContainer.classList.remove('hidden');
    console.log("Chat opened");
  } else {
    chatContainer.classList.add('hidden');
    console.log("Chat closed");
  }
}



function emptyQueue() {
  queue = [];
  renderQueue();
  markStateChanged();
  saveState();
  showNotification('Queue has been emptied!');
}

/* =================== */
/* Favorites & Playlists */
function filterSongPicker(query) {
  const songPickerList = document.getElementById('song-picker-list');
  const lowerQuery = query.toLowerCase();
  songPickerList.innerHTML =
    songHistory
      .filter(song => song.title.toLowerCase().includes(lowerQuery) || song.artist.toLowerCase().includes(lowerQuery))
      .map(
        song => `
      <div class="song-picker-item" onclick="addToPlaylist(${songPickerList.dataset.playlistIdx}, '${encodeURIComponent(song.id)}')">
        ${song.title} - ${song.artist}
      </div>
    `
      )
      .join('') || '<span>No matching songs</span>';
  songPickerList.dataset.playlistIdx = songPickerList.dataset.playlistIdx;
}

function closeSongPickerModal() {
  const modal = document.querySelector('.song-picker-modal');
  if (modal) modal.remove();
}

function createPlaylistModal(songId = '') {
  const modal = document.createElement('div');
  modal.className = 'song-picker-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h4>Create Playlist</h4>
      <input type="text" id="playlist-name-input" placeholder="Enter playlist name..." />
      <div class="modal-buttons">
        <button onclick="createPlaylist(document.getElementById('playlist-name-input').value, '${encodeURIComponent(songId)}'); closePlaylistModal()">Create</button>
        <button onclick="closePlaylistModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const input = document.getElementById('playlist-name-input');
    if (input) input.focus();
  }, 0);
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
    markStateChanged();
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
    markStateChanged();
    saveState();
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Favorites</h4>')) {
      loadFavorites();
    }
    showNotification('Removed from favorites!');
    updateFavoriteButton();
  }
}

function toggleFavorites(songId) {
  if (favorites.some(f => f.id === songId)) {
    removeFromFavorites(songId);
  } else {
    addToFavorites(songId);
  }
}

function addToFavoritesFromPlayer() {
  if (currentSongIndex >= 0 && songHistory[currentSongIndex]) {
    toggleFavorites(songHistory[currentSongIndex].id);
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
  markStateChanged();
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
    ${
      favorites.length
        ? `
      <div class="song-container">
        <div class="cards">
          ${favorites
            .map(
              song => `
            <div class="card">
              <img src="${song.image || 'default.png'}" alt="${song.title}" />
              <div class="card-body">
                <div class="song-name">${song.title}</div>
                <div class="artist-name">${song.artist}</div>
              </div>
              <div class="play-down">
                <div class="play-btn" title="Play" onclick="event.stopPropagation(); playSong({id: '${encodeURIComponent(song.id)}', title: '${song.title.replace(/'/g, "\\'")}', artist: '${song.artist.replace(/'/g, "\\'")}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false)"><i class="fa-solid fa-play"></i></div>
                <div class="playlist-btn" title="Add to Playlist" onclick="event.stopPropagation(); showAddToPlaylistModal('${encodeURIComponent(song.id)}')"><i class="fa-solid fa-plus"></i></div>
                <div class="add-fav" title="Remove from Favorites" onclick="event.stopPropagation(); removeFromFavorites('${encodeURIComponent(song.id)}')"><i class="fa-solid fa-trash"></i></div>
                <div class="queue-btn" title="Add to Queue" onclick="event.stopPropagation(); addToQueue('${encodeURIComponent(song.id)}')"><i class="fa-solid fa-list"></i></div>
                <div class="download-btn" title="Download" onclick="event.stopPropagation(); downloadSong('${encodeURIComponent(song.id)}')"><i class="fa-solid fa-download"></i></div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
        : '<span>No favorites yet</span>'
    }
  `;
  moreBtn.style.display = 'none';
  hideBackButton();
}

function createPlaylist(name, songId = '') {
  if (name.trim()) {
    playlists.push({ name, songs: [] });
    if (songId) {
      addToPlaylist(playlists.length - 1, songId);
      showNotification('Playlist created and song added!');
    } else {
      showNotification('Playlist created!');
    }
    markStateChanged();
    saveState();
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Playlists</h4>')) {
      loadPlaylists();
    }
    closePlaylistModal();
  } else {
    showNotification('Please enter a valid playlist name.');
  }
}

function addToPlaylist(playlistIdx, songId) {
  const song = songHistory.find(s => s.id === songId);
  if (song) {
    if (!playlists[playlistIdx].songs.some(s => s.id === songId)) {
      playlists[playlistIdx].songs.push(song);
      markStateChanged();
      saveState();
      if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Playlists</h4>')) {
        loadPlaylists();
      }
      showNotification('Added to playlist!');
    } else {
      showNotification('Song already in playlist.');
    }
    closeAddToPlaylistModal();
  }
}

function removeFromPlaylist(playlistIdx, songId) {
  const playlist = playlists[playlistIdx];
  const songIndex = playlist.songs.findIndex(s => s.id === songId);
  if (songIndex !== -1) {
    playlist.songs.splice(songIndex, 1);
    markStateChanged();
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
  markStateChanged();
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
    ${playlists
      .map(
        (pl, idx) => `
      <div class="playlist-item">
        <h5>${pl.name} (${pl.songs.length})</h5>
        <button class="delete-playlist" onclick="event.stopPropagation(); deletePlaylist(${idx})"><i class="fa-solid fa-trash"></i></button>
        <button class="playlist-download-btn" onclick="downloadPlaylist(playlists[${idx}].songs, '${pl.name}')" ${pl.songs.length === 0 ? 'disabled' : ''}>Download Playlist</button>
        <div class="song-container">
          <div class="cards">
            ${pl.songs
              .map(
                song => `
              <div class="card">
                <img src="${song.image || 'default.png'}" alt="${song.title}" />
                <div class="card-body">
                  <div class="song-name">${song.title}</div>
                  <div class="artist-name">${song.artist}</div>
                </div>
                <div class="play-down">
                  <div class="play-btn" title="Play" onclick="event.stopPropagation(); playSong({id: '${encodeURIComponent(song.id)}', title: '${song.title.replace(/'/g, "\\'")}', artist: '${song.artist.replace(/'/g, "\\'")}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false)"><i class="fa-solid fa-play"></i></div>
                  <div class="playlist-btn" title="Add to Another Playlist" onclick="event.stopPropagation(); showAddToPlaylistModal('${encodeURIComponent(song.id)}')"><i class="fa-solid fa-plus"></i></div>
                  <div class="add-fav" title="Remove from Playlist" onclick="event.stopPropagation(); removeFromPlaylist(${idx}, '${encodeURIComponent(song.id)}')"><i class="fa-solid fa-trash"></i></div>
                  <div class="queue-btn" title="Add to Queue" onclick="event.stopPropagation(); addToQueue('${encodeURIComponent(song.id)}')"><i class="fa-solid fa-list"></i></div>
                  <div class="download-btn" title="Download" onclick="event.stopPropagation(); downloadSong('${encodeURIComponent(song.id)}')"><i class="fa-solid fa-download"></i></div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
        <button onclick="createSongPickerModal(${idx})">+ Add Song</button>
      </div>
    `
      )
      .join('')}
  `;
  moreBtn.style.display = 'none';
  hideBackButton();
}

function showAddToPlaylistModal(songId) {
  const modal = document.createElement('div');
  modal.className = 'song-picker-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h4>Add to Playlist</h4>
      <div id="playlist-picker-list">
        ${
          playlists.length
            ? playlists
                .map(
                  (pl, idx) => `
          <div class="playlist-picker-item" onclick="addToPlaylist(${idx}, '${songId}'); closeAddToPlaylistModal();">
            ${pl.name}
          </div>
        `
                )
                .join('')
            : '<span>No playlists yet. Create one below.</span>'
        }
      </div>
      <div class="modal-buttons">
        <button onclick="closeAddToPlaylistModal(); createPlaylistModal('${songId}');">Create New</button>
        <button onclick="closeAddToPlaylistModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeAddToPlaylistModal() {
  const modal = document.querySelector('.song-picker-modal');
  if (modal) modal.remove();
}

/* =================== */
/* Listen Together */
function closeListenModal() {
  const modal = document.getElementById('listen-together-modal');
  if (modal) {
    modal.classList.add('hidden');
    // Reset join input visibility
    document.getElementById('join-input').classList.add('hidden');
    document.getElementById('listen-options').classList.remove('hidden');
  }
}
/*function hostSession() {
  let displayName = prompt("Enter your name:");
  if (!displayName || !displayName.trim()) displayName = "Host";

  socket.emit("host-session", { name: displayName }, (sessionCode) => {
    if (!sessionCode) {
      showNotification("Failed to create session");
      return;
    }
    currentSessionCode = sessionCode;
    document.getElementById("session-code").textContent = sessionCode;
    document.getElementById("session-code-display").classList.remove("hidden");
    document.getElementById("chat-open-btn").style.display = "flex"; // ✅ host sees chat button
    closeListenModal();
  });
}
*/
function hostSession() {
  socket.emit('host-session');
}

function joinSession() {
  const code = document.getElementById("session-code-input").value.toUpperCase().trim();
  if (code.length !== 6) {
    showNotification("Invalid code");
    return;
  }

  let displayName = prompt("Enter your name:");
  if (!displayName || !displayName.trim()) displayName = "Guest";

  socket.emit("join-session", { code, name: displayName }, (success) => {
    if (success) {
      document.getElementById("chat-open-btn").style.display = "flex"; // ✅ joiner sees chat button
      closeListenModal();
      showChatButton();
       isHost = false;
    } else {
      showNotification("Invalid session code");
    }
  });
}


function leaveSession() {
  console.log('Leaving session, currentSessionCode:', currentSessionCode);
  leaveSessionUIReset();
  if (currentSessionCode) {
    socket.emit('leave-session', { code: currentSessionCode });
  }
  currentSessionCode = null;
  isHost = false;
  participants = {};
  document.getElementById('chat-container').style.display = 'none';
  document.getElementById('participants-list').style.display = 'none';
  enableControls();
  showNotification('Left session');
  document.getElementById('chat-container').classList.remove('open');
  updateChatButtonVisibility();
  hideChatButton();
}

function renderParticipants() {
  const ul = document.getElementById('participants-ul');
  ul.innerHTML = '';
  Object.keys(participants).forEach(userId => {
    const li = document.createElement('li');
    li.textContent = `${userId.slice(0, 4)} ${participants[userId].isHost ? '(Host)' : ''}`;
    ul.appendChild(li);
  });
}

function disableControls() {
  playPauseBtn.disabled = true;
  document.getElementById('next-btn').disabled = true;
  document.getElementById('prev-btn').disabled = true;
  document.getElementById('fav-btn').disabled = true;
  document.getElementById('loop-btn').disabled = true;
  const controls = document.querySelectorAll('.player-controls button');
  controls.forEach(btn => btn.classList.add('disabled'));
}

function enableControls() {
  playPauseBtn.disabled = false;
  document.getElementById('next-btn').disabled = false;
  document.getElementById('prev-btn').disabled = false;
  document.getElementById('fav-btn').disabled = false;
  document.getElementById('loop-btn').disabled = false;
  const controls = document.querySelectorAll('.player-controls button');
  controls.forEach(btn => btn.classList.remove('disabled'));
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input.value.trim()) return;
  socket.emit('chat-message', { message: input.value });
  input.value = '';
}



function toggleParticipants() {
  const list = document.getElementById('participants-ul');
  const btn = event.target;
  if (list.style.display === 'none') {
    list.style.display = 'block';
    btn.textContent = '-';
  } else {
    list.style.display = 'none';
    btn.textContent = '+';
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* =================== */
/* Other Controls */
function toggleLoop() {
  if (!isHost && currentSessionCode) {
     showNotification('Only the host can control playback.');
    return; 
  }
  audioPlayer.loop = !audioPlayer.loop;
  loopBtn.innerHTML = audioPlayer.loop ? '<i class="fa-solid fa-repeat"></i>' : '<i class="fa-regular fa-repeat"></i>';
}

function setVolume(value) {
  audioPlayer.volume = parseFloat(value);
}

function focusSearch() {
  searchInput.focus();
  libraryView.style.display = 'none';
  document.getElementById('home-content').style.display = 'none';
  resultsList.style.display = 'block';
  hideBackButton();
}

function displayResults(data) {
  resultsList.innerHTML = '';

  // ----- Songs -----
  lastSongResults = data.songs.results || [];
  if (lastSongResults.length > 0) {
    const songsHeader = document.createElement('h3');
    songsHeader.textContent = 'Songs';
    resultsList.appendChild(songsHeader);

    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';
    lastSongResults.slice(0, visibleSongCount).forEach(song => {
      const normalizedSong = normalizeSong(song);
      if (!songHistory.some(s => s.id === normalizedSong.id)) {
        songHistory.push(normalizedSong);
      }
      const card = createSongCard(normalizedSong);
      cards.appendChild(card);
    });
    container.appendChild(cards);
    resultsList.appendChild(container);

    let loadMoreBtn = document.getElementById('songs-load-more');
    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'songs-load-more';
      loadMoreBtn.className = 'load-more-btn';
      loadMoreBtn.textContent = 'Load More';
      resultsList.appendChild(loadMoreBtn);
    }
    if (lastSongResults.length > visibleSongCount) {
      loadMoreBtn.style.display = 'block';
      loadMoreBtn.onclick = () => {
        visibleSongCount += 5;
        displayResults({
          songs: { results: lastSongResults },
          artists: data.artists,
          albums: data.albums,
          playlists: data.playlists            // keep playlists when re-rendering
        });
      };
    } else {
      loadMoreBtn.style.display = 'none';
    }
  }

  // ----- Artists -----
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
          <div class="play-btn" title="View Songs"
               onclick="event.stopPropagation(); fetchArtistSongs('${encodeURIComponent(artist.id)}',
               '${artist.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-play"></i></div>
        </div>
      `;
      card.addEventListener('click', () => fetchArtistSongs(artist.id, artist.name));
      cards.appendChild(card);
    });
    container.appendChild(cards);
    resultsList.appendChild(container);
  }

  // ----- Albums -----
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
          <div class="play-btn" title="View Songs"
               onclick="event.stopPropagation(); fetchAlbumSongs('${encodeURIComponent(album.id)}',
               '${album.title.replace(/'/g, "\\'")}')"><i class="fa-solid fa-play"></i></div>
        </div>
      `;
      card.addEventListener('click', () => fetchAlbumSongs(album.id, album.title));
      cards.appendChild(card);
    });
    container.appendChild(cards);
    resultsList.appendChild(container);
  }

  // ----- Playlists (NEW) -----
  if (data.playlists?.results?.length > 0) {
    const playlistsHeader = document.createElement('h3');
    playlistsHeader.textContent = 'Playlists';
    resultsList.appendChild(playlistsHeader);

    const container = document.createElement('div');
    container.className = 'song-container';
    const cards = document.createElement('div');
    cards.className = 'cards';

    data.playlists.results.slice(0, 3).forEach(pl => {
      // pick the best available image (fall back to default.png)
      const img =
        pl.image?.find(i => i.quality === '150x150')?.url ||
        pl.image?.[0]?.url ||
        'default.png';

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${img}" alt="${pl.name}" />
        <div class="card-body">
          <div class="song-name">${pl.name}</div>
          <div class="artist-name">${pl.language || ''} • ${pl.songCount} songs</div>
        </div>
        <div class="play-down">
          <div class="play-btn" title="View Songs"
               onclick="event.stopPropagation(); fetchPlaylistSongs('${encodeURIComponent(pl.id)}',
               '${pl.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-play"></i></div>
        </div>
      `;
      card.addEventListener('click', () => fetchPlaylistSongs(pl.id, pl.name));
      cards.appendChild(card);
    });

    container.appendChild(cards);
    resultsList.appendChild(container);
  }

  // ----- No results -----
  if (
    !data.songs.results.length &&
    !data.artists.results.length &&
    !data.albums.results.length &&
    !(data.playlists?.results?.length)
  ) {
    resultsList.innerHTML = '<span>No results found.</span>';
  }

  markStateChanged();
  saveState();
}

function createSongPickerModal(playlistIdx) {
  const modal = document.createElement('div');
  modal.className = 'song-picker-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h4>Add Songs to Playlist</h4>
      <input type="text" id="song-picker-search" placeholder="Search songs..." oninput="filterSongPicker(this.value)" />
      <div class="song-picker-list" id="song-picker-list" data-playlist-idx="${playlistIdx}"></div>
      <div class="modal-buttons">
        <button onclick="closeSongPickerModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  filterSongPicker('');
}
function updateChatButtonVisibility() {
  const chatButton = document.getElementById('chat-open-btn');
  if (!chatButton) {
    console.error('Chat button not found in DOM');
    return;
  }
  console.log('Updating chat button visibility, currentSessionCode:', currentSessionCode);
  if (currentSessionCode) {
    chatButton.style.display = 'flex';
    chatButton.classList.remove('hidden');
    console.log('Chat button set to display: flex');
  } else {
    chatButton.style.display = 'none';
    chatButton.classList.add('hidden');
    console.log('Chat button set to display: none');
  }
}

async function loadMoreArtistSongs() {
  if (!currentArtistId) return;
  artistPage++;
  await fetchArtistSongs(currentArtistId, searchInput.value.replace('Songs by ', ''), artistPage, true);
}

/* =================== */
/* WebSocket Handlers */
socket.on('session-created', ({ code }) => {
  console.log('Session created, code:', code);
  currentSessionCode = code;
  isHost = true;
  document.getElementById('session-code').textContent = code;
  document.getElementById('session-code-display').classList.remove('hidden');
  //showSessionUI();
  const listenOptions = document.getElementById('listen-options');
  if (listenOptions) {
    listenOptions.classList.add('hidden');
    console.log('Listen options hidden in session-created');
  }
  closeListenModal();
  const chatButton = document.getElementById('chat-open-btn');
  if (chatButton) {
    chatButton.style.display = 'flex';
    chatButton.classList.remove('hidden');
    console.log('Chat button shown in session-created');
  } else {
    console.error('Chat button not found in session-created');
  }
  const shareBtn = document.createElement('button');
  shareBtn.textContent = 'Share Code';
  shareBtn.onclick = () => navigator.clipboard.writeText(code).then(() => showNotification('Code copied!'));
  document.getElementById('session-code-display').appendChild(shareBtn);
  showNotification('Session hosted! Share the code: ' + code);
  updateChatButtonVisibility();
  showChatButton();
});

/*
socket.on('session-joined', ({ code, isHost: host }) => {
  currentSessionCode = code;
  isHost = host;
  closeListenModal();
  //showSessionUI();
  if (!isHost) disableControls();
  showNotification(`Joined session ${code}`);
document.getElementById("chat-open-btn").style.display = "flex";
});*/
socket.on('session-joined', ({ code, isHost: host }) => {
  console.log('Session joined, code:', code, 'isHost:', host);
  currentSessionCode = code;
  isHost = host;
  closeListenModal();
  //showSessionUI();
  if (!isHost) disableControls();
  const chatButton = document.getElementById('chat-open-btn');
  if (chatButton) {
    chatButton.style.display = 'flex';
    chatButton.classList.remove('hidden');
    console.log('Chat button shown in session-joined');
  } else {
    console.error('Chat button not found in session-joined');
  }
  showNotification(`Joined session ${code}`);
  updateChatButtonVisibility();
});

socket.on('error', ({ message }) => {
  showNotification(message);
});

socket.on('connect_error', () => {
  showNotification('Connection to server failed. Please try again.');
  leaveSession();
});

socket.on('disconnect', () => {
  showNotification('Disconnected from server.');
  leaveSession();
});

socket.on('user-joined', ({ userId, isHost }) => {
  participants[userId] = { isHost };
  renderParticipants();
  showNotification(`User ${userId.slice(0, 4)} joined`);
});

socket.on('user-left', ({ userId }) => {
  delete participants[userId];
  renderParticipants();
  showNotification(`User ${userId.slice(0, 4)} left`);
});

socket.on('session-ended', ({ message }) => {
  showNotification(message);
  leaveSession();
});

socket.on('playback-control', data => {
  if (isHost) return;
  handlePlaybackControl(data);
});

socket.on('sync-state', state => {
  if (isHost) return;
  if (state.song) {
    loadSongWithoutPlaying(state.song);
    audioPlayer.currentTime = state.currentTime || 0;
    if (state.isPlaying) audioPlayer.play().catch(err => console.error('Playback error:', err));
    else audioPlayer.pause();
  }
});

socket.on('request-state', ({ forUser }) => {
  if (!isHost) return;
  const state = {
    song: songHistory[currentSongIndex],
    currentTime: audioPlayer.currentTime,
    isPlaying: !audioPlayer.paused,
  };
  socket.emit('provide-state', { forUser, state });
});

socket.on('chat-message', ({ userId, message }) => {
  const chatMessages = document.getElementById('chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.textContent = `${userId.slice(0, 4)}: ${message}`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function handlePlaybackControl(data) {
  switch (data.action) {
    case 'play-song':
      if (data.song) playSong(data.song, false);
      break;
    case 'pause':
      if (isPlaying) playPause();
      break;
    case 'play':
      if (!isPlaying) playPause();
      break;
    case 'next':
      playNext();
      break;
    case 'previous':
      playPrevious();
      break;
  }
}

/* =================== */
/* Initialization */
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('session');
  if (code) {
    document.getElementById('session-code-input').value = code;
    joinSession();
  }
  setGreeting();
  loadHomeContent();
  renderQueue();

  if (currentSongIndex >= 0 && songHistory[currentSongIndex]) {
    loadSongWithoutPlaying(songHistory[currentSongIndex]);
  }

  setInterval(saveState, 10000); // Save state every 10 seconds

  audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    document.getElementById('progress').style.width = `${percentage}%`;
    document.getElementById('progress-circle').style.left = `calc(${percentage}% - 6px)`;
    document.getElementById('current-time').textContent = formatTime(audioPlayer.currentTime);
    document.getElementById('duration').textContent = formatTime(audioPlayer.duration);
  });

  document.querySelector('.player-progress').addEventListener('click', seek);

  const volumeSlider = document.getElementById('volume-slider');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      audioPlayer.volume = parseFloat(volumeSlider.value) / 100;
    });
  }

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  document.addEventListener('click', handleOutsideClick);

  searchInput.addEventListener('click', () => {
    searchInput.select();
  });

document.getElementById('listen-together-btn').addEventListener('click', () => {
  openListenModal();
});


  document.getElementById('host-session-btn').addEventListener('click', () => {
    socket.emit('create-session');
  });

  document.getElementById('join-session-btn').addEventListener('click', () => {
    document.getElementById('join-input').style.display = 'block';
  });

  document.getElementById('close-modal').addEventListener('click', closeListenModal);
  document.getElementById('send-chat-btn').addEventListener('click', sendChatMessage);

  audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    playerBar.classList.add('playing');
  });

  audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    playerBar.classList.remove('playing');
  });

  audioPlayer.addEventListener('ended', playNext);

  searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') searchSongs();
  });

  document.querySelector('.search-container button').addEventListener('click', searchSongs);

  document.getElementById('next-btn').addEventListener('click', playNext);
  document.getElementById('prev-btn').addEventListener('click', playPrevious);
  document.getElementById('play-pause-btn').addEventListener('click', playPause);
  document.getElementById('fav-btn').addEventListener('click', addToFavoritesFromPlayer);
  document.getElementById('loop-btn').addEventListener('click', toggleLoop);
  document.getElementById('queue-open-btn').addEventListener('click', dropQueue);
  document.getElementById('empty-queue').addEventListener('click', emptyQueue);

if (moreBtn) {
  moreBtn.addEventListener('click', () => {
    if (currentArtistId) {
      // For artist-specific lists
      currentPage++;
      loadMoreArtistSongs();
    } else {
      // For general search results
      //currentPage++;
      fetchResults();
    }
  });
}


  setInterval(() => {
    if (isHost && currentSessionCode && songHistory[currentSongIndex]) {
      socket.emit(
        'sync-state',
        {
          song: songHistory[currentSongIndex],
          currentTime: audioPlayer.currentTime,
          isPlaying: !audioPlayer.paused,
        },
        error => {
          if (error) {
            showNotification('Failed to sync playback. Check your connection.');
          }
        }
      );
    }
  }, 2000); // Sync every 2 seconds
});

function handleOutsideClick(event) {
  if (
    queueContainer.classList.contains('open') &&
    !queueContainer.contains(event.target) &&
    !event.target.closest('#queue-open-btn') &&
    !event.target.closest('#q-open-btn')
  ) {
    queueContainer.classList.remove('open');
  }

  if (
    sidebar.classList.contains('open') &&
    !sidebar.contains(event.target) &&
    !event.target.closest('#sidebar-toggle')
  ) {
    sidebar.classList.remove('open');
  }
}
/* === Listen-Together UI helpers === */
function openListenModal() {
  // show the main listen-together modal, keep join-input hidden first
  document.getElementById('listen-together-modal').classList.remove('hidden');
  document.getElementById('join-input').classList.add('hidden');
}

function showJoinInput() {
  // hide host/join/cancel buttons and show the join-code input
  document.getElementById('listen-options').classList.add('hidden');
  document.getElementById('join-input').classList.remove('hidden');
}

function leaveSessionUIReset() {
  console.log('Resetting session UI');
  document.getElementById('session-code-display').classList.add('hidden');
  document.getElementById('participants-list').classList.add('hidden');
  document.getElementById('chat-container').classList.add('hidden');
  document.getElementById('listen-together-modal').classList.add('hidden');
  document.getElementById('listen-options').classList.remove('hidden');
  document.getElementById('join-input').classList.add('hidden');
  updateChatButtonVisibility();
}


// Global functions for onclick handlers
window.playSong = playSong;
window.addToQueue = addToQueue;
window.toggleFavorites = toggleFavorites;
window.addToFavorites = addToFavorites;
window.removeFromFavorites = removeFromFavorites;
window.downloadSong = downloadSong;
window.removeFromQueue = removeFromQueue;
window.playPause = playPause;
window.playNext = playNext;
window.playPrevious = playPrevious;
window.toggleLoop = toggleLoop;
window.addToFavoritesFromPlayer = addToFavoritesFromPlayer;
window.dropQueue = dropQueue;
window.emptyQueue = emptyQueue;
window.loadFavorites = loadFavorites;
window.loadPlaylists = loadPlaylists;
window.createPlaylistModal = createPlaylistModal;
window.closePlaylistModal = closePlaylistModal;
window.createSongPickerModal = createSongPickerModal;
window.closeSongPickerModal = closeSongPickerModal;
window.addToPlaylist = addToPlaylist;
window.removeFromPlaylist = removeFromPlaylist;
window.deletePlaylist = deletePlaylist;
window.fetchArtistSongs = fetchArtistSongs;
window.fetchAlbumSongs = fetchAlbumSongs;
window.searchSongs = searchSongs;
window.goBack = goBack;
window.showAddToPlaylistModal = showAddToPlaylistModal;
window.closeAddToPlaylistModal = closeAddToPlaylistModal;
window.createPlaylist = createPlaylist;
window.toggleChat = toggleChat;
window.toggleParticipants = toggleParticipants;
window.joinSession = joinSession;
window.closeListenModal = closeListenModal;
window.sendChatMessage = sendChatMessage;
//window.hostSession = hostSession;

