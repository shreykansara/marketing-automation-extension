// content.js

/**
 * Gmail Email Ingester - Content Script
 * Injects a 'Save to Blostem' button and extracts email data.
 */

// --- Configuration ---
const CONFIG = {
    selectors: {
        subject: 'h2.hP',
        body: '.adn.ads .gs',
        sender: 'span[email]',
        threadContainer: '[role="main"]',
        toolbar: '.iH' // Toolbar area in conversation view
    },
    debounceTime: 500
};

let lastUrl = location.href;

// --- Core Logic ---

/**
 * Extracts data from the currently opened email.
 */
function extractEmailData() {
    const subjectEl = document.querySelector(CONFIG.selectors.subject);
    const bodyEls = document.querySelectorAll(CONFIG.selectors.body);
    const senderEls = document.querySelectorAll(CONFIG.selectors.sender);

    if (!subjectEl || bodyEls.length === 0) {
        console.warn("Blostem: Could not find email subject or body.");
        return null;
    }

    const subject = subjectEl.innerText;
    
    // Get the last (most recent) message in the thread
    const bodyEl = bodyEls[bodyEls.length - 1];
    const body = bodyEl.innerText || bodyEl.textContent;

    // Extract sender and receiver
    // Usually the first span[email] is the sender of the current message
    // In a thread, it's more complex, but we'll try to get the most relevant one
    let sender = "unknown@example.com";
    if (senderEls.length > 0) {
        sender = senderEls[senderEls.length - 1].getAttribute('email');
    }

    // Receiver is likely the current user
    // We can try to find the user's email from the DOM or just leave it for now
    // For simplicity, we'll try to find an email that isn't the sender
    let receiver = "me@example.com";
    for (let el of senderEls) {
        let email = el.getAttribute('email');
        if (email && email !== sender) {
            receiver = email;
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
 * Injects the button into the Gmail UI.
 */
function injectButton() {
    // Check if button already exists
    if (document.getElementById('blostem-save-button')) return;

    // Look for the toolbar or the subject line area
    const container = document.querySelector(CONFIG.selectors.subject)?.parentElement;
    
    if (!container) return;

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
                console.error("Blostem Save Error:", response?.message);
                setTimeout(() => {
                    btn.classList.remove('error');
                    btn.innerText = 'Save to Blostem';
                }, 3000);
            }
        });
    };

    container.appendChild(btn);
}

/**
 * Observes changes to the DOM to detect when an email is opened.
 */
const observer = new MutationObserver((mutations) => {
    // Check if the URL has changed or if the email view is present
    if (location.href.includes('#inbox/') || location.href.includes('#search/') || location.href.includes('#all/')) {
        // Debounce injection to allow Gmail to render
        setTimeout(injectButton, 1000);
    }
});

// Start observing
observer.observe(document.body, { childList: true, subtree: true });

// Also handle initial load
if (location.href.includes('#inbox/') || location.href.includes('#all/')) {
    setTimeout(injectButton, 2000);
}

// --- Popup Messaging ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "detectEmail") {
        const subjectEl = document.querySelector(CONFIG.selectors.subject);
        if (subjectEl) {
            sendResponse({ 
                isOpen: true, 
                subject: subjectEl.innerText 
            });
        } else {
            sendResponse({ isOpen: false });
        }
    } else if (request.action === "detectCompose") {
        // Detect Compose Dialog
        const composeDialog = document.querySelector('[role="dialog"], .M9');
        if (composeDialog) {
            // Try to find recipient
            const toField = composeDialog.querySelector('input[name="to"], [name="to"], [aria-label="To"], [role="combobox"]');
            let recipient = "";
            if (toField) {
                recipient = toField.value || toField.innerText || "";
                
                // If it's a chip/collection, find the actual email address
                if (!recipient || !recipient.includes('@')) {
                    const toArea = composeDialog.querySelector('.vX, .aoD, [aria-label="To"]');
                    if (toArea) {
                        const emailMatch = toArea.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                        if (emailMatch) recipient = emailMatch[0];
                    }
                }
            }
            sendResponse({ isComposing: true, recipient: recipient.trim() });
        } else {
            sendResponse({ isComposing: false });
        }
    } else if (request.action === "extractFullData") {
        const data = extractEmailData();
        sendResponse({ data: data });
    }
    return true;
});

console.log("Blostem Email Ingester active.");
