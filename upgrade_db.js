const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("database.sqlite");

db.serialize(() => {
  db.run(`
    ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0
  `, (err) => {
    if (err) {
      console.log("Column may already exist:", err.message);
    } else {
      console.log("Added is_admin column.");
    }
  });
});

db.close();