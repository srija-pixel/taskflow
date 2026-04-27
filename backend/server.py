from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import sqlite3, bcrypt, os, json
from datetime import timedelta, datetime

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET', 'taskflow_secret_key_2024')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)

CORS(app)
jwt = JWTManager(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'taskflow.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT DEFAULT 'todo',
                priority TEXT DEFAULT 'medium',
                due_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

init_db()

def row_to_dict(row):
    return dict(row) if row else None

# ─── AUTH ────────────────────────────────────────────────────────────────────

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({'error': 'All fields required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    try:
        with get_db() as db:
            cur = db.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', (name, email, hashed))
            user_id = cur.lastrowid
        identity = json.dumps({'id': user_id, 'name': name, 'email': email})
        token = create_access_token(identity=identity)
        return jsonify({'token': token, 'user': {'id': user_id, 'name': name, 'email': email}})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already in use'}), 409

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    with get_db() as db:
        user = row_to_dict(db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone())
    if not user or not bcrypt.checkpw(password.encode(), user['password'].encode()):
        return jsonify({'error': 'Invalid credentials'}), 401

    identity = json.dumps({'id': user['id'], 'name': user['name'], 'email': user['email']})
    token = create_access_token(identity=identity)
    return jsonify({'token': token, 'user': {'id': user['id'], 'name': user['name'], 'email': user['email']}})

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    user_data = json.loads(get_jwt_identity())
    with get_db() as db:
        user = row_to_dict(db.execute('SELECT id, name, email, created_at FROM users WHERE id = ?', (user_data['id'],)).fetchone())
    return jsonify(user)

# ─── TASKS ───────────────────────────────────────────────────────────────────

@app.route('/api/tasks', methods=['GET'])
@jwt_required()
def list_tasks():
    user = json.loads(get_jwt_identity())
    status = request.args.get('status')
    priority = request.args.get('priority')
    query = 'SELECT * FROM tasks WHERE user_id = ?'
    params = [user['id']]
    if status:
        query += ' AND status = ?'; params.append(status)
    if priority:
        query += ' AND priority = ?'; params.append(priority)
    query += ' ORDER BY created_at DESC'
    with get_db() as db:
        rows = db.execute(query, params).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/tasks', methods=['POST'])
@jwt_required()
def create_task():
    user = json.loads(get_jwt_identity())
    data = request.get_json()
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title required'}), 400
    with get_db() as db:
        cur = db.execute(
            'INSERT INTO tasks (user_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)',
            (user['id'], title, data.get('description', ''), data.get('status', 'todo'),
             data.get('priority', 'medium'), data.get('due_date'))
        )
        task = row_to_dict(db.execute('SELECT * FROM tasks WHERE id = ?', (cur.lastrowid,)).fetchone())
    return jsonify(task), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    user = json.loads(get_jwt_identity())
    data = request.get_json()
    with get_db() as db:
        existing = row_to_dict(db.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, user['id'])).fetchone())
        if not existing:
            return jsonify({'error': 'Task not found'}), 404
        db.execute("""
            UPDATE tasks SET title=?, description=?, status=?, priority=?, due_date=?, updated_at=CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        """, (
            data.get('title', existing['title']),
            data.get('description', existing['description']),
            data.get('status', existing['status']),
            data.get('priority', existing['priority']),
            data.get('due_date', existing['due_date']),
            task_id, user['id']
        ))
        task = row_to_dict(db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone())
    return jsonify(task)

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    user = json.loads(get_jwt_identity())
    with get_db() as db:
        result = db.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', (task_id, user['id']))
        if result.rowcount == 0:
            return jsonify({'error': 'Task not found'}), 404
    return jsonify({'success': True})

@app.route('/api/tasks/stats', methods=['GET'])
@jwt_required()
def task_stats():
    user = json.loads(get_jwt_identity())
    with get_db() as db:
        row = db.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo,
                SUM(CASE WHEN status='in-progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
            FROM tasks WHERE user_id = ?
        """, (user['id'],)).fetchone()
    return jsonify(dict(row))

# SPA fallback
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    dist = os.path.join(os.path.dirname(__file__), '../frontend/dist')
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))
    print(f"TaskFlow server running on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)