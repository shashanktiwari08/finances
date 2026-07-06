const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(express.json());

// Initialize PostgreSQL if DATABASE_URL is present
let pool = null;
if (process.env.DATABASE_URL) {
  console.log('PostgreSQL database URL detected. Connecting to database...');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render/Neon PostgreSQL
  });

  // Create table if it doesn't exist
  const initDb = async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ledger_storage (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      console.log('Database initialized successfully: ledger_storage table is ready.');
    } catch (err) {
      console.error('Failed to initialize database table:', err);
    }
  };
  initDb();
} else {
  console.log('No DATABASE_URL found. Falling back to local db.json file.');
}

// Helper to read local database
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return {};
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('Error reading local database:', err);
    return {};
  }
}

// Helper to write local database
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing local database:', err);
  }
}

// Get storage key
app.get('/api/storage', async (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  if (pool) {
    try {
      const result = await pool.query('SELECT value FROM ledger_storage WHERE key = $1', [key]);
      if (result.rows.length > 0) {
        // Since values were stored stringified in the local fallback, we check if they need parsing
        // or return them directly. To keep behavior exact, we'll parse it if it is valid JSON,
        // or return the raw string.
        let rawVal = result.rows[0].value;
        try {
          res.json({ value: JSON.parse(rawVal) });
        } catch (e) {
          res.json({ value: rawVal });
        }
      } else {
        res.json({ value: null });
      }
    } catch (err) {
      console.error('Database get error:', err);
      res.status(500).json({ error: 'Database read error' });
    }
  } else {
    const db = readDB();
    res.json({ value: db[key] !== undefined ? db[key] : null });
  }
});

// Set storage key
app.post('/api/storage', async (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'Missing key in body' });
  }

  // Ensure value is stored as a stringified representation
  const stringifiedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (pool) {
    try {
      await pool.query(
        'INSERT INTO ledger_storage (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, stringifiedValue]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Database set error:', err);
      res.status(500).json({ error: 'Database write error' });
    }
  } else {
    const db = readDB();
    db[key] = value;
    writeDB(db);
    res.json({ success: true });
  }
});

// List storage keys with prefix
app.get('/api/storage/list', async (req, res) => {
  const { prefix } = req.query;
  if (prefix === undefined) {
    return res.status(400).json({ error: 'Missing prefix parameter' });
  }

  if (pool) {
    try {
      const result = await pool.query('SELECT key FROM ledger_storage WHERE key LIKE $1', [`${prefix}%`]);
      const keys = result.rows.map(row => row.key);
      res.json({ keys });
    } catch (err) {
      console.error('Database list error:', err);
      res.status(500).json({ error: 'Database query error' });
    }
  } else {
    const db = readDB();
    const keys = Object.keys(db).filter(k => k.startsWith(prefix));
    res.json({ keys });
  }
});

// Serve frontend daily ledger page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'shashank-daily-ledger.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
