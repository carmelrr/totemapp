/**
 * Debug script to check existing routes data in Firestore
 * Run with: node debug-routes.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase config - replace with your actual config
const firebaseConfig = {
  // Add your config here if you want to run this script
  projectId: "your-project-id"
};

async function debugRoutes() {
  try {
    console.log('🔍 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('🔍 Fetching routes from Firestore...');
    const routesRef = collection(db, 'routes');
    const snapshot = await getDocs(routesRef);
    
    console.log(`🔍 Found ${snapshot.size} routes:`);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`\n📍 Route: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Grade: ${data.grade}`);
      console.log(`  Color: ${data.color}`);
      console.log(`  xNorm: ${data.xNorm} (${typeof data.xNorm})`);
      console.log(`  yNorm: ${data.yNorm} (${typeof data.yNorm})`);
      console.log(`  x: ${data.x} (${typeof data.x})`);
      console.log(`  y: ${data.y} (${typeof data.y})`);
      console.log(`  Status: ${data.status}`);
      console.log(`  CreatedAt: ${data.createdAt}`);
    });
    
    console.log('\n✅ Debug complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

console.log('🔍 Starting routes debug...');
console.log('Note: Update firebaseConfig above with your actual config to run this script');

// Uncomment the line below and add your config to actually run
// debugRoutes();
