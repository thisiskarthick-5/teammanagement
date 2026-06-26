/**
 * TEAMLINK Smart AI Assistant Chat Widget
 * Site-wide floating helper enabling users to ask questions like:
 * - "What is overdue?"
 * - "What should I do today?"
 * - "Summarize team progress."
 */

import { getCurrentUser, getTasks, getTeamMembers, getAllAttendance } from './data.js';
import { GROQ_API_KEY, GROQ_MODEL } from './firebase-config.js';

const SYSTEM_INSTRUCTION = `You are TEAMLINK AI Assistant, a virtual companion for a high-performance team collaboration platform.
You have access to real-time project management details (current user info, tasks list, team members list, and attendance data).
Your goal is to answer the user's questions about their tasks, schedule, and team progress using the provided context.

Context Details:
- The current date is 2026-06-26 (Friday). Use this to calculate overdue items.
- A task is OVERDUE if its deadline date is in the past (before 2026-06-26) AND its status is NOT "Approved" and NOT "Completed".
- A task is PENDING/ACTIVE if its status is "Not Started" or "Action Required".
- If the user asks "What is overdue?", scan tasks assigned to them (or all tasks if they are an admin), identify overdue ones, list them clearly with priority and due date, and urge them to take action.
- If the user asks "What should I do today?", show their active pending tasks, order by priority (High first), and provide a small helpful recommendation on what to tackle first.
- If the user asks "Summarize team progress.", provide a clean summary of task completion rates (completed vs total), list active items, and call out members with active items.

Tone & Formatting Guidelines:
1. Be helpful, professional, polite, and slightly encouraging.
2. Use emojis in your answers (e.g. ⚠️ for overdue, 📅 for schedule, ✅ for completed, 🚀 for momentum).
3. Format your answers in clean Markdown (using bold **text**, bulleted lists -, or numbered lists).
4. Keep summaries concise and highly readable. Avoid long-winded paragraphs.`;

export function initSmartAssistant() {
    const user = getCurrentUser();
    if (!user) return; // Only show for logged in users

    // Prevent duplicate injection
    if (document.getElementById('assistantFab') || document.getElementById('assistantPanel')) {
        return;
    }

    // 1. Inject HTML markup
    const fabHTML = `<button class="assistant-fab" id="assistantFab" title="TEAMSYNC Smart AI Assistant"><i class="fas fa-robot"></i></button>`;
    const panelHTML = `
        <div class="assistant-panel" id="assistantPanel">
            <div class="assistant-header">
                <div class="assistant-header-info">
                    <div class="assistant-header-icon"><i class="fas fa-robot"></i></div>
                    <div>
                        <div class="assistant-header-title">TEAMSYNC AI Assistant</div>
                        <div class="assistant-header-sub">Online Productivity Companion</div>
                    </div>
                </div>
                <button class="assistant-close" id="assistantClose" title="Minimize Chat"><i class="fas fa-times"></i></button>
            </div>
            <div class="assistant-body" id="assistantBody"></div>
            <div class="assistant-footer">
                <input type="text" id="assistantInput" class="assistant-input" placeholder="Ask about tasks, overdue items..." disabled>
                <button id="assistantSend" class="assistant-send" disabled title="Send Question"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', fabHTML + panelHTML);

    // 2. Set up event listeners
    const fab = document.getElementById('assistantFab');
    const panel = document.getElementById('assistantPanel');
    const close = document.getElementById('assistantClose');
    const body = document.getElementById('assistantBody');
    const input = document.getElementById('assistantInput');
    const send = document.getElementById('assistantSend');

    let isPanelOpen = false;

    fab.addEventListener('click', () => {
        isPanelOpen = !isPanelOpen;
        panel.classList.toggle('active', isPanelOpen);
        if (isPanelOpen) {
            scrollToBottom();
            renderInitialConversation();
        }
    });

    close.addEventListener('click', () => {
        isPanelOpen = false;
        panel.classList.remove('active');
    });

    // Handle send click or Enter key
    const submitQuery = () => {
        const queryText = input.value.trim();
        if (!queryText) return;
        input.value = '';
        addUserMessage(queryText);
        processUserQuery(queryText);
    };

    send.addEventListener('click', submitQuery);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitQuery();
    });

    // Helper: Scroll body to bottom
    function scrollToBottom() {
        body.scrollTop = body.scrollHeight;
    }

    // Helper: Add User Message Bubble
    function addUserMessage(text) {
        const row = document.createElement('div');
        row.className = 'assistant-msg-row user';
        row.innerHTML = `<div class="assistant-bubble user">${escapeHtml(text)}</div>`;
        body.appendChild(row);
        scrollToBottom();
    }

    // Helper: Add AI Message Bubble (with loading indicator support)
    function addAiMessage(htmlContent, isLoader = false) {
        const row = document.createElement('div');
        row.className = 'assistant-msg-row ai';
        if (isLoader) {
            row.id = 'aiAssistantLoader';
            row.innerHTML = `
                <div class="assistant-bubble ai" style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-dim);">
                    <i class="fas fa-circle-notch fa-spin"></i> Analyzing project data...
                </div>`;
        } else {
            row.innerHTML = `<div class="assistant-bubble ai">${htmlContent}</div>`;
        }
        body.appendChild(row);
        scrollToBottom();
        return row;
    }

    // Helper: Remove loading indicator
    function removeLoader() {
        const loader = document.getElementById('aiAssistantLoader');
        if (loader) loader.remove();
    }

    // Render Initial Welcome + Suggestion Chips
    function renderInitialConversation() {
        body.innerHTML = '';
        
        // Welcome bubble
        const nameClean = user.name.split(' ')[0];
        const welcomeText = `Hi ${nameClean}! I'm your AI productivity assistant. I can help check your deadlines, plan your day, or summarize your team's current velocity.`;
        addAiMessage(`<p>${welcomeText}</p>`);

        // Check for API key
        const isKeyConfigured = GROQ_API_KEY && GROQ_API_KEY !== 'YOUR_GROQ_API_KEY_HERE' && GROQ_API_KEY.trim() !== '';
        if (!isKeyConfigured) {
            renderSetupView();
            return;
        }

        // Enable composer inputs
        input.removeAttribute('disabled');
        send.removeAttribute('disabled');

        // Suggestion chips container
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'assistant-chips-container';
        chipsContainer.innerHTML = `
            <div class="assistant-chip-title">Quick Action Questions</div>
            <div class="assistant-chips">
                <button class="assistant-chip" data-query="What is overdue?"><i class="fas fa-exclamation-triangle"></i> What is overdue?</button>
                <button class="assistant-chip" data-query="What should I do today?"><i class="fas fa-calendar-day"></i> What should I do today?</button>
                <button class="assistant-chip" data-query="Summarize team progress."><i class="fas fa-chart-bar"></i> Summarize team progress.</button>
            </div>
        `;
        body.appendChild(chipsContainer);

        // Bind clicks to chips
        chipsContainer.querySelectorAll('.assistant-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.getAttribute('data-query');
                addUserMessage(query);
                processUserQuery(query);
            });
        });
        scrollToBottom();
    }

    // Render local API Key Input screen inside chat stream
    function renderSetupView() {
        input.setAttribute('disabled', 'true');
        send.setAttribute('disabled', 'true');

        const card = document.createElement('div');
        card.className = 'assistant-setup-card';
        card.innerHTML = `
            <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-main);"><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> AI Assistant Disabled</div>
            <p style="font-size: 0.75rem; color: var(--text-dim); line-height: 1.4; margin: 0.5rem 0;">
                The Groq API key is not yet set in the project configuration file. Please configure the key:
            </p>
            <div style="background: #f1f5f9; padding: 0.4rem; border-radius: 6px; font-family: monospace; font-size: 0.7rem; color: #ef4444; border: 1px solid var(--glass-border); text-align: center; margin-bottom: 0.25rem;">
                js/firebase-config.js
            </div>
        `;
        body.appendChild(card);
        scrollToBottom();
    }

    // Query Processing and Groq Integration
    async function processUserQuery(queryText) {
        addAiMessage('', true); // Show loading spinner

        try {
            // Gather real-time Firestore database records
            const tasks = await getTasks();
            const teamMembers = await getTeamMembers(user.teamId);
            const attendance = await getAllAttendance();

            const contextData = {
                currentTime: '2026-06-26T23:00:00+05:30',
                currentUser: {
                    id: user.id,
                    name: user.name,
                    role: user.role,
                    teamId: user.teamId,
                    teamName: user.teamName,
                    streak: user.streak || 0
                },
                teamMembers: teamMembers.map(m => ({
                    id: m.id,
                    name: m.name,
                    role: m.role,
                    streak: m.streak || 0,
                    lastActive: m.lastActive || 'none'
                })),
                tasks: tasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    assignedTo: t.assignedTo,
                    assignedToName: teamMembers.find(m => m.id === t.assignedTo)?.name || 'Unknown',
                    deadline: t.deadline,
                    priority: t.priority,
                    status: t.status,
                    submissionStatus: t.submission?.status || 'none'
                })),
                attendanceToday: attendance.filter(a => a.date === '2026-06-26').map(a => ({
                    userId: a.userId,
                    userName: teamMembers.find(m => m.id === a.userId)?.name || 'Unknown',
                    time: a.time,
                    status: a.status
                }))
            };

            const userPrompt = `Project Context Data:\n${JSON.stringify(contextData, null, 2)}\n\nUser Question: "${queryText}"\n\nAnswer:`;

            const response = await callGroqAPI(userPrompt);
            removeLoader();
            addAiMessage(formatMarkdown(response));
        } catch (err) {
            console.error('Smart assistant execution error:', err);
            removeLoader();
            addAiMessage(`<p style="color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Error calling AI Assistant: ${escapeHtml(err.message || 'Unknown network error')}</p>`);
        }
    }

    // Call REST endpoint for Groq API
    async function callGroqAPI(promptText) {
        if (!GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE' || GROQ_API_KEY.trim() === '') {
            throw new Error('Groq API Key is not configured. Please define GROQ_API_KEY in js/firebase-config.js.');
        }

        const url = `https://api.groq.com/openai/v1/chat/completions`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: SYSTEM_INSTRUCTION
                    },
                    {
                        role: 'user',
                        content: promptText
                    }
                ],
                temperature: 0.4
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `HTTP error ${response.status}`;
            throw new Error(errMsg);
        }

        const data = await response.json();
        const responseText = data?.choices?.[0]?.message?.content;
        if (!responseText) throw new Error('Received an empty response from Groq.');

        return responseText.trim();
    }

    // Escape HTML to prevent XSS in chat messages
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Simple Markdown parsing for assistant replies
    function formatMarkdown(text) {
        let formatted = escapeHtml(text);

        // Header parsing (### Header or ## Header)
        formatted = formatted.replace(/^(?:###|##) (.*?)$/gm, '<h4 style="margin: 0.75rem 0 0.25rem; font-weight: 800; font-size: 0.9rem; color: var(--primary-hover);">$1</h4>');

        // Bold (**text**)
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic (*text*)
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Bulleted lists (dash - or asterisk *)
        formatted = formatted.replace(/^\s*[-*]\s+(.*?)$/gm, '<li style="margin-left: 1.25rem; list-style-type: disc; margin-bottom: 0.25rem;">$1</li>');

        // Numbered lists (1. list item)
        formatted = formatted.replace(/^\s*\d+\.\s+(.*?)$/gm, '<li style="margin-left: 1.25rem; list-style-type: decimal; margin-bottom: 0.25rem;">$1</li>');

        // Code blocks (inline `code`)
        formatted = formatted.replace(/`(.*?)`/g, '<code style="font-family: monospace; background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 4px; color: #ef4444;">$1</code>');

        // Linebreaks
        formatted = formatted.replace(/\n/g, '<br>');

        // Wrap list items nicely
        // Simple regex-based wrapper is hard, but inserting li groups into ul tags cleans it up:
        // A neat trick: Replace consecutive <br><li elements
        formatted = formatted.replace(/(<li.*?>.*?<\/li>)/g, '$1');

        return formatted;
    }
}
