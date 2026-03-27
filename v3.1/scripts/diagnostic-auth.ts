import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const SESSION_COOKIE_NAME = "kpiq_v3_session";
const SESSION_COOKIE_SECRET = "dev-session-secret-change-me";

function signSessionToken(token: string): string {
  return crypto.createHmac("sha256", SESSION_COOKIE_SECRET).update(token).digest("hex");
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function main() {
  console.log('=== Auth Diagnostic ===\n');
  
  // 1. Check if sessions exist
  const sessions = await prisma.session.findMany({
    take: 5,
    include: { user: { select: { name: true, email: true } } }
  });
  
  console.log('1. Sessions in database:', await prisma.session.count());
  if (sessions.length > 0) {
    console.log('   Sample sessions:');
    sessions.forEach(s => {
      console.log(`   - User: ${s.user.name} (${s.user.email})`);
      console.log(`     Expires: ${s.expiresAt.toISOString()}`);
      console.log(`     Valid: ${s.expiresAt > new Date() ? '✓' : '✗ EXPIRED'}`);
    });
  }
  
  // 2. Check SESSION_COOKIE_SECRET
  console.log('\n2. Session Cookie Secret:');
  console.log(`   Configured: ${SESSION_COOKIE_SECRET ? '✓' : '✗ MISSING'}`);
  
  // 3. Check the cookie value format
  // In a real request, the cookie would be: "token.signature"
  // Let's simulate what the API does
  console.log('\n3. Auth Flow Test:');
  
  // Get the first valid session token from DB
  const validSession = sessions.find(s => s.expiresAt > new Date());
  if (validSession) {
    console.log(`   Testing with session for: ${validSession.user.name}`);
    
    const tokenHash = hashSessionToken(validSession.sessionTokenHash);
    const tokenFromDb = validSession.sessionTokenHash;
    
    // The signed value should be: token.signature
    const signature = signSessionToken(tokenFromDb);
    const signedValue = `${tokenFromDb}.${signature}`;
    
    console.log(`   Token (first 20 chars): ${tokenFromDb.slice(0, 20)}...`);
    console.log(`   Signature (first 20 chars): ${signature.slice(0, 20)}...`);
    console.log(`   Full cookie value would be: ${signedValue.slice(0, 40)}...`);
    
    // Now verify it can be parsed back
    const [parsedToken, parsedSig] = signedValue.split(".");
    const expectedSig = signSessionToken(parsedToken);
    const match = expectedSig === parsedSig;
    console.log(`   Signature verification: ${match ? '✓ PASS' : '✗ FAIL'}`);
    
    // Hash the token (same as database)
    const computedHash = crypto.createHash("sha256").update(parsedToken).digest("hex");
    console.log(`   Token hash matches DB: ${computedHash === tokenFromDb ? '✓' : '✗'}`);
    
    // Check if session exists in DB
    const sessionInDb = await prisma.session.findFirst({
      where: { sessionTokenHash: tokenFromDb }
    });
    console.log(`   Session in DB: ${sessionInDb ? '✓' : '✗ NOT FOUND'}`);
    console.log(`   Session expired: ${sessionInDb && sessionInDb.expiresAt <= new Date() ? '✗ YES' : '✓ NO'}`);
  }
  
  // 4. Test with admin user
  console.log('\n4. Admin User Check:');
  const admin = await prisma.user.findFirst({
    where: { email: { contains: 'admin' } },
    include: { userRoles: { include: { role: true } } }
  });
  
  if (admin) {
    console.log(`   Found: ${admin.name} (${admin.email})`);
    console.log(`   Roles: ${admin.userRoles.map(r => r.role.key).join(', ')}`);
  } else {
    console.log('   No admin user found');
  }
  
  // 5. Check sessions with admin
  console.log('\n5. Active Sessions:');
  const activeSessions = await prisma.session.findMany({
    where: { expiresAt: { gt: new Date() } },
    include: { user: { select: { name: true, email: true } } }
  });
  console.log(`   Count: ${activeSessions.length}`);
  activeSessions.forEach(s => {
    console.log(`   - ${s.user.name} (${s.user.email})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
