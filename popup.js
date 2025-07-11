class FormDataReader {
  constructor() {
    this.dbName = "FormDataDB";
    this.dbVersion = 1;
    this.storeName = "formData";
    this.init();
  }

  async init() {
    await this.initDatabase();
    this.bindEvents();
    this.setupShowAllToggle();
  }

  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  bindEvents() {
    document
      .getElementById("readFormData")
      .addEventListener("click", () => this.readFormData());
    document
      .getElementById("viewStoredData")
      .addEventListener("click", () => this.showStoredData());
    document
      .getElementById("closeModal")
      .addEventListener("click", () => this.hideModal());
    document
      .getElementById("clearAllData")
      .addEventListener("click", () => this.clearAllData());
    document
      .getElementById("syncToAPI")
      .addEventListener("click", () => this.syncToAPI());
    document
      .getElementById("openStoredDataPage")
      .addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("stored-data.html") });
      });

=
    document
      .getElementById("storedDataModal")
      .addEventListener("click", (e) => {
        if (e.target.id === "storedDataModal") {
          this.hideModal();
        }
      });
  }

  async readFormData() {
    this.showStatus("Reading form data...", "info");
   
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
    
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "readFormData",
        });
      
      if (response.success) {
        const validatedData = this.validateFormData(response.data);
        
       
        localStorage.setItem("formDataBackup", JSON.stringify(validatedData));
        await this.storeFormData(validatedData);
        this.displayFormData(validatedData);
        this.showStatus(
          `Found ${validatedData.length} form fields with valid data`,
          "success"
        );
      } else {
        this.showStatus("No form data found on this page", "error");
      }
    } catch (error) {
      
      this.showStatus(
        "Error reading form data. Make sure you are on a page with forms.",
        "error"
      );
    }
  }

  validateFormData(formData) {
    const validatedData = [];

    formData.forEach((field) => {
      const validation = this.validateField(field);
      if (validation.isValid) {
        validatedData.push({
          ...field,
          validation: validation,
        });
      }
    });

    return validatedData;
  }

  validateField(field) {
    const { name, value, type } = field;

   
    if (this.isAadharField(name)) {
      const cleanValue = value.replace(/[\s\-]/g, "");
      const isValid = /^\d{12}$/.test(cleanValue);
      return {
        isValid,
        type: "aadhar",
        message: isValid
          ? "Valid Aadhar number"
          : "Invalid Aadhar number (should be 12 digits)",
      };
    }

    
    if (this.isPANField(name)) {
      const isValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase());
      return {
        isValid,
        type: "pan",
        message: isValid
          ? "Valid PAN number"
          : "Invalid PAN number (should be 10 characters: 5 letters + 4 digits + 1 letter)",
      };
    }

   
    if (this.isNameField(name)) {
      const isValid =
        value.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(value.trim());
      return {
        isValid,
        type: "name",
        message: isValid
          ? "Valid name"
          : "Invalid name (should be at least 2 characters, letters only)",
      };
    }

    
    if (type === "email" || this.isEmailField(name)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = emailRegex.test(value);
      return {
        isValid,
        type: "email",
        message: isValid ? "Valid email" : "Invalid email format",
      };
    }


    if (type === "tel" || this.isPhoneField(name)) {
      const cleanValue = value.replace(/[\s\-\(\)]/g, "");
      const isValid = /^\d{10}$/.test(cleanValue);
      return {
        isValid,
        type: "phone",
        message: isValid
          ? "Valid phone number"
          : "Invalid phone number (should be 10 digits)",
      };
    }


    return {
      isValid: value.trim().length > 0,
      type: "text",
      message: value.trim().length > 0 ? "Valid text" : "Empty field",
    };
  }


  sanitizeFormData(formData) {
    return formData.map((field) => {
      const sanitized = { ...field };
      if (sanitized.validation) {

        sanitized.validation = {
          isValid: !!sanitized.validation.isValid,
          type: sanitized.validation.type || "",
          message: sanitized.validation.message || "",
        };
      }
      return sanitized;
    });
  }

  isAadharField(name) {
    const aadharKeywords = [
      "aadhar",
      "aadhaar",
      "uid",
      "unique id",
      "identity",
    ];
    return aadharKeywords.some(
      (keyword) =>
        name.toLowerCase().includes(keyword) ||
        name.toLowerCase().includes("aadhar") ||
        name.toLowerCase().includes("aadhaar")
    );
  }

  isPANField(name) {
    const panKeywords = ["pan", "permanent account number", "tax id"];
    return panKeywords.some(
      (keyword) =>
        name.toLowerCase().includes(keyword) ||
        name.toLowerCase().includes("pan")
    );
  }

  isNameField(name) {
    const nameKeywords = ["name", "first", "last", "full", "given", "surname"];
    return nameKeywords.some((keyword) => name.toLowerCase().includes(keyword));
  }

  isEmailField(name) {
    const emailKeywords = ["email", "e-mail", "mail"];
    return emailKeywords.some((keyword) =>
      name.toLowerCase().includes(keyword)
    );
  }

  isPhoneField(name) {
    const phoneKeywords = ["phone", "mobile", "contact", "tel", "number"];
    return phoneKeywords.some((keyword) =>
      name.toLowerCase().includes(keyword)
    );
  }


  getKeyFields(formData) {
    const keys = {};
    formData.forEach((field) => {
      if (
        ["aadhar", "pan", "name", "email", "phone"].includes(
          field.name.toLowerCase()
        )
      ) {
        keys[field.name.toLowerCase()] = field.value;
      }
    });
    return keys;
  }


  async isDuplicateSynced(url, formData) {
    const transaction = this.db.transaction([this.storeName], "readonly");
    const store = transaction.objectStore(this.storeName);
    const index = store.index("timestamp");
    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        const keyFields = this.getKeyFields(formData);
        const found = request.result.some((item) => {
          if (!item.synced) return false;
          if (item.url !== url) return false;
          const itemKeys = this.getKeyFields(item.formData);
          return Object.keys(keyFields).every(
            (k) => itemKeys[k] === keyFields[k]
          );
        });
        resolve(found);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async storeFormData(formData) {
    if (formData.length === 0) {
      console.log("[Popup] No form data to store.");
      return;
    }
    const url = (
      await chrome.tabs.query({ active: true, currentWindow: true })
    )[0].url;
    const sanitizedFormData = this.sanitizeFormData(formData);
    const isDuplicate = await this.isDuplicateSynced(url, sanitizedFormData);
    const dataToStore = {
      timestamp: new Date().toISOString(),
      url: url,
      formData: sanitizedFormData,
      synced: isDuplicate, 
      duplicate: isDuplicate, 
    };
    console.log("[Popup] Storing data to IndexedDB:", dataToStore);
    const transaction = this.db.transaction([this.storeName], "readwrite");
    const store = transaction.objectStore(this.storeName);
    return new Promise((resolve, reject) => {
      const request = store.add(dataToStore);
      request.onsuccess = () => {
      
        localStorage.removeItem("formDataBackup");
        resolve(request.result);
      };
      request.onerror = () => {
       
        reject(request.error);
      };
    });
  }

  displayFormData(formData) {
    const container = document.getElementById("formDataList");
    const display = document.getElementById("dataDisplay");

    if (formData.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><span class="icon">📝</span><p>No valid form data found</p></div>';
    } else {
      container.innerHTML = formData
        .map(
          (field) => `
                <div class="data-item">
                    <div class="data-field">
                        <span class="field-label">Field Name:</span>
                        <span class="field-value">${field.name}</span>
                    </div>
                    <div class="data-field">
                        <span class="field-label">Value:</span>
                        <span class="field-value">${field.value}</span>
                    </div>
                    <div class="data-field">
                        <span class="field-label">Type:</span>
                        <span class="field-value">${field.type}</span>
                    </div>
                    <div class="data-field">
                        <span class="field-label">Validation:</span>
                        <span class="validation-status ${
                          field.validation.isValid ? "valid" : "invalid"
                        }">
                            ${field.validation.message}
                        </span>
                    </div>
                </div>
            `
        )
        .join("");
    }

    display.classList.remove("hidden");
  }

  async showStoredData() {
    const modal = document.getElementById("storedDataModal");
    const container = document.getElementById("storedDataList");

    modal.classList.remove("hidden");
    container.innerHTML =
      '<div class="loading"><div class="spinner"></div>Loading stored data...</div>';
    try {
      const storedData = await this.getAllStoredData(true); 
     

      if (storedData.length === 0) {
        container.innerHTML =
          '<div class="empty-state"><span class="icon">💾</span><p>No unsynced data found</p></div>';
      } else {
        container.innerHTML = storedData
          .map(
            (item) => `
          <div class="stored-data-item">
            <div class="stored-data-header">
              <span class="stored-data-title">Form Data Entry</span>
              <span class="stored-data-timestamp">${new Date(
                item.timestamp
              ).toLocaleString()}</span>
            </div>
            <div class="stored-data-fields">
              ${item.formData
                .map(
                  (field) => `
                <div class="data-field">
                  <span class="field-label">${field.name}:</span>
                  <span class="field-value">${field.value}</span>
                </div>
              `
                )
                .join("")}
            </div>
            ${
              item.duplicate
                ? '<div class="status info">Duplicate of already synced data</div>'
                : ""
            }
          </div>
        `
          )
          .join("");
      }
    } catch (error) {
      console.error("[Popup] Error loading stored data:", error);
      container.innerHTML =
        '<div class="empty-state"><span class="icon">❌</span><p>Error loading stored data</p></div>';
    }
  }

  async getAllStoredData(onlyUnsynced = false) {
    const transaction = this.db.transaction([this.storeName], "readonly");
    const store = transaction.objectStore(this.storeName);
    const index = store.index("timestamp");

    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        let result = request.result.reverse();
        if (onlyUnsynced) {
          result = result.filter((item) => !item.synced && !item.duplicate);
        }
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData() {
    if (!confirm("Are you sure you want to clear all stored data?")) return;

    const transaction = this.db.transaction([this.storeName], "readwrite");
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        this.showStoredData(); 
        this.showStatus("All stored data cleared", "success");
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async syncToAPI() {
    try {
      const storedData = await this.getAllStoredData(true); 
      if (storedData.length === 0) {
        this.showStatus("No data to sync", "info");
        return;
      }
      this.showStatus("Syncing data", "info");
      const apiEndpoint = "https://2d6aa15eb19b.ngrok-free.app/api/form-data"; 
      for (const data of storedData) {
        
        const formFields = {};
        const sanitizedFormData = this.sanitizeFormData(data.formData);
        sanitizedFormData.forEach((field) => {
          if (
            ["aadhar", "pan", "name", "email", "phone"].includes(
              field.name.toLowerCase()
            )
          ) {
            formFields[field.name.toLowerCase()] = field.value;
          }
        });
        const payload = {
          url: data.url,
          title: document.title,
          aadhar: formFields.aadhar || "",
          pan: formFields.pan || "",
          name: formFields.name || "",
          email: formFields.email || "",
          phone: formFields.phone || "",
          raw_data:
            sanitizedFormData && sanitizedFormData.length
              ? sanitizedFormData
              : [],
        };
        try {
          const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);
          console.log("Data synced successfully:", payload);
         
          await this.markAsSynced(data.id);
        } catch (error) {
          console.error("Error syncing data:", error);
          this.showStatus("Error syncing data to API", "error");
          return;
        }
      }
      this.showStatus("All data synced successfully to API", "success");
    } catch (error) {
      console.error("Error in sync process:", error);
      this.showStatus("Error during sync process", "error");
    }
  }

  async markAsSynced(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.synced = true;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  hideModal() {
    document.getElementById("storedDataModal").classList.add("hidden");
  }

  showStatus(message, type) {
    const status = document.getElementById("status");
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove("hidden");

   
    setTimeout(() => {
      status.classList.add("hidden");
    }, 5000);
  }

 
  async fetchAllFromAPI() {
    const apiEndpoint = "https://2d6aa15eb19b.ngrok-free.app/api/form-data/all";
    try {
      const response = await fetch(apiEndpoint);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error("Error fetching all data from API:", error);
      return [];
    }
  }

  setupShowAllToggle() {
    const toggleBtn = document.getElementById("showAllToggle");
    let showingAll = false;
    toggleBtn.addEventListener("click", async () => {
      showingAll = !showingAll;
      if (showingAll) {
        toggleBtn.textContent = "Show Only Unsynced Data";
        const apiData = await this.fetchAllFromAPI();
        this.displayAPIData(apiData);
      } else {
        toggleBtn.textContent = "Show All Synced Data";
        this.showStoredData();
      }
    });
  }

  displayAPIData(apiData) {
    const container = document.getElementById("storedDataList");
    if (!container) return;
    if (apiData.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><span class="icon">💾</span><p>No synced data found on server</p></div>';
    } else {
      container.innerHTML =
        '<div class="status info">Showing all synced data from server</div>' +
        apiData
          .map(
            (item) => `
                    <div class="stored-data-item">
                        <div class="stored-data-header">
                            <span class="stored-data-title">Form Data Entry</span>
                            <span class="stored-data-timestamp">${new Date(
                              item.created_at || item.timestamp
                            ).toLocaleString()}</span>
                        </div>
                        <div class="stored-data-fields">
                            ${["aadhar", "pan", "name", "email", "phone"]
                              .map((field) =>
                                item[field]
                                  ? `<div class="data-field"><span class="field-label">${field}:</span><span class="field-value">${item[field]}</span></div>`
                                  : ""
                              )
                              .join("")}
                        </div>
                    </div>
                `
          )
          .join("");
    }
  }
}


document.addEventListener("DOMContentLoaded", () => {
  new FormDataReader();
});
