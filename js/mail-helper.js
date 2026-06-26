import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from './firebase-config.js';

// Inject CSS styles for the premium Email Toast Notification
const toastStyles = `
    .email-toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 380px;
        width: calc(100% - 48px);
        pointer-events: none;
    }
    .email-toast {
        background: rgba(16, 185, 129, 0.95); /* Emerald/Green tint */
        color: white;
        padding: 16px 20px;
        border-radius: 14px;
        box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.3), 0 8px 16px -6px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.25);
        display: flex;
        flex-direction: column;
        gap: 8px;
        transform: translateY(30px) scale(0.95);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
        position: relative;
        overflow: hidden;
    }
    .email-toast.show {
        transform: translateY(0) scale(1);
        opacity: 1;
    }
    .email-toast-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 800;
        font-size: 0.85rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        padding-bottom: 6px;
    }
    .email-toast-header i {
        font-size: 1rem;
    }
    .email-toast-title {
        font-weight: 700;
        font-size: 0.95rem;
        margin-top: 2px;
    }
    .email-toast-meta {
        font-size: 0.75rem;
        background: rgba(255, 255, 255, 0.15);
        padding: 2px 8px;
        border-radius: 99px;
        width: fit-content;
        font-weight: 600;
    }
    .email-toast-body {
        font-size: 0.8rem;
        opacity: 0.9;
        line-height: 1.45;
        white-space: pre-wrap;
    }
    .email-toast-action {
        align-self: flex-end;
        background: white;
        color: #047857;
        font-weight: 800;
        font-size: 0.75rem;
        padding: 6px 12px;
        border-radius: 8px;
        text-decoration: none;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        transition: all 0.2s ease;
        margin-top: 4px;
    }
    .email-toast-action:hover {
        background: #f0fdf4;
        transform: translateY(-1px);
    }
    .email-toast-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        opacity: 0.7;
        font-size: 0.85rem;
        padding: 0;
        transition: opacity 0.2s;
    }
    .email-toast-close:hover {
        opacity: 1;
    }
`;

// Append styles to DOM
if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style');
    styleEl.textContent = toastStyles;
    document.head.appendChild(styleEl);
}

// Function to render a beautiful Toast on the page showing simulated email
function showEmailToast({ toEmail, toName, subject, bodyTitle, bodyText, actionUrl, actionText }) {
    if (typeof document === 'undefined') return;

    // Create container if it doesn't exist
    let container = document.querySelector('.email-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'email-toast-container';
        document.body.appendChild(container);
    }

    // Create toast card
    const toast = document.createElement('div');
    toast.className = 'email-toast';
    
    toast.innerHTML = `
        <div class="email-toast-header">
            <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-envelope-open-text"></i>
                <span>Simulated Email Notification</span>
            </div>
            <button class="email-toast-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="email-toast-meta">To: ${toName} (${toEmail})</div>
        <div class="email-toast-title">${subject}</div>
        <div class="email-toast-body">${bodyText}</div>
        ${actionUrl && actionText ? `<a href="${actionUrl}" class="email-toast-action">${actionText} <i class="fas fa-arrow-right" style="font-size: 0.65rem; margin-left: 2px;"></i></a>` : ''}
    `;

    container.appendChild(toast);

    // Slide in
    setTimeout(() => toast.classList.add('show'), 100);

    // Bind close button
    const closeBtn = toast.querySelector('.email-toast-close');
    const dismiss = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    };
    closeBtn.addEventListener('click', dismiss);

    // Auto dismiss after 7 seconds
    setTimeout(dismiss, 7000);
}

/**
 * Sends a mail notification.
 * Uses EmailJS REST API if configured, otherwise falls back to a simulated on-screen toast.
 */
export async function sendMail({ toEmail, toName, subject, bodyTitle, bodyText, actionUrl, actionText }) {
    const isEmailJSConfigured = 
        EMAILJS_SERVICE_ID && EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID' && EMAILJS_SERVICE_ID.trim() !== '' &&
        EMAILJS_TEMPLATE_ID && EMAILJS_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID' && EMAILJS_TEMPLATE_ID.trim() !== '' &&
        EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY' && EMAILJS_PUBLIC_KEY.trim() !== '';

    if (isEmailJSConfigured) {
        console.log(`[EmailJS] Sending email to ${toEmail}...`);
        const url = 'https://api.emailjs.com/api/v1.0/email/send';
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    service_id: EMAILJS_SERVICE_ID,
                    template_id: EMAILJS_TEMPLATE_ID,
                    user_id: EMAILJS_PUBLIC_KEY,
                    template_params: {
                        to_email: toEmail,
                        to_name: toName,
                        subject: subject,
                        body_title: bodyTitle,
                        body_text: bodyText,
                        action_url: actionUrl,
                        action_text: actionText
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`EmailJS failed: ${response.status} ${errorText}`);
            }

            console.log(`[EmailJS] Email sent successfully to ${toEmail}`);
            // Still show a smaller success toast for visual verification
            showEmailToast({
                toEmail,
                toName,
                subject,
                bodyTitle,
                bodyText: `📧 [EmailJS Real Email Sent]\n\n${bodyText}`,
                actionUrl,
                actionText
            });
            
            return true;
        } catch (err) {
            console.error('[EmailJS] API error, falling back to simulation:', err);
            // Fallback to simulation
            showEmailToast({ toEmail, toName, subject, bodyTitle, bodyText: `⚠️ [Real Send Failed - Showing Simulation]\n\n${bodyText}`, actionUrl, actionText });
            return false;
        }
    } else {
        // Log simulation details to dev console
        console.log(
            `%c[Email Notification Simulation]\n` +
            `To: ${toName} (${toEmail})\n` +
            `Subject: ${subject}\n` +
            `Body Title: ${bodyTitle}\n` +
            `Body Text: ${bodyText}\n` +
            `Action: ${actionText} (${actionUrl})`,
            'color: #10b981; font-weight: bold; line-height: 1.4;'
        );

        // Show premium on-screen Toast
        showEmailToast({ toEmail, toName, subject, bodyTitle, bodyText, actionUrl, actionText });
        return true;
    }
}
