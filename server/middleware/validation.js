const Joi = require("joi");

const formDataSchema = Joi.object({
  url: Joi.string().uri().required(),
  title: Joi.string().max(255).optional().empty(""),
  aadhar: Joi.string()
    .pattern(/^[0-9]{12}$/)
    .optional()
    .empty(""),
  pan: Joi.string()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .optional()
    .empty(""),
  name: Joi.string().max(255).optional().empty(""),
  email: Joi.string().email().optional().empty(""),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]{10,15}$/)
    .optional()
    .empty(""),
  raw_data: Joi.alternatives().try(Joi.object(), Joi.array()).optional(),
  validation_status: Joi.object().optional(),
});

const updateFormDataSchema = Joi.object({
  url: Joi.string().uri().optional().empty(""),
  title: Joi.string().max(255).optional().empty(""),
  aadhar: Joi.string()
    .pattern(/^[0-9]{12}$/)
    .optional()
    .empty(""),
  pan: Joi.string()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .optional()
    .empty(""),
  name: Joi.string().max(255).optional().empty(""),
  email: Joi.string().email().optional().empty(""),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]{10,15}$/)
    .optional()
    .empty(""),
  raw_data: Joi.alternatives().try(Joi.object(), Joi.array()).optional(),
  validation_status: Joi.object().optional(),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  url: Joi.string().optional(),
  aadhar: Joi.string().optional(),
  pan: Joi.string().optional(),
  email: Joi.string().optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  sort_by: Joi.string()
    .valid("created_at", "updated_at", "url", "name")
    .default("created_at"),
  sort_order: Joi.string().valid("asc", "desc").default("desc"),
});

const validateFormData = (req, res, next) => {
  const { error, value } = formDataSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDetails = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      error: "Validation failed",
      details: errorDetails,
    });
  }

  req.validatedData = value;
  next();
};

const validateUpdateFormData = (req, res, next) => {
  const { error, value } = updateFormDataSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDetails = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      error: "Validation failed",
      details: errorDetails,
    });
  }

  req.validatedData = value;
  next();
};

const validateQuery = (req, res, next) => {
  const { error, value } = querySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDetails = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      error: "Query validation failed",
      details: errorDetails,
    });
  }

  req.validatedQuery = value;
  next();
};

const validateAadhar = (aadhar) => {
  if (!aadhar) return { isValid: false, message: "Aadhar number is required" };
  if (!/^[0-9]{12}$/.test(aadhar)) {
    return { isValid: false, message: "Aadhar must be exactly 12 digits" };
  }
  return { isValid: true, message: "Valid Aadhar number" };
};

const validatePAN = (pan) => {
  if (!pan) return { isValid: false, message: "PAN is required" };
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
    return { isValid: false, message: "PAN must be in format: ABCDE1234F" };
  }
  return { isValid: true, message: "Valid PAN" };
};

const validateEmail = (email) => {
  if (!email) return { isValid: false, message: "Email is required" };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, message: "Invalid email format" };
  }
  return { isValid: true, message: "Valid email" };
};

const validatePhone = (phone) => {
  if (!phone) return { isValid: false, message: "Phone number is required" };
  const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
  if (!phoneRegex.test(phone)) {
    return { isValid: false, message: "Invalid phone number format" };
  }
  return { isValid: true, message: "Valid phone number" };
};

module.exports = {
  validateFormData,
  validateUpdateFormData,
  validateQuery,
  validateAadhar,
  validatePAN,
  validateEmail,
  validatePhone,
};
