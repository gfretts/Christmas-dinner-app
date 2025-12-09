const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const db = new sqlite3.Database("database.sqlite");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: "super-secret-christmas-key",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(express.static(path.join(__dirname, "public")));

// Simple auth guard
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login.html");
  }
  next();
}

// Routes

// Root -> redirect to menu if logged in, otherwise to index
app.get("/", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/menu.html");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Signup
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Username and password required");
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    db.run(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, hash],
      function (err) {
        if (err) {
          console.error(err);
          return res
            .status(400)
            .send("That username is taken. Please choose another.");
        }
        res.redirect("/login.html");
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error");
  }
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
    if (!user) {
      return res.status(400).send("Invalid username or password");
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).send("Invalid username or password");
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect("/menu.html");
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// Get current user info
app.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    id: req.session.userId,
    username: req.session.username,req.session.userId = user.id;
req.session.username = user.username;
req.session.is_admin = user.is_admin === 1;
  });
});

// Get dishes
app.get("/dishes", (req, res) => {
  const sql = `
    SELECT dishes.id, dishes.name, users.username AS claimed_by
    FROM dishes
    LEFT JOIN users ON dishes.claimed_by = users.id
    ORDER BY dishes.id ASC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
    res.json(rows);
  });
});

// Add dish
app.post("/add-dish", requireLogin, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).send("Dish name is required");
  }
  db.run("INSERT INTO dishes (name, claimed_by) VALUES (?, NULL)", [name.trim()], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
    res.redirect("/menu.html");
  });
});

// Claim dish
app.post("/claim-dish", requireLogin, (req, res) => {
  const { dishId } = req.body;
  const userId = req.session.userId;

  db.run(
    "UPDATE dishes SET claimed_by = ? WHERE id = ?",
    [userId, dishId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.redirect("/menu.html");
    }
  );
});

// Unclaim dish (if someone changes their mind)
app.post("/unclaim-dish", requireLogin, (req, res) => {
  const { dishId } = req.body;
  const userId = req.session.userId;

  db.run(
    "UPDATE dishes SET claimed_by = NULL WHERE id = ? AND claimed_by = ?",
    [dishId, userId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.redirect("/menu.html");
    }
  );
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Christmas Dinner app running at http://localhost:${PORT}`);
});