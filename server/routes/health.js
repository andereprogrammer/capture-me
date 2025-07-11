const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.get("/", async (req, res) => {
  try {
    const dbResult = await db.query("SELECT NOW() as current_time");

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      database: {
        status: "connected",
        current_time: dbResult.rows[0].current_time,
      },
      version: "1.0.0",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Database connection failed",
      details: error.message,
    });
  }
});

router.get("/detailed", async (req, res) => {
  try {
    const startTime = Date.now();

    const dbResult = await db.query("SELECT NOW() as current_time");
    const dbResponseTime = Date.now() - startTime;

    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as records_last_24h
      FROM form_data
    `);

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      database: {
        status: "connected",
        response_time_ms: dbResponseTime,
        current_time: dbResult.rows[0].current_time,
        stats: statsResult.rows[0],
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
      version: "1.0.0",
    });
  } catch (error) {
    console.error("Detailed health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      details: error.message,
    });
  }
});

module.exports = router;
