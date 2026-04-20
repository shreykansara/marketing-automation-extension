// content.js - Blostem Gmail Integration

/**
 * Configuration for Gmail selectors
 */
const CONFIG = {
    selectors: {
        subject: 'h2.hP',
        body: '.adn.ads .gs',
        sender: 'span[email]',
        threadContainer: '[role="main"]',
        toolbar: '.iH',
        composeWindow: '[role="dialog"], .M9, [aria-label="Compose"]',
        composeToolbar: '.btC', // Bottom toolbar in compose
        composeSubject: 'input[name="subjectbox"]',
        composeBody: 'div[aria-label="Message Body"], div[role="textbox"]'
    }
};

// --- Utilities ---

/**
 * Robustly extracts the recipient email from a compose window
 */
function extractRecipient(composeDialog) {
    let recipient = "";
    const toArea = (composeDialog || document).querySelector('[aria-label="To"], .aoD, .vP, input[name="to"]');

    if (toArea) {
        // 1. Check for email attributes (chips)
        const emailEl = toArea.querySelector('[email]');
        if (emailEl) return emailEl.getAttribute('email');

        // 2. Check for text matches
        const text = toArea.innerText || toArea.value || "";
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) return emailMatch[0];

        // 3. Check all inputs
        const inputs = toArea.querySelectorAll('input');
        for (let input of inputs) {
            if (input.value && input.value.includes('@')) return input.value;
        }
    }

    // Global fallback for this dialog
    if (composeDialog) {
        const globalMatch = composeDialog.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (globalMatch) return globalMatch[0];
    }

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
        bodyBox.innerText = body;
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
        btn.innerHTML = '✨ AI Outreach';
        btn.className = 'blostem-ai-btn';
        btn.type = 'button';
        btn.title = 'Generate AI Outreach with Blostem';

        btn.onclick = async (e) => {
            e.preventDefault();
            const recipient = extractRecipient(dialog);

            if (!recipient) {
                btn.innerHTML = '❌ No Recipient';
                btn.classList.add('error');
                setTimeout(() => {
                    btn.innerHTML = '✨ AI Outreach';
                    btn.classList.remove('error');
                }, 3000);
                return;
            }

            btn.innerHTML = '⏳ Generating...';
            btn.classList.add('loading');
            btn.disabled = true;

            try {
                const response = await fetch("https://marketing-automation-xtd2.onrender.com/api/emails/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ recipient_email: recipient })
                });

                const data = await response.json();

                if (response.ok && data.status === "success") {
                    injectDraft(dialog, data.generated.subject, data.generated.body);
                    btn.innerHTML = '✅ Generated!';
                    btn.classList.add('success');
                } else {
                    const errorMsg = data.detail || (response.status !== 200 ? `Status ${response.status}` : "Unknown Error");
                    throw new Error(errorMsg);
                }
            } catch (err) {
                console.error("Blostem AI Outreach Error:", err);
                btn.innerHTML = '❌ ' + (err.message.includes('Status') ? err.message : 'Error');
                btn.classList.add('error');
            } finally {
                btn.classList.remove('loading');
                btn.disabled = false;
                setTimeout(() => {
                    btn.innerHTML = '✨ AI Outreach';
                    btn.classList.remove('success', 'error');
                }, 4000);
            }
        };

        // Insert at the beginning of the toolbar
        toolbar.insertBefore(btn, toolbar.firstChild);
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

// --- Main Execution ---

const observer = new MutationObserver(() => {
    injectOutreachButton();
    if (location.href.includes('#inbox/') || location.href.includes('#search/') || location.href.includes('#all/')) {
        injectSaveButton();
    }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial checks for slow loads
setInterval(() => {
    injectOutreachButton();
}, 2000);

console.log("Blostem AI Integration Active.");
