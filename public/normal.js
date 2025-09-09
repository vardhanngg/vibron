// ==== State ====
let songHistory = JSON.parse(localStorage.getItem('songHistory') || '[]');
let currentSongIndex = parseInt(localStorage.getItem('currentSongIndex') || '-1');
let queue = JSON.parse(localStorage.getItem('queue') || '[]');
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let playlists = JSON.parse(localStorage.getItem('playlists') || '[]');

const searchInput = document.getElementById('searchInput');
const songList = document.getElementById('song-list');
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
  libraryView.style.display = 'none'; // Ensure libraryView is hidden on load
  songList.style.display = 'grid'; // Show search results area
  renderQueue();

  if (currentSongIndex >= 0 && songHistory[currentSongIndex]) {
    loadSongWithoutPlaying(songHistory[currentSongIndex]); // Load but don't play
  }

  // Auto-save state every 5 seconds
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
  if (!query) return showNotification('Please enter a search term.');

  currentQuery = query;
  currentPage = 0;
  songList.innerHTML = '';
  libraryView.style.display = 'none';
  moreBtn.style.display = 'block';

  await fetchSongs();
}

async function fetchSongs() {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}&limit=10`);
    if (!response.ok) throw new Error('Search failed');

    const data = await response.json();

    if (!data.songs?.results?.length) {
      showNotification('No more songs found');
      moreBtn.style.display = 'none';
      return;
    }

    displaySongs(data.songs.results);
    currentPage++;
  } catch (err) {
    console.error(err);
    showNotification('Error fetching songs');
  }
}

function loadMoreSongs() {
  fetchSongs();
}

function displaySongs(songs) {
  songs.forEach(song => {
    const card = document.createElement('div');
    card.classList.add('song-card');
    card.innerHTML = `
      <img src="${song.image || 'default.png'}" alt="${song.title}" />
      <div class="song-title">${song.title}</div>
      <div class="artist-name">${song.artist}</div>
      <button class="add-queue" onclick="event.stopPropagation(); addToQueue('${song.id}')"><i class="fa-solid fa-plus"></i></button>
      <button class="add-fav" onclick="event.stopPropagation(); addToFavorites('${song.id}')"><i class="fa-solid fa-heart"></i></button>
    `;
    card.addEventListener('click', () => playSong(song));
    songList.appendChild(card);

    if (!songHistory.some(s => s.id === song.id)) songHistory.push(song);
  });
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
  isPlaying = false; // Ensure paused state
  playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  saveState();
}

function playSong(song) {
  currentSongIndex = songHistory.findIndex(s => s.id === song.id);
  if (currentSongIndex === -1) {
    songHistory.push(song);
    currentSongIndex = songHistory.length - 1;
  }

  audioPlayer.src = song.audioUrl;
  audioPlayer.play().catch(err => {
    console.error('Playback error:', err);
    showNotification('Failed to play song. Check console.');
  });

  albumArt.src = song.image || 'default.png';
  nowPlaying.textContent = song.title;
  artistName.textContent = song.artist;

  playerBar.classList.add('playing');
  isPlaying = true;
  playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';

  addToQueue(song.id); // Auto-add to queue

  if (queue.length < 5) autoAddSimilar(song); // Auto-queue similar songs

  saveState();
}

function playPause() {
  if (isPlaying) {
    audioPlayer.pause();
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    playerBar.classList.remove('playing');
  } else {
    audioPlayer.play().catch(err => console.error(err));
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    playerBar.classList.add('playing');
  }
  isPlaying = !isPlaying;
}

function playNext() {
  if (queue.length > 0) {
    const nextSong = queue.shift();
    playSong(nextSong);
  } else if (currentSongIndex < songHistory.length - 1) {
    currentSongIndex++;
    playSong(songHistory[currentSongIndex]);
  } else {
    showNotification('No next song. Try searching more!');
  }
  renderQueue();
  saveState();
}

function playPrevious() {
  if (currentSongIndex > 0) {
    currentSongIndex--;
    playSong(songHistory[currentSongIndex]);
  }
}

// ==== Queue Management ====
function addToQueue(songId) {
  const song = [...songHistory, ...queue].find(s => s.id === songId);
  if (song && !queue.some(q => q.id === songId)) {
    queue.push(song);
    renderQueue();
    saveState();
    console.log('Added to queue:', song.title);
  }
}

async function autoAddSimilar(currentSong) {
  try {
    const similarQuery = `${currentSong.artist} similar songs`;
    const response = await fetch(`/api/search?q=${encodeURIComponent(similarQuery)}&page=0&limit=3`);
    const data = await response.json();

    data.songs?.results?.forEach(similarSong => {
      if (!queue.some(q => q.id === similarSong.id) && similarSong.id !== currentSong.id) {
        addToQueue(similarSong.id);
      }
    });
  } catch (err) {
    console.error('Auto-add failed:', err);
  }
}

function renderQueue() {
  if (queue.length === 0) {
    queueList.innerHTML = '<span>No songs in queue</span>';
    return;
  }

  queueList.innerHTML = queue.map((song, idx) => `
    <div class="queue-item">
      <span onclick="playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'})">
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
  songPickerList.dataset.playlistIdx = songPickerList.dataset.playlistIdx; // Preserve playlistIdx
}

function closeSongPickerModal() {
  const modal = document.querySelector('.song-picker-modal');
  if (modal) modal.remove();
}

function createPlaylistModal() {
  const modal = document.createElement('div');
  modal.className = 'song-picker-modal'; // Reuse song-picker-modal for consistent styling
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
    // Update libraryView if currently showing Favorites
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Favorites</h4>')) {
      loadFavorites();
    }
    showNotification('Added to favorites!');
  }
}

function addToFavoritesFromPlayer() {
  if (currentSongIndex >= 0 && songHistory[currentSongIndex]) {
    addToFavorites(songHistory[currentSongIndex].id);
  } else {
    showNotification('No song is currently playing.');
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
  playSong(songsToQueue[0]);
  renderQueue();
  saveState();
}

function loadFavorites() {
  libraryView.style.display = 'block';
  songList.style.display = 'none';
  libraryView.innerHTML = `
    <h4>Favorites</h4>
    <button onclick="playAllFavorites()" ${favorites.length === 0 ? 'disabled' : ''}>Play All</button>
    <button onclick="playAllFavorites(true)" ${favorites.length === 0 ? 'disabled' : ''}>Shuffle All</button>
    ${favorites.length ? favorites.map(song => `
      <div class="playlist-item">
        <span onclick="playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'})">${song.title} - ${song.artist}</span>
      </div>`).join('') : '<span>No favorites yet</span>'}
  `;
  moreBtn.style.display = 'none';
}

function createPlaylist(name) {
  if (name.trim()) {
    playlists.push({ name, songs: [] });
    saveState();
    // Update libraryView if currently showing Playlists
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
    // Update libraryView if currently showing Playlists
    if (libraryView.style.display === 'block' && libraryView.innerHTML.includes('<h4>Playlists</h4>')) {
      loadPlaylists();
    }
    showNotification('Added to playlist!');
    closeSongPickerModal();
  }
}

function loadPlaylists() {
  libraryView.style.display = 'block';
  songList.style.display = 'none';
  libraryView.innerHTML = `
    <h4>Playlists</h4>
    <button onclick="createPlaylistModal()">+ New</button>
    ${playlists.map((pl, idx) => `
      <div class="playlist-item">
        <h5>${pl.name} (${pl.songs.length})</h5>
        ${pl.songs.map(song => `
          <span onclick="playSong({id: '${song.id}', title: '${song.title}', artist: '${song.artist}', image: '${song.image}', audioUrl: '${song.audioUrl}'})">${song.title}</span>
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
  songList.style.display = 'grid';
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
moreBtn.addEventListener('click', loadMoreSongs);
audioPlayer.addEventListener('timeupdate', updateProgress);
audioPlayer.addEventListener('loadedmetadata', updateDuration);
audioPlayer.addEventListener('ended', playNext);
audioPlayer.addEventListener('play', () => {
  isPlaying = true;
  playerBar.classList.add('playing');
});
audioPlayer.addEventListener('pause', () => {
  isPlaying = false;
  playerBar.classList.remove('playing');
});
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchSongs();
});