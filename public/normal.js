// normal.js
let songHistory = [];
let currentSongIndex = -1;
let playedSongIds = JSON.parse(localStorage.getItem('playedSongIds') || '[]');

const searchInput = document.getElementById('searchInput');
const songList = document.getElementById('song-list');
const audioPlayer = document.getElementById('audio-player');
const albumArt = document.getElementById('album-art');
const nowPlaying = document.getElementById('now-playing');
const artistName = document.getElementById('artist-name');
const moreBtn = document.getElementById('more');

let currentQuery = '';
let currentPage = 0;

async function searchSongs() {
  currentQuery = searchInput.value.trim();
  if (!currentQuery) return alert('Please enter a search term.');
  currentPage = 0;
  songList.innerHTML = '';
  await fetchSongs();
}

async function fetchSongs() {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}&limit=10`);
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    if (!data.songs || !data.songs.results.length) return alert('No songs found');
    displaySongs(data.songs.results);
    currentPage++;
  } catch (err) {
    console.error(err);
    alert('Error fetching songs');
  }
}

function displaySongs(songs) {
  songs.forEach((song, index) => {
    const card = document.createElement('div');
    card.classList.add('song-card');
    card.innerHTML = `
      <img src="${song.image || 'default.png'}" alt="${song.title}" />
      <div class="song-title">${song.title}</div>
      <div class="song-artist">${song.artist}</div>
    `;
    card.addEventListener('click', () => playSong(song));
    songList.appendChild(card);
    songHistory.push(song);
  });
}

function playSong(song) {
  currentSongIndex = songHistory.findIndex(s => s.id === song.id);
  audioPlayer.src = song.audioUrl;
  audioPlayer.play();
  albumArt.src = song.image || 'default.png';
  nowPlaying.textContent = song.title;
  artistName.textContent = song.artist;
}

function playNext() {
  if (currentSongIndex < songHistory.length - 1) {
    playSong(songHistory[currentSongIndex + 1]);
  } else {
    alert('No next song.');
  }
}

function playPause() {
  if (audioPlayer.paused) audioPlayer.play();
  else audioPlayer.pause();
}

function toggleLoop() {
  audioPlayer.loop = !audioPlayer.loop;
  document.getElementById('loop-btn-icon').style.color = audioPlayer.loop ? 'var(--accent)' : 'white';
}

function updateProgress() {
  const progress = document.getElementById('progress');
  const circle = document.getElementById('progress-circle');
  const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  progress.style.width = `${percentage}%`;
  circle.style.left = `calc(${percentage}% - 6px)`;
  document.getElementById('current-time').textContent = formatTime(audioPlayer.currentTime);
}

function updateDuration() {
  document.getElementById('duration').textContent = formatTime(audioPlayer.duration);
}

function seek(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audioPlayer.currentTime = percent * audioPlayer.duration;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' + s : s}`;
}

moreBtn.addEventListener('click', fetchSongs);
audioPlayer.addEventListener('timeupdate', updateProgress);
audioPlayer.addEventListener('loadedmetadata', updateDuration);
audioPlayer.addEventListener('ended', playNext);
