const sqlite3 = require("sqlite3").verbose();

module.exports = function initDB() {
  const db = new sqlite3.Database("/opt/render/project/data/database.sqlite");

  db.serialize(() => {
    console.log("Initializing database...");

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        attending INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        claimed_by INTEGER,
        FOREIGN KEY (claimed_by) REFERENCES users(id)
      )
    `);

    console.log("Tables ensured (users, dishes)");
  });

  db.close();
};