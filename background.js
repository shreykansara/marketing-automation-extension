// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveEmail") {
    console.log("Saving email to Blostem...", request.data);

    fetch("http://localhost:8000/api/emails/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.data)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error("Backend error: " + response.statusText);
      }
      return response.json();
    })
    .then(data => {
      console.log("Success:", data);
      sendResponse({ status: "success", data: data });
    })
    .catch(error => {
      console.error("Error saving email:", error);
      sendResponse({ status: "error", message: error.message });
    });

    return true; // Keep the message channel open for async response
  }
});
