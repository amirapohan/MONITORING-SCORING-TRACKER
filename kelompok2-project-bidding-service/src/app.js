const express = require('express')
const app = express()
const db = require('./config/db')

app.use(express.json())

const projectsRoute = require('./features/projects/routes/project.routes')
const biddingRoute = require('./features/bidding/routes/bidding.routes')
const negotiatingRoute = require('./features/negotiating/routes/negotiating.routes')

app.use('/api/projects', projectsRoute)
app.use('/api/bidding', biddingRoute)
app.use('/api/negotiating', negotiatingRoute)

app.get('/', (req, res) => {
  res.send('Halo ini layanan bidding')
})

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'bidding' })
})

// Temporary migration endpoint to fix database schema
app.get('/api/migrate', async (req, res) => {
  const results = []
  try {
    // 1. Create enum types if they don't exist
    await db.query(`
      DO $$ BEGIN
        CREATE TYPE project_skill_enum AS ENUM (
          'Frontend','Backend','UI/UX','Mobile','Database',
          'DevOps','Data Science','Machine Learning','Cybersecurity','QA Testing'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('project_skill_enum: OK')

    await db.query(`
      DO $$ BEGIN
        CREATE TYPE status_proyek_enum AS ENUM ('Open','Full','Closed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('status_proyek_enum: OK')

    await db.query(`
      DO $$ BEGIN
        CREATE TYPE status_bid_enum AS ENUM ('Pending','Accepted','Rejected','Queued');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('status_bid_enum: OK')

    await db.query(`
      DO $$ BEGIN
        CREATE TYPE user_role_enum AS ENUM ('talent','client','admin');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('user_role_enum: OK')

    await db.query(`
      DO $$ BEGIN
        CREATE TYPE status_nego_enum AS ENUM ('Pending','Accepted','Rejected','Countered');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('status_nego_enum: OK')

    // 2. Fix mitra table
    await db.query(`
      ALTER TABLE mitra ALTER COLUMN mitra_id TYPE VARCHAR(50);
    `)
    results.push('mitra.mitra_id -> VARCHAR(50): OK')

    // 3. Fix proyek table - add missing columns
    const addColumn = async (table, column, type, defaultVal) => {
      try {
        const def = defaultVal ? ` DEFAULT ${defaultVal}` : ''
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${def}`)
        results.push(`${table}.${column} ADDED: OK`)
      } catch (e) {
        if (e.code === '42701') {
          results.push(`${table}.${column}: already exists, skipped`)
        } else {
          results.push(`${table}.${column} ERROR: ${e.message}`)
        }
      }
    }

    await addColumn('proyek', 'skills', "project_skill_enum[] NOT NULL", "'{}'")
    await addColumn('proyek', 'requirements', 'TEXT', "''")
    await addColumn('proyek', 'kuota_maksimal', 'INT NOT NULL', '1')
    await addColumn('proyek', 'budget_awal', 'DECIMAL(15,2) NOT NULL', '0')
    await addColumn('proyek', 'tanggal_selesai', 'DATE', null)

    // 4. Fix mitra_id in proyek table
    try {
      await db.query(`
        ALTER TABLE proyek DROP CONSTRAINT IF EXISTS fk_mitra;
        ALTER TABLE proyek ALTER COLUMN mitra_id TYPE VARCHAR(50);
        ALTER TABLE proyek ADD CONSTRAINT fk_mitra FOREIGN KEY (mitra_id) REFERENCES mitra(mitra_id) ON DELETE CASCADE;
      `)
      results.push('proyek.mitra_id -> VARCHAR(50) + FK: OK')
    } catch (e) {
      results.push('proyek.mitra_id fix: ' + e.message)
    }

    res.json({ message: 'Migration completed!', results })
  } catch (error) {
    res.status(500).json({ error: error.message, results })
  }
})

module.exports = app

