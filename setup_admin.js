// Run this script to create an admin user
// Usage: node setup_admin.js

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const admissionNo = 'ADMIN001';
  const password = 'admin123';
  const name = 'Library Admin';
  const email = 'admin@drizaikn.edu';

  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log('Generated hash:', passwordHash);

    // Check if admin exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('admission_no', admissionNo)
      .single();

    if (existing) {
      // Update existing user to admin
      const { error } = await supabase
        .from('users')
        .update({ 
          role: 'Admin', 
          password_hash: passwordHash,
          name: name
        })
        .eq('admission_no', admissionNo);

      if (error) throw error;
      console.log('✅ Updated existing user to Admin');
    } else {
      // Create new admin
      const { error } = await supabase
        .from('users')
        .insert([{
          admission_no: admissionNo,
          name: name,
          email: email,
          password_hash: passwordHash,
          role: 'Admin',
          avatar_url: 'https://ui-avatars.com/api/?name=Library+Admin&background=dc2626&color=fff'
        }]);

      if (error) throw error;
      console.log('✅ Created new Admin user');
    }

    console.log('\n📋 Admin Credentials:');
    console.log('   Admission No: ADMIN001');
    console.log('   Password: admin123');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

createAdmin();
