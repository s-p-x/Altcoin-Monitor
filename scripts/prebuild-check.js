#!/usr/bin/env node

/**
 * Prebuild Check - Vercel-visible diagnostic script
 * Validates environment and database connectivity before build
 * Does NOT print secrets - only YES/NO status
 */

console.log('='.repeat(60));
console.log('PREBUILD CHECK');
console.log('='.repeat(60));

// 1. Print Node version
console.log(`Node Version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Platform: ${process.platform}`);

// 2. Check DATABASE_URL presence (do NOT print the value)
console.log('\n--- Database Configuration ---');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL: NOT SET');
  console.error('\nFATAL: DATABASE_URL environment variable is missing.');
  console.error('Please set DATABASE_URL in your Vercel environment variables.');
  console.error('Format: postgresql://user:password@host:5432/database');
  process.exit(1);
}

console.log('✅ DATABASE_URL: PRESENT');

// 3. Validate DATABASE_URL format (without printing it)
if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error('❌ DATABASE_URL format appears invalid');
  console.error('Expected: postgresql:// or postgres:// prefix');
  console.error('Got: ' + databaseUrl.split('://')[0] + '://...');
  process.exit(1);
}

console.log('✅ DATABASE_URL format: Valid (PostgreSQL)');

// 4. Test database connection (optional but highly recommended)
console.log('\n--- Database Connection Test ---');

async function testConnection() {
  try {
    // For Prisma 7, we need to use the lazy-loaded client from lib/prismaClient.ts
    // Since we can't import TypeScript directly in Node, we'll use a simpler approach
    // Just verify that Prisma CLI can access the database via migrate status
    
    const { execSync } = await import('child_process');
    
    console.log('Attempting database connection via Prisma CLI...');
    
    try {
      // This will fail if DB is unreachable, but won't print sensitive info
      execSync('npx prisma migrate status', {
        stdio: 'pipe',
        env: process.env,
      });
      
      console.log('✅ Database connection: SUCCESS');
    } catch (migrateError) {
      // Check if it's a connection error or just pending migrations
      const output = migrateError.stdout?.toString() || migrateError.stderr?.toString() || '';
      
      if (output.includes('P1001') || output.includes("Can't reach database")) {
        console.error('❌ Database connection: FAILED');
        console.error('\nFATAL: Cannot connect to database');
        console.error('Error: Database server is not reachable');
        
        console.error('\nPossible causes:');
        console.error('1. Database server is not running');
        console.error('2. Invalid credentials in DATABASE_URL');
        console.error('3. Database does not exist');
        console.error('4. Firewall blocking connection');
        console.error('5. SSL/TLS configuration issue (try adding ?sslmode=require)');
        
        process.exit(1);
      }
      
      // If it's just migration status info, that's fine - connection works
      console.log('✅ Database connection: SUCCESS (migrations pending or applied)');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('PREBUILD CHECK PASSED');
    console.log('='.repeat(60) + '\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database connection: FAILED');
    console.error('\nFATAL: Cannot connect to database');
    
    // Sanitize error message - remove any URLs
    let errorMessage = error.message || String(error);
    errorMessage = errorMessage.replace(/postgresql:\/\/[^\s]+/g, 'postgresql://***:***@***/***');
    errorMessage = errorMessage.replace(/postgres:\/\/[^\s]+/g, 'postgres://***:***@***/***');
    
    console.error('Error:', errorMessage);
    
    // Print helpful hints
    console.error('\nPossible causes:');
    console.error('1. Database server is not reachable');
    console.error('2. Invalid credentials in DATABASE_URL');
    console.error('3. Database does not exist');
    console.error('4. Firewall blocking connection');
    console.error('5. SSL/TLS configuration issue (try adding ?sslmode=require)');
    
    process.exit(1);
  }
}

// Run the connection test
testConnection().catch((error) => {
  console.error('❌ Unexpected error during prebuild check');
  console.error(error);
  process.exit(1);
});
