// popup.js

document.addEventListener('DOMContentLoaded', async () => {
    const defaultView = document.getElementById('default-view');
    const activeView = document.getElementById('active-view');
    const composeView = document.getElementById('compose-view');
    const emailSubject = document.getElementById('email-subject');
    const addBtn = document.getElementById('add-to-db-btn');
    const statusMsg = document.getElementById('status-msg');

    // Compose View elements
    const recipientIndicator = document.getElementById('recipient-indicator');
    const generateBtn = document.getElementById('generate-ai-btn');
    const aiResultContainer = document.getElementById('ai-result-container');
    const aiSubjectField = document.getElementById('ai-subject');
    const aiBodyField = document.getElementById('ai-body');
    const copyBtn = document.getElementById('copy-ai-btn');
    const composeStatus = document.getElementById('compose-status');

    // 1. Detect Active Tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url.includes('mail.google.com')) {
        showView('default');
        return;
    }

    // 2. Automatic Detection - Priority: Compose Mode
    chrome.tabs.sendMessage(tab.id, { action: "detectCompose" }, (composeResponse) => {
        if (composeResponse && composeResponse.isComposing) {
            showView('compose');
            recipientIndicator.innerText = composeResponse.recipient ? `To: ${composeResponse.recipient}` : "To: (Empty)";
            recipientIndicator.dataset.recipient = composeResponse.recipient;
        } else {
            // Check for Read Mode
            chrome.tabs.sendMessage(tab.id, { action: "detectEmail" }, (readResponse) => {
                if (readResponse && readResponse.isOpen) {
                    showView('active');
                    emailSubject.innerText = readResponse.subject;
                } else {
                    showView('default');
                }
            });
        }
    });

    // 3. Handle Add to Database (Read Mode)
    addBtn.addEventListener('click', () => {
        addBtn.disabled = true;
        addBtn.innerText = 'Saving...';
        chrome.tabs.sendMessage(tab.id, { action: "extractFullData" }, (response) => {
            if (response && response.data) {
                chrome.runtime.sendMessage({ action: "saveEmail", data: response.data }, (saveResponse) => {
                    if (saveResponse && saveResponse.status === "success") {
                        addBtn.innerText = 'Added!';
                        statusMsg.innerText = 'Email successfully ingested.';
                    } else {
                        addBtn.innerText = 'Error';
                        statusMsg.innerText = 'Failed to save.';
                    }
                });
            }
        });
    });

    // 4. Handle AI Generation (Compose Mode)
    generateBtn.addEventListener('click', async () => {
        const recipient = recipientIndicator.dataset.recipient;
        if (!recipient) {
            composeStatus.innerText = "Please enter a recipient email first.";
            composeStatus.style.color = "#ef4444";
            return;
        }

        generateBtn.disabled = true;
        generateBtn.innerText = "Generating AI Outreach...";
        composeStatus.innerText = "Connecting to Blostem Intelligence...";
        aiResultContainer.style.display = 'none';

        try {
            const response = await fetch("http://localhost:8000/api/emails/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipient_email: recipient })
            });

            const data = await response.json();

            if (response.ok && data.status === "success") {
                aiSubjectField.value = data.generated.subject;
                aiBodyField.value = data.generated.body;
                aiResultContainer.style.display = 'block';
                generateBtn.innerText = "✨ Regenerate";
                generateBtn.disabled = false;
                composeStatus.innerText = `Context: ${data.company} (${data.current_state_detected})`;
                composeStatus.style.color = "#10b981";
            } else {
                throw new Error(data.detail || "Generation failed.");
            }
        } catch (error) {
            console.error(error);
            generateBtn.disabled = false;
            generateBtn.innerText = "✨ Generate AI Outreach";
            composeStatus.innerText = error.message;
            composeStatus.style.color = "#ef4444";
        }
    });

    // 5. Copy to Clipboard
    copyBtn.addEventListener('click', () => {
        const text = `Subject: ${aiSubjectField.value}\n\n${aiBodyField.value}`;
        navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerText = "Copied!";
            setTimeout(() => copyBtn.innerText = "Copy to Clipboard", 2000);
        });
    });

    function showView(view) {
        defaultView.style.display = view === 'default' ? 'flex' : 'none';
        activeView.style.display = view === 'active' ? 'flex' : 'none';
        composeView.style.display = view === 'compose' ? 'flex' : 'none';
    }
});
