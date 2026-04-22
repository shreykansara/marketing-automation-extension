// content.js - Blostem Gmail Integration

/**
 * Configuration for Gmail selectors
 */
const CONFIG = {
    apiBase: "http://localhost:8000",
    selectors: {
        subject: 'h2.hP',
        body: '.adn.ads .gs',
        sender: 'span[email]',
        threadContainer: '[role="main"]',
        toolbar: '.iH',
        composeWindow: '[role="dialog"], .M9, [aria-label="Compose"]',
        composeToolbar: '.btC', // Bottom toolbar in compose
        composeSubject: 'input[name="subjectbox"]',
        composeBody: 'div[aria-label="Message Body"], div[role="textbox"]',
        toArea: '[aria-label="To"], .aoD, .vP, input[name="to"]',
        sendButton: '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
        sendDropdown: '.T-I.J-J5-Ji.n7.T-I-ax7.L3'
    }
};

// --- State ---
const STATE = {
    companies: [],
    lastFetch: 0,
    isFetching: false
};

async function fetchCompanies() {
    if (STATE.companies.length > 0 && (Date.now() - STATE.lastFetch < 300000)) {
        return STATE.companies;
    }
    if (STATE.isFetching) return [];

    STATE.isFetching = true;
    try {
        const { token } = await chrome.storage.local.get("token");
        if (!token) return [];

        const resp = await fetch(`${CONFIG.apiBase}/api/companies/`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (resp.ok) {
            STATE.companies = await resp.json();
            STATE.lastFetch = Date.now();
        }
    } catch (e) {
        console.error("Blostem: Fetch companies failed", e);
    } finally {
        STATE.isFetching = false;
    }
    return STATE.companies;
}

// --- Utilities ---

function extractRecipient(composeDialog) {
    if (!composeDialog) return "";
    console.log("Blostem: Attempting to extract recipient...");

    // Target the specific Gmail "To" area containers
    const toArea = composeDialog.querySelector(CONFIG.selectors.toArea);
    if (!toArea) {
        console.warn("Blostem: To area not found");
        return "";
    }

    // 1. Check for chips/email elements using every known Gmail attribute
    const emailEls = toArea.querySelectorAll('[email], [data-hovercard-id], .vP, .vN');
    for (let el of emailEls) {
        const email = el.getAttribute('email') || el.getAttribute('data-hovercard-id');
        if (email && email.includes('@')) {
            console.log("Blostem: Found recipient in chip:", email);
            return email.trim();
        }
        // Check aria-label for "Name <email@domain.com>"
        const aria = el.getAttribute('aria-label');
        if (aria && aria.includes('<')) {
            const match = aria.match(/<([^>]+)>/);
            if (match) {
                console.log("Blostem: Found recipient in aria-label:", match[1]);
                return match[1].trim();
            }
        }
    }

    // 2. Check for the PeopleKit input field (where user types)
    const inputs = toArea.querySelectorAll('input, [role="combobox"], [contenteditable="true"]');
    for (let input of inputs) {
        const val = input.value || input.innerText || "";
        if (val.includes('@')) {
            const match = val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (match) {
                console.log("Blostem: Found recipient in input/textbox:", match[0]);
                return match[0].trim();
            }
        }
    }

    console.warn("Blostem: No recipient found in To area");
    return "";
}

/**
 * Injects subject and body into a compose window
 */
function injectDraft(composeDialog, subject, body) {
    if (!composeDialog) return;

    const subjectBox = composeDialog.querySelector(CONFIG.selectors.composeSubject);
    if (subjectBox) {
        subjectBox.value = subject;
        subjectBox.dispatchEvent(new Event('input', { bubbles: true }));
        subjectBox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const bodyBox = composeDialog.querySelector(CONFIG.selectors.composeBody);
    if (bodyBox) {
        bodyBox.focus();

        // Double-tap clearing: ensure both innerText and innerHTML are cleared
        // This is necessary because some Gmail versions react differently to innerHTML = ''
        bodyBox.innerText = "";
        bodyBox.innerHTML = "";

        // Insert with execCommand to keep Gmail's internal React/Redux state synced
        document.execCommand('insertHTML', false, body.replace(/\n/g, '<br>'));

        bodyBox.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// --- Injection Logic ---

/**
 * Injects the "Generate AI Outreach" button into Gmail Compose windows
 */
function injectOutreachButton() {
    const composeWindows = document.querySelectorAll(CONFIG.selectors.composeWindow);

    composeWindows.forEach(dialog => {
        const toolbar = dialog.querySelector(CONFIG.selectors.composeToolbar);
        if (!toolbar || dialog.querySelector('.blostem-ai-btn')) return;

        const btn = document.createElement('button');
        btn.innerHTML = 'Generate AI Draft';
        btn.className = 'blostem-ai-btn';
        btn.type = 'button';
        btn.title = 'Generate AI Outreach with Blostem';

        btn.onclick = async (e) => {
            e.preventDefault();
            const recipient = extractRecipient(dialog);

            if (!recipient) {
                btn.innerHTML = 'No Recipient';
                btn.classList.add('error');
                setTimeout(() => {
                    btn.innerHTML = 'Generate AI Draft';
                    btn.classList.remove('error');
                }, 3000);
                return;
            }

            btn.innerHTML = 'Generating...';
            btn.classList.add('loading');
            btn.disabled = true;

            try {
                const { token } = await chrome.storage.local.get("token");
                if (!token) {
                    throw new Error("Login via extension first");
                }

                const response = await fetch(`${CONFIG.apiBase}/api/emails/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ recipient_email: recipient })
                });

                const data = await response.json();

                if (response.ok && data.status === "success") {
                    injectDraft(dialog, data.generated.subject, data.generated.body);

                    // Catch-all for any mode that results in a cold outreach draft
                    const isCold = data.current_state_detected === 'cold_outreach' ||
                        data.current_state_detected === 'internal_no_pipeline' ||
                        data.current_state_detected.includes('missing_');

                    btn.innerHTML = isCold ? 'Cold Draft Generated!' : 'Generated!';
                    btn.classList.add('success');
                } else {
                    const errorMsg = data.detail || (response.status !== 200 ? `Status ${response.status}` : "Unknown Error");
                    throw new Error(errorMsg);
                }
            } catch (err) {
                console.error("Blostem AI Outreach Error:", err);
                btn.innerHTML = 'Error';
                btn.classList.add('error');
            } finally {
                btn.classList.remove('loading');
                btn.disabled = false;
                setTimeout(() => {
                    btn.innerHTML = 'Generate AI Draft';
                    btn.classList.remove('success', 'error');
                }, 4000);
            }
        };

        // Insert at the beginning of the toolbar
        toolbar.insertBefore(btn, toolbar.firstChild);
    });
}

/**
 * Injects the Company Picker into Gmail Compose windows
 */
async function injectCompanyPicker() {
    const composeWindows = document.querySelectorAll(CONFIG.selectors.composeWindow);

    composeWindows.forEach(async dialog => {
        const toArea = dialog.querySelector(CONFIG.selectors.toArea);
        if (!toArea || dialog.querySelector('.blostem-picker-trigger')) return;

        const trigger = document.createElement('div');
        trigger.className = 'blostem-picker-trigger';
        trigger.innerHTML = 'Find Companies';
        trigger.title = 'Pick Company/Email from Blostem';

        trigger.onclick = async (e) => {
            e.stopPropagation();
            const rect = trigger.getBoundingClientRect();
            showPickerOverlay(rect.left, rect.bottom + 5, dialog);
        };

        // Find a clean insertion point in the "To" row
        const ccBccContainer = toArea.parentElement.querySelector('.aA6');
        if (ccBccContainer) {
            ccBccContainer.parentElement.insertBefore(trigger, ccBccContainer);
        } else {
            toArea.parentElement.appendChild(trigger);
        }
    });
}

function showPickerOverlay(x, y, dialog) {
    // Remove existing
    const existing = document.querySelector('.blostem-picker-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'blostem-picker-overlay';
    overlay.style.left = `${x}px`;
    overlay.style.top = `${y}px`;

    let selectedCompany = null;

    const render = async (view = 'companies', filter = '') => {
        overlay.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'blostem-picker-header';

        if (view === 'emails' && selectedCompany) {
            const back = document.createElement('div');
            back.className = 'blostem-picker-back';
            back.innerHTML = '← Back';
            back.onclick = () => render('companies');
            header.appendChild(back);

            const title = document.createElement('h4');
            title.innerText = selectedCompany.name;
            header.appendChild(title);
        } else {
            const title = document.createElement('h4');
            title.innerText = 'Blostem Companies';
            header.appendChild(title);
        }
        overlay.appendChild(header);

        if (view === 'companies') {
            const searchBox = document.createElement('div');
            searchBox.className = 'blostem-picker-search';
            const input = document.createElement('input');
            input.placeholder = 'Search companies...';
            input.value = filter;
            input.oninput = (e) => render('companies', e.target.value);
            searchBox.appendChild(input);
            overlay.appendChild(searchBox);
            setTimeout(() => input.focus(), 100);

            const list = document.createElement('div');
            list.className = 'blostem-picker-list';

            const companies = await fetchCompanies();
            const filtered = companies.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

            filtered.forEach(comp => {
                const item = document.createElement('div');
                item.className = 'blostem-picker-item';
                item.innerHTML = `<div>${comp.name}</div><div class="item-sub">${comp.emails?.length || 0} emails</div>`;
                item.onclick = () => {
                    selectedCompany = comp;
                    render('emails');
                };
                list.appendChild(item);
            });
            overlay.appendChild(list);
        } else {
            const list = document.createElement('div');
            list.className = 'blostem-picker-list';

            selectedCompany.emails.forEach(email => {
                const item = document.createElement('div');
                item.className = 'blostem-picker-item';
                item.innerHTML = `<div>${email}</div>`;
                item.onclick = () => {
                    populateToField(dialog, email);
                    overlay.remove();
                };
                list.appendChild(item);
            });
            overlay.appendChild(list);
        }
    };

    render();
    document.body.appendChild(overlay);

    // Close on outside click
    const closer = (e) => {
        if (!overlay.contains(e.target)) {
            overlay.remove();
            document.removeEventListener('mousedown', closer);
        }
    };
    document.addEventListener('mousedown', closer);
}

function populateToField(dialog, email) {
    // 1. Target the specific PeopleKit input field seen in Gmail's "To" row
    const selectors = [
        'input[aria-label*="To recipients"]',
        'input[peoplekit-id]',
        'div[aria-label="To"] input',
        'input[name="to"]',
        'div[role="textbox"][aria-label*="To"]'
    ];

    let toInput = null;
    for (const selector of selectors) {
        toInput = dialog.querySelector(selector);
        if (toInput) break;
    }

    if (toInput) {
        console.log("Blostem: Found 'To' field, populating...");
        toInput.focus();

        // For standard inputs
        if (toInput.tagName === 'INPUT') {
            toInput.value = email;
            toInput.dispatchEvent(new Event('input', { bubbles: true }));
            toInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Simulating 'Enter' is critical for Gmail to convert text to a "chip"
            const enterEvent = new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                keyCode: 13
            });
            toInput.dispatchEvent(enterEvent);
        }
        // Fallback for contenteditable fields
        else {
            document.execCommand('insertText', false, email);
            toInput.dispatchEvent(new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                keyCode: 13
            }));
        }
    } else {
        console.error("Blostem: Could not locate the 'To' field in the compose window.");
    }
}

/**
 * Injects a standalone "Save & Send" button in the Compose toolbar
 */
function injectSaveSendButton() {
    const composeWindows = document.querySelectorAll(CONFIG.selectors.composeWindow);

    composeWindows.forEach(dialog => {
        const toolbar = dialog.querySelector(CONFIG.selectors.composeToolbar);
        const nativeSend = dialog.querySelector(CONFIG.selectors.sendButton);

        if (!toolbar || !nativeSend || dialog.querySelector('.blostem-send-standalone')) return;

        const btn = document.createElement('button');
        btn.innerHTML = 'Save & Send';
        btn.className = 'blostem-send-standalone';
        btn.type = 'button';
        btn.title = 'Save to Blostem and Send email';

        btn.onclick = async (e) => {
            e.preventDefault();
            if (btn.disabled) return;

            btn.disabled = true;
            btn.innerHTML = 'Saving...';
            btn.classList.add('loading');

            const data = {
                subject: dialog.querySelector(CONFIG.selectors.composeSubject)?.value || "No Subject",
                body: dialog.querySelector(CONFIG.selectors.composeBody)?.innerText || "",
                receiver: extractRecipient(dialog),
                sender: "me-integration@blostem.io",
                timestamp: new Date().toISOString()
            };

            chrome.runtime.sendMessage({ action: "saveEmail", data: data }, (response) => {
                btn.classList.remove('loading');
                btn.disabled = false;
                btn.innerHTML = 'Save & Send';

                if (response && response.status === "success") {
                    nativeSend.click();
                } else {
                    console.error("Blostem: Save failed, still sending as fallback", response?.message);
                    nativeSend.click();
                }
            });
        };

        // Insert near the native send button but as a standalone sibling
        const nativeSendParent = nativeSend.parentElement;
        if (nativeSendParent) {
            nativeSendParent.parentElement.insertBefore(btn, nativeSendParent);
        }
    });
}

/**
 * Extracts data from the currently opened email (Read mode)
 */
function extractEmailData() {
    const subjectEl = document.querySelector(CONFIG.selectors.subject);
    const bodyEls = document.querySelectorAll(CONFIG.selectors.body);
    const senderEls = document.querySelectorAll(CONFIG.selectors.sender);

    if (!subjectEl || bodyEls.length === 0) return null;

    const subject = subjectEl.innerText;
    const bodyEl = bodyEls[bodyEls.length - 1];
    const body = bodyEl.innerText || bodyEl.textContent;

    let receiver = "unknown@example.com";
    if (senderEls.length > 0) {
        receiver = senderEls[senderEls.length - 1].getAttribute('email');
    }

    let sender = "me@example.com";
    for (let el of senderEls) {
        let email = el.getAttribute('email');
        if (email && email !== receiver) {
            sender = email;
            break;
        }
    }

    return {
        subject,
        body,
        sender,
        receiver,
        timestamp: new Date().toISOString(),
        is_logged: false
    };
}

/**
 * Injects the "Save to Blostem" button in Read mode
 */
function injectSaveButton() {
    if (document.getElementById('blostem-save-button')) return;

    const subjectLine = document.querySelector(CONFIG.selectors.subject);
    if (!subjectLine) return;

    const btn = document.createElement('button');
    btn.id = 'blostem-save-button';
    btn.className = 'blostem-save-btn';
    btn.innerText = 'Save to Blostem';

    btn.onclick = async () => {
        const data = extractEmailData();
        if (!data) {
            btn.classList.add('error');
            setTimeout(() => btn.classList.remove('error'), 2000);
            return;
        }

        btn.classList.add('loading');
        btn.innerText = 'Saving...';

        chrome.runtime.sendMessage({ action: "saveEmail", data: data }, (response) => {
            btn.classList.remove('loading');
            if (response && response.status === "success") {
                btn.classList.add('success');
                btn.innerText = 'Saved!';
                setTimeout(() => {
                    btn.classList.remove('success');
                    btn.innerText = 'Save to Blostem';
                }, 3000);
            } else {
                btn.classList.add('error');
                btn.innerText = 'Failed';
                setTimeout(() => {
                    btn.classList.remove('error');
                    btn.innerText = 'Save to Blostem';
                }, 3000);
            }
        });
    };

    subjectLine.parentElement.appendChild(btn);
}

// --- Auth-Aware Main Execution ---

async function checkAuthAndInject() {
    const { token } = await chrome.storage.local.get("token");

    if (!token) {
        hideBlostemUI();
        injectLoginPrompt();
        return;
    }

    // Authenticated: Remove prompt and inject UI
    const prompt = document.getElementById('blostem-login-prompt');
    if (prompt) prompt.remove();

    injectOutreachButton();
    injectCompanyPicker();
    injectSaveSendButton();
    if (location.href.includes('#inbox/') || location.href.includes('#search/') || location.href.includes('#all/')) {
        injectSaveButton();
    }
}

function hideBlostemUI() {
    const elements = document.querySelectorAll('.blostem-ai-btn, .blostem-picker-trigger, .blostem-send-standalone, .blostem-save-btn');
    elements.forEach(el => el.remove());
}

function injectLoginPrompt() {
    if (document.getElementById('blostem-login-prompt')) return;

    // Target the specific wrapper for the Gmail search bar
    const searchWrapper = document.querySelector('.gb_Pe');
    if (!searchWrapper) return;

    // Force horizontal alignment on the parent container
    searchWrapper.style.display = 'flex';
    searchWrapper.style.alignItems = 'center';
    searchWrapper.style.flexWrap = 'nowrap';

    const prompt = document.createElement('div');
    prompt.id = 'blostem-login-prompt';
    prompt.innerHTML = `
        <span>Blostem: <a href="#" style="color: inherit; text-decoration: underline;">Open extension to login</a></span>
    `;

    // Style the prompt for the header area
    Object.assign(prompt.style, {
        background: 'rgba(99, 102, 241, 0.08)',
        border: '1px dashed rgba(99, 102, 241, 0.3)',
        padding: '4px 10px',
        marginLeft: '12px',
        borderRadius: '16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        color: '#6366f1',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        height: '28px',
        flexShrink: '0',
        zIndex: '10',
        transition: 'all 0.2s ease'
    });

    prompt.onmouseover = () => {
        prompt.style.background = 'rgba(99, 102, 241, 0.15)';
        prompt.style.borderStyle = 'solid';
    };
    prompt.onmouseout = () => {
        prompt.style.background = 'rgba(99, 102, 241, 0.08)';
        prompt.style.borderStyle = 'dashed';
    };

    prompt.onclick = (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: "openPopup" });
    };

    // Append as a sibling to the form inside the wrapper
    searchWrapper.appendChild(prompt);
}

const observer = new MutationObserver(() => {
    checkAuthAndInject();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial checks for slow loads
setInterval(() => {
    checkAuthAndInject();
}, 2000);

console.log("Blostem AI Integration Active (Auth-Aware).");
