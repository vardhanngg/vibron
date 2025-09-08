import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Use JSON parser for API requests
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// API routes
app.use('/api/songByMood', require('./songByMood'));
app.use('/api/search', require('./search'));

// Example route
app.get('/', (req, res) => {
  res.send('Hello, Mood Music Player!');
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(`[server] Unhandled error: ${err.message}`);
  res.setHeader('Content-Type', 'application/json');
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
