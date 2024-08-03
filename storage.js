import sqlite3 from "sqlite3";

const db = new sqlite3.Database("data.db");

/** @typedef { pid: number, pnid: string, fc: string, hash: string } User */
db.run(`CREATE TABLE IF NOT EXISTS users (
    pid INTEGER,
    pnid TEXT,
    fc TEXT,
    hash TEXT
);`);

/**
 * Pushes a new user to the database.
 * 
 * @param {User} user The user data
 */
export function pushUser(user) {
    return new Promise(resolve => {
        db.run(`INSERT INTO users (pid, pnid, fc, hash)
        VALUES (?, ?, ?, ?);`, [user.pid, user.pnid, user.fc, user.hash], resolve);
    });
}

/**
 * Gets a user from the database by PNID.
 * 
 * @param {string} pnid The user PNID
 * @returns {User} The user object
 */
export function getUserByPNID(pnid) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE pnid = ?;`, [pnid], (err, data) => {
            if(err) reject(err);
            else resolve(data);
        });
    });
}