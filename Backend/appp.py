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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT    NOT NULL,
            category  TEXT,
            brand     TEXT,
            price     REAL,
            old_price REAL,
            image     TEXT
        )
    """)
    if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
        conn.executemany("""
            INSERT INTO products (name, category, brand, price, old_price, image)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [
            ("MacBook Pro 14",     "Ноутбуки",   "Apple",   150000, 170000, ""),
            ("MacBook Air M2",     "Ноутбуки",   "Apple",   110000, 125000, ""),
            ("Lenovo ThinkPad X1", "Ноутбуки",   "Lenovo",   95000, 110000, ""),
            ("Samsung Galaxy Tab", "Планшеты",   "Samsung",  45000,  55000, ""),
            ("iPad Pro 12.9",      "Планшеты",   "Apple",   120000, 135000, ""),
            ("Sony WH-1000XM5",    "Наушники",   "Sony",     28000,  35000, ""),
            ("AirPods Pro 2",      "Наушники",   "Apple",    24000,  28000, ""),
            ("Samsung Monitor 27", "Мониторы",   "Samsung",  32000,  38000, ""),
            ("Logitech MX Master", "Аксессуары", "Lenovo",    8000,  10000, ""),
            ("Bose QC45",          "Наушники",   "Bose",     22000,  27000, ""),
        ])
        conn.commit()
        print("Товары добавлены в базу данных")
    conn.close()

init_db()

@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "01techstorerabochay_fixed.html")

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