const express = require("express");
const router = express.Router();
const cors = require("cors");
const db = require("../config/database");
const {
  validateFormData,
  validateUpdateFormData,
  validateQuery,
  validateAadhar,
  validatePAN,
  validateEmail,
  validatePhone,
} = require("../middleware/validation");

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (origin.startsWith("chrome-extension://")) {
      return callback(null, true);
    }

    if (origin.startsWith("moz-extension://")) {
      return callback(null, true);
    }

    if (origin.startsWith("ms-browser-extension://")) {
      return callback(null, true);
    }

    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("https://localhost:")
    ) {
      return callback(null, true);
    }

    if (origin.includes("ngrok-free.app") || origin.includes("ngrok.io")) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

router.use(cors(corsOptions));

router.options("*", cors(corsOptions));

function removeFunctions(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeFunctions);
  } else if (obj && typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      if (typeof obj[key] !== "function" && obj[key] !== undefined) {
        newObj[key] = removeFunctions(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

router.get("/all", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT ON (url, aadhar, pan, email) 
        id,
        url,
        title,
        aadhar,
        pan,
        name,
        email,
        phone,
        raw_data,
        validation_status,
        created_at,
        updated_at
      FROM form_data
      ORDER BY url, aadhar, pan, email, created_at DESC
    `;

    const result = await db.query(query);

    console.log(` ${result.rows.length} records from database`);

    res.json({
      message: "All form data retrieved successfully",
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching all form data:", error);
    res.status(500).json({
      error: "Failed to fetch all form data",
      details: error.message,
    });
  }
});

router.get("/", validateQuery, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      url,
      aadhar,
      pan,
      email,
      start_date,
      end_date,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.validatedQuery;

    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (url) {
      whereConditions.push(`url ILIKE $${paramIndex}`);
      queryParams.push(`%${url}%`);
      paramIndex++;
    }

    if (aadhar) {
      whereConditions.push(`aadhar = $${paramIndex}`);
      queryParams.push(aadhar);
      paramIndex++;
    }

    if (pan) {
      whereConditions.push(`pan = $${paramIndex}`);
      queryParams.push(pan);
      paramIndex++;
    }

    if (email) {
      whereConditions.push(`email = $${paramIndex}`);
      queryParams.push(email);
      paramIndex++;
    }

    if (start_date) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const countQuery = `
      SELECT COUNT(*) as total
      FROM form_data
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    const dataQuery = `
      SELECT 
        id,
        url,
        title,
        aadhar,
        pan,
        name,
        email,
        phone,
        raw_data,
        validation_status,
        created_at,
        updated_at
      FROM form_data
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order.toUpperCase()}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const dataResult = await db.query(dataQuery, queryParams);

    res.json({
      data: dataResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching form data:", error);
    res.status(500).json({
      error: "Failed to fetch form data",
      details: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        url,
        title,
        aadhar,
        pan,
        name,
        email,
        phone,
        raw_data,
        validation_status,
        created_at,
        updated_at
      FROM form_data
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Form data not found",
        message: `No form data found with ID ${id}`,
      });
    }

    res.json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching form data by ID:", error);
    res.status(500).json({
      error: "Failed to fetch form data",
      details: error.message,
    });
  }
});

router.post("/", validateFormData, async (req, res) => {
  try {
    console.log("Incoming payload:", req.body);
    const formData = req.validatedData;

    if (formData.raw_data) {
      formData.raw_data = removeFunctions(formData.raw_data);
      try {
        console.log(
          "raw_data (stringified):",
          JSON.stringify(formData.raw_data, null, 2)
        );
      } catch (e) {
        console.error("Error stringifying raw_data:", e);
      }
    }

    const validationStatus = {};

    if (formData.aadhar) {
      validationStatus.aadhar = validateAadhar(formData.aadhar);
    }

    if (formData.pan) {
      validationStatus.pan = validatePAN(formData.pan);
    }

    if (formData.email) {
      validationStatus.email = validateEmail(formData.email);
    }

    if (formData.phone) {
      validationStatus.phone = validatePhone(formData.phone);
    }

    const query = `
      INSERT INTO form_data (
        url,
        title,
        aadhar,
        pan,
        name,
        email,
        phone,
        raw_data,
        validation_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id,
        url,
        title,
        aadhar,
        pan,
        name,
        email,
        phone,
        raw_data,
        validation_status,
        created_at,
        updated_at
    `;

    const values = [
      formData.url,
      formData.title,
      formData.aadhar,
      formData.pan,
      formData.name,
      formData.email,
      formData.phone,
      JSON.stringify(formData.raw_data),
      validationStatus,
    ];

    console.log(
      "Type of raw_data being passed to DB:",
      typeof formData.raw_data,
      Array.isArray(formData.raw_data)
    );
    console.log(
      "Values array for DB query:",
      values.map((val, i) => `${i}: ${typeof val} = ${JSON.stringify(val)}`)
    );

    const result = await db.query(query, values);

    res.status(201).json({
      message: "Form data created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating form data:", error);
    res.status(500).json({
      error: "Failed to create form data",
      details: error.message,
    });
  }
});

router.put("/:id", validateUpdateFormData, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.validatedData;

    const checkQuery = "SELECT id FROM form_data WHERE id = $1";
    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: "Form data not found",
        message: `No form data found with ID ${id}`,
      });
    }

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: "No valid fields to update",
      });
    }

    const validationStatus = {};
    if (updateData.aadhar) {
      validationStatus.aadhar = validateAadhar(updateData.aadhar);
    }
    if (updateData.pan) {
      validationStatus.pan = validatePAN(updateData.pan);
    }
    if (updateData.email) {
      validationStatus.email = validateEmail(updateData.email);
    }
    if (updateData.phone) {
      validationStatus.phone = validatePhone(updateData.phone);
    }

    if (Object.keys(validationStatus).length > 0) {
      updateFields.push(`validation_status = $${paramIndex}`);
      values.push(validationStatus);
      paramIndex++;
    }

    values.push(id);

    const query = `
      UPDATE form_data
      SET ${updateFields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        url,
        title,
        aadhar,
        pan,
        name,
        email,
        phone,
        raw_data,
        validation_status,
        created_at,
        updated_at
    `;

    const result = await db.query(query, values);

    res.json({
      message: "Form data updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating form data:", error);
    res.status(500).json({
      error: "Failed to update form data",
      details: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = "DELETE FROM form_data WHERE id = $1 RETURNING id";
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Form data not found",
        message: `No form data found with ID ${id}`,
      });
    }

    res.json({
      message: "Form data deleted successfully",
      deleted_id: id,
    });
  } catch (error) {
    console.error("Error deleting form data:", error);
    res.status(500).json({
      error: "Failed to delete form data",
      details: error.message,
    });
  }
});

router.get("/stats/summary", async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as records_last_24h,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as records_last_7d,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as records_last_30d,
        COUNT(CASE WHEN aadhar IS NOT NULL THEN 1 END) as records_with_aadhar,
        COUNT(CASE WHEN pan IS NOT NULL THEN 1 END) as records_with_pan,
        COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as records_with_email,
        COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as records_with_phone
      FROM form_data
    `;

    const result = await db.query(query);

    res.json({
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching summary stats:", error);
    res.status(500).json({
      error: "Failed to fetch summary statistics",
      details: error.message,
    });
  }
});

module.exports = router;
