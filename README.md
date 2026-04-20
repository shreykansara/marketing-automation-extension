# Blostem Email Ingester - Setup Instructions

This browser extension allows you to save emails from Gmail directly to your Blostem Intelligence Platform.

## 1. Load the Extension
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked**.
4. Select the directory: `the **Extension folder** (the root directory where you cloned this repository)`.

## 2. Usage

### 📩 Saving Emails (Read Mode)
1. Open any email in [Gmail](https://mail.google.com).
2. Look for the glassmorphic **🌱 Save to Blostem** button next to the email subject.
3. Click the button to sync the conversation to your Blostem database.
4. Once saved (checkmark ✅), the email will appear in your dashboard.

### ✨ AI Outreach Generation (Compose Mode)
1. Click **Compose** to start a new email, or **Reply** to an existing thread.
2. Enter a recipient email address (the system uses this to fetch history).
3. Look for the **✨ AI Outreach** button in the bottom toolbar (next to the Send button).
4. Click it to automatically generate a personalized draft based on the lead's history and current pipeline status.
5. Review and refine the generated draft before sending.

## 3. Configuration
- The extension connects to the production backend: `https://marketing-automation-xtd2.onrender.com/api/emails/`.
- Ensure the recipient email exists in your Blostem leads/deals for the AI Outreach generator to find context.

---
*Note: This version is optimized for Gmail's current DOM structure.*
# m a r k e t i n g - a u t o m a t i o n - e x t e n s i o n

