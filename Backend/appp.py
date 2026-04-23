from flask import Flask, jsonify, request, session, send_from_directory
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
app.secret_key = "secret123"
CORS(app, supports_credentials=True)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Frontend")

# ──────────────────────────────────────────
# ПОДКЛЮЧЕНИЕ К БД (с WAL-режимом)
# WAL позволяет читать БД даже когда она
# открыта в VS Code / DB Browser
# ──────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")   # главное исправление
    conn.execute("PRAGMA busy_timeout=5000")  # ждать 5 сек если БД занята
    conn.row_factory = sqlite3.Row
    return conn

# ──────────────────────────────────────────
# ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ
# ──────────────────────────────────────────
def init_db():
    conn = get_db()
    conn.execute("DROP TABLE IF EXISTS products")
    conn.execute("""
        CREATE TABLE products (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT    NOT NULL,
            category  TEXT,
            brand     TEXT,
            price     REAL,
            old_price REAL,
            image     TEXT
        )
    """)
    conn.executemany("""
        INSERT INTO products (name, category, brand, price, old_price, image)
        VALUES (?, ?, ?, ?, ?, ?)
    """, [
        # Ноутбуки
        ("MacBook Pro 14", "Ноутбуки", "Apple", 185000, 200000, ""),
        ("MacBook Air M2", "Ноутбуки", "Apple", 115000, 130000, ""),
        ("Lenovo ThinkPad X1", "Ноутбуки", "Lenovo", 145000, 160000, ""),
        ("ASUS ROG Zephyrus G14", "Ноутбуки", "ASUS", 155000, 175000, ""),
        ("Dell XPS 15", "Ноутбуки", "Dell", 165000, 180000, ""),
        ("HP Spectre x360", "Ноутбуки", "HP", 135000, 150000, ""),
        ("Acer Swift 3", "Ноутбуки", "Acer", 75000, 85000, ""),
        ("Microsoft Surface Laptop 5", "Ноутбуки", "Microsoft", 125000, 140000, ""),

        # Планшеты
        ("iPad Pro 12.9", "Планшеты", "Apple", 125000, 140000, ""),
        ("iPad Air 5", "Планшеты", "Apple", 65000, 75000, ""),
        ("Samsung Galaxy Tab S9 Ultra", "Планшеты", "Samsung", 135000, 150000, ""),
        ("Samsung Galaxy Tab S8", "Планшеты", "Samsung", 75000, 85000, ""),
        ("Xiaomi Pad 6", "Планшеты", "Xiaomi", 35000, 45000, ""),
        ("Lenovo Tab P12 Pro", "Планшеты", "Lenovo", 55000, 65000, ""),

        # Наушники
        ("Sony WH-1000XM5", "Наушники", "Sony", 35000, 42000, ""),
        ("AirPods Pro 2", "Наушники", "Apple", 26000, 30000, ""),
        ("Bose QuietComfort 45", "Наушники", "Bose", 28000, 35000, ""),
        ("Sennheiser Momentum 4", "Наушники", "Sennheiser", 32000, 38000, ""),
        ("Samsung Galaxy Buds 2 Pro", "Наушники", "Samsung", 18000, 22000, ""),
        ("JBL Tour One M2", "Наушники", "JBL", 24000, 29000, ""),

        # Мониторы
        ("Samsung Odyssey G7", "Мониторы", "Samsung", 65000, 75000, ""),
        ("LG UltraGear 27GN950", "Мониторы", "LG", 75000, 85000, ""),
        ("Dell UltraSharp U2723QE", "Мониторы", "Dell", 68000, 78000, ""),
        ("ASUS ProArt Display", "Мониторы", "ASUS", 55000, 65000, ""),
        ("BenQ PD2700U", "Мониторы", "BenQ", 45000, 55000, ""),

        # Смартфоны
        ("iPhone 15 Pro", "Смартфоны", "Apple", 115000, 130000, ""),
        ("Samsung Galaxy S24 Ultra", "Смартфоны", "Samsung", 125000, 140000, ""),
        ("Google Pixel 8 Pro", "Смартфоны", "Google", 95000, 110000, ""),
        ("Xiaomi 14 Pro", "Смартфоны", "Xiaomi", 85000, 95000, ""),
        ("OnePlus 12", "Смартфоны", "OnePlus", 80000, 90000, ""),

        # Аксессуары
        ("Logitech MX Master 3S", "Аксессуары", "Logitech", 12000, 15000, ""),
        ("Apple Magic Keyboard", "Аксессуары", "Apple", 16000, 19000, ""),
        ("Razer DeathAdder V3 Pro", "Аксессуары", "Razer", 14000, 17000, ""),
        ("Keychron K2 Wireless", "Аксессуары", "Keychron", 11000, 14000, ""),
        ("Anker 737 Power Bank", "Аксессуары", "Anker", 13000, 16000, ""),
    ])
    conn.commit()
    print("База данных обновлена расширенным списком товаров")
    conn.close()

init_db()

@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(FRONTEND_DIR, filename)

@app.route("/api/products")
def get_products():
    try:
        conn = get_db()
        rows = conn.execute("SELECT id, name, category, brand, price, old_price, image FROM products").fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/products/<int:pid>")
def get_product(pid):
    try:
        conn = get_db()
        r = conn.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
        conn.close()
        if not r: return jsonify({"error": "Не найден"}), 404
        return jsonify(dict(r))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/products", methods=["POST"])
def add_product():
    try:
        d = request.json
        conn = get_db()
        cur = conn.execute(
            "INSERT INTO products (name, category, brand, price, old_price, image) VALUES (?, ?, ?, ?, ?, ?)",
            (d["name"], d.get("category",""), d.get("brand",""), d["price"], d.get("old_price"), d.get("image",""))
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return jsonify({"status": "ok", "id": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/products/<int:pid>", methods=["PUT"])
def update_product(pid):
    try:
        d = request.json
        conn = get_db()
        conn.execute(
            "UPDATE products SET name=?, category=?, brand=?, price=?, old_price=?, image=? WHERE id=?",
            (d["name"], d.get("category",""), d.get("brand",""), d["price"], d.get("old_price"), d.get("image",""), pid)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/products/<int:pid>", methods=["DELETE"])
def delete_product(pid):
    try:
        conn = get_db()
        conn.execute("DELETE FROM products WHERE id=?", (pid,))
        conn.commit()
        conn.close()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/cart/add", methods=["POST"])
def add_to_cart():
    product_id = request.json.get("id")
    if "cart" not in session:
        session["cart"] = []
    session["cart"].append(product_id)
    session.modified = True
    return jsonify({"status": "ok"})

@app.route("/api/cart")
def get_cart():
    try:
        cart = session.get("cart", [])
        conn = get_db()
        items = []
        for pid in cart:
            r = conn.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
            if r: items.append(dict(r))
        conn.close()
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)