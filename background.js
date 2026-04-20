// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveEmail") {
    console.log("Saving email to Blostem...", request.data);

    fetch("https://marketing-automation-xtd2.onrender.com/api/emails/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.data)
    })
      .then(async response => {
        if (!response.ok) {
          let errorDetail = response.statusText;
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

    return true; // Keep the message channel open for async response
  }
});
