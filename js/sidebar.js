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
    const existingTopHeader = document.querySelector('.mobile-top-header');
    const existingDrawer = document.querySelector('.mobile-nav-drawer');
    const existingBackdrop = document.querySelector('.mobile-drawer-backdrop');
    if (existingSidebar) existingSidebar.remove();
    if (existingFloating) existingFloating.remove();
    if (existingBottom) existingBottom.remove();
    if (existingTopHeader) existingTopHeader.remove();
    if (existingDrawer) existingDrawer.remove();
    if (existingBackdrop) existingBackdrop.remove();

    const path = window.location.pathname;

    // --- Desktop Floating Sidebar ---
    const desktopNavHTML = `
        <div class="floating-sidebar hide-mobile">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; padding: 0 0.5rem;">
                <div style="width: 38px; height: 38px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white;">
                    <i class="fas fa-leaf" style="font-size: 1.1rem;"></i>
                </div>
                <span style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">TEAMSYNC</span>
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

                <a href="chat.html" class="nav-link ${path.includes('chat') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-comments"></i>
                        <span>Chat & Call</span>
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

                <a href="javascript:void(0)" onclick="if(window.installTeamSyncPWA){window.installTeamSyncPWA();}else{alert('TeamSync is already installed or ready via browser address bar.');}" class="nav-link" id="navInstallApp">
                    <div class="nav-link-content" style="color: var(--primary);">
                        <i class="fas fa-download" style="color: var(--primary);"></i>
                        <span style="font-weight: 700;">Install App</span>
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

    // --- Mobile Top Header Bar ---
    const mobileTopHTML = `
        <header class="mobile-top-header hide-desktop">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
                <div class="mobile-top-logo-icon">
                    <i class="fas fa-leaf"></i>
                </div>
                <span class="mobile-top-logo-text">TEAMSYNC</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.6rem;">
                <a href="notifications.html" class="mobile-top-icon-btn" title="Notifications">
                    <i class="fas fa-bell"></i>
                </a>
                <button class="mobile-top-icon-btn" id="mobileDrawerOpenBtn" aria-label="Open Navigation Menu">
                    <i class="fas fa-bars"></i>
                </button>
                <a href="profile.html?id=${user.id}" class="mobile-top-avatar-link">
                    <img src="${user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'}" alt="${user.name}" class="mobile-top-avatar">
                </a>
            </div>
        </header>
    `;

    // --- Mobile Slide-Over Drawer Navigation ---
    const mobileDrawerHTML = `
        <div class="mobile-drawer-backdrop" id="mobileDrawerBackdrop"></div>
        <aside class="mobile-nav-drawer" id="mobileNavDrawer" aria-label="Mobile Navigation">
            <div class="mobile-drawer-header">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="${user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'}" class="mobile-drawer-user-avatar">
                    <div style="overflow: hidden;">
                        <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: capitalize; font-weight: 600;">${user.role}</div>
                    </div>
                </div>
                <button class="mobile-drawer-close-btn" id="mobileDrawerCloseBtn" aria-label="Close Menu">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <nav class="mobile-drawer-nav">
                <div class="nav-section-header" style="margin-top: 0.5rem;">MENU</div>

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
                    <span class="badge" id="mobileDrawerTaskBadge" style="display: none;">0</span>
                </a>

                <a href="attendance.html" class="nav-link ${path.includes('attendance') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="far fa-calendar-alt"></i>
                        <span>Calendar & Attendance</span>
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
                        <span>Team Space</span>
                    </div>
                </a>

                <a href="chat.html" class="nav-link ${path.includes('chat') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-comments"></i>
                        <span>Chat & Call</span>
                    </div>
                </a>

                <div class="nav-section-header">GENERAL</div>

                <a href="${user.role === 'admin' ? 'members.html' : 'profile.html?id=' + user.id}" class="nav-link ${(path.includes('members') && user.role === 'admin') || (path.includes('profile') && user.role === 'member') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-cog"></i>
                        <span>${user.role === 'admin' ? 'Member Management' : 'Profile Settings'}</span>
                    </div>
                </a>

                <a href="notifications.html" class="nav-link ${path.includes('notifications') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="fas fa-bell"></i>
                        <span>Notifications</span>
                    </div>
                </a>

                <a href="help.html" class="nav-link ${path.includes('help') ? 'active' : ''}">
                    <div class="nav-link-content">
                        <i class="far fa-question-circle"></i>
                        <span>Help & Guide</span>
                    </div>
                </a>

                <a href="javascript:void(0)" onclick="if(window.installTeamSyncPWA){window.installTeamSyncPWA();}else{alert('TeamSync is already installed or ready via browser address bar.');}" class="nav-link">
                    <div class="nav-link-content" style="color: var(--primary);">
                        <i class="fas fa-download" style="color: var(--primary);"></i>
                        <span style="font-weight: 700;">Install App</span>
                    </div>
                </a>

                <a href="javascript:void(0)" onclick="logout()" class="nav-link" style="margin-top: 1rem;">
                    <div class="nav-link-content" style="color: #ef4444;">
                        <i class="fas fa-sign-out-alt" style="color: #ef4444;"></i>
                        <span>Logout</span>
                    </div>
                </a>
            </nav>
        </aside>
    `;

    // --- Mobile Bottom Navigation Bar ---
    const mobileBottomHTML = `
        <nav class="mobile-bottom-bar hide-desktop" aria-label="Mobile Quick Nav">
            <a href="dashboard.html" class="bottom-nav-link ${path.includes('dashboard') ? 'active' : ''}">
                <i class="fas fa-layer-group"></i>
                <span>Home</span>
            </a>
            <a href="tasks.html" class="bottom-nav-link ${path.includes('tasks') ? 'active' : ''}">
                <i class="fas fa-check-square"></i>
                <span>Tasks</span>
                <span class="bottom-badge-dot" id="bottomTaskBadgeDot" style="display: none;"></span>
            </a>
            <a href="chat.html" class="bottom-nav-link ${path.includes('chat') ? 'active' : ''}">
                <i class="fas fa-comments"></i>
                <span>Chat</span>
            </a>
            <a href="attendance.html" class="bottom-nav-link ${path.includes('attendance') ? 'active' : ''}">
                <i class="far fa-calendar-alt"></i>
                <span>Calendar</span>
            </a>
            <a href="javascript:void(0)" class="bottom-nav-link" id="bottomMoreTrigger">
                <i class="fas fa-bars"></i>
                <span>Menu</span>
            </a>
        </nav>
    `;

    document.body.insertAdjacentHTML('afterbegin', desktopNavHTML + mobileTopHTML + mobileDrawerHTML + mobileBottomHTML);

    // Setup Mobile Drawer Toggle Listeners
    const openBtn = document.getElementById('mobileDrawerOpenBtn');
    const closeBtn = document.getElementById('mobileDrawerCloseBtn');
    const backdrop = document.getElementById('mobileDrawerBackdrop');
    const drawer = document.getElementById('mobileNavDrawer');
    const moreTrigger = document.getElementById('bottomMoreTrigger');

    function openDrawer() {
        if (drawer && backdrop) {
            drawer.classList.add('open');
            backdrop.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeDrawer() {
        if (drawer && backdrop) {
            drawer.classList.remove('open');
            backdrop.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    if (openBtn) openBtn.addEventListener('click', openDrawer);
    if (moreTrigger) moreTrigger.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

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
            const drawerBadge = document.getElementById('mobileDrawerTaskBadge');
            const bottomBadgeDot = document.getElementById('bottomTaskBadgeDot');

            if (userTasks.length > 0) {
                if (badge) {
                    badge.innerText = userTasks.length;
                    badge.style.display = 'inline-block';
                }
                if (drawerBadge) {
                    drawerBadge.innerText = userTasks.length;
                    drawerBadge.style.display = 'inline-block';
                }
                if (bottomBadgeDot) {
                    bottomBadgeDot.style.display = 'block';
                }
            }
        }).catch(() => {});
    } catch (e) {}

    // Initialize Global Smart AI Assistant Chat
    initSmartAssistant();
}

document.addEventListener('DOMContentLoaded', initSidebar);
