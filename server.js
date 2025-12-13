const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
//const db = new sqlite3.Database("database.sqlite");
const db = new sqlite3.Database("/opt/render/project/data/database.sqlite");

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

// Auth guard
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login.html");
  }
  next();
}

// Admin guard
function requireAdmin(req, res, next) {
  if (!req.session.is_admin) {
    return res.status(403).send("Admins only");
  }
  next();
}

// Root route
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
    return res.status(400).send("Username and password required");
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const attendingValue = attending ? 1 : 0;

    db.run(
      "INSERT INTO users (username, password_hash, attending) VALUES (?, ?, ?)",
      [username, hash, attendingValue],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(400).send("That username is taken.");
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

    // Set session fields
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

// Current user info
app.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    id: req.session.userId,
    username: req.session.username,
    attending: req.session.attending,
    is_admin: req.session.is_admin === true || req.session.is_admin === 1
  });
});

// Get all users (attendance list)
app.get("/users", (req, res) => {
  db.all("SELECT username, attending FROM users ORDER BY username ASC", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
    res.json(rows);
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

  db.run(
    "INSERT INTO dishes (name, claimed_by) VALUES (?, NULL)",
    [name.trim()],
    function (err) {
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
    function (err) {
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
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.redirect("/menu.html");
    }
  );
});

// Delete dish (admin only)
app.post("/delete-dish", requireAdmin, (req, res) => {
  const { dishId } = req.body;

  db.run("DELETE FROM dishes WHERE id = ?", [dishId], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
    res.redirect("/menu.html");
  });
});

// Set attending
app.post("/set-attending", requireLogin, (req, res) => {
  const attending = req.body.attending === "1" ? 1 : 0;

  db.run(
    "UPDATE users SET attending = ? WHERE id = ?",
    [attending, req.session.userId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }

      req.session.attending = attending === 1;
      res.redirect("/menu.html");
    }
  );
});
//adding 9:49
app.get("/admin/users", requireAdmin, (req, res) => {
  db.all(
    "SELECT id, username, attending, is_admin FROM users ORDER BY username ASC",
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.json(rows);
    }
  );
});
app.post("/admin/toggle-attending", requireAdmin, (req, res) => {
  const { userId } = req.body;

  db.run(
    "UPDATE users SET attending = NOT attending WHERE id = ?",
    [userId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.redirect("/admin.html");
    }
  );
});

app.post("/admin/toggle-admin", requireAdmin, (req, res) => {
  const { userId } = req.body;

  db.run(
    "UPDATE users SET is_admin = NOT is_admin WHERE id = ?",
    [userId],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }
      res.redirect("/admin.html");
    }
  );
});
app.post("/admin/delete-user", requireAdmin, (req, res) => {
  const { userId } = req.body;

  db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send("Server error");
    }
    res.redirect("/admin.html");
  });
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Christmas Dinner app running at http://localhost:${PORT}`);
});