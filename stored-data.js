document.addEventListener("DOMContentLoaded", () => {
  const dbName = "FormDataDB";
  const dbVersion = 1;
  const storeName = "formData";
  let db;

  function initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log("db result", db);
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  function renderData(storedData) {
    const container = document.getElementById("storedDataList");
    console.log("[StoredData] Rendering data:", storedData);
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
  }

  function addSyncedFlagIfMissing(item) {
    if (typeof item.synced === "undefined") item.synced = false;
    if (typeof item.duplicate === "undefined") item.duplicate = false;
    return item;
  }

  function getAllStoredData(onlyUnsynced = false) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const index = store.index("timestamp");
      const request = index.getAll();
      request.onsuccess = () => {
        let result = request.result.reverse().map(addSyncedFlagIfMissing);
        if (onlyUnsynced) {
          result = result.filter((item) => !item.synced && !item.duplicate);
        }
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  function sanitizeFormData(formData) {
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

  async function markAsSynced(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
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

  async function syncToAPI() {
    try {
      const storedData = await getAllStoredData(true);
      if (storedData.length === 0) {
        showStatus("No data to sync", "info");
        return;
      }
      showStatus("Syncing data to API...", "info");
      const apiEndpoint = "https://045b58a9d855.ngrok-free.app/api/form-data";
      for (const data of storedData) {
        const formFields = {};
        const sanitizedFormData = sanitizeFormData(data.formData);
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

          await markAsSynced(data.id);
        } catch (error) {
          console.error("Error syncing data:", error);
          showStatus("Error syncing data to API", "error");
          return;
        }
      }
      showStatus("All data synced successfully to API", "success");

      const unsynced = await getAllStoredData(true);
      renderData(unsynced);
    } catch (error) {
      showStatus("Error during sync process", "error");
    }
  }

  function showStatus(message, type) {
    const status = document.getElementById("status");
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove("hidden");
    setTimeout(() => {
      status.classList.add("hidden");
    }, 5000);
  }

  document.getElementById("syncToAPI").addEventListener("click", syncToAPI);

  async function fetchAllFromAPI() {
    const apiEndpoint = "https://045b58a9d855.ngrok-free.app/api/form-data/all";
    try {
      const response = await fetch(apiEndpoint, {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      return result.data || [];
    } catch (error) {
      console.error("Error fetching all data from API:", error);
      return [];
    }
  }

  function displayAPIData(apiData) {
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
                            ? `<div class=\"data-field\"><span class=\"field-label\">${field}:</span><span class=\"field-value\">${item[field]}</span></div>`
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

  function setupShowAllToggle() {
    const toggleBtn = document.getElementById("showAllToggle");
    let showingAll = false;
    toggleBtn.addEventListener("click", async () => {
      showingAll = !showingAll;
      if (showingAll) {
        toggleBtn.textContent = "Show Only Unsynced Data";
        const apiData = await fetchAllFromAPI();
        displayAPIData(apiData);
      } else {
        toggleBtn.textContent = "Show All Synced Data";
        const unsynced = await getAllStoredData(true);
        renderData(unsynced);
      }
    });
  }

  initDatabase()
    .then(() => getAllStoredData(true))
    .then(renderData)
    .then(setupShowAllToggle)
    .catch((error) => {
      document.getElementById(
        "storedDataList"
      ).innerHTML = `<div class="empty-state"><span class="icon">❌</span><p>Error loading stored data: ${error.message}</p></div>`;
    });
});
