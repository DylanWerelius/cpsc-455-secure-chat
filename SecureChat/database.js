//Created by Victoria Guzman
// database.js (SQLite version)
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const dbFolder = path.join(process.cwd(), 'logs');
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

let db;

async function getDatabase() {
  if (!db) {
    const dbFolder = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

    const dbPath = path.join(dbFolder, 'chat.sqlite');
    console.log("SQLite DB will be saved to:", dbPath);

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  return db;
}

async function saveMessage(sender, recipient, message) {
  const db = await getDatabase();
  await db.run(
    `INSERT INTO messages (sender, recipient, message) VALUES (?, ?, ?)`,
    sender,
    recipient,
    message
  );
}

async function getMessagesBetween(sender, recipient) {
  const db = await getDatabase();
  return db.all(
    `SELECT * FROM messages WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?) ORDER BY timestamp ASC`,
    sender, recipient, recipient, sender
  );
}

async function getRecentMessages(limit = 100) {
  const db = await getDatabase();
  return db.all(
    `SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?`,
    limit
  );
}

async function createUser(username, hashedPassword) {
  const db = await getDatabase();
  await db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    username,
    hashedPassword
  );
}

async function findUserByUsername(username) {
  const db = await getDatabase();
  return db.get(
    `SELECT * FROM users WHERE username = ?`,
    username
  );
} 

async function getAllUsers() {
  const db = await getDatabase();
  const rows = await db.all(`SELECT username FROM users`);
  return rows.map(r => r.username);
}

module.exports = {
  getDatabase,
  saveMessage,
  getMessagesBetween,
  getRecentMessages,
  createUser,
  findUserByUsername,
  getAllUsers
};