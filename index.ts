import express from 'express';
import path from 'path';
import { inject } from '@vercel/analytics';

const app = express();

// Initialize Vercel Analytics
inject();
const PORT = process.env.PORT || 3000;

// Parse JSON for APIs
app.use(express.json());

// Serve public folder
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/songByMood', require('./api/songByMood'));
app.use('/api/search', require('./api/search'));

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'normal.html'));
});

app.get('/normal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'normal.html'));
});

app.get('/mood', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mood.html'));
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(`[server] Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
