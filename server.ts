import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const db = new Database("nutriplan.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    proteins REAL DEFAULT 0,
    fats REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    kcal REAL DEFAULT 0,
    portion REAL DEFAULT 100,
    is_custom INTEGER DEFAULT 0,
    is_ready_meal INTEGER DEFAULT 0,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    proteins REAL DEFAULT 0,
    fats REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    kcal REAL DEFAULT 0,
    portion REAL DEFAULT 100,
    image TEXT
  );
`);

// Migration: Rename base_weight to portion if it exists
try {
  const tableInfo = db.prepare("PRAGMA table_info(dishes)").all() as any[];
  const hasBaseWeight = tableInfo.some(col => col.name === 'base_weight');
  const hasPortion = tableInfo.some(col => col.name === 'portion');
  
  if (hasBaseWeight && !hasPortion) {
    db.exec("ALTER TABLE dishes RENAME COLUMN base_weight TO portion");
    console.log("Migrated dishes table: renamed base_weight to portion");
  }

  // Migration: Add image to products and dishes if it doesn't exist
  try {
    const pInfo = db.prepare("PRAGMA table_info(products)").all() as any[];
    if (!pInfo.some(col => col.name === 'image')) {
      db.exec("ALTER TABLE products ADD COLUMN image TEXT");
    }
    const dInfo = db.prepare("PRAGMA table_info(dishes)").all() as any[];
    if (!dInfo.some(col => col.name === 'image')) {
      db.exec("ALTER TABLE dishes ADD COLUMN image TEXT");
    }
    
    const planInfo = db.prepare("PRAGMA table_info(plans)").all() as any[];
    if (!planInfo.some(col => col.name === 'start_date')) {
      db.exec("ALTER TABLE plans ADD COLUMN start_date TEXT");
    }
    if (!planInfo.some(col => col.name === 'end_date')) {
      db.exec("ALTER TABLE plans ADD COLUMN end_date TEXT");
    }
  } catch (e) {
    console.error("Image migration failed:", e);
  }
} catch (e) {
  console.error("Migration failed:", e);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS dish_ingredients (
    dish_id INTEGER,
    product_id INTEGER,
    weight REAL,
    FOREIGN KEY(dish_id) REFERENCES dishes(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    target_kcal INTEGER DEFAULT 2000,
    target_proteins REAL DEFAULT 150,
    target_fats REAL DEFAULT 70,
    target_carbs REAL DEFAULT 250,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    start_date TEXT,
    end_date TEXT,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed initial products if empty
const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (productCount.count === 0) {
  console.log("Database is empty. Please run migrate_products.ts to seed data.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Image Upload API
  app.post("/api/upload", (req, res) => {
    try {
      const { image } = req.body; // Expecting base64
      if (!image) return res.status(400).json({ error: "No image provided" });

      const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid image format" });
      }

      const extension = matches[1];
      const data = matches[2];
      const buffer = Buffer.from(data, "base64");
      const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`;
      const filepath = path.join(UPLOADS_DIR, filename);

      fs.writeFileSync(filepath, buffer);
      res.json({ url: `/uploads/${filename}` });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // API Routes
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY name ASC").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    try {
      const { id, name, proteins, fats, carbs, kcal, portion, is_ready_meal, image } = req.body;
      console.log('POST /api/products', { id, name });
      
      if (id && id !== null && id !== '') {
        const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
        if (existing) {
          db.prepare("UPDATE products SET name = ?, proteins = ?, fats = ?, carbs = ?, kcal = ?, portion = ?, is_ready_meal = ?, image = ? WHERE id = ?")
            .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, is_ready_meal || 0, image || null, id);
          return res.json({ id, updated: true });
        } else {
          db.prepare("INSERT INTO products (id, name, proteins, fats, carbs, kcal, portion, is_custom, is_ready_meal, image) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
            .run(id, name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, is_ready_meal || 0, image || null);
          return res.json({ id, created: true });
        }
      }

      const result = db.prepare("INSERT INTO products (name, proteins, fats, carbs, kcal, portion, is_custom, is_ready_meal, image) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)")
        .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, is_ready_meal || 0, image || null);
      res.json({ id: result.lastInsertRowid });
    } catch (err) {
      console.error('Error in POST /api/products:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    try {
      const id = req.params.id;
      console.log('Attempting to DELETE product with ID:', id, 'Type:', typeof id);
      
      const numericId = parseInt(id, 10);
      let result;
      
      if (!isNaN(numericId)) {
        result = db.prepare("DELETE FROM products WHERE id = ?").run(numericId);
        console.log('Deleted product using numeric ID:', numericId, 'Changes:', result.changes);
      }
      
      if (!result || result.changes === 0) {
        result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
        console.log('Deleted product using string ID:', id, 'Changes:', result.changes);
      }
      
      res.json({ success: true, changes: result.changes });
    } catch (err) {
      console.error('Error in DELETE /api/products:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/products/:id", (req, res) => {
    try {
      const { name, proteins, fats, carbs, kcal, portion, is_ready_meal, image } = req.body;
      console.log('PUT /api/products', req.params.id);
      db.prepare("UPDATE products SET name = ?, proteins = ?, fats = ?, carbs = ?, kcal = ?, portion = ?, is_ready_meal = ?, image = ? WHERE id = ?")
        .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, is_ready_meal || 0, image || null, req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Error in PUT /api/products:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/dishes", (req, res) => {
    const full = req.query.full === 'true';
    const dishes = db.prepare("SELECT * FROM dishes ORDER BY name ASC").all();
    
    if (full) {
      const dishesWithIngredients = dishes.map((dish: any) => {
        const ingredients = db.prepare("SELECT product_id as productId, weight FROM dish_ingredients WHERE dish_id = ?").all(dish.id);
        return { ...dish, ingredients };
      });
      res.json(dishesWithIngredients);
    } else {
      res.json(dishes);
    }
  });

  app.get("/api/dishes/:id", (req, res) => {
    const dish = db.prepare("SELECT * FROM dishes WHERE id = ?").get(req.params.id);
    if (dish) {
      const ingredients = db.prepare("SELECT product_id as productId, weight FROM dish_ingredients WHERE dish_id = ?").all(req.params.id);
      res.json({ ...dish, ingredients });
    } else {
      res.status(404).send("Dish not found");
    }
  });

  app.post("/api/dishes", (req, res) => {
    try {
      const { id, name, proteins, fats, carbs, kcal, portion, ingredients = [], image } = req.body;
      console.log('POST /api/dishes', { id, name });
      let dishId = id;

      if (id && id !== null && id !== '') {
        const existing = db.prepare("SELECT id FROM dishes WHERE id = ?").get(id);
        if (existing) {
          db.prepare("UPDATE dishes SET name = ?, proteins = ?, fats = ?, carbs = ?, kcal = ?, portion = ?, image = ? WHERE id = ?")
            .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, image || null, id);
          db.prepare("DELETE FROM dish_ingredients WHERE dish_id = ?").run(id);
        } else {
          db.prepare("INSERT INTO dishes (id, name, proteins, fats, carbs, kcal, portion, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .run(id, name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, image || null);
        }
      } else {
        const result = db.prepare("INSERT INTO dishes (name, proteins, fats, carbs, kcal, portion, image) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, image || null);
        dishId = result.lastInsertRowid;
      }

      const insertIngredient = db.prepare("INSERT INTO dish_ingredients (dish_id, product_id, weight) VALUES (?, ?, ?)");
      (ingredients || []).forEach((ing: any) => {
        const pId = ing.productId || ing.product_id;
        if (pId) {
          insertIngredient.run(dishId, pId, ing.weight || 0);
        }
      });
      res.json({ id: dishId });
    } catch (err) {
      console.error('Error in POST /api/dishes:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/dishes/:id", (req, res) => {
    try {
      const id = req.params.id;
      console.log('Attempting to DELETE dish with ID:', id, 'Type:', typeof id);
      
      // Try to delete with both string and number just in case
      const numericId = parseInt(id, 10);
      
      let ingredientsResult;
      let dishResult;

      if (!isNaN(numericId)) {
        ingredientsResult = db.prepare("DELETE FROM dish_ingredients WHERE dish_id = ?").run(numericId);
        dishResult = db.prepare("DELETE FROM dishes WHERE id = ?").run(numericId);
        console.log('Deleted using numeric ID:', numericId, 'Changes:', dishResult.changes);
      }
      
      if (!dishResult || dishResult.changes === 0) {
        ingredientsResult = db.prepare("DELETE FROM dish_ingredients WHERE dish_id = ?").run(id);
        dishResult = db.prepare("DELETE FROM dishes WHERE id = ?").run(id);
        console.log('Deleted using string ID:', id, 'Changes:', dishResult.changes);
      }
      
      res.json({ success: true, changes: dishResult.changes });
    } catch (err) {
      console.error('Error in DELETE /api/dishes:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/dishes/:id", (req, res) => {
    try {
      const { name, proteins, fats, carbs, kcal, portion, ingredients = [], image } = req.body;
      console.log('PUT /api/dishes', req.params.id);
      db.prepare("UPDATE dishes SET name = ?, proteins = ?, fats = ?, carbs = ?, kcal = ?, portion = ?, image = ? WHERE id = ?")
        .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, image || null, req.params.id);
      
      // Refresh ingredients
      db.prepare("DELETE FROM dish_ingredients WHERE dish_id = ?").run(req.params.id);
      const insertIngredient = db.prepare("INSERT INTO dish_ingredients (dish_id, product_id, weight) VALUES (?, ?, ?)");
      (ingredients || []).forEach((ing: any) => {
        const pId = ing.productId || ing.product_id;
        if (pId) {
          insertIngredient.run(req.params.id, pId, ing.weight || 0);
        }
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Error in PUT /api/dishes:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/plans", (req, res) => {
    const plans = db.prepare("SELECT id, client_name, target_kcal, target_proteins, target_fats, target_carbs, created_at, start_date, end_date, data FROM plans ORDER BY created_at DESC").all();
    res.json(plans);
  });

  app.get("/api/plans/:id", (req, res) => {
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id);
    if (plan) {
      const p = plan as any;
      res.json({ 
        id: p.id,
        clientName: p.client_name,
        targetKcal: p.target_kcal,
        targetProteins: p.target_proteins,
        targetFats: p.target_fats,
        targetCarbs: p.target_carbs,
        createdAt: p.created_at,
        startDate: p.start_date,
        endDate: p.end_date,
        data: JSON.parse(p.data) 
      });
    } else {
      res.status(404).send("Plan not found");
    }
  });

  app.post("/api/plans", (req, res) => {
    const { id, clientName, targetKcal, targetProteins, targetFats, targetCarbs, startDate, endDate, data } = req.body;
    db.prepare("INSERT OR REPLACE INTO plans (id, client_name, target_kcal, target_proteins, target_fats, target_carbs, start_date, end_date, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, clientName, targetKcal, targetProteins || 150, targetFats || 70, targetCarbs || 250, startDate || null, endDate || null, JSON.stringify(data));
    res.json({ success: true });
  });

  app.delete("/api/plans/:id", (req, res) => {
    db.prepare("DELETE FROM plans WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsMap = (settings as any[]).reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsMap);
  });

  app.post("/api/settings", (req, res) => {
    const { settings } = req.body;
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    Object.entries(settings).forEach(([key, value]) => {
      upsert.run(key, String(value));
    });
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
