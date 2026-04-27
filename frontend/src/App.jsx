import { useState, useEffect, useCallback } from 'react'
import { auth, tasks } from './api'
import { format, isAfter, parseISO } from 'date-fns'
import './App.css'

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const fn = mode === 'login' ? auth.login : auth.signup
      const data = await fn(form)
      localStorage.setItem('tf_token', data.token)
      onAuth(data.user)
    } catch (e) {
      setErr(e.response?.data?.error || 'Something went wrong')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-left">
        <div className="auth-brand">
          <span className="brand-icon">✦</span>
          <span className="brand-name">TaskFlow</span>
        </div>
        <div className="auth-hero">
          <h1>Focus on what<br /><em>matters most.</em></h1>
          <p>Elegant task management for ambitious people. Organize, prioritize, and accomplish.</p>
          <div className="auth-features">
            {['Real-time sync across devices','Priority & deadline tracking','Clean, distraction-free interface'].map(f => (
              <div key={f} className="auth-feat"><span>◆</span>{f}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setErr('') }}>Sign In</button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setErr('') }}>Create Account</button>
          </div>
          <form onSubmit={handle} className="auth-form">
            {mode === 'signup' && (
              <div className="field">
                <label>Full Name</label>
                <input type="text" placeholder="Jane Doe" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
            )}
            <div className="field">
              <label>Email Address</label>
              <input type="email" placeholder="you@example.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            {err && <div className="auth-err">{err}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function TaskModal({ task, onSave, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    due_date: task?.due_date || '',
  })
  const [loading, setLoading] = useState(false)

  const handle = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const saved = task?.id ? await tasks.update(task.id, form) : await tasks.create(form)
      onSave(saved)
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task?.id ? 'Edit Task' : 'New Task'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handle} className="modal-form">
          <div className="field">
            <label>Task Title *</label>
            <input type="text" placeholder="What needs to be done?" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required autoFocus />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea placeholder="Add details…" rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Due Date</label>
            <input type="date" value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : task?.id ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }
  const statusLabels = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }
  const isOverdue = task.due_date && task.status !== 'done' && isAfter(new Date(), parseISO(task.due_date))

  return (
    <div className={`task-card priority-${task.priority} ${task.status === 'done' ? 'done' : ''}`}>
      <div className="task-card-top">
        <div className="task-priority-bar" style={{ background: priorityColors[task.priority] }} />
        <div className="task-card-content">
          <div className="task-card-header">
            <label className="task-check">
              <input type="checkbox" checked={task.status === 'done'}
                onChange={() => onStatusChange(task, task.status === 'done' ? 'todo' : 'done')} />
              <span className="checkmark">✓</span>
            </label>
            <h3 className={`task-title ${task.status === 'done' ? 'struck' : ''}`}>{task.title}</h3>
            <div className="task-actions">
              <button onClick={() => onEdit(task)} title="Edit">✎</button>
              <button onClick={() => onDelete(task.id)} title="Delete">✕</button>
            </div>
          </div>
          {task.description && <p className="task-desc">{task.description}</p>}
          <div className="task-meta">
            <span className={`tag status-${task.status}`}>{statusLabels[task.status]}</span>
            <span className="tag priority-tag" style={{ color: priorityColors[task.priority], borderColor: priorityColors[task.priority] + '44' }}>
              {task.priority}
            </span>
            {task.due_date && (
              <span className={`tag due ${isOverdue ? 'overdue' : ''}`}>
                {isOverdue ? '⚠ ' : '📅 '}
                {format(parseISO(task.due_date), 'MMM d')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ user, onLogout }) {
  const [taskList, setTaskList] = useState([])
  const [stats, setStats] = useState({})
  const [filter, setFilter] = useState({ status: '', priority: '' })
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([tasks.list(filter), tasks.stats()])
      setTaskList(t); setStats(s)
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleSave = (saved) => {
    setTaskList(prev => {
      const exists = prev.find(t => t.id === saved.id)
      return exists ? prev.map(t => t.id === saved.id ? saved : t) : [saved, ...prev]
    })
    tasks.stats().then(setStats)
    setModal(null)
  }

  const handleDelete = async id => {
    if (!confirm('Delete this task?')) return
    await tasks.delete(id)
    setTaskList(prev => prev.filter(t => t.id !== id))
    tasks.stats().then(setStats)
  }

  const handleStatusChange = async (task, status) => {
    const updated = await tasks.update(task.id, { status })
    setTaskList(prev => prev.map(t => t.id === updated.id ? updated : t))
    tasks.stats().then(setStats)
  }

  const filtered = taskList.filter(t =>
    search ? t.title.toLowerCase().includes(search.toLowerCase()) : true
  )

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">✦</span>
          <span className="brand-name">TaskFlow</span>
        </div>
        <div className="user-info">
          <div className="avatar">{user.name[0].toUpperCase()}</div>
          <div>
            <div className="user-name">{user.name}</div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Filter by Status</div>
          {[['', 'All Tasks'], ['todo', 'To Do'], ['in-progress', 'In Progress'], ['done', 'Done']].map(([val, label]) => (
            <button key={val} className={`nav-item ${filter.status === val && !filter.priority ? 'active' : ''}`}
              onClick={() => setFilter({ status: val, priority: '' })}>
              <span className={`nav-dot status-dot-${val || 'all'}`} />{label}
              {val === '' && <span className="nav-count">{stats.total || 0}</span>}
              {val === 'todo' && <span className="nav-count">{stats.todo || 0}</span>}
              {val === 'in-progress' && <span className="nav-count">{stats.in_progress || 0}</span>}
              {val === 'done' && <span className="nav-count">{stats.done || 0}</span>}
            </button>
          ))}
          <div className="nav-label" style={{ marginTop: '1.5rem' }}>Filter by Priority</div>
          {[['high', '🔴'], ['medium', '🟡'], ['low', '🟢']].map(([val, icon]) => (
            <button key={val} className={`nav-item ${filter.priority === val ? 'active' : ''}`}
              onClick={() => setFilter({ status: '', priority: val })}>
              {icon} {val.charAt(0).toUpperCase() + val.slice(1)}
            </button>
          ))}
        </nav>
        <div className="progress-section">
          <div className="progress-label">
            <span>Completion</span><span>{pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: pct + '%' }} />
          </div>
          <div className="progress-sub">{stats.done || 0} of {stats.total || 0} tasks done</div>
        </div>
        <button className="logout-btn" onClick={onLogout}>← Sign Out</button>
      </aside>

      <main className="main">
        <div className="main-header">
          <div>
            <h1 className="page-title">My Tasks</h1>
            <p className="page-sub">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button className="btn-primary btn-new" onClick={() => setModal({})}>+ New Task</button>
        </div>

        <div className="stats-row">
          {[
            { label: 'Total', value: stats.total || 0, color: '#6366f1' },
            { label: 'To Do', value: stats.todo || 0, color: '#94a3b8' },
            { label: 'In Progress', value: stats.in_progress || 0, color: '#f59e0b' },
            { label: 'Done', value: stats.done || 0, color: '#10b981' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="search-bar">
          <span className="search-icon">⌕</span>
          <input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} className="search-clear">✕</button>}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading your tasks…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            <h3>{search ? 'No matching tasks' : 'No tasks yet'}</h3>
            <p>{search ? 'Try a different search term' : 'Create your first task to get started'}</p>
            {!search && <button className="btn-primary" onClick={() => setModal({})}>+ Create Task</button>}
          </div>
        ) : (
          <div className="task-list">
            {filtered.map(task => (
              <TaskCard key={task.id} task={task}
                onEdit={t => setModal(t)}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </main>

      {modal !== null && (
        <TaskModal task={modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('tf_token')
    if (token) {
      auth.me().then(u => { setUser(u); setReady(true) }).catch(() => {
        localStorage.removeItem('tf_token'); setReady(true)
      })
    } else setReady(true)
  }, [])

  const handleAuth = u => setUser(u)
  const handleLogout = () => { localStorage.removeItem('tf_token'); setUser(null) }

  if (!ready) return <div className="app-loading"><div className="spinner" /></div>
  return user ? <Dashboard user={user} onLogout={handleLogout} /> : <AuthPage onAuth={handleAuth} />
}