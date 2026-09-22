/* AquaTrack — shared frontend helpers (auth session + API calls) */

const API_BASE = "/api";

const Session = {
  setAuth(token, user) {
    localStorage.setItem("aquatrack_token", token);
    localStorage.setItem("aquatrack_user", JSON.stringify(user));
  },
  getToken() {
    return localStorage.getItem("aquatrack_token");
  },
  getUser() {
    const raw = localStorage.getItem("aquatrack_user");
    return raw ? JSON.parse(raw) : null;
  },
  clear() {
    localStorage.removeItem("aquatrack_token");
    localStorage.removeItem("aquatrack_user");
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  logout() {
    this.clear();
    window.location.href = "/index.html";
  },
  // Redirects away if the user isn't logged in as the required role.
  // Call at the top of any protected page.
  requireRole(role) {
    const user = this.getUser();
    if (!this.isLoggedIn() || !user || user.role !== role) {
      window.location.href = role === "admin" ? "/pages/admin-login.html" : "/pages/login.html";
      return null;
    }
    return user;
  },
};

async function apiRequest(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = Session.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isForm && body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no JSON body */
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

/* ---------- Formatting helpers ---------- */

function formatDate(isoString) {
  if (!isoString) return "—";

  const d = new Date(isoString);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusBadgeClass(status) {
  const map = {
    Submitted: "badge-submitted",
    Assigned: "badge-assigned",
    "In Progress": "badge-inprogress",
    Resolved: "badge-resolved",
    Closed: "badge-closed",
  };
  return map[status] || "badge-submitted";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ---------- Shared topbar renderer ---------- */

function renderTopbar(containerId, { role }) {
  const user = Session.getUser();
  const el = document.getElementById(containerId);
  if (!el) return;

  if (role === "admin") {
    el.innerHTML = `
      <a class="brand" href="/pages/admin-dashboard.html"><span class="drop"></span> AquaTrack <span class="small" style="font-weight:400;opacity:.8">Admin</span></a>
      <nav>
        <a href="/pages/admin-dashboard.html"><span class="txt">Dashboard</span></a>
        <a href="/pages/admin-complaints.html"><span class="txt">Complaints</span></a>
        <a href="/pages/admin-database.html"><span class="txt">Database</span></a>
        <span class="user-chip">${escapeHtml(user?.name || "Admin")}</span>
        <button class="btn btn-sm btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="Session.logout()">Log out</button>
      </nav>`;
  } else {
    el.innerHTML = `
      <a class="brand" href="/index.html"><span class="drop"></span> AquaTrack</a>
      <nav>
        <a href="/pages/citizen-dashboard.html"><span class="txt">My Complaints</span></a>
        <a href="/pages/submit-complaint.html"><span class="txt">Report Issue</span></a>
        ${user ? `<span class="user-chip">${escapeHtml(user.name)}</span>
        <button class="btn btn-sm btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="Session.logout()">Log out</button>`
        : `<a href="/pages/login.html">Log in</a>`}
      </nav>`;
  }
}
