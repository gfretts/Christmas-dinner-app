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

// --------- Helpers / Middleware ---------

// Require user to be logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login.html");
  }
  next();
}

// Require admin user
function requireAdmin(req, res, next) {
  if (!req.session.is_admin) {
    return res.status(403).send("Admins only");
  }
  next();
}

// --------- Routes ---------

// Root -> redirect to menu if logged in, otherwise to landing page
app.get("/", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/menu.html");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Signup
app.post("/signup", async (req, res) => {
  const { username, password, attending } = req.body;

  if (!username || !password) {
    return res.status(400).send("Username and password are required");
  }

  const attendingValue = attending ? 1 : 0;

  try {
    const hash = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (username, password_hash, attending) VALUES (?, ?, ?)",
      [username, hash, attendingValue],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(400).send("Username already exists");
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

    // Store session data
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.attending = user.attending === 1;
    req.session.is_admin = user.is_admin === 1;

    res.redirect("/menu.html");
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// Get current user info (for frontend)
app.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    id: req.session.userId,
    username: req.session.username,
    is_admin: req.session.is_admin,
    attending: req.session.attending,
  });
});

// Get all users (for attendance list)
app.get("/users", (req, res) => {
  db.all("SELECT username, attending FROM users ORDER BY username ASC", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
    res.json(rows);
  });
});

// Get all dishes
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

  db.run(
    "INSERT INTO dishes (name, claimed_by) VALUES (?, NULL)",
    [name.trim()],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.redirect("/menu.html");
    }
  );
});

// Claim dish
app.post("/claim-dish", requireLogin, (req, res) => {
  const { dishId } = req.body;
  const userId = req.session.userId;

  db.run(
    "UPDATE dishes SET claimed_by = ? WHERE id = ?",
    [userId, dishId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.redirect("/menu.html");
    }
  );
});

// Unclaim dish
app.post("/unclaim-dish", requireLogin, (req, res) => {
  const { dishId } = req.body;
  const userId = req.session.userId;

  db.run(
    "UPDATE dishes SET claimed_by = NULL WHERE id = ? AND claimed_by = ?",
    [dishId, userId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.redirect("/menu.html");
    }
  );
});

// Admin: delete dish
app.post("/delete-dish", requireAdmin, (req, res) => {
  const { dishId } = req.body;

  db.run("DELETE FROM dishes WHERE id = ?", [dishId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
    res.redirect("/menu.html");
  });
});

// Set attending (toggle from menu page)
app.post("/set-attending", (req, res) => {
  if (!req.session.userId) return res.status(403).send("Not logged in");

  const attending = req.body.attending === "1" ? 1 : 0;

  db.run(
    "UPDATE users SET attending = ? WHERE id = ?",
    [attending, req.session.userId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      req.session.attending = attending === 1;
      res.redirect("/menu.html");
    }
  );
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Christmas Dinner app running at http://localhost:${PORT}`);
});