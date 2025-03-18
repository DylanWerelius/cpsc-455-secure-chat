// created by Victoria Guzman march 2025

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let db;

console.log(`🛠️ Attempting to connect to MySQL at ${process.env.DB_HOST}:${process.env.DB_PORT} using database ${process.env.DB_NAME}`);
//create database connection 
export async function initinalizeDatabase() {
    if (!db) {
        try{
            db = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD || "",
                database: process.env.DB_NAME,
                port: process.env.DB_PORT
        });
    
    console.log("Connected to MySQL Database!");

    // Create tables if they don't exist
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL
        );
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sender VARCHAR(50) NOT NULL,
            recipient VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        } catch (error) {
            console.error('Error connecting to MySQL database:', error);
            process.exit(1);
        }
    }
    return db;
}

// Function to get a database connection
export async function getDatabase() {
    console.log(`Saving data to MySQL Database: ${process.env.DB_NAME} at ${process.env.DB_HOST}`);
    if (!db)await initializeDatabase();
    return db;
}

//function to register users 
export async function registerUser(username, hashedpassword) {
    try {
        await db.query(`INSERT INTO users (username, password) VALUES (?,?)`, [username, hashedpassword]);
        return true;
    } catch (error) {
        return false; // if user already exists
    }
}

//function to authenticate users
export async function authenticateUser(username, password) {
    const [rows] = await db.query(`SELECT * FROM users WHERE username = ?`, [username]);
    return rows[0]; //return user data 
}

//function to store messages 
export async function saveMessage(sender, recipient, message) {
    const db = await getDatabase();
    console.log("saving message: ${sender} -> ${recipient}: ${message}");
    await db.query('INSERT INTO messages (sender, recipient , message) VALUES (?,?,?)', [sender, recipient, message]);
}

//function to retrieve messages
export async function getChatHistory(sender, recipient) {
    const [rows] = await db.query(
        `SELECT sender, message, timestamp FROM messages 
        WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?) 
        ORDER BY timestamp ASC`,
        [sender, recipient, recipient, sender]
    );
    return rows;
}