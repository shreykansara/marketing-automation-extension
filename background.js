// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openPopup") {
    chrome.action.openPopup();
    sendResponse({ status: "success" });
    return;
  }

  if (request.action === "saveEmail") {
    console.log("Saving email to Blostem...", request.data);

    // Retrieve token from storage before making the request
    chrome.storage.local.get("token", async ({ token }) => {
      if (!token) {
        console.error("No auth token found. User must login via popup.");
        sendResponse({ status: "error", message: "Please login to Blostem via the extension icon first." });
        return;
      }

      fetch("https://marketing-automation-xtd2.onrender.com/api/emails/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(request.data)
      })
        .then(async response => {
          if (!response.ok) {
            let errorDetail = response.statusText;
            if (response.status === 401) {
              await chrome.storage.local.remove(["token", "user"]);
              throw new Error("Session expired. Please login again via the extension popup.");
            }
            try {
              const data = await response.json();
              errorDetail = data.detail || errorDetail;
            } catch (e) { }
            throw new Error(`Backend error (${response.status}): ${errorDetail}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Success:", data);
          sendResponse({ status: "success", data: data });
        })
        .catch(error => {
          console.error("Blostem Background Error:", error);
          sendResponse({ status: "error", message: error.message });
        });
    });

    return true; // Keep the message channel open for async response
  }
});
