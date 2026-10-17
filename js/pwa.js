// TeamSync PWA Controller & Registration Module
(function () {
    let deferredPrompt = null;
    let newWorker = null;

    // 1. Inject Styles for PWA Notifications & Install Prompt
    function injectPWAStyles() {
        if (document.getElementById('teamsync-pwa-styles')) return;

        const style = document.createElement('style');
        style.id = 'teamsync-pwa-styles';
        style.textContent = `
            /* Offline / Online Toast Banner */
            .pwa-network-toast {
                position: fixed;
                top: 1.25rem;
                left: 50%;
                transform: translateX(-50%) translateY(-100px);
                z-index: 100000;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1.4rem;
                border-radius: 9999px;
                font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 0.88rem;
                font-weight: 600;
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
                transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
                opacity: 0;
                pointer-events: none;
            }

            .pwa-network-toast.show {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
                pointer-events: auto;
            }

            .pwa-network-toast.offline {
                background: rgba(30, 41, 59, 0.95);
                border: 1px solid rgba(239, 68, 68, 0.4);
                color: #fca5a5;
            }

            .pwa-network-toast.online {
                background: rgba(16, 185, 129, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: #ffffff;
            }

            /* Custom Install Prompt Banner */
            .pwa-install-banner {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                z-index: 99999;
                width: calc(100% - 4rem);
                max-width: 420px;
                background: #0d1527;
                background: linear-gradient(145deg, #131c31, #0a0f1d);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 20px;
                padding: 1.25rem 1.4rem;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.15);
                display: flex;
                flex-direction: column;
                gap: 1rem;
                color: #f8fafc;
                font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                transform: translateY(150%);
                transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .pwa-install-banner.show {
                transform: translateY(0);
            }

            .pwa-banner-header {
                display: flex;
                align-items: center;
                gap: 0.9rem;
            }

            .pwa-banner-logo {
                width: 46px;
                height: 46px;
                border-radius: 12px;
                object-fit: cover;
                border: 1px solid rgba(255, 255, 255, 0.15);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }

            .pwa-banner-title {
                font-size: 1rem;
                font-weight: 800;
                color: #ffffff;
                margin-bottom: 0.15rem;
            }

            .pwa-banner-sub {
                font-size: 0.8rem;
                color: #94a3b8;
                line-height: 1.35;
            }

            .pwa-banner-actions {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                justify-content: flex-end;
            }

            .pwa-btn-install {
                background: linear-gradient(135deg, #ade235, #84cc16);
                color: #042617;
                border: none;
                padding: 0.55rem 1.25rem;
                font-size: 0.88rem;
                font-weight: 700;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
            }

            .pwa-btn-install:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(173, 226, 53, 0.35);
            }

            .pwa-btn-dismiss {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #cbd5e1;
                padding: 0.55rem 1rem;
                font-size: 0.85rem;
                font-weight: 600;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .pwa-btn-dismiss:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
            }

            /* Floating Quick Install Pill (in case banner was dismissed or for navigation) */
            .pwa-quick-install-pill {
                display: none;
                align-items: center;
                gap: 0.5rem;
                background: linear-gradient(135deg, #ade235, #10b981);
                color: #042617;
                font-size: 0.82rem;
                font-weight: 800;
                padding: 0.45rem 1rem;
                border-radius: 9999px;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 14px rgba(173, 226, 53, 0.3);
                transition: all 0.2s ease;
            }

            .pwa-quick-install-pill:hover {
                transform: scale(1.05);
            }

            /* Update Toast */
            .pwa-update-toast {
                position: fixed;
                bottom: 2rem;
                left: 2rem;
                z-index: 100000;
                background: #0f172a;
                border: 1px solid rgba(16, 185, 129, 0.4);
                color: #f8fafc;
                padding: 0.9rem 1.3rem;
                border-radius: 16px;
                display: flex;
                align-items: center;
                gap: 1rem;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                font-size: 0.88rem;
                animation: slideInUp 0.4s ease;
            }

            @keyframes slideInUp {
                from { transform: translateY(40px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            @media (max-width: 640px) {
                .pwa-install-banner {
                    left: 1rem;
                    right: 1rem;
                    bottom: 5.5rem; /* above mobile nav bar */
                    width: auto;
                }
                .pwa-update-toast {
                    left: 1rem;
                    right: 1rem;
                    bottom: 5.5rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Setup Network Status Monitoring (Online/Offline)
    function setupNetworkMonitor() {
        const toast = document.createElement('div');
        toast.className = 'pwa-network-toast';
        document.body.appendChild(toast);

        let timeoutId = null;

        function showToast(status, message, iconClass) {
            clearTimeout(timeoutId);
            toast.className = `pwa-network-toast show ${status}`;
            toast.innerHTML = `<i class="${iconClass}"></i> <span>${message}</span>`;

            if (status === 'online') {
                timeoutId = setTimeout(() => {
                    toast.classList.remove('show');
                }, 3500);
            }
        }

        window.addEventListener('offline', () => {
            showToast('offline', 'You are currently offline. Running from local cache.', 'fas fa-wifi-slash');
        });

        window.addEventListener('online', () => {
            showToast('online', 'Internet restored! Reconnected to TeamSync.', 'fas fa-check-circle');
        });

        // Initial check if opened offline
        if (!navigator.onLine) {
            showToast('offline', 'You are currently offline. Running from local cache.', 'fas fa-wifi-slash');
        }
    }

    // 3. Setup Install Banner & Listen to beforeinstallprompt
    function setupInstallPrompt() {
        // Create custom banner element
        const banner = document.createElement('div');
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="pwa-banner-header">
                <img src="icons/icon-192x192.png" alt="TeamSync" class="pwa-banner-logo" onerror="this.src='logo.png'">
                <div>
                    <div class="pwa-banner-title">Install TeamSync App</div>
                    <div class="pwa-banner-sub">Install for instant launch, offline access & desktop/mobile integration.</div>
                </div>
            </div>
            <div class="pwa-banner-actions">
                <button class="pwa-btn-dismiss" id="pwaDismissBtn">Not Now</button>
                <button class="pwa-btn-install" id="pwaInstallBtn">
                    <i class="fas fa-download"></i> Install App
                </button>
            </div>
        `;
        document.body.appendChild(banner);

        const installBtn = document.getElementById('pwaInstallBtn');
        const dismissBtn = document.getElementById('pwaDismissBtn');

        dismissBtn.addEventListener('click', () => {
            banner.classList.remove('show');
            sessionStorage.setItem('teamsync_pwa_dismissed', 'true');
        });

        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            banner.classList.remove('show');
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[TeamSync PWA] Install choice outcome:', outcome);
            deferredPrompt = null;
        });

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // Expose trigger globally
            window.installTeamSyncPWA = () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                }
            };

            // Only show banner if user has not dismissed it in this session
            if (!sessionStorage.getItem('teamsync_pwa_dismissed')) {
                setTimeout(() => {
                    banner.classList.add('show');
                }, 2000);
            }
        });

        window.addEventListener('appinstalled', () => {
            console.log('[TeamSync PWA] App was successfully installed');
            banner.classList.remove('show');
            deferredPrompt = null;
        });
    }

    // 4. Update Notification
    function showUpdateToast() {
        if (document.getElementById('pwa-update-toast')) return;

        const updateToast = document.createElement('div');
        updateToast.id = 'pwa-update-toast';
        updateToast.className = 'pwa-update-toast';
        updateToast.innerHTML = `
            <div>
                <strong style="color: #ade235; display: block; margin-bottom: 0.15rem;">Update Available</strong>
                <span>A new version of TeamSync is ready.</span>
            </div>
            <button class="pwa-btn-install" id="pwaUpdateBtn" style="padding: 0.45rem 0.9rem; font-size: 0.8rem;">
                <i class="fas fa-sync-alt"></i> Update
            </button>
        `;
        document.body.appendChild(updateToast);

        document.getElementById('pwaUpdateBtn').addEventListener('click', () => {
            if (newWorker) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }

    // 5. Register Service Worker
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // Determine relative sw path
                const swPath = './sw.js';
                navigator.serviceWorker.register(swPath).then((registration) => {
                    console.log('[TeamSync PWA] Service Worker registered with scope:', registration.scope);

                    registration.addEventListener('updatefound', () => {
                        newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    showUpdateToast();
                                }
                            });
                        }
                    });
                }).catch((error) => {
                    console.warn('[TeamSync PWA] Service Worker registration failed:', error);
                });

                // Reload automatically when new service worker takes over
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!refreshing) {
                        refreshing = true;
                        window.location.reload();
                    }
                });
            });
        }
    }

    // Initialize when DOM is ready
    function init() {
        injectPWAStyles();
        setupNetworkMonitor();
        setupInstallPrompt();
        registerServiceWorker();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
