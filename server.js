const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(express.json());

// Helper to read database
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return {};
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('Error reading database:', err);
    return {};
  }
}

// Helper to write database
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database:', err);
  }
}

// Get storage key
app.get('/api/storage', (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }
  const db = readDB();
  res.json({ value: db[key] !== undefined ? db[key] : null });
});

// Set storage key
app.post('/api/storage', (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'Missing key in body' });
  }
  const db = readDB();
  db[key] = value;
  writeDB(db);
  res.json({ success: true });
});

// List storage keys with prefix
app.get('/api/storage/list', (req, res) => {
  const { prefix } = req.query;
  if (prefix === undefined) {
    return res.status(400).json({ error: 'Missing prefix parameter' });
  }
  const db = readDB();
  const keys = Object.keys(db).filter(k => k.startsWith(prefix));
  res.json({ keys });
});

// Serve frontend daily ledger page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'shashank-daily-ledger.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
