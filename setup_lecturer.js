// Setup Lecturer Account Script
// Run with: node setup_lecturer.js

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createLecturer(name, email, staffId, password) {
  console.log(`\n📚 Creating lecturer account for ${name}...`);
  
  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Generate avatar URL
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff`;
    
    // Insert lecturer into database
    const { data, error } = await supabase
      .from('users')
      .insert([{
        name: name,
        email: email,
        admission_no: staffId,
        password_hash: passwordHash,
        role: 'Lecturer',
        avatar_url: avatarUrl,
        course: null,
        department: null
      }])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        console.error(`❌ Error: Staff ID ${staffId} already exists`);
      } else {
        console.error('❌ Error creating lecturer:', error.message);
      }
      return false;
    }
    
    console.log('✅ Lecturer account created successfully!');
    console.log('📋 Account Details:');
    console.log(`   Name: ${data.name}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Staff ID: ${data.admission_no}`);
    console.log(`   Role: ${data.role}`);
    console.log(`   Password: ${password}`);
    console.log(`\n🔐 Login credentials:`);
    console.log(`   Staff ID: ${staffId}`);
    console.log(`   Password: ${password}`);
    
    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

async function main() {
  console.log('🎓 Drizaikn Digital Library - Lecturer Account Setup');
  console.log('================================================\n');
  
  // Create sample lecturers
  const lecturers = [
    {
      name: 'Dr. Jane Doe',
      email: 'jane.doe@drizaikn.edu',
      staffId: 'LEC-001',
      password: 'lecturer123'
    },
    {
      name: 'Prof. John Smith',
      email: 'john.smith@drizaikn.edu',
      staffId: 'LEC-002',
      password: 'lecturer123'
    },
    {
      name: 'Dr. Mary Johnson',
      email: 'mary.johnson@drizaikn.edu',
      staffId: 'LEC-003',
      password: 'lecturer123'
    }
  ];
  
  let successCount = 0;
  
  for (const lecturer of lecturers) {
    const success = await createLecturer(
      lecturer.name,
      lecturer.email,
      lecturer.staffId,
      lecturer.password
    );
    if (success) successCount++;
  }
  
  console.log('\n================================================');
  console.log(`✅ Created ${successCount} out of ${lecturers.length} lecturer accounts`);
  console.log('\n💡 Tip: Lecturers can now login at the portal by selecting "Lecturer" role');
  console.log('📚 Lecturers have the same borrowing privileges as students');
  console.log('🤖 AI Librarian provides teaching tips and pedagogical support for lecturers\n');
}

main();
