const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

module.exports = async function seedAdmin() {
  const db = new sqlite3.Database("/opt/render/project/data/database.sqlite");

  console.log("Checking for existing admin user...");

  db.get("SELECT * FROM users WHERE is_admin = 1", async (err, row) => {
    if (err) {
      console.error("Database error:", err);
      return db.close();
    }

    if (row) {
      console.log("Admin user already exists:", row.username);
      return db.close();
    }

    console.log("No admin found — creating default admin user...");

    const username = "admin";
    const password = "admin123";
    const hash = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (username, password_hash, attending, is_admin) VALUES (?, ?, ?, ?)",
      [username, hash, 1, 1],
      (err) => {
        if (err) {
          console.error("Failed to create admin:", err);
        } else {
          console.log("Admin user created successfully!");
          console.log("   Username:", username);
          console.log("   Password:", password);
        }
        db.close();
      }
    );
  });
};