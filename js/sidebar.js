import { getCurrentUser, logout } from './data.js';
import { initSmartAssistant } from './smart-assistant.js';

export function initSidebar() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
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
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; padding: 0 0.5rem;">
                <div style="width: 38px; height: 38px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white;">
                    <i class="fas fa-cubes" style="font-size: 1.1rem;"></i>
                </div>
                <span style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">Tasko</span>
            </div>
            
            <nav style="flex: 1; display: flex; flex-direction: column;">
                <div class="nav-section-header">MENU</div>
                
                <a href="dashboard.html" class="nav-link ${path.includes('dashboard') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-border-all"></i>
                        <span>Dashboard</span>
                    </div>
                </a>
                
                <a href="tasks.html" class="nav-link ${path.includes('tasks') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-check-square"></i>
                        <span>Tasks</span>
                    </div>
                    <span class="badge" id="sidebarTaskBadge" style="display: none;">0</span>
                </a>
                
                <a href="attendance.html" class="nav-link ${path.includes('attendance') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="far fa-calendar-alt"></i>
                        <span>Calendar</span>
                    </div>
                </a>
                
                <a href="analytics.html" class="nav-link ${path.includes('analytics') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-chart-bar"></i>
                        <span>Analytics</span>
                    </div>
                </a>
                
                <a href="teams.html" class="nav-link ${path.includes('teams') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-user-friends"></i>
                        <span>Team</span>
                    </div>
                </a>

                <div class="nav-section-header">GENERAL</div>

                <a href="${user.role === 'admin' ? 'members.html' : 'profile.html?id=' + user.id}" class="nav-link ${(path.includes('members') && user.role === 'admin') || (path.includes('profile') && user.role === 'member') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-cog"></i>
                        <span>Settings</span>
                    </div>
                </a>
                
                <a href="help.html" class="nav-link ${path.includes('help') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="far fa-question-circle"></i>
                        <span>Help</span>
                    </div>
                </a>

                <a href="javascript:void(0)" onclick="logout()" class="nav-link">
                    <div class="nav-link-content" style="color: #ef4444;">
                        <i class="fas fa-sign-out-alt" style="color: #ef4444;"></i>
                        <span>Logout</span>
                    </div>
                </a>
            </nav>

            <div style="margin-top: auto; padding-top: 1.25rem; border-top: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0 0.25rem;">
                    <img src="${user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--accent-light);">
                    <div style="overflow: hidden;">
                        <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.name.split(' ')[0]}</div>
                        <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: capitalize; font-weight: 600;">${user.role}</div>
                    </div>
                </div>
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
            <a href="chat.html" class="bottom-nav-link ${path.includes('chat') ? 'active' : ''}">
                <i class="fas fa-comments"></i>
                <span>Chat</span>
            </a>
            <a href="teams.html" class="bottom-nav-link ${path.includes('teams') ? 'active' : ''}">
                <i class="fas fa-people-group"></i>
                <span>Team</span>
            </a>
            <a href="analytics.html" class="bottom-nav-link ${path.includes('analytics') ? 'active' : ''}">
                <i class="fas fa-chart-line"></i>
                <span>Analytics</span>
            </a>
            <a href="profile.html?id=${user.id}" class="bottom-nav-link ${path.includes('profile') ? 'active' : ''}">
                <i class="fas fa-circle-user"></i>
                <span>Profile</span>
            </a>
        </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', desktopNavHTML + mobileBottomHTML);

    // --- Team Guard Overlay for non-team members ---
    if (!user.teamId && (path.includes('dashboard') || path.includes('tasks') || path.includes('attendance') || path.includes('members') || path.includes('notifications') || path.includes('analytics'))) {
        const guardHTML = `
            <div class="team-guard-overlay">
                <div class="team-guard-card">
                    <i class="fas fa-lock"></i>
                    <h2>Team Workspace Required</h2>
                    <p class="text-dim">To access collaboration features like the Dashboard, Tasks, Attendance, and Team Members, you must first create or join a team workspace.</p>
                    <button class="btn btn-secondary" onclick="window.location.href='teams.html'" style="height: 50px; border-radius: 12px; width: 100%;">
                        <i class="fas fa-users-gear"></i> Set Up My Team
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', guardHTML);
    }

    // Dynamically update task badge count if available
    try {
        import('./data.js').then(async ({ getTasks }) => {
            const tasks = await getTasks();
            const userTasks = user.role === 'admin' ? tasks.filter(t => t.status !== 'Approved') : tasks.filter(t => t.assignedTo === user.id && t.status !== 'Approved');
            const badge = document.getElementById('sidebarTaskBadge');
            if (badge) {
                if (userTasks.length > 0) {
                    badge.innerText = userTasks.length;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        }).catch(() => {});
    } catch (e) {}

    // Initialize Global Smart AI Assistant Chat
    initSmartAssistant();
}

document.addEventListener('DOMContentLoaded', initSidebar);
