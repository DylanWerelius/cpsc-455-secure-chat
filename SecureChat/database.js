//Created by Victoria Guzman
// database.js (SQLite version)
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

const dbFolder = path.join(process.cwd(), 'logs');
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

let db;

export async function getDatabase() {
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

export async function saveMessage(sender, recipient, message) {
  const db = await getDatabase();
  await db.run(
    `INSERT INTO messages (sender, recipient, message) VALUES (?, ?, ?)`,
    sender,
    recipient,
    message
  );
}

export async function getMessagesBetween(sender, recipient) {
  const db = await getDatabase();
  return db.all(
    `SELECT * FROM messages WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?) ORDER BY timestamp ASC`,
    sender, recipient, recipient, sender
  );
}

export async function getRecentMessages(limit = 100) {
  const db = await getDatabase();
  return db.all(
    `SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?`,
    limit
  );
}

export async function createUser(username, hashedPassword) {
  const db = await getDatabase();
  await db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    username,
    hashedPassword
  );
}

export async function findUserByUsername(username) {
  const db = await getDatabase();
  return db.get(
    `SELECT * FROM users WHERE username = ?`,
    username
  );
} 

export async function getAllUsers() {
  const db = await getDatabase();
  const rows = await db.all(`SELECT username FROM users`);
  return rows.map(r => r.username);
}
