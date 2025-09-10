// public/socket-client.js
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = 'https://socket.vibronmax.com';

class ListenTogether {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.userId = `user_${Math.floor(Math.random() * 1000000)}`;
  }

  connect() {
    this.socket = io(SOCKET_SERVER_URL);
    this.socket.on('room-state', (state) => {
      // Broadcast this event so UI can listen and sync player
      document.dispatchEvent(new CustomEvent('room-state', { detail: state }));
    });
  }

  createRoom() {
    this.roomId = this._generateRoomId();
    this.joinRoom(this.roomId);
    return this.roomId;
  }

  joinRoom(roomId) {
    this.roomId = roomId;
    this.socket.emit('join-room', { roomId, userId: this.userId });
  }

  sendPlaybackUpdate(currentSong, currentTime, isPlaying) {
    if (!this.roomId) return;
    this.socket.emit('playback-update', {
      roomId: this.roomId,
      currentSong,
      currentTime,
      isPlaying,
    });
  }

  _generateRoomId() {
    return Math.random().toString(36).slice(2, 8);
  }
}

const listenTogether = new ListenTogether();
listenTogether.connect();

export default listenTogether;
