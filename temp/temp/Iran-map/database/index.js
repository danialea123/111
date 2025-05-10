// Database operations for inventory management
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database connection
let db = null;

// Initialize database
async function initializeDatabase() {
  try {
    // Create DB directory if it doesn't exist
    const dbDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Open database
    const dbPath = path.join(dbDir, 'inventory.db');
    console.log(`Connected to SQLite database at: ${dbPath}`);
    
    db = new Database(dbPath, { verbose: console.log });
    
    // Create tables if they don't exist
    createTables();
    
    // Initialize item data if needed
    await initializeItemData();
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error initializing database:', error);
    return Promise.reject(error);
  }
}

// Create tables
function createTables() {
  // Create items table
  db.exec(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    quantity INTEGER DEFAULT 0,
    category TEXT DEFAULT 'drug',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  
  console.log('Items table created or already exists');
  
  // Create logs table
  db.exec(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    ic_player_name TEXT,
    ooc_player_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  
  console.log('Logs table created or already exists');
  
  // Create XP tables
  db.exec(`CREATE TABLE IF NOT EXISTS drug_task_xp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ic_player_name TEXT NOT NULL,
    ooc_player_name TEXT NOT NULL,
    xp_amount INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reset_date TEXT NOT NULL
  )`);
  
  console.log('Drug Task XP table created or already exists');
  
  db.exec(`CREATE TABLE IF NOT EXISTS gang_task_xp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ic_player_name TEXT NOT NULL,
    ooc_player_name TEXT NOT NULL,
    xp_amount INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reset_period INTEGER NOT NULL,
    reset_date TEXT NOT NULL
  )`);
  
  console.log('Gang Task XP table created or already exists');
}

// Initialize item data
async function initializeItemData() {
  // Check if items exist
  const count = db.prepare('SELECT COUNT(*) as count FROM items').get().count;
  
  // If no items exist, add default items
  if (count === 0) {
    console.log('No items found, initializing default items');
    
    // Default items with initial quantity of 10
    const defaultItems = [
      { name: 'Crack', quantity: 10, category: 'drug' },
      { name: 'Ghaarch', quantity: 10, category: 'drug' },
      { name: 'Marijuana', quantity: 10, category: 'drug' },
      { name: 'Shishe', quantity: 10, category: 'drug' },
      { name: 'Cocaine', quantity: 10, category: 'drug' }
    ];
    
    // Prepare insert statement
    const insert = db.prepare('INSERT OR IGNORE INTO items (name, quantity, category) VALUES (?, ?, ?)');
    
    // Insert default items one by one with error handling
    for (const item of defaultItems) {
      try {
        const result = insert.run(item.name, item.quantity, item.category);
        if (result.changes > 0) {
          console.log(`Added item: ${item.name}`);
        }
      } catch (itemErr) {
        console.warn(`Error adding item ${item.name}:`, itemErr);
        // Continue with next item
      }
    }
    
    // Check how many items we have now
    const newCount = db.prepare('SELECT COUNT(*) as count FROM items').get().count;
    console.log(`Database now contains ${newCount} items`);
  } else {
    console.log(`Database already contains ${count} items`);
  }
}

// Get all items
function getItems() {
  try {
    const rows = db.prepare('SELECT * FROM items ORDER BY category, name').all();
    return Promise.resolve(rows);
  } catch (error) {
    return Promise.reject(error);
  }
}

// Get item by name
function getItemByName(name) {
  try {
    const row = db.prepare('SELECT * FROM items WHERE name = ? COLLATE NOCASE').get(name);
    return Promise.resolve(row);
  } catch (error) {
    return Promise.reject(error);
  }
}

// Update item quantity
async function updateItemQuantity(name, quantity, icPlayerName, oocPlayerName) {
  try {
    // Check if item exists
    const item = await getItemByName(name);
    
    if (!item) {
      return Promise.reject(new Error(`Item not found: ${name}`));
    }
    
    // Update item quantity
    const result = db.prepare(
      'UPDATE items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ? COLLATE NOCASE'
    ).run(quantity, name);
    
    if (result.changes === 0) {
      return Promise.reject(new Error(`Failed to update item: ${name}`));
    }
    
    // Get updated item
    const updatedItem = await getItemByName(name);
    return Promise.resolve(updatedItem);
  } catch (error) {
    return Promise.reject(error);
  }
}

// Process transaction (add or remove items)
async function processTransaction(type, itemName, quantity, icPlayerName, oocPlayerName) {
  try {
    // Validate inputs
    if (!itemName) {
      return Promise.reject(new Error('Item name is required'));
    }
    
    if (!quantity || quantity <= 0) {
      return Promise.reject(new Error('Quantity must be a positive number'));
    }
    
    // Get current item
    const item = await getItemByName(itemName);
    
    if (!item) {
      return Promise.reject(new Error(`Item not found: ${itemName}`));
    }
    
    // Calculate new quantity
    let newQuantity;
    if (type === 'add') {
      newQuantity = item.quantity + quantity;
    } else if (type === 'remove') {
      newQuantity = item.quantity - quantity;
      
      // Ensure quantity doesn't go below 0
      if (newQuantity < 0) {
        return Promise.reject(new Error(`Not enough ${itemName} in inventory. Current: ${item.quantity}`));
      }
    } else {
      return Promise.reject(new Error('Invalid transaction type. Must be "add" or "remove"'));
    }
    
    // Update item quantity
    const updatedItem = await updateItemQuantity(itemName, newQuantity, icPlayerName, oocPlayerName);
    
    // Log the transaction
    await addLog(type, {
      item_name: itemName,
      quantity,
      ic_player_name: icPlayerName,
      ooc_player_name: oocPlayerName
    });
    
    return Promise.resolve(updatedItem);
  } catch (error) {
    return Promise.reject(error);
  }
}

// Add log entry
function addLog(type, data) {
  try {
    const result = db.prepare(
      'INSERT INTO logs (type, item_name, quantity, ic_player_name, ooc_player_name) VALUES (?, ?, ?, ?, ?)'
    ).run(type, data.item_name, data.quantity, data.ic_player_name, data.ooc_player_name);
    
    return Promise.resolve({
      id: result.lastInsertRowid,
      type,
      ...data,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

// Get logs
function getLogs(limit = 100) {
  try {
    const rows = db.prepare(
      'SELECT * FROM logs ORDER BY created_at DESC LIMIT ?'
    ).all(limit);
    
    return Promise.resolve(rows);
  } catch (error) {
    return Promise.reject(error);
  }
}

// Close database connection
function closeDatabase() {
  if (db) {
    console.log('Process exiting, closing database...');
    try {
      db.close();
      return Promise.resolve();
    } catch (error) {
      console.error('Error closing database:', error.message);
      return Promise.reject(error);
    }
  }
  return Promise.resolve();
}

// Close database on process exit
process.on('exit', () => {
  if (db) {
    try {
      console.log('Process exiting, closing database...');
      db.close();
    } catch (error) {
      console.error('Error closing database on exit:', error);
    }
  }
});

// XP MANAGEMENT FUNCTIONS

// Helper function to format current date in YYYY-MM-DD format
function getCurrentDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Get current reset period for gang tasks (1 = morning 6AM-6PM, 2 = night 6PM-6AM)
function getCurrentGangResetPeriod() {
  const now = new Date();
  const hour = now.getHours();
  return (hour >= 6 && hour < 18) ? 1 : 2;
}

// Add Drug Task XP
async function addDrugTaskXP(icPlayerName, oocPlayerName, xpAmount) {
  try {
    // Check if this player has already completed a drug task today
    const today = getCurrentDateString();
    const existing = db.prepare(
      'SELECT * FROM drug_task_xp WHERE ic_player_name = ? AND reset_date = ?'
    ).get(icPlayerName, today);
    
    if (existing) {
      return Promise.reject(new Error(`Player ${icPlayerName} has already completed a drug task today`));
    }
    
    // Check if we've reached the daily limit (5 players)
    const dailyCount = db.prepare(
      'SELECT COUNT(*) as count FROM drug_task_xp WHERE reset_date = ?'
    ).get(today).count;
    
    if (dailyCount >= 5) {
      return Promise.reject(new Error('Daily limit of 5 drug tasks has been reached'));
    }
    
    // Add drug task XP
    const result = db.prepare(
      'INSERT INTO drug_task_xp (ic_player_name, ooc_player_name, xp_amount, reset_date) VALUES (?, ?, ?, ?)'
    ).run(icPlayerName, oocPlayerName, xpAmount, today);
    
    return Promise.resolve({
      id: result.lastInsertRowid,
      ic_player_name: icPlayerName,
      ooc_player_name: oocPlayerName,
      xp_amount: xpAmount,
      reset_date: today
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

// Get Drug Task XP Status
function getDrugTaskXPStatus() {
  try {
    const today = getCurrentDateString();
    const players = db.prepare(
      'SELECT * FROM drug_task_xp WHERE reset_date = ? ORDER BY created_at ASC'
    ).all(today);
    
    return Promise.resolve({
      date: today,
      count: players.length,
      limit: 5,
      players: players
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

// Add Gang Task XP
async function addGangTaskXP(icPlayerName, oocPlayerName, xpAmount) {
  try {
    // Check the current reset period
    const today = getCurrentDateString();
    const currentPeriod = getCurrentGangResetPeriod();
    
    // Check if this player has already completed a gang task in this period
    const existing = db.prepare(
      'SELECT * FROM gang_task_xp WHERE ic_player_name = ? AND reset_date = ? AND reset_period = ?'
    ).get(icPlayerName, today, currentPeriod);
    
    if (existing) {
      return Promise.reject(new Error(`Player ${icPlayerName} has already completed a gang task in this period`));
    }
    
    // Add gang task XP
    const result = db.prepare(
      'INSERT INTO gang_task_xp (ic_player_name, ooc_player_name, xp_amount, reset_period, reset_date) VALUES (?, ?, ?, ?, ?)'
    ).run(icPlayerName, oocPlayerName, xpAmount, currentPeriod, today);
    
    return Promise.resolve({
      id: result.lastInsertRowid,
      ic_player_name: icPlayerName,
      ooc_player_name: oocPlayerName,
      xp_amount: xpAmount,
      reset_period: currentPeriod,
      reset_date: today
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

// Get Gang Task XP Status
function getGangTaskXPStatus() {
  try {
    const today = getCurrentDateString();
    
    // Get morning period (6AM-6PM)
    const morningPlayers = db.prepare(
      'SELECT * FROM gang_task_xp WHERE reset_date = ? AND reset_period = 1 ORDER BY created_at ASC'
    ).all(today);
    
    // Get night period (6PM-6AM)
    const nightPlayers = db.prepare(
      'SELECT * FROM gang_task_xp WHERE reset_date = ? AND reset_period = 2 ORDER BY created_at ASC'
    ).all(today);
    
    // Current period
    const currentPeriod = getCurrentGangResetPeriod();
    
    return Promise.resolve({
      date: today,
      currentPeriod: currentPeriod,
      morningPlayers: morningPlayers, // 6AM-6PM
      nightPlayers: nightPlayers, // 6PM-6AM
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

// Export functions
module.exports = {
  initializeDatabase,
  getItems,
  getItemByName,
  updateItemQuantity,
  processTransaction,
  addLog,
  getLogs,
  addDrugTaskXP,
  getDrugTaskXPStatus,
  addGangTaskXP,
  getGangTaskXPStatus,
  closeDatabase
};