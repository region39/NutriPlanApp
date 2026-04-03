import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "nutriplan-super-secret-key-2026";

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const DB_PATH = "nutriplan.db";

function saveEntityImage(type: string, id: string | number, base64Data: string | null) {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const prefix = `${type}_${id}.`;
    for (const file of files) {
      if (file.startsWith(prefix)) {
        fs.unlinkSync(path.join(UPLOADS_DIR, file));
      }
    }

    if (base64Data) {
      const matches = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        fs.writeFileSync(path.join(UPLOADS_DIR, `${prefix}${ext}`), buffer);
      }
    }
  } catch (err) {
    console.error(`Error saving image for ${type} ${id}:`, err);
  }
}

function entityHasImage(type: string, id: string | number): boolean {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const prefix = `${type}_${id}.`;
    return files.some(f => f.startsWith(prefix));
  } catch (err) {
    return false;
  }
}

function initDb() {
  let database: Database.Database;
  try {
    database = new Database(DB_PATH);
    // Check integrity
    const check = database.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    if (check.integrity_check !== "ok") {
      throw new Error("Database integrity check failed: " + check.integrity_check);
    }
  } catch (err) {
    console.error("Database is corrupted or could not be opened, recreating...", err);
    if (fs.existsSync(DB_PATH)) {
      fs.renameSync(DB_PATH, `${DB_PATH}.corrupt-${Date.now()}`);
    }
    database = new Database(DB_PATH);
  }
  return database;
}

const db = initDb();

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
    image TEXT,
    categories TEXT
  );

  CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    proteins REAL DEFAULT 0,
    fats REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    kcal REAL DEFAULT 0,
    portion REAL DEFAULT 100,
    image TEXT,
    categories TEXT
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
    if (!pInfo.some(col => col.name === 'categories')) {
      db.exec("ALTER TABLE products ADD COLUMN categories TEXT");
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
    if (!planInfo.some(col => col.name === 'meal_types')) {
      db.exec("ALTER TABLE plans ADD COLUMN meal_types TEXT");
    }
    if (!planInfo.some(col => col.name === 'meal_categories')) {
      db.exec("ALTER TABLE plans ADD COLUMN meal_categories TEXT");
    }
    if (!dInfo.some(col => col.name === 'categories')) {
      db.exec("ALTER TABLE dishes ADD COLUMN categories TEXT");
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
    meal_types TEXT,
    meal_categories TEXT,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// Ensure default settings exist
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('authMode', 'password')").run();

// Password recovery mechanism: check for reset_password.txt in root directory
const resetFile = path.join(process.cwd(), 'reset_password.txt');
if (fs.existsSync(resetFile)) {
  try {
    const newPassword = fs.readFileSync(resetFile, 'utf8').trim();
    if (newPassword) {
      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'").run(hash);
      console.log("Admin password reset from reset_password.txt");
      fs.unlinkSync(resetFile);
    }
  } catch (err) {
    console.error("Failed to reset password from file:", err);
  }
}

// Create default admin user if no users exist
const adminUser = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
if (!adminUser) {
  const complexPassword = "NutriPlan_2024_Secure!";
  const defaultPasswordHash = bcrypt.hashSync(complexPassword, 10);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run("admin", defaultPasswordHash);
  console.log(`Created default user 'admin' with complex password: ${complexPassword}`);
}

// Seed initial products if empty
function seedDatabase(database: Database.Database) {
  const productCount = database.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
  if (productCount.count > 0) return;

  console.log("Seeding initial products...");
  const csvData = `Продукт;Белки (г);Жиры (г);Углеводы (г);Ккал
**Мясо и птица**;;;;
Говядина отварная;18,9;12,4;0;187
Говядина тушеная;16,0;25,0;0;290
Телятина;19,7;1,2;0;90
Свинина отварная;16,4;27,8;0;316
Свинина тушеная;11,4;49,3;0;489
Баранина;16,3;15,3;0;203
Кролик;20,2;7,0;0;143
Конина;20,7;12,9;0;199
Куриная грудка;23,6;1,9;0;113
Куриная ножка;18,5;11,0;0;185
Индейка (филе);20,8;8,8;0,6;165
Цыпленок (филе);21,6;12,0;0,8;197
Утка;16,5;61,2;0;346
Гусь;16,1;33,3;0;364
Говяжья печень;17,4;3,1;0;98
Свиная печень;18,8;3,6;0;108
Говяжий язык;13,6;12,1;0;163
Свиное сердце;15,0;3,0;0;87
Куриная печень;19,1;6,3;0;140
Куриные желудки;18,2;4,2;0;114
**Рыба и морепродукты**;;;;
Горбуша;20,5;6,5;0;142
Семга;20,8;15,1;0;219
Кета;22,0;5,6;0;138
Сельдь атлантическая;17,7;19,5;0;242
Скумбрия;18,0;9,0;0;153
Треска;17,5;0,6;0;75
Минтай;15,9;0,7;0;70
Хек;16,6;2,2;0;86
Судак;19,0;0,8;0;83
Щука;18,4;0,8;0;82
Карп;16,0;5,6;0;96
Окунь;18,4;5,3;0;121
Лещ;17,1;4,1;0;105
Окунь морской;18,5;0,9;0;82
Камбала;18,9;3,0;0;103
Кальмары;16,5;1,8;0;83
Тунец;22,7;0,7;0;96
Пельмени;18,0;0,3;0;75
Креветки;18,0;0,8;0;83
Краб;16,0;0,5;0;69
Мидии;11,5;2,0;1,5;77
Икра красная;32,0;15,0;0;263
Икра черная;28,0;9,7;1,8;203
Печень трески;4,2;65,7;0;613
Морская капуста;0,9;0,2;3,0;5
**Молочные продукты**;;;;
Молоко 1,5%;3,0;1,5;4,8;45
Молоко 3,2%;2,9;3,2;4,7;59
Молоко 6%;2,8;6,0;4,7;84
Кефир 1%;2,8;1,0;4,0;40
Кефир 2,5%;2,8;2,5;4,1;53
Кефир 3,2%;2,8;3,2;4,1;56
Ряженка 2,5%;2,9;2,5;4,2;54
Ряженка 4%;2,8;4,0;4,2;67
Простокваша;2,9;2,5;4,1;53
Сметана 10%;3,0;10,0;2,9;115
Сметана 20%;2,8;20,0;3,2;206
Сливки 10%;3,0;10,0;4,0;118
Сливки 20%;2,8;20,0;3,7;205
Сливки 33%;2,5;33,0;4,0;337
Творог 0%;18,0;0,0;1,8;79
Творог 2%;18,5;2,0;1,8;103
Творог 5%;17,2;5,0;1,8;121
Творог 9%;16,7;9,0;2,0;159
Творог 18%;14,0;18,0;2,8;232
Творожная масса сладкая;7,1;23,0;27,5;341
Сыр Российский;24,1;29,5;0,3;363
Сыр Голландский;26,0;26,8;0;352
Сыр Пошехонский;26,0;26,5;0;350
Сыр Швейцарский;24,9;31,8;0;396
Сыр Адыгейский;16,1;18,0;1,5;240
Брынза;17,9;20,1;0;260
Фета;14,2;21,3;4,1;264
Моцарелла;22,4;22,4;2,2;280
Пармезан;33,0;28,0;0;392
Йогурт натуральный 1,5%;4,3;1,5;6,2;51
Йогурт сладкий фруктовый;3,5;2,5;14,0;95
Мороженое пломбир в стакане;7,2;8,5;56,0;320
Мороженое пломбир без стакана;6,6;7,5;9,4;131
Сгущ молоко;26,0;25,0;37,5;476
**Яйца**;;;;
Яйцо куриное (1 шт. ~55г);12,7;10,9;0,7;157
Яйцо перепелиное;11,9;13,1;0,6;168
Яичный белок;11,1;0,0;1,0;44
Яичный желток;16,2;31,2;1,0;352
**Крупы и каши**;;;;
Гречка ядрица (сухая);12,6;3,3;62,1;313
Гречка продел (сухая);9,5;2,3;65,9;306
Рис белый (сухой);6,7;0,7;78,9;344
Рис бурый (сухой);7,4;1,8;72,9;331
Овсяные хлопья «Геркулес»;12,5;6,2;61,0;352
Овсяная крупа;12,3;6,1;59,5;342
Пшено;11,5;3,3;69,3;348
Кускус;9,3;1,1;73,7;320
Ячневая крупа;10,4;1,3;66,3;324
Перловая крупа;10,3;1,0;67,4;328
Кукурузная крупа;8,3;1,2;75,0;337
Пшеничная крупа;11,5;1,3;62,0;316
Манка (сухая);12,3;1,3;57,6;342
Киноа (сухая);14,1;6,1;57,2;368
Хлеб белый (пшеничный);7,5;2,3;50,8;265
Хлеб черный (ржаной);6,5;1,2;34,2;165
Хлеб цельнозерновой;8,5;1,4;42,0;220
Сухари ржаные;10,0;2,3;58,0;295
Макароны из твердых сортов;10,4;1,1;69,7;337
Макароны обычные;11,3;2,1;68,0;345
**Овощи**;;;;
Картофель;2,0;0,4;16,1;76
Капуста белокочанная;1,8;0,1;4,7;27
Капуста цветная;2,5;0,3;5,4;30
Капуста брокколи;2,8;0,4;6,6;34
Капуста краснокочанная;1,8;0,0;7,6;24
Морковь;1,3;0,1;6,9;32
Свекла;1,5;0,1;8,8;43
Лук репчатый;1,4;0,0;10,4;47
Лук зеленый;1,3;0,0;4,6;19
Чеснок;6,5;0,5;29,9;143
Огурцы свежие;0,8;0,1;2,8;15
Помидоры;1,1;0,2;3,7;20
Перец болгарский красный;1,3;0,0;5,3;27
Перец болгарский зеленый;1,3;0,0;6,9;33
Баклажаны;1,2;0,1;4,5;24
Кабачки;0,6;0,3;4,6;24
Тыква;1,0;0,1;4,4;22
Горошек зеленый (свежий);5,0;0,2;13,8;73
Фасоль стручковая;2,0;0,2;3,6;24
Шпинат;1,2;0,1;3,4;19
Редька;1,9;0,0;7,0;34
Репа;1,5;0,1;6,2;30
Салат листовой;1,5;0,0;2,2;14
Петрушка;2,9;0,3;2,0;22
Укроп;1,5;0,0;2,9;19
Ревень (стебли);3,7;0,0;8,1;45
Щавель;2,5;0,5;6,3;38
Сельдерей (стебель);0,9;0,1;2,1;12
**Фрукты**;;;;
Яблоки;0,4;0,0;11,3;46
Груши;0,4;0,0;10,7;42
Бананы;1,5;0,0;21,8;95
Апельсины;0,9;0,0;8,4;38
Мандарины;0,8;0,0;8,6;38
Грейпфрут;0,9;0,0;7,3;35
Лимон;0,9;0,0;3,6;31
Виноград;0,4;0,0;17,5;69
Абрикос;0,8;0,0;9,9;43
Персик;0,9;0,0;9,0;44
Нектарин;0,9;0,0;10,4;44
Хурма;0,9;0,0;11,8;48
Слива;0,8;0,0;11,3;49
Гранат;1,1;0,0;12,3;52
Киви;1,0;0,6;10,3;48
Инжир;0,5;0,0;15,9;62
Ананас;0,9;0,0;11,8;52
Помело;0,4;0,0;10,6;49
**Ягоды**;;;;
Клубника;0,6;0,1;5,8;25
Малина;0,6;0,3;7,4;35
Голубика;0,8;0,4;7,5;41
Черника;0,8;0,0;9,0;41
Смородина черная;1,0;0,0;8,0;40
Смородина красная;0,6;0,2;7,7;38
Крыжовник;0,7;0,0;9,9;44
Клюква;0,5;0,0;4,8;28
Брусника;0,7;0,5;8,2;46
Ежевика;1,1;0,0;8,6;40
Вишня;2,0;0,0;5,3;33
Черешня;1,2;5,4;5,7;82
**Сухофрукты**;;;;
Изюм;2,3;0,0;71,2;279
Курага;5,2;0,0;65,9;272
Урюк;5,0;0,0;67,5;278
Чернослив;2,3;0,0;65,6;264
Финики;2,5;0,0;72,1;281
Инжир сушеный;3,1;0,8;57,9;257
Яблоки сушеные;3,2;0,0;68,0;273
Груши сушеные;2,3;0,0;62,1;246
**Орехи и семена**;;;;
Грецкий орех;15,2;61,3;10,2;648
Фундук;18,6;57,7;13,6;645
Миндаль;16,1;66,9;9,9;704
Кешью;26,3;45,2;9,7;548
Арахис;18,5;48,5;22,5;553
Фисташки;20,0;50,0;7,0;556
Кедровый орех;13,7;68,4;13,1;673
Семена подсолнечника;20,7;52,9;5,0;578
Тыквенные семечки;24,5;46,0;4,7;556
Кунжут;19,4;48,7;12,2;565
**Бобовые (сухие)**;;;;
Горох лущеный;23,0;1,6;57,7;323
Фасоль белая;22,3;1,7;54,5;309
Фасоль красная;21,0;2,0;58,0;333
Чечевица красная;24,0;1,5;53,0;314
Чечевица зеленая;24,8;1,1;53,7;310
Нут;19,0;6,0;61,0;364
Соя;34,9;17,3;26,5;395
**Колбасные изделия и полуфабрикаты**;;;;
Колбаса докторская;13,7;22,8;0;260
Колбаса молочная;11,7;22,8;0;252
Колбаса любительская вареная;12,2;28,0;0;301
Сервелат варено-копченый;28,2;27,5;0;360
Краковская полукопченая;16,2;44,6;0;466
Сырокопченая московская;24,8;41,5;0;473
Ветчина;22,6;20,9;0;279
Сосиски молочные;12,3;25,3;0;277
Сосиски русские;12,0;19,1;0;220
Чебуреки свиные;10,1;31,6;1,9;332
Пельмени домашние;12,0;13,0;25,0;275
Пельмени «Русские»;11,5;12,5;26,0;273
Вареники с картофелем;4,5;3,5;18,5;125
Вареники с творогом;9,0;4,0;16,0;145
Вареники с вишней;5,0;2,5;22,0;135
Котлета домашняя (жареная);14,0;12,0;8,0;200
Котлета куриная;16,0;8,0;6,0;165
Шницель куриный;15,0;14,0;15,0;250
Блины на молоке;6,0;3,5;22,0;145
Сырники;5,5;4,0;25,0;165
Наггетсы;14,0;9,0;12,0;185
Блинчики с мясом;8,0;6,0;10,0;120
Тефтели;12,0;10,0;8,0;170
Борщ говяжий (готовый);14,0;8,0;5,0;145
Бефстроганов (готовый);16,0;12,0;4,0;185
Плов с курицей (готовый);8,5;6,0;22,0;175
Рассольник (готовый);2,5;3,0;6,0;60
Солянка мясная (готовый);4,5;5,0;4,0;80
Суп с мясом (готовый);3,0;2,5;5,5;55
Щи из свежей капусты;1,5;2,0;4,5;40
Суп куриный с лапшой;3,5;2,5;6,0;60
**Масла, жиры, соусы**;;;;
Масло сливочное 82,5%;0,5;82,5;0,8;748
Масло топленое;0,3;99,0;0;892
Масло подсолнечное;0;99,9;0;899
Масло оливковое;0;99,8;0;898
Майонез «Провансаль»;3,0;67,0;3,9;627
Майонез легкий 30%;1,5;30,0;5,0;300
Сметанный соус;2,5;15,0;6,0;175
Кетчуп томатный;1,5;0,2;22,0;95
Горчица столовая;5,0;3,5;8,0;85
Хрен столовый;2,5;0,4;7,5;45
**Сладости и выпечка**;;;;
Сахар-песок;0;0;99,8;398
Мед;0,8;0;80,3;308
Шоколад горький 70%;7,8;38,0;48,0;540
Шоколад молочный;6,9;35,7;52,4;547
Шоколад белоснежный;4,3;39,5;54,2;596
Халва;0,8;0;78,3;299
Пастила;0,5;0;80,4;305
Мармелад;4,3;0,1;77,7;296
Зефир глазированный;11,6;29,7;54,0;516
Вафли с начинкой;3,2;2,8;80,9;350
Печенье «Юбилейное»;7,5;18,0;65,0;445
Пряники русские;5,8;6,5;71,6;364
Торт «Бисквит»;4,5;20,0;45,0;380
Торт «Прага»;4,6;26,5;65,1;517
Пирожное «Картошка»;3,5;15,0;50,0;350
Круассан;7,5;18,0;45,0;360
Булочка сдобная;7,8;4,5;48,0;265
Батон нарезной;7,5;2,3;50,8;265
Сушки;10,5;1,3;73,0;340
Крекер пшеничный;11,2;1,4;72,2;355
**Напитки (на 100 мл)**;;;;
Вода питьевая;0;0;0;0
Чай черный без сахара;0,2;0;0;1
Кофе черный без сахара;0,3;0;0,1;2
Сок яблочный;0,5;0;11,0;46
Сок апельсиновый;0,7;0,2;13,0;56
Сок томатный;1,1;0,2;3,8;21
Компот из сухофруктов;0,2;0;14,0;55
Квас хлебный;0,2;0;5,2;27
Пиво светлое 4,5%;0,5;0;3,8;45
Вино сухое красное;0,2;0;0,3;68
Водка 40%;0;0;0,1;235`;

  const lines = csvData.split('\n');
  let currentCategory = '';
  const insert = database.prepare("INSERT INTO products (name, proteins, fats, carbs, kcal, portion, is_ready_meal) VALUES (?, ?, ?, ?, ?, ?, ?)");

  for (const line of lines) {
    if (!line.trim() || line.startsWith('Продукт;')) continue;
    if (line.startsWith('**')) {
      currentCategory = line.replace(/\*\*/g, '').trim();
      continue;
    }
    const parts = line.split(';');
    if (parts.length < 5) continue;

    const name = parts[0].trim();
    const proteins = parseFloat(parts[1].replace(',', '.')) || 0;
    const fats = parseFloat(parts[2].replace(',', '.')) || 0;
    const carbs = parseFloat(parts[3].replace(',', '.')) || 0;
    const kcal = parseFloat(parts[4].replace(',', '.')) || 0;

    let portion = 100;
    let isReadyMeal = 0;

    const readyMealKeywords = [
      '(готовый)', 'Вареники', 'Пельмени', 'Котлета', 'Блины', 'Сырники', 
      'Наггетсы', 'Тефтели', 'Борщ', 'Бефстроганов', 'Плов', 'Рассольник', 
      'Солянка', 'Суп', 'Щи', 'Чебуреки', 'Шницель', 'Ветчина', 'Колбаса', 
      'Сосиски', 'Сервелат', 'тушеная', 'отварная', 'жареная', 'запеченная'
    ];
    
    if (readyMealKeywords.some(kw => name.toLowerCase().includes(kw.toLowerCase()))) {
      isReadyMeal = 1;
    }

    if (currentCategory.includes('Мясо и птица') || currentCategory.includes('Рыба и морепродукты')) {
      portion = 150;
    } else if (currentCategory.includes('Молочные продукты')) {
      if (name.includes('Молоко') || name.includes('Кефир') || name.includes('Ряженка') || name.includes('Йогурт') || name.includes('Простокваша')) {
        portion = 200;
      } else if (name.includes('Сметана') || name.includes('Сливки') || name.includes('Сыр') || name.includes('Брынза') || name.includes('Фета') || name.includes('Моцарелла') || name.includes('Пармезан')) {
        portion = 30;
      } else if (name.includes('Творог')) {
        portion = 150;
      } else {
        portion = 100;
      }
    } else if (currentCategory.includes('Яйца')) {
      portion = 100;
    } else if (currentCategory.includes('Крупы и каши') || currentCategory.includes('Бобовые')) {
      portion = 60;
    } else if (currentCategory.includes('Овощи')) {
      portion = 200;
    } else if (currentCategory.includes('Фрукты')) {
      portion = 200;
    } else if (currentCategory.includes('Ягоды')) {
      portion = 150;
    } else if (currentCategory.includes('Сухофрукты')) {
      portion = 40;
    } else if (currentCategory.includes('Орехи и семена')) {
      portion = 30;
    } else if (currentCategory.includes('Колбасные изделия')) {
      portion = 100;
    } else if (currentCategory.includes('Масла, жиры, соусы')) {
      portion = 10;
    } else if (currentCategory.includes('Сладости и выпечка')) {
      portion = 50;
    } else if (currentCategory.includes('Напитки')) {
      portion = 200;
    }

    insert.run(name, proteins, fats, carbs, kcal, portion, isReadyMeal);
  }
  console.log("Database seeded successfully.");
}

// Seed initial products if empty
seedDatabase(db);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3050;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Auth Middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip auth for public routes
    if (
      req.path.startsWith('/public/') || 
      req.path.startsWith('/images/') || 
      req.path === '/login' ||
      req.path === '/logout' ||
      req.path === '/me' ||
      req.path === '/check-admin'
    ) {
      return next();
    }

    // Check if auth is disabled in settings
    const authModeSetting = db.prepare("SELECT value FROM settings WHERE key = 'authMode'").get() as any;
    if (authModeSetting && authModeSetting.value === 'none') {
      return next();
    }

    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Apply auth middleware to all API routes
  app.use('/api', requireAuth);

  // Auth Routes
  app.post("/api/login", (req, res) => {
    const username = req.body.username?.trim();
    const password = req.body.password?.trim();
    const rememberMe = req.body.rememberMe;
    
    console.log(`Login attempt for user: "${username}"`);
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    
    if (!user) {
      console.log(`User "${username}" not found in database`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    console.log(`Password match for "${username}": ${isMatch}`);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: rememberMe ? '30d' : '1d' });
    
    const isProduction = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    
    const cookieOptions: express.CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    };

    if (rememberMe) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    res.cookie('auth_token', token, cookieOptions);

    res.json({ success: true, username: user.username });
  });

  app.post("/api/logout", (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie('auth_token', { 
      path: '/',
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax'
    });
    res.json({ success: true });
  });

  app.get("/api/me", (req, res) => {
    // Check if auth is disabled in settings
    const authModeSetting = db.prepare("SELECT value FROM settings WHERE key = 'authMode'").get() as any;
    if (authModeSetting && authModeSetting.value === 'none') {
      return res.json({ authenticated: true, username: 'guest', authMode: 'none' });
    }

    const token = req.cookies.auth_token;
    if (!token) {
      return res.json({ authenticated: false, authMode: 'password' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      res.json({ authenticated: true, username: decoded.username, authMode: 'password' });
    } catch (err) {
      res.json({ authenticated: false, authMode: 'password' });
    }
  });

  app.get("/api/check-admin", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
    if (!user) return res.json({ error: "No admin user" });
    const isMatch = bcrypt.compareSync("admin", user.password_hash);
    res.json({ username: user.username, hash: user.password_hash, isMatch });
  });

  app.post("/api/change-password", (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const token = req.cookies.auth_token;
    
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as any;
      
      if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(400).json({ error: "Неверный текущий пароль" });
      }
      
      const newHash = bcrypt.hashSync(newPassword, 10);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);
      
      res.json({ success: true });
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Dynamic Image Serving API
  app.get("/api/images/:type/:id", (req, res) => {
    try {
      const { type, id } = req.params;
      const prefix = `${type}_${id}.`;
      const files = fs.readdirSync(UPLOADS_DIR);
      const file = files.find(f => f.startsWith(prefix));
      if (file) {
        res.sendFile(path.join(UPLOADS_DIR, file));
      } else {
        res.status(404).send("Not found");
      }
    } catch (err) {
      res.status(500).send("Server error");
    }
  });

  // API Routes
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY name ASC").all() as any[];
    const result = products.map(p => ({
      ...p,
      categories: p.categories ? JSON.parse(p.categories) : [],
      hasImage: entityHasImage('product', p.id)
    }));
    res.json(result);
  });

  app.post("/api/products", (req, res) => {
    try {
      const { id, name, proteins, fats, carbs, kcal, portion, is_ready_meal, imageBase64, categories = [] } = req.body;
      console.log('POST /api/products', { id, name });
      
      if (id && id !== null && id !== '') {
        const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
        if (existing) {
          db.prepare("UPDATE products SET name = ?, proteins = ?, fats = ?, carbs = ?, kcal = ?, portion = ?, is_ready_meal = ?, categories = ? WHERE id = ?")
            .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, is_ready_meal || 0, JSON.stringify(categories), id);
          if (imageBase64 !== undefined) saveEntityImage('product', id, imageBase64);
          return res.json({ id, updated: true });
        } else {
          db.prepare("INSERT INTO products (id, name, proteins, fats, carbs, kcal, portion, is_custom, is_ready_meal, categories) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
            .run(id, name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, is_ready_meal || 0, JSON.stringify(categories));
          if (imageBase64 !== undefined) saveEntityImage('product', id, imageBase64);
          return res.json({ id, created: true });
        }
      }

      const result = db.prepare("INSERT INTO products (name, proteins, fats, carbs, kcal, portion, is_custom, is_ready_meal, categories) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)")
        .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, is_ready_meal || 0, JSON.stringify(categories));
      const newId = result.lastInsertRowid;
      if (imageBase64 !== undefined) saveEntityImage('product', newId, imageBase64);
      res.json({ id: newId });
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
      
      saveEntityImage('product', id, null);
      res.json({ success: true, changes: result.changes });
    } catch (err) {
      console.error('Error in DELETE /api/products:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/products/:id", (req, res) => {
    try {
      const { name, proteins, fats, carbs, kcal, portion, is_ready_meal, imageBase64, categories = [] } = req.body;
      console.log('PUT /api/products', req.params.id);
      db.prepare("UPDATE products SET name = ?, proteins = ?, fats = ?, carbs = ?, kcal = ?, portion = ?, is_ready_meal = ?, categories = ? WHERE id = ?")
        .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, is_ready_meal || 0, JSON.stringify(categories), req.params.id);
      if (imageBase64 !== undefined) saveEntityImage('product', req.params.id, imageBase64);
      res.json({ success: true });
    } catch (err) {
      console.error('Error in PUT /api/products:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/dishes", (req, res) => {
    const full = req.query.full === 'true';
    const dishes = db.prepare("SELECT * FROM dishes ORDER BY name ASC").all() as any[];
    
    const result = dishes.map((dish: any) => {
      const parsedDish = { 
        ...dish, 
        categories: dish.categories ? JSON.parse(dish.categories) : [],
        hasImage: entityHasImage('dish', dish.id)
      };
      if (full) {
        const ingredients = db.prepare("SELECT product_id as productId, weight FROM dish_ingredients WHERE dish_id = ?").all(dish.id);
        return { ...parsedDish, ingredients };
      }
      return parsedDish;
    });
    res.json(result);
  });

  app.get("/api/dishes/:id", (req, res) => {
    const dish = db.prepare("SELECT * FROM dishes WHERE id = ?").get(req.params.id) as any;
    if (dish) {
      const ingredients = db.prepare("SELECT product_id as productId, weight FROM dish_ingredients WHERE dish_id = ?").all(req.params.id);
      res.json({ 
        ...dish, 
        categories: dish.categories ? JSON.parse(dish.categories) : [], 
        ingredients,
        hasImage: entityHasImage('dish', dish.id)
      });
    } else {
      res.status(404).send("Dish not found");
    }
  });

  app.post("/api/dishes", (req, res) => {
    try {
      const { id, name, proteins, fats, carbs, kcal, portion, ingredients = [], imageBase64, categories = [] } = req.body;
      console.log('POST /api/dishes', { id, name });
      let dishId = id;

      if (id && id !== null && id !== '') {
        const existing = db.prepare("SELECT id FROM dishes WHERE id = ?").get(id);
        if (existing) {
          db.prepare("UPDATE dishes SET name = ?, proteins = ?, fats = ?, carbs = ?, kcal = ?, portion = ?, categories = ? WHERE id = ?")
            .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, JSON.stringify(categories), id);
          db.prepare("DELETE FROM dish_ingredients WHERE dish_id = ?").run(id);
        } else {
          db.prepare("INSERT INTO dishes (id, name, proteins, fats, carbs, kcal, portion, categories) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .run(id, name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, JSON.stringify(categories));
        }
      } else {
        const result = db.prepare("INSERT INTO dishes (name, proteins, fats, carbs, kcal, portion, categories) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, JSON.stringify(categories));
        dishId = result.lastInsertRowid;
      }

      if (imageBase64 !== undefined) saveEntityImage('dish', dishId, imageBase64);

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
      
      saveEntityImage('dish', id, null);
      res.json({ success: true, changes: dishResult.changes });
    } catch (err) {
      console.error('Error in DELETE /api/dishes:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.put("/api/dishes/:id", (req, res) => {
    try {
      const { name, proteins, fats, carbs, kcal, portion, ingredients = [], imageBase64, categories = [] } = req.body;
      console.log('PUT /api/dishes', req.params.id);
      db.prepare("UPDATE dishes SET name = ?, proteins = ?, fats = ?, carbs = ?, kcal = ?, portion = ?, categories = ? WHERE id = ?")
        .run(name || '', proteins || 0, fats || 0, carbs || 0, kcal || 0, portion || 100, JSON.stringify(categories), req.params.id);
      
      if (imageBase64 !== undefined) saveEntityImage('dish', req.params.id, imageBase64);
      
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
        mealTypes: p.meal_types ? JSON.parse(p.meal_types) : null,
        mealCategories: p.meal_categories ? JSON.parse(p.meal_categories) : null,
        data: JSON.parse(p.data) 
      });
    } else {
      res.status(404).send("Plan not found");
    }
  });

  // Public endpoint for sharing plans (read-only)
  app.get("/api/public/plans/:id", (req, res) => {
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
        mealTypes: p.meal_types ? JSON.parse(p.meal_types) : null,
        mealCategories: p.meal_categories ? JSON.parse(p.meal_categories) : null,
        data: JSON.parse(p.data) 
      });
    } else {
      res.status(404).json({ error: "Plan not found" });
    }
  });

  app.post("/api/plans", (req, res) => {
    try {
      const { id, clientName, targetKcal, targetProteins, targetFats, targetCarbs, startDate, endDate, mealTypes, mealCategories, data } = req.body;
      console.log('POST /api/plans', { id, clientName });
      db.prepare("INSERT OR REPLACE INTO plans (id, client_name, target_kcal, target_proteins, target_fats, target_carbs, start_date, end_date, meal_types, meal_categories, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(
          id, 
          clientName, 
          targetKcal, 
          targetProteins || 150, 
          targetFats || 70, 
          targetCarbs || 250, 
          startDate || null, 
          endDate || null, 
          mealTypes ? JSON.stringify(mealTypes) : null,
          mealCategories ? JSON.stringify(mealCategories) : null,
          JSON.stringify(data)
        );
      res.json({ success: true });
    } catch (err) {
      console.error('Error in POST /api/plans:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/plans/:id", (req, res) => {
    try {
      const id = req.params.id;
      const numericId = parseInt(id, 10);
      let result;
      if (!isNaN(numericId)) {
        result = db.prepare("DELETE FROM plans WHERE id = ?").run(numericId);
      }
      if (!result || result.changes === 0) {
        result = db.prepare("DELETE FROM plans WHERE id = ?").run(id);
      }
      res.json({ success: true, changes: result?.changes });
    } catch (err) {
      console.error('Error in DELETE /api/plans:', err);
      res.status(500).json({ error: String(err) });
    }
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
