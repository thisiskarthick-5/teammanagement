import { getCurrentUser, logout } from './data.js';

export function initSidebar() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Attach logout to window so inline onclick works
    window.logout = logout;

    const sidebarHTML = `
        <div class="sidebar">
            <div class="logo" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 3rem;">
                <div style="width: 35px; height: 35px; background: var(--primary); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white;">
                    <i class="fas fa-leaf" style="font-size: 1.1rem;"></i>
                </div>
                <span style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">TEAMSYNC</span>
            </div>
            
            <nav style="flex: 1;">
                <a href="dashboard.html" class="nav-link ${window.location.pathname.includes('dashboard') ? 'active' : ''}">
                    <i class="fas fa-th-large"></i> Dashboard
                </a>
                <a href="tasks.html" class="nav-link ${window.location.pathname.includes('tasks') ? 'active' : ''}">
                    <i class="fas fa-tasks"></i> Tasks
                </a>
                <a href="attendance.html" class="nav-link ${window.location.pathname.includes('attendance') ? 'active' : ''}">
                    <i class="fas fa-calendar-check"></i> Attendance
                </a>
                ${user.role === 'member' ? `
                <a href="notifications.html" class="nav-link ${window.location.pathname.includes('notifications') ? 'active' : ''}">
                    <i class="fas fa-bell"></i> Notifications
                </a>
                ` : ''}
                ${user.role === 'admin' ? `
                <a href="members.html" class="nav-link ${window.location.pathname.includes('members') ? 'active' : ''}">
                    <i class="fas fa-users"></i> Team Members
                </a>
                ` : ''}
                <a href="profile.html?id=${user.id}" class="nav-link ${window.location.pathname.includes('profile') ? 'active' : ''}">
                    <i class="fas fa-user-circle"></i> Portfolio
                </a>
            </nav>

            <div class="user-profile" style="margin-top: auto; padding-top: 1.5rem; border-top: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
                    <img src="${user.avatar}" style="width: 44px; height: 44px; border-radius: 50%; border: 2px solid white; box-shadow: var(--shadow-sm);">
                    <div style="overflow: hidden;">
                        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">${user.role}</div>
                    </div>
                </div>
                <button onclick="logout()" class="btn" style="width: 100%; font-size: 0.85rem; padding: 0.65rem; background: #fef2f2; color: #ef4444; border-radius: 12px; font-weight: 700;">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
}

document.addEventListener('DOMContentLoaded', initSidebar);
