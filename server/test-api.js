const fetch = require("node-fetch");

const API_BASE_URL = "http://localhost:3000/api";

const testFormData = {
  url: "https://example.com/registration-form",
  title: "User Registration Form",
  aadhar: "123456789012",
  pan: "ABCDE1234F",
  name: "John Doe",
  email: "john.doe@example.com",
  phone: "9876543210",
  raw_data: {
    firstName: "John",
    lastName: "Doe",
    dateOfBirth: "1990-01-01",
    address: "123 Main Street, City, State",
    occupation: "Software Engineer",
    additionalFields: {
      field1: "value1",
      field2: "value2",
    },
  },
};

async function testAPI() {
  console.log("🧪 Starting API tests...\n");

  try {
    console.log("1. Testing Health Check...");
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log("✅ Health Check:", healthData.status);
    console.log("   Database:", healthData.database.status);
    console.log("   Uptime:", Math.round(healthData.uptime), "seconds\n");

    console.log("2. Testing Create Form Data...");
    const createResponse = await fetch(`${API_BASE_URL}/form-data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testFormData),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(`Create failed: ${JSON.stringify(errorData)}`);
    }

    const createData = await createResponse.json();
    console.log("✅ Form Data Created");
    console.log("   ID:", createData.data.id);
    console.log("   URL:", createData.data.url);
    console.log("   Validation Status:", createData.data.validation_status);
    console.log("");

    const createdId = createData.data.id;

    console.log("3. Testing Get Form Data by ID...");
    const getResponse = await fetch(`${API_BASE_URL}/form-data/${createdId}`);
    const getData = await getResponse.json();
    console.log("✅ Form Data Retrieved");
    console.log("   Name:", getData.data.name);
    console.log("   Email:", getData.data.email);
    console.log("   Aadhar:", getData.data.aadhar);
    console.log("   PAN:", getData.data.pan);
    console.log("");

    console.log("4. Testing Get All Form Data...");
    const getAllResponse = await fetch(`${API_BASE_URL}/form-data?limit=5`);
    const getAllData = await getAllResponse.json();
    console.log("✅ All Form Data Retrieved");
    console.log("   Total Records:", getAllData.pagination.total);
    console.log("   Current Page:", getAllData.pagination.page);
    console.log("   Records in Response:", getAllData.data.length);
    console.log("");

    console.log("5. Testing Statistics...");
    const statsResponse = await fetch(
      `${API_BASE_URL}/form-data/stats/summary`
    );
    const statsData = await statsResponse.json();
    console.log("✅ Statistics Retrieved");
    console.log("   Total Records:", statsData.data.total_records);
    console.log("   Records with Aadhar:", statsData.data.records_with_aadhar);
    console.log("   Records with PAN:", statsData.data.records_with_pan);
    console.log("   Records with Email:", statsData.data.records_with_email);
    console.log("");

    console.log("6. Testing Update Form Data...");
    const updateData = {
      name: "John Smith",
      email: "john.smith@example.com",
    };

    const updateResponse = await fetch(
      `${API_BASE_URL}/form-data/${createdId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      }
    );

    const updateResult = await updateResponse.json();
    console.log("✅ Form Data Updated");
    console.log("   Updated Name:", updateResult.data.name);
    console.log("   Updated Email:", updateResult.data.email);
    console.log("");

    console.log("7. Testing Filter Form Data...");
    const filterResponse = await fetch(
      `${API_BASE_URL}/form-data?aadhar=123456789012`
    );
    const filterData = await filterResponse.json();
    console.log("✅ Filtered Form Data Retrieved");
    console.log("   Filtered Records:", filterData.pagination.total);
    console.log("");

    console.log("8. Testing Delete Form Data...");
    const deleteResponse = await fetch(
      `${API_BASE_URL}/form-data/${createdId}`,
      {
        method: "DELETE",
      }
    );

    const deleteData = await deleteResponse.json();
    console.log("✅ Form Data Deleted");
    console.log("   Deleted ID:", deleteData.deleted_id);
    console.log("");

    console.log("🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    if (error.response) {
      const errorData = await error.response.json();
      console.error("Error details:", errorData);
    }
  }
}

if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };
