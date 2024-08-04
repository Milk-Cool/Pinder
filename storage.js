import sqlite3 from "sqlite3";

const db = new sqlite3.Database("data.db");

/** @typedef {{ pid: number, pnid: string, fc: string, hash: string }} User */
db.run(`CREATE TABLE IF NOT EXISTS users (
    pid INTEGER,
    pnid TEXT,
    fc TEXT,
    hash TEXT
);`);

/*
0 - from skipped
1 - from sent
2 - to sent (unused)
3 - both sent, match
*/
/** @typedef { 0 | 1 | 3 } SwipeType */
/** @typedef {{ id: number?, from_u: string, to_u: string, type: SwipeType }} Swipe */
db.run(`CREATE TABLE IF NOT EXISTS swipes (
    id INTEGER PRIMARY KEY,
    from_u TEXT,
    to_u TEXT,
    type INTEGER
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
 * @returns {Promise<User>} The user object
 */
export function getUserByPNID(pnid) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE pnid = ?;`, [pnid], (err, data) => {
            if(err) reject(err);
            else resolve(data);
        });
    });
}

/**
 * Pushes a new swipe to the database.
 * 
 * @param {Swipe} swipe The swipe data
 */
export function pushSwipe(swipe) {
    return new Promise(resolve => {
        db.run(`INSERT INTO swipes (from, to, type)
        VALUES (?, ?, ?);`, [swipe.from, swipe.to, swipe.type], resolve);
    });
}

/**
 * Gets a swipe from the database by its ID.
 * 
 * @param {number} id The swipe ID
 * @returns {Promise<Swipe>} The swipe object
 */
export function getSwipeByID(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM swipes WHERE id = ?;`, [id], (err, data) => {
            if(err) reject(err);
            else resolve(data);
        });
    });
}

/**
 * Updadtes a swipe's type in the database.
 * 
 * @param {number} id The swipe ID
 * @param {Promise<SwipeType>} type The swipe type
 */
export function updateSwipe(id, type) {
    return new Promise(resolve => {
        db.run(`UPDATE swipes SET type = ?
        WHERE id = ?;`, [type, id], resolve);
    });
}

/**
 * Recommends users to a specific user. 
 * 
 * @param {string} user The user PNID
 * @return {Promise<User[]>} Recommended users
*/
export function recommendUsers(user) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT u.*
        FROM swipes s
        INNER JOIN users u ON s.from_u = u.pnid
        WHERE s.to_u = ? AND s.type = 1;`, [user], (err, data) => {
            if(err) reject(err);
            else if(data.length < 10) db.all(`SELECT *
            FROM users u
            WHERE u.pnid NOT IN (
              SELECT s.to_u
              FROM swipes s
              WHERE s.from_u = ?
            ) AND u.pnid != ?
            ORDER BY RANDOM()
            LIMIT 10;`, [user, user], (err2, data2) => {
                if(err2) reject(err2);
                else resolve(data.concat(data2));
            })
            else resolve(data);
        });
    });
}