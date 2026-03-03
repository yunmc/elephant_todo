const mysql = require('mysql2/promise')

async function migrate() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root123',
    database: process.env.DB_NAME || 'elephant_todo',
  })

  // 1. Add new column
  try {
    await c.query("ALTER TABLE important_dates ADD COLUMN repeat_type VARCHAR(20) NOT NULL DEFAULT 'none' AFTER is_lunar")
    console.log('✅ Column repeat_type added')
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Column repeat_type already exists')
    } else {
      throw e
    }
  }

  // 2. Migrate data
  const [r1] = await c.query("UPDATE important_dates SET repeat_type = 'yearly' WHERE repeat_yearly = 1")
  const [r2] = await c.query("UPDATE important_dates SET repeat_type = 'none' WHERE repeat_yearly = 0")
  console.log(`✅ Data migrated: ${r1.affectedRows} yearly, ${r2.affectedRows} none`)

  // 3. Drop old column
  try {
    await c.query('ALTER TABLE important_dates DROP COLUMN repeat_yearly')
    console.log('✅ Old column repeat_yearly dropped')
  } catch (e) {
    console.log('⚠️  Drop column:', e.message)
  }

  await c.end()
  console.log('✅ Migration complete')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
