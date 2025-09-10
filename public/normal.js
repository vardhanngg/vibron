// ==== State ====
let songHistory = JSON.parse(localStorage.getItem('songHistory') || '[]');
let currentSongIndex = parseInt(localStorage.getItem('currentSongIndex') || '-1');
let queue = JSON.parse(localStorage.getItem('queue') || '[]');
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let playlists = JSON.parse(localStorage.getItem('playlists') || '[]');

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

// ==== Initialization ====
window.addEventListener('load', () => {
  libraryView.style.display = 'none';
  resultsList.style.display = 'grid';
  renderQueue();

  if (currentSongIndex >= 0 && songHistory[currentSongIndex]) {
    loadSongWithoutPlaying(songHistory[currentSongIndex]);
  }

  setInterval(saveState, 5000);
});

// ==== Save State ====
function saveState() {
  localStorage.setItem('songHistory', JSON.stringify(songHistory));
  localStorage.setItem('currentSongIndex', currentSongIndex.toString());
  localStorage.setItem('queue', JSON.stringify(queue));
  localStorage.setItem('favorites', JSON.stringify(favorites));
  localStorage.setItem('playlists', JSON.stringify(playlists));
}

// ==== Search & Fetch ====
async function searchSongs() {
  const query = searchInput.value.trim();
  if (!query) return;

  currentQuery = query;
  currentPage = 0;
  resultsList.innerHTML = '';
  libraryView.style.display = 'none';
  moreBtn.style.display = 'block';

  await fetchResults();
}

async function fetchResults() {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}&limit=10`);
    if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);

    const data = await response.json();

    if (!data.songs?.results?.length && !data.artists?.results?.length && !data.albums?.results?.length) {
      moreBtn.style.display = 'none';
      return;
    }

    displayResults(data);
    moreBtn.style.display = data.songs.next || data.artists.next || data.albums.next ? 'block' : 'none';
    currentPage++;
  } catch (err) {
    moreBtn.style.display = 'none';
    return;
  }
}

async function fetchArtistSongs(artistId, artistName) {
  try {
    const response = await fetch(`/api/artist/${encodeURIComponent(artistId)}`);
    if (!response.ok) throw new Error(`Artist fetch failed: ${response.statusText}`);

    const data = await response.json();
    resultsList.innerHTML = '';
    libraryView.style.display = 'none';
    searchInput.value = `Songs by ${artistName}`;
    moreBtn.style.display = 'none'; // No pagination for artist songs

    if (data.songs?.results?.length) {
      data.songs.results.forEach(song => {
        if (!songHistory.some(s => s.id === song.id)) {
          songHistory.push(song);
        }
        const card = document.createElement('div');
        card.classList.add('song-card');
        card.innerHTML = `
          <img src="${song.image || 'default.png'}" alt="${song.title}" />
          <div class="song-title">${song.title}</div>
          <div class="artist-name">${song.artist}</div>
          <button class="add-queue" onclick="event.stopPropagation(); addToQueue('${song.id}')"><i class="fa-solid fa-plus"></i></button>
          <button class="add-fav" onclick="event.stopPropagation(); addToFavorites('${song.id}')"><i class="fa-solid fa-heart${favorites.some(f => f.id === song.id) ? ' favorited' : ''}"></i></button>
        `;
        card.addEventListener('click', () => playSong(song, true));
        resultsList.appendChild(card);
      });
    } else {
      resultsList.innerHTML = '<span>No songs found for this artist.</span>';
    }
    saveState();
  } catch (err) {
    resultsList.innerHTML = '<span>Error loading artist songs.</span>';
  }
}

async function fetchAlbumSongs(albumId, albumTitle) {
  try {
    const response = await fetch(`/api/album/${encodeURIComponent(albumId)}`);
    if (!response.ok) throw new Error(`Album fetch failed: ${response.statusText}`);

    const data = await response.json();
    resultsList.innerHTML = '';
    libraryView.style.display = 'none';
    searchInput.value = `Songs from ${albumTitle}`;
    moreBtn.style.display = 'none'; // No pagination for album songs

    if (data.songs?.results?.length) {
      data.songs.results.forEach(song => {
        if (!songHistory.some(s => s.id === song.id)) {
          songHistory.push(song);
        }
        const card = document.createElement('div');
        card.classList.add('song-card');
        card.innerHTML = `
          <img src="${song.image || 'default.png'}" alt="${song.title}" />
          <div class="song-title">${song.title}</div>
          <div class="artist-name">${song.artist}</div>
          <button class="add-queue" onclick="event.stopPropagation(); addToQueue('${song.id}')"><i class="fa-solid fa-plus"></i></button>
          <button class="add-fav" onclick="event.stopPropagation(); addToFavorites('${song.id}')"><i class="fa-solid fa-heart${favorites.some(f => f.id === song.id) ? ' favorited' : ''}"></i></button>
        `;
        card.addEventListener('click', () => playSong(song, true));
        resultsList.appendChild(card);
      });
    } else {
      resultsList.innerHTML = '<span>No songs found in this album.</span>';
    }
    saveState();
  } catch (err) {
    resultsList.innerHTML = '<span>Error loading album songs.</span>';
  }
}

function loadMoreResults() {
  fetchResults();
}

function displayResults(data) {
  // Display songs
  data.songs.results.forEach(song => {
    if (!songHistory.some(s => s.id === song.id)) {
      songHistory.push(song);
      const card = document.createElement('div');
      card.classList.add('song-card');
      card.innerHTML = `
        <img src="${song.image || 'default.png'}" alt="${song.title}" />
        <div class="song-title">${song.title}</div>
        <div class="artist-name">${song.artist}</div>
        <button class="add-queue" onclick="event.stopPropagation(); addToQueue('${song.id}')"><i class="fa-solid fa-plus"></i></button>
        <button class="add-fav" onclick="event.stopPropagation(); addToFavorites('${song.id}')"><i class="fa-solid fa-heart${favorites.some(f => f.id === song.id) ? ' favorited' : ''}"></i></button>
      `;
      card.addEventListener('click', () => playSong(song, true));
      resultsList.appendChild(card);
    }
  });

  // Display artists
  data.artists.results.forEach(artist => {
    const card = document.createElement('div');
    card.classList.add('artist-card');
    card.innerHTML = `
      <img src="${artist.image || 'default.png'}" alt="${artist.name}" />
      <div class="artist-title">${artist.name}</div>
      <div class="artist-role">${artist.role}</div>
    `;
    card.addEventListener('click', () => fetchArtistSongs(artist.id, artist.name));
    resultsList.appendChild(card);
  });

  // Display albums
  data.albums.results.forEach(album => {
    const card = document.createElement('div');
    card.classList.add('album-card');
    card.innerHTML = `
      <img src="${album.image || 'default.png'}" alt="${album.title}" />
      <div class="album-title">${album.title}</div>
      <div class="album-artists">${album.primaryArtists}</div>
      <div class="album-year">${album.year} (${album.songCount} songs)</div>
    `;
    card.addEventListener('click', () => fetchAlbumSongs(album.id, album.title));
    resultsList.appendChild(card);
  });

  saveState();
}

// ==== Playback ====
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
  updateBackground(song);
  updateFavoriteButton();
  saveState();
}

function playSong(song, fromSearch = false) {
  currentSongIndex = songHistory.findIndex(s => s.id === song.id);
  if (currentSongIndex === -1) {
    songHistory.push(song);
    currentSongIndex = songHistory.length - 1;
  }

  audioPlayer.src = song.audioUrl;
  audioPlayer.play().catch(() => {});

  albumArt.src = song.image || 'default.png';
  nowPlaying.textContent = song.title;
  artistName.textContent = song.artist;

  playerBar.classList.add('playing');
  isPlaying = true;
  playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  updateBackground(song);
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

function updateBackground(song) {
  const artistLower = song.artist.toLowerCase();
  const titleLower = song.title.toLowerCase();
  const moodMap = {
    happy: ['party', 'dance', 'upbeat'],
    sad: ['sad', 'melancholy'],
    angry: ['item', 'rock', 'metal'],
    neutral: ['love', 'chill'],
    surprised: ['mass', 'energetic'],
    disgusted: ['instrumental', 'classical'],
    fearful: ['romantic', 'ballad']
  };
  let mood = 'neutral';
  for (const [moodKey, keywords] of Object.entries(moodMap)) {
    if (keywords.some(k => artistLower.includes(k) || titleLower.includes(k))) {
      mood = moodKey;
      break;
    }
  }
  const moodToImage = {
    happy: 'party.gif',
    sad: 'sad.gif',
    angry: 'item.gif',
    neutral: 'love.gif',
    surprised: 'mass.gif',
    disgusted: 'instruments.gif',
    fearful: 'romantic.gif'
  };
  const imageName = moodToImage[mood] || 'love.gif';
  document.body.style.background = `url('/public/${imageName}') no-repeat center center fixed`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundColor = 'transparent';
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

// ==== Queue Management ====
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

// ==== Favorites & Playlists ====
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
  libraryView.innerHTML = `
    <h4>Favorites</h4>
    <button onclick="playAllFavorites()" ${favorites.length === 0 ? 'disabled' : ''}>Play All</button>
    <button onclick="playAllFavorites(true)" ${favorites.length === 0 ? 'disabled' : ''}>Shuffle All</button>
    ${favorites.length ? favorites.map(song => `
      <div class="playlist-item">
        <span onclick="playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false)">${song.title} - ${song.artist}</span>
        <button class="remove-fav" onclick="event.stopPropagation(); removeFromFavorites('${song.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>`).join('') : '<span>No favorites yet</span>'}
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
  libraryView.innerHTML = `
    <h4>Playlists</h4>
    <button onclick="createPlaylistModal()">+ New</button>
    ${playlists.map((pl, idx) => `
      <div class="playlist-item">
        <h5>${pl.name} (${pl.songs.length})</h5>
        <button class="delete-playlist" onclick="event.stopPropagation(); deletePlaylist(${idx})"><i class="fa-solid fa-trash"></i></button>
        ${pl.songs.map(song => `
          <div class="playlist-song">
            <span onclick="playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'}, false)">${song.title} - ${song.artist}</span>
            <button class="remove-from-playlist" onclick="event.stopPropagation(); removeFromPlaylist(${idx}, '${song.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        `).join('')}
        <button onclick="createSongPickerModal(${idx})">+ Add Song</button>
      </div>
    `).join('')}
  `;
  moreBtn.style.display = 'none';
}

// ==== Other Controls ====
function toggleLoop() {
  audioPlayer.loop = !audioPlayer.loop;
  loopBtn.innerHTML = audioPlayer.loop
    ? '<i class="fa-solid fa-repeat" style="color: var(--accent);"></i>'
    : '<i class="fa-solid fa-repeat"></i>';
}

function setVolume(value) {
  audioPlayer.volume = parseFloat(value);
}

function focusSearch() {
  searchInput.focus();
  libraryView.style.display = 'none';
  resultsList.style.display = 'grid';
}

function toggleSidebar() {
  sidebar.classList.toggle('open');
}

// Close sidebar on outside clicks
document.addEventListener('click', (e) => {
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !e.target.closest('#sidebar-toggle')) {
    sidebar.classList.remove('open');
  }
});

// Close sidebar on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
  }
});

// ==== Progress & Events ====
function updateProgress() {
  if (!audioPlayer.duration) return;
  const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  document.getElementById('progress').style.width = `${percentage}%`;
  document.getElementById('progress-circle').style.left = `calc(${percentage}% - 6px)`;
  document.getElementById('current-time').textContent = formatTime(audioPlayer.currentTime);
}

function updateDuration() {
  document.getElementById('duration').textContent = formatTime(audioPlayer.duration);
}

function seek(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  audioPlayer.currentTime = percent * audioPlayer.duration;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==== Event Listeners ====
moreBtn.addEventListener('click', loadMoreResults);
audioPlayer.addEventListener('timeupdate', updateProgress);
audioPlayer.addEventListener('loadedmetadata', updateDuration);
audioPlayer.addEventListener('ended', playNext);
audioPlayer.addEventListener('play', () => {
  isPlaying = true;
  playerBar.classList.add('playing');
  if (currentSongIndex >= 0 && songHistory[currentSongIndex]) {
    updateBackground(songHistory[currentSongIndex]);
  }
});
audioPlayer.addEventListener('pause', () => {
  isPlaying = false;
  playerBar.classList.remove('playing');
  document.body.style.background = `url('/public/pause.gif') no-repeat center center fixed`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundColor = 'transparent';
});
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchSongs();
});