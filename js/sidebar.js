import { getCurrentUser, logout } from './data.js';

export function initSidebar() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Attach logout to window so inline onclick works
    window.logout = logout;

    // Remove existing navigation elements if any
    const existingSidebar = document.querySelector('.sidebar');
    const existingFloating = document.querySelector('.floating-sidebar');
    const existingBottom = document.querySelector('.mobile-bottom-bar');
    if (existingSidebar) existingSidebar.remove();
    if (existingFloating) existingFloating.remove();
    if (existingBottom) existingBottom.remove();

    const path = window.location.pathname;

    // --- Desktop Floating Sidebar ---
    const desktopNavHTML = `
        <div class="floating-sidebar hide-mobile">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 3rem; padding: 0 0.5rem;">
                <div style="width: 32px; height: 32px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">
                    <i class="fas fa-leaf" style="font-size: 1rem;"></i>
                </div>
                <span style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">TEAMSYNC</span>
            </div>
            
            <nav style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
                <a href="dashboard.html" class="nav-link ${path.includes('dashboard') ? 'active' : ''}">
                    <i class="fas fa-th-large"></i> Dashboard
                </a>
                <a href="tasks.html" class="nav-link ${path.includes('tasks') ? 'active' : ''}">
                    <i class="fas fa-tasks"></i> Tasks
                </a>
                <a href="attendance.html" class="nav-link ${path.includes('attendance') ? 'active' : ''}">
                    <i class="fas fa-calendar-check"></i> Attendance
                </a>
                ${user.role === 'member' ? `
                <a href="notifications.html" class="nav-link ${path.includes('notifications') ? 'active' : ''}">
                    <i class="fas fa-bell"></i> Notifications
                </a>
                ` : ''}
                ${user.role === 'admin' ? `
                <a href="members.html" class="nav-link ${path.includes('members') ? 'active' : ''}">
                    <i class="fas fa-users"></i> Team Members
                </a>
                ` : ''}
                <a href="profile.html?id=${user.id}" class="nav-link ${path.includes('profile') ? 'active' : ''}">
                    <i class="fas fa-user-circle"></i> Portfolio
                </a>
            </nav>

            <div style="margin-top: auto; padding-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding: 0 0.5rem;">
                    <img src="${user.avatar}" style="width: 38px; height: 38px; border-radius: 12px; box-shadow: var(--shadow-sm);">
                    <div style="overflow: hidden;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.name.split(' ')[0]}</div>
                        <div style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">${user.role}</div>
                    </div>
                </div>
                <button onclick="logout()" class="btn" style="width: 100%; font-size: 0.8rem; padding: 0.6rem; background: #fee2e2; color: #ef4444; border-radius: 12px; font-weight: 800;">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        </div>
    `;

    // --- Mobile Floating Bottom Bar ---
    const mobileBottomHTML = `
        <div class="mobile-bottom-bar">
            <a href="dashboard.html" class="bottom-nav-link ${path.includes('dashboard') ? 'active' : ''}">
                <i class="fas fa-layer-group"></i>
                <span>Home</span>
            </a>
            <a href="tasks.html" class="bottom-nav-link ${path.includes('tasks') ? 'active' : ''}">
                <i class="fas fa-list-check"></i>
                <span>Tasks</span>
            </a>
            <a href="attendance.html" class="bottom-nav-link ${path.includes('attendance') ? 'active' : ''}">
                <i class="fas fa-calendar-alt"></i>
                <span>Presence</span>
            </a>
            <a href="profile.html?id=${user.id}" class="bottom-nav-link ${path.includes('profile') ? 'active' : ''}">
                <i class="fas fa-circle-user"></i>
                <span>Profile</span>
            </a>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', desktopNavHTML + mobileBottomHTML);
}

document.addEventListener('DOMContentLoaded', initSidebar);
