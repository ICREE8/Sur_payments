import { pool } from './client.js';

async function seed() {
  console.log('Seeding users...');

  await pool.query(`
    INSERT INTO users (email, full_name, role) VALUES
      ('operator@sur.payments', 'Ana Operator', 'OPERATOR'),
      ('approver@sur.payments', 'Carlos Approver', 'APPROVER'),
      ('auditor@sur.payments', 'Lucia Auditor', 'AUDITOR'),
      ('admin@sur.payments', 'Diego Admin', 'ADMIN')
    ON CONFLICT (email) DO NOTHING;
  `);

  console.log('Seed completed');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
