class FormDataExtractor {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "readFormData") {
        const formData = this.extractAllFormData(document);
        sendResponse({
          success: formData.length > 0,
          data: formData,
        });
      }
    });
  }

  extractAllFormData(root) {
    const formData = [];
    this.findFields(root, formData);
    return formData;
  }

  findFields(node, formData) {
    if (!node) return;

    if (
      node.nodeType === 1 &&
      ["INPUT", "SELECT", "TEXTAREA"].includes(node.tagName)
    ) {
      const fieldData = this.extractFieldData(node);
      if (fieldData) {
        formData.push(fieldData);
      }
    }

    if (node.shadowRoot) {
      this.findFields(node.shadowRoot, formData);
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.findFields(child, formData);
      }
    }
  }

  extractFieldData(input) {
    if (
      input.type === "hidden" ||
      input.type === "submit" ||
      input.type === "button" ||
      input.type === "reset" ||
      input.type === "image"
    ) {
      return null;
    }
    let value = "";
    if (input.type === "checkbox") {
      value = input.checked ? "true" : "false";
    } else if (input.type === "radio") {
      if (input.checked) {
        value = input.value;
      } else {
        return null;
      }
    } else if (input.tagName === "SELECT") {
      const selectedOption = input.options[input.selectedIndex];
      value = selectedOption ? selectedOption.value : "";
    } else {
      value = input.value || "";
    }
    if (!value || value.trim() === "") {
      return null;
    }
    let name = this.getFieldName(input);
    let type = this.getFieldType(input);

    return {
      name: name,
      value: value.trim(),
      type: type,
      id: input.id || "",
      placeholder: input.placeholder || "",
      required: input.required || false,
    };
  }

  getFieldName(input) {
    if (input.name) return input.name;
    if (input.id) return input.id;
    if (input.placeholder) return input.placeholder;

    const label = this.findLabel(input);
    if (label) return label.textContent.trim();
    return input.type || "text";
  }

  findLabel(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label;
    }
    let parent = input.parentElement;
    while (parent && parent.tagName !== "BODY") {
      if (parent.tagName === "LABEL") return parent;
      parent = parent.parentElement;
    }
    const nearbyLabel = input.previousElementSibling;
    if (nearbyLabel && nearbyLabel.tagName === "LABEL") return nearbyLabel;
    return null;
  }

  getFieldType(input) {
    if (input.tagName === "SELECT") return "select";
    if (input.tagName === "TEXTAREA") return "textarea";
    const typeMap = {
      text: "text",
      email: "email",
      password: "password",
      tel: "phone",
      number: "number",
      date: "date",
      "datetime-local": "datetime",
      time: "time",
      url: "url",
      search: "search",
      checkbox: "checkbox",
      radio: "radio",
      file: "file",
      color: "color",
      range: "range",
    };
    return typeMap[input.type] || "text";
  }
}

new FormDataExtractor();
console.log("Extension loaded");
