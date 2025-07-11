class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.createContextMenu();
      }
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === "readFormData") {
        this.readFormDataFromTab(tab);
      }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "syncToAPI") {
        this.syncDataToAPI(request.data).then(sendResponse);
        return true;
      }
    });
  }

  createContextMenu() {
    chrome.contextMenus.create({
      id: "readFormData",
      title: "Read Form Data",
      contexts: ["page"],
    });
  }

  async readFormDataFromTab(tab) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "readFormData",
      });

      if (response.success) {
        console.log("Form data read successfully:", response.data);
      } else {
        console.log("No form data found on this page");
      }
    } catch (error) {
      console.error("Error reading form data:", error);
    }
  }

  async syncDataToAPI(data) {
    try {
      const apiEndpoint = "https://2d6aa15eb19b.ngrok-free.app";

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          source: "chrome_extension",
          data: data,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error("Error syncing data to API:", error);
      return { success: false, error: error.message };
    }
  }

  validateAadhar(aadharNumber) {
    const cleanAadhar = aadharNumber.replace(/[\s\-]/g, "");
    return /^\d{12}$/.test(cleanAadhar);
  }

  validatePAN(panNumber) {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase());
  }

  validateName(name) {
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePhone(phone) {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    return /^\d{10}$/.test(cleanPhone);
  }
}

new BackgroundService();

chrome.runtime.onStartup.addListener(() => {
  console.log("Form Data Reader Extension started");
});
