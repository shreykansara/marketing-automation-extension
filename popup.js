// popup.js

document.addEventListener('DOMContentLoaded', async () => {
    const defaultView = document.getElementById('default-view');
    const activeView = document.getElementById('active-view');
    const emailSubject = document.getElementById('email-subject');
    const addBtn = document.getElementById('add-to-db-btn');
    const statusMsg = document.getElementById('status-msg');

    // 1. Detect Active Tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url.includes('mail.google.com')) {
        showDefault();
        return;
    }

    // 2. Check if an email is open (Automatic Scan)
    chrome.tabs.sendMessage(tab.id, { action: "detectEmail" }, (response) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            showDefault("Please refresh Gmail to enable the extension.");
            return;
        }

        if (response && response.isOpen) {
            showActive(response.subject);
        } else {
            showDefault();
        }
    });

    // 3. Handle Add to Database Click
    addBtn.addEventListener('click', () => {
        addBtn.disabled = true;
        addBtn.innerText = 'Scanning & Saving...';
        addBtn.classList.add('loading');

        chrome.tabs.sendMessage(tab.id, { action: "extractFullData" }, (response) => {
            if (response && response.data) {
                // Relay to background script to save to API
                chrome.runtime.sendMessage({ action: "saveEmail", data: response.data }, (saveResponse) => {
                    if (saveResponse && saveResponse.status === "success") {
                        addBtn.innerText = 'Added to Database!';
                        addBtn.classList.remove('loading');
                        addBtn.classList.add('success');
                        statusMsg.innerText = 'Email successfully ingested.';
                        statusMsg.style.color = '#10b981';
                    } else {
                        addBtn.innerText = 'Error Saving';
                        addBtn.classList.remove('loading');
                        addBtn.classList.add('error');
                        statusMsg.innerText = saveResponse?.message || 'Failed to save to database.';
                        statusMsg.style.color = '#ef4444';
                    }
                });
            } else {
                addBtn.innerText = 'Scan Failed';
                addBtn.disabled = false;
            }
        });
    });

    function showDefault(customMsg) {
        defaultView.style.display = 'block';
        activeView.style.display = 'none';
        if (customMsg) {
            document.querySelector('.status').innerText = customMsg;
        }
    }

    function showActive(subject) {
        defaultView.style.display = 'none';
        activeView.style.display = 'block';
        emailSubject.innerText = subject;
    }
});
