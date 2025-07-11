const db = require("../config/database");

const createTables = async () => {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const createFormDataTable = `
      CREATE TABLE IF NOT EXISTS form_data (
        id SERIAL PRIMARY KEY,
        url VARCHAR(500) NOT NULL,
        title VARCHAR(255),
        aadhar VARCHAR(12),
        pan VARCHAR(10),
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(20),
        raw_data JSONB NOT NULL,
        validation_status JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_form_data_url ON form_data(url);
      CREATE INDEX IF NOT EXISTS idx_form_data_created_at ON form_data(created_at);
      CREATE INDEX IF NOT EXISTS idx_form_data_aadhar ON form_data(aadhar);
      CREATE INDEX IF NOT EXISTS idx_form_data_pan ON form_data(pan);
      CREATE INDEX IF NOT EXISTS idx_form_data_email ON form_data(email);
    `;

    const createUpdateTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;

    const createTrigger = `
      DROP TRIGGER IF EXISTS update_form_data_updated_at ON form_data;
      CREATE TRIGGER update_form_data_updated_at
        BEFORE UPDATE ON form_data
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    console.log("📋 Creating form_data table...");
    await client.query(createFormDataTable);

    console.log("📊 Creating indexes...");
    await client.query(createIndexes);

    console.log("⚡ Creating update trigger...");
    await client.query(createUpdateTrigger);
    await client.query(createTrigger);

    await client.query("COMMIT");
    console.log("✅ Database setup completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Database setup failed:", error);
    throw error;
  } finally {
    client.release();
  }
};

const dropTables = async () => {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    console.log("🗑️ Dropping tables...");
    await client.query("DROP TABLE IF EXISTS form_data CASCADE");

    await client.query("COMMIT");
    console.log("✅ Tables dropped successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to drop tables:", error);
    throw error;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  const command = process.argv[2];

  if (command === "drop") {
    dropTables()
      .then(() => {
        console.log("🎉 Database cleanup completed");
        process.exit(0);
      })
      .catch((error) => {
        console.error("💥 Database cleanup failed:", error);
        process.exit(1);
      });
  } else {
    createTables()
      .then(() => {
        console.log("🎉 Database setup completed");
        process.exit(0);
      })
      .catch((error) => {
        console.error("💥 Database setup failed:", error);
        process.exit(1);
      });
  }
}

module.exports = {
  createTables,
  dropTables,
};
