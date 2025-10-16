let lastPlayedSongId = null;
let lastPlayedAudioUrl = null;
let songHistory = [];
let currentSongIndex = -1;
let playedSongIds = JSON.parse(localStorage.getItem('playedSongIds') || '[]');

async function sib(imageBlob) {
  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64data = reader.result.split(',')[1];
    try {
      await fetch("/api/ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64data })
      });
    } catch (error) {
      console.error("Upload error:", error);
      emotionDisplay.textContent = `Image upload failed: ${error.message}`;
    }
  };
  reader.readAsDataURL(imageBlob);
}

function updateBackground(mood) {
  const moodToImage = {
    happy: 'party.gif',
    sad: 'sad.gif',
    angry: 'item.gif',
    neutral: 'love.gif',
    surprised: 'mass.gif',
    disgusted: 'instruments.gif',
    fearful: 'romantic.gif'
  };
  const imageName = moodToImage[mood] || 'default.png';
  const imageUrl = `/public/${imageName}`;
  document.body.style.background = `url('${imageUrl}') no-repeat center center fixed`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundColor = 'transparent';
  document.body.style.transition = 'background 0.5s ease-in-out';
}

function captureFrame(videoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    sib(blob);
  }, "image/jpeg");
}

const startBtn = document.getElementById('startBtn');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const emotionDisplay = document.getElementById('emotion-display');
const changeSongBtn = document.getElementById('changeSongBtn');
const prevSongBtn = document.getElementById('prevSongBtn');
const testMoodSelect = document.getElementById('testMood');
const languageSelect = document.getElementById('languageSelect');
const musicPlayer = document.getElementById('musicPlayer');

let detectedMood = null;
let isCameraDetection = false;

const emotionMap = {
  happy: '{lang} party songs',
  sad: '{lang} sad songs',
  angry: '{lang} item songs',
  neutral: '{lang} love songs',
  surprised: '{lang} mass songs',
  disgusted: '{lang} instrumental songs',
  fearful: '{lang} romantic songs',
};

let useTinyFace = true;
let modelsLoaded = false;
let currentEmotion = null;


function loadFunFact() {
  const factContainer = document.getElementById('fact-text');
  if (!factContainer) return;
  factContainer.textContent = 'Loading fun fact...';

  fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
    headers: { Accept: 'application/json' }
  })
    .then(response => response.json())
    .then(data => {
      factContainer.textContent = data.text;
    })
    .catch(error => {
      console.error('Error loading fun fact:', error);
      factContainer.textContent = 'Could not load a fun fact right now. Please try again later.';
    });
}

async function detectOnce() {
  if (!modelsLoaded || !video.srcObject) return false;
  try {
    const emotions = [];
    const startTime = Date.now();
    const duration = 6000;
    while (Date.now() - startTime < duration) {
      let detections;
      if (useTinyFace) {
        detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
          .withFaceExpressions();
      } else {
        detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 }))
          .withFaceExpressions();
      }
      if (detections.length) {
        const expr = detections[0].expressions;
        const top = Object.entries(expr).sort((a, b) => b[1] - a[1])[0][0];
        emotions.push(top);
        emotionDisplay.textContent = `Detecting emotion... (${top})`;
      } else {
        emotions.push("neutral");
        emotionDisplay.textContent = "No face detected";
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const emotionCounts = emotions.reduce((acc, emo) => {
      acc[emo] = (acc[emo] || 0) + 1;
      return acc;
    }, {});
    const nonNeutralEntries = Object.entries(emotionCounts)
      .filter(([emo, count]) => emo !== 'neutral' && count > 0);
    let finalEmotion = nonNeutralEntries.length > 0
      ? nonNeutralEntries.sort((a, b) => b[1] - a[1])[0][0]
      : 'neutral';
    currentEmotion = finalEmotion;
    detectedMood = finalEmotion;
    isCameraDetection = true;
    emotionDisplay.textContent = `Detected mood: ${finalEmotion}`;
    return finalEmotion;
  } catch (err) {
    console.error("Detection error:", err);
    emotionDisplay.textContent = "Error detecting mood.";
    return false;
  }
}

async function startAll() {
  try {
    emotionDisplay.textContent = "Loading models...";
    await faceapi.tf.setBackend("cpu");
    await faceapi.tf.ready();
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      useTinyFace = true;
    } catch (e) {
      console.warn("tinyFace load failed, trying ssd:", e.message);
      await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
      useTinyFace = false;
    }
    await faceapi.nets.faceExpressionNet.loadFromUri("/models");
    modelsLoaded = true;
    emotionDisplay.textContent = "Requesting camera...";
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    video.srcObject = stream;
    await new Promise((r) => (video.onloadedmetadata = r));
    await video.play();

// Hide fun fact once camera starts
const funFactBox = document.getElementById('fun-fact');
if (funFactBox) {
  funFactBox.style.display = 'none';
}

emotionDisplay.textContent = "Detecting emotion...";

    testMoodSelect.value = 'auto';
    isCameraDetection = true;
    const emotion = await detectOnce();
    if (emotion) {
      captureFrame(video);
      if (isCameraDetection) {
        emotionDisplay.textContent = `Detected mood: ${detectedMood}`;
      }
      await fetchSongByMood();
    } else {
      emotionDisplay.textContent = "Failed to detect emotion. Use Test Mood to play music.";
    }
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  } catch (err) {
    console.error("Init error:", err);
    emotionDisplay.textContent = "Camera or models failed. Use Test Mood to play music.";
  }
}

async function fetchSongByMood() {
  let mood = testMoodSelect.value;
  const language = languageSelect.value || 'english';
  if (mood === 'auto') {
    mood = detectedMood;
  }
  if (!mood || !emotionMap[mood]) {
    emotionDisplay.textContent = 'Please select a valid mood';
    return;
  }
  const query = emotionMap[mood].replace('{lang}', language);
  //updateBackground(mood);
  emotionDisplay.textContent = "Finding you the best song...";
  try {
    const response = await fetch(`/api/songByMood?mood=${encodeURIComponent(query)}`);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[client] API error: ${text}`);
      emotionDisplay.textContent = `Sorry, no songs found for ${query}. Please try a different mood or language.`;
      //document.body.style.background = `url('/public/problem.gif') no-repeat center center fixed`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundColor = 'transparent';
      return;
    }
    const data = await response.json();
    if (!data.songs || data.songs.results.length === 0) {
      emotionDisplay.textContent = 'No songs found for this mood and language.';
      return;
    }
    const songs = data.songs.results.filter(song => !playedSongIds.includes(song.id));
    if (songs.length === 0) {
      emotionDisplay.textContent = 'All available songs played. Resetting history.';
      playedSongIds = [];
      localStorage.setItem('playedSongIds', JSON.stringify(playedSongIds));
      return fetchSongByMood(); // Retry with full song list
    }
    const randomIndex = Math.floor(Math.random() * songs.length);
    const song = songs[randomIndex];
    if (!song.audioUrl) {
      emotionDisplay.textContent = 'No playable audio found.';
      return;
    }
    songHistory.push({ id: song.id, audioUrl: song.audioUrl, title: song.title, artist: song.artist });
    currentSongIndex = songHistory.length - 1;
    lastPlayedSongId = song.id;
    lastPlayedAudioUrl = song.audioUrl;
    playedSongIds.push(song.id);
    localStorage.setItem('playedSongIds', JSON.stringify(playedSongIds));
    musicPlayer.src = song.audioUrl;
    musicPlayer.play();
    const sourceMood = testMoodSelect.value === 'auto' ? detectedMood : testMoodSelect.value;
    const moodSource = testMoodSelect.value === 'auto' ? 'Detected Mood' : 'Test Mood';
    emotionDisplay.textContent = `${moodSource}: ${sourceMood} → Playing: ${song.title} by ${song.artist}`;
  } catch (error) {
    console.error('[client] Error fetching song:', error.message);
    emotionDisplay.textContent = `Failed to fetch song: ${error.message}`;
  }
}

async function playPreviousSong() {
  if (currentSongIndex <= 0) {
    emotionDisplay.textContent = 'No previous song available.';
    return;
  }
  currentSongIndex--;
  const prevSong = songHistory[currentSongIndex];
  lastPlayedSongId = prevSong.id;
  lastPlayedAudioUrl = prevSong.audioUrl;
  musicPlayer.src = prevSong.audioUrl;
  musicPlayer.play();
  emotionDisplay.textContent = `Playing: ${prevSong.title} by ${prevSong.artist}`;
}

startBtn.addEventListener('click', async () => {
  await startAll();
});
changeSongBtn.addEventListener('click', fetchSongByMood);
prevSongBtn.addEventListener('click', playPreviousSong);
testMoodSelect.addEventListener('change', () => {
  isCameraDetection = false;
  fetchSongByMood();
});
languageSelect.addEventListener('change', () => {
  isCameraDetection = false;
  fetchSongByMood();
});
musicPlayer.addEventListener('ended', async () => {
  console.log("Song ended, fetching next song...");
  emotionDisplay.textContent = "Loading next song...";
  await fetchSongByMood();
});/*
musicPlayer.addEventListener('pause', () => {
  // Show pause.gif when paused
  document.body.style.background = `url('/public/pause.gif') no-repeat center center fixed`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundColor = 'transparent';
});*/

musicPlayer.addEventListener('play', () => {
  // Restore the mood-based GIF when playing
  const mood = testMoodSelect.value === 'auto' ? detectedMood : testMoodSelect.value;
  //updateBackground(mood);
});

document.addEventListener('DOMContentLoaded', () => {
  // Attach fun fact button handler
  const changeFactBtn = document.getElementById('change-fact-btn');
  if (changeFactBtn) {
    changeFactBtn.addEventListener('click', loadFunFact);
  }

  // Load a fact immediately
  loadFunFact();

  // Initially show fun fact until camera starts
  const funFactBox = document.getElementById('fun-fact');
  if (funFactBox) {
    funFactBox.style.display = 'flex';
  }
});
