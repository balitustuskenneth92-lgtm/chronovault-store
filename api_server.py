import os
import json
import sqlite3
import urllib.parse
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

# Try to import psycopg2 for Vercel Postgres
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

app = FastAPI(title="ChronoVault API (Vercel)", version="2.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "chronovault.db"

def get_db_connection():
    # If Vercel Postgres URL is provided, use it
    pg_url = os.environ.get("POSTGRES_URL")
    if pg_url and HAS_POSTGRES:
        # Vercel provides a postgres:// URL, psycopg2 likes it
        conn = psycopg2.connect(pg_url, cursor_factory=RealDictCursor)
        conn.autocommit = True
        return conn, "postgres"
    else:
        # Fallback to local SQLite
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn, "sqlite"

def init_db():
    try:
        conn, db_type = get_db_connection()
        cur = conn.cursor()
        
        if db_type == "postgres":
            cur.execute("""
                CREATE TABLE IF NOT EXISTS watches (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS buyers (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
            """)
        else:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS watches (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS buyers (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
            """)
            conn.commit()
            
        cur.close()
        conn.close()
    except Exception as e:
        print("DB Init Error:", e)

init_db()

def rows_to_list(rows, db_type):
    if db_type == "postgres":
        return [json.loads(r["data"]) for r in rows]
    else:
        return [json.loads(r["data"]) for r in rows]

@app.get("/api/watches")
def get_watches():
    conn, db_type = get_db_connection()
    cur = conn.cursor()
    if db_type == "postgres":
        cur.execute("SELECT data FROM watches ORDER BY id")
    else:
        cur.execute("SELECT data FROM watches ORDER BY rowid")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows_to_list(rows, db_type)

@app.post("/api/watches")
async def save_watches(request: Request):
    watches = await request.json()
    conn, db_type = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("DELETE FROM watches")
    
    for w in watches:
        if db_type == "postgres":
            cur.execute("INSERT INTO watches (id, data) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
                         (w["id"], json.dumps(w)))
        else:
            cur.execute("INSERT OR REPLACE INTO watches (id, data) VALUES (?, ?)",
                         (w["id"], json.dumps(w)))
            
    if db_type == "sqlite":
        conn.commit()
        
    cur.close()
    conn.close()
    return {"success": True, "count": len(watches)}

@app.get("/api/buyers")
def get_buyers():
    conn, db_type = get_db_connection()
    cur = conn.cursor()
    if db_type == "postgres":
        cur.execute("SELECT data FROM buyers ORDER BY id")
    else:
        cur.execute("SELECT data FROM buyers ORDER BY rowid")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows_to_list(rows, db_type)

@app.post("/api/buyers")
async def save_buyers(request: Request):
    buyers = await request.json()
    conn, db_type = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("DELETE FROM buyers")
    for b in buyers:
        if db_type == "postgres":
            cur.execute("INSERT INTO buyers (id, data) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
                         (b["id"], json.dumps(b)))
        else:
            cur.execute("INSERT OR REPLACE INTO buyers (id, data) VALUES (?, ?)",
                         (b["id"], json.dumps(b)))
                         
    if db_type == "sqlite":
        conn.commit()
        
    cur.close()
    conn.close()
    return {"success": True, "count": len(buyers)}

@app.post("/api/checkout")
async def checkout(request: Request):
    body = await request.json()
    new_watches = body.get("newWatches")
    new_buyers  = body.get("newBuyers")

    conn, db_type = get_db_connection()
    cur = conn.cursor()
    
    if new_watches is not None:
        cur.execute("DELETE FROM watches")
        for w in new_watches:
            if db_type == "postgres":
                cur.execute("INSERT INTO watches (id, data) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
                             (w["id"], json.dumps(w)))
            else:
                cur.execute("INSERT OR REPLACE INTO watches (id, data) VALUES (?, ?)",
                             (w["id"], json.dumps(w)))
                             
    if new_buyers is not None:
        cur.execute("DELETE FROM buyers")
        for b in new_buyers:
            if db_type == "postgres":
                cur.execute("INSERT INTO buyers (id, data) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
                             (b["id"], json.dumps(b)))
            else:
                cur.execute("INSERT OR REPLACE INTO buyers (id, data) VALUES (?, ?)",
                             (b["id"], json.dumps(b)))
                             
    if db_type == "sqlite":
        conn.commit()
        
    cur.close()
    conn.close()
    return {"success": True}

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "environment": "vercel",
        "postgres_enabled": HAS_POSTGRES
    }
