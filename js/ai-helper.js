/**
 * TEAMLINK AI Writing Assistant & Tone Cleanup Module
 * Uses Groq API client-side with central API key configuration.
 */

import { GROQ_API_KEY, GROQ_MODEL } from './firebase-config.js';

const SYSTEM_INSTRUCTION = `You are an expert writing assistant integrated into a professional team chat application called TEAMLINK.
Your job is to rewrite, clean up, or draft a chat message based on the user's request.
Maintain the key information, but adjust the style, grammar, and tone.
IMPORTANT rules:
1. Return ONLY the raw rewritten message text.
2. Do NOT wrap it in quotes.
3. Do NOT include any introductory or concluding text (e.g. "Here is your message:", "Hope this helps!").
4. Do NOT explain your changes. Just provide the final message.`;

export function initAIHelper() {
    const aiToggle = document.getElementById('aiToggle');
    const aiPopover = document.getElementById('aiPopover');
    const chatInput = document.getElementById('chatInputText');
    const emojiPopover = document.getElementById('emojiPopover');

    if (!aiToggle || !aiPopover || !chatInput) {
        console.warn('AI Assistant elements not found in DOM.');
        return;
    }

    // Toggle AI popover visibility
    aiToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Hide emoji picker if open
        if (emojiPopover) emojiPopover.style.display = 'none';

        const isOpen = aiPopover.style.display === 'flex';
        if (isOpen) {
            aiPopover.style.display = 'none';
        } else {
            aiPopover.style.display = 'flex';
            renderCurrentState();
        }
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        if (!aiPopover.contains(e.target) && e.target !== aiToggle && !aiToggle.contains(e.target)) {
            aiPopover.style.display = 'none';
        }
    });

    // Main rendering logic based on API Key and input content
    function renderCurrentState(customState = null) {
        const isKeyConfigured = GROQ_API_KEY && GROQ_API_KEY !== 'YOUR_GROQ_API_KEY_HERE' && GROQ_API_KEY.trim() !== '';
        
        if (!isKeyConfigured) {
            renderSetupView();
            return;
        }

        if (customState) {
            if (customState.type === 'loading') {
                renderLoadingView();
            } else if (customState.type === 'result') {
                renderResultView(customState.originalText, customState.suggestedText, customState.actionType);
            } else if (customState.type === 'error') {
                renderErrorView(customState.errorMsg, customState.retryState);
            }
            return;
        }

        const currentText = chatInput.value.trim();
        if (currentText) {
            renderToneCleanupView(currentText);
        } else {
            renderMessageGeneratorView();
        }
    }

    // RENDER: API Key Setup View (Developer warning)
    function renderSetupView() {
        aiPopover.innerHTML = `
            <div class="ai-popover-header">
                <span class="ai-popover-title"><i class="fas fa-wand-magic-spark"></i> AI Assistant</span>
                <button class="ai-popover-close" id="aiCloseBtn"><i class="fas fa-times"></i></button>
            </div>
            <div class="ai-popover-body">
                <div class="ai-setup-container">
                    <div class="ai-setup-icon" style="color: #f59e0b;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">Groq API Key Missing</div>
                    <p class="ai-setup-text">
                        The AI assistant has been configured to use Groq, but the API key is not yet set.
                        Please define <strong>GROQ_API_KEY</strong> in the project config file:
                        <br><br>
                        <code style="background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.75rem;">js/firebase-config.js</code>
                    </p>
                </div>
            </div>
        `;

        const closeBtn = document.getElementById('aiCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => aiPopover.style.display = 'none');
        }
    }

    // RENDER: Tone Cleanup Selection View (When text is present)
    function renderToneCleanupView(originalText) {
        aiPopover.innerHTML = `
            <div class="ai-popover-header">
                <span class="ai-popover-title"><i class="fas fa-wand-magic-spark"></i> Clean Up Message</span>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="ai-popover-close" id="aiCloseBtn"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="ai-popover-body">
                <div style="background: #f8fafc; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid var(--glass-border); font-size: 0.85rem; color: var(--text-dim); max-height: 80px; overflow-y: auto;">
                    <strong>Your draft:</strong> "${originalText}"
                </div>
                <div class="ai-section-title">Select Tone Cleanup Mode</div>
                <div class="ai-tone-grid">
                    <button class="ai-tone-btn" data-action="professional"><i class="fas fa-briefcase"></i> Professional</button>
                    <button class="ai-tone-btn" data-action="friendly"><i class="fas fa-face-smile"></i> Friendly</button>
                    <button class="ai-tone-btn" data-action="concise"><i class="fas fa-compress-alt"></i> Concise</button>
                    <button class="ai-tone-btn" data-action="assertive"><i class="fas fa-bullhorn"></i> Assertive</button>
                    <button class="ai-tone-btn" data-action="grammar"><i class="fas fa-spell-check"></i> Fix Grammar</button>
                    <button class="ai-tone-btn" data-action="elaborate"><i class="fas fa-expand-arrows-alt"></i> Elaborate</button>
                </div>
                <div style="border-top: 1px solid var(--glass-border); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div class="ai-section-title">Custom Instruction</div>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="aiCustomInput" placeholder="e.g., Make it sound urgent..." style="flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--glass-border); border-radius: 8px; font-size: 0.8rem; outline: none;">
                        <button class="ai-generate-btn" id="aiCustomGoBtn" style="padding: 0.5rem 1rem; border-radius: 8px;"><i class="fas fa-magic"></i></button>
                    </div>
                </div>
            </div>
        `;

        setupCommonEvents();

        // Bind click on tone buttons
        document.querySelectorAll('.ai-tone-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                processToneCleanup(originalText, action);
            });
        });

        // Bind custom instruction
        const customGoBtn = document.getElementById('aiCustomGoBtn');
        const customInput = document.getElementById('aiCustomInput');
        
        const runCustom = () => {
            const instr = customInput.value.trim();
            if (!instr) return;
            processToneCleanup(originalText, 'custom', instr);
        };

        customGoBtn.addEventListener('click', runCustom);
        customInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') runCustom();
        });
    }

    // RENDER: Message Generator View (When chat input is empty)
    function renderMessageGeneratorView() {
        aiPopover.innerHTML = `
            <div class="ai-popover-header">
                <span class="ai-popover-title"><i class="fas fa-wand-magic-spark"></i> Write a Message</span>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="ai-popover-close" id="aiCloseBtn"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="ai-popover-body">
                <div class="ai-prompt-area">
                    <label class="ai-section-title" for="aiPromptText">What should the message say?</label>
                    <textarea id="aiPromptText" class="ai-prompt-input" placeholder="e.g., Ask the team to send updates on their active tasks before EOD, or draft a congratulations message for launch..."></textarea>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <select id="aiPromptTone" style="padding: 0.4rem 0.6rem; border: 1px solid var(--glass-border); border-radius: 8px; font-size: 0.8rem; font-weight: 700; color: var(--text-dim); background: white; outline: none;">
                        <option value="friendly">Tone: Friendly</option>
                        <option value="professional" selected>Tone: Professional</option>
                        <option value="urgent">Tone: Urgent</option>
                        <option value="casual">Tone: Casual</option>
                    </select>
                    <button class="ai-generate-btn" id="aiGenerateBtn">
                        <i class="fas fa-wand-magic-spark"></i> Generate Draft
                    </button>
                </div>
            </div>
        `;

        setupCommonEvents();

        const generateBtn = document.getElementById('aiGenerateBtn');
        const promptTextarea = document.getElementById('aiPromptText');
        const toneSelect = document.getElementById('aiPromptTone');

        generateBtn.addEventListener('click', () => {
            const prompt = promptTextarea.value.trim();
            if (!prompt) {
                alert('Please enter a description for the message.');
                return;
            }
            processMessageGeneration(prompt, toneSelect.value);
        });
    }

    // RENDER: Loading Shimmer View
    function renderLoadingView() {
        aiPopover.innerHTML = `
            <div class="ai-popover-header">
                <span class="ai-popover-title"><i class="fas fa-spinner fa-spin"></i> Processing with AI...</span>
                <button class="ai-popover-close" id="aiCloseBtn"><i class="fas fa-times"></i></button>
            </div>
            <div class="ai-popover-body">
                <div class="ai-loader">
                    <div class="ai-shimmer-bar"></div>
                    <div class="ai-shimmer-bar" style="width: 85%;"></div>
                    <div class="ai-shimmer-bar short"></div>
                </div>
                <p style="font-size: 0.8rem; color: var(--text-dim); text-align: center; font-style: italic;">
                    Polishing your draft...
                </p>
            </div>
        `;
        document.getElementById('aiCloseBtn').addEventListener('click', () => aiPopover.style.display = 'none');
    }

    // RENDER: Result View with Suggestions
    function renderResultView(originalText, suggestedText, actionType) {
        aiPopover.innerHTML = `
            <div class="ai-popover-header">
                <span class="ai-popover-title"><i class="fas fa-wand-magic-spark"></i> AI Suggestion</span>
                <button class="ai-popover-close" id="aiCloseBtn"><i class="fas fa-times"></i></button>
            </div>
            <div class="ai-popover-body">
                <div class="ai-suggestion-card">
                    <div class="ai-suggestion-text" id="aiSuggestedText">${suggestedText}</div>
                </div>
                <div class="ai-actions-row">
                    <button class="ai-action-btn" id="aiBackBtn">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <button class="ai-action-btn" id="aiCopyBtn">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="ai-action-btn apply-btn" id="aiApplyBtn">
                        <i class="fas fa-check"></i> Apply to Chat
                    </button>
                </div>
            </div>
        `;

        document.getElementById('aiCloseBtn').addEventListener('click', () => aiPopover.style.display = 'none');
        
        document.getElementById('aiBackBtn').addEventListener('click', () => {
            // Restore previous panel depending on input text state
            renderCurrentState();
        });

        const copyBtn = document.getElementById('aiCopyBtn');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(suggestedText);
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });

        document.getElementById('aiApplyBtn').addEventListener('click', () => {
            chatInput.value = suggestedText;
            aiPopover.style.display = 'none';
            chatInput.focus();
        });
    }

    // RENDER: Error View
    function renderErrorView(errorMsg, retryState) {
        aiPopover.innerHTML = `
            <div class="ai-popover-header">
                <span class="ai-popover-title" style="color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> Error</span>
                <button class="ai-popover-close" id="aiCloseBtn"><i class="fas fa-times"></i></button>
            </div>
            <div class="ai-popover-body" style="text-align: center; gap: 1rem;">
                <div style="font-size: 0.85rem; color: #ef4444; background: #fee2e2; padding: 0.75rem 1rem; border-radius: 10px; line-height: 1.45;">
                    ${errorMsg}
                </div>
                <div class="ai-actions-row" style="justify-content: center;">
                    <button class="ai-action-btn apply-btn" id="aiRetryBtn" style="width: 100%;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            </div>
        `;

        document.getElementById('aiCloseBtn').addEventListener('click', () => aiPopover.style.display = 'none');
        
        document.getElementById('aiRetryBtn').addEventListener('click', () => {
            if (retryState.mode === 'cleanup') {
                processToneCleanup(retryState.text, retryState.action, retryState.customPrompt);
            } else {
                processMessageGeneration(retryState.prompt, retryState.tone);
            }
        });
    }

    // Common navigation handlers
    function setupCommonEvents() {
        const closeBtn = document.getElementById('aiCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => aiPopover.style.display = 'none');
        }
    }

    // API: Make fetch call to Groq API
    async function callGroq(systemInstruction, promptText) {
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
                        content: systemInstruction
                    },
                    {
                        role: 'user',
                        content: promptText
                    }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `HTTP error ${response.status}`;
            throw new Error(errMsg);
        }

        const data = await response.json();
        const responseText = data?.choices?.[0]?.message?.content;

        if (!responseText) {
            throw new Error('Received an empty response from AI.');
        }

        return responseText.trim();
    }

    // PROCESS: Tone Cleanup Execution
    async function processToneCleanup(text, action, customPrompt = '') {
        renderCurrentState({ type: 'loading' });

        let toneInstruction = '';
        switch (action) {
            case 'professional':
                toneInstruction = 'Rewrite this message to be professional, polite, well-structured, and workplace-appropriate.';
                break;
            case 'friendly':
                toneInstruction = 'Rewrite this message to be warm, friendly, collaborative, approaches-friendly, and positive.';
                break;
            case 'concise':
                toneInstruction = 'Shorten this message significantly to make it concise, direct, and focused, removing fluff.';
                break;
            case 'assertive':
                toneInstruction = 'Rewrite this message to sound assertive, confident, and direct.';
                break;
            case 'grammar':
                toneInstruction = 'Fix all spelling, typos, punctuation, and grammatical mistakes, keeping the original meaning and tone intact.';
                break;
            case 'elaborate':
                toneInstruction = 'Expand this short draft or bullet points into a detailed, complete, and polite message.';
                break;
            case 'custom':
                toneInstruction = `Rewrite this message following this specific tone instruction: ${customPrompt}`;
                break;
            default:
                toneInstruction = 'Rewrite this message to be clear and correct.';
        }

        const userPrompt = `User Instruction: ${toneInstruction}\nOriginal message draft to rewrite:\n"${text}"\n\nRewritten message:`;

        try {
            const result = await callGroq(SYSTEM_INSTRUCTION, userPrompt);
            renderCurrentState({
                type: 'result',
                originalText: text,
                suggestedText: result,
                actionType: action
            });
        } catch (err) {
            console.error('Groq cleanup call failed: ', err);
            renderCurrentState({
                type: 'error',
                errorMsg: err.message || 'An unknown error occurred while processing.',
                retryState: { mode: 'cleanup', text, action, customPrompt }
            });
        }
    }

    // PROCESS: Message Generation Execution
    async function processMessageGeneration(prompt, tone) {
        renderCurrentState({ type: 'loading' });

        const userPrompt = `User Request: Draft a chat message based on this prompt: "${prompt}".\nRequested tone style: Make the tone of the message "${tone}".\n\nDrafted message:`;

        try {
            const result = await callGroq(SYSTEM_INSTRUCTION, userPrompt);
            renderCurrentState({
                type: 'result',
                originalText: '',
                suggestedText: result,
                actionType: `generate_${tone}`
            });
        } catch (err) {
            console.error('Groq generation call failed: ', err);
            renderCurrentState({
                type: 'error',
                errorMsg: err.message || 'An unknown error occurred while generating the message.',
                retryState: { mode: 'generate', prompt, tone }
            });
        }
    }
}
