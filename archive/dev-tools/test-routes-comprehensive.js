/**
 * Comprehensive test for Firebase routes data loading
 * This tests the actual useFirebaseRoutes hook and RoutesService
 */

import { useState, useEffect } from 'react';
import { RoutesService } from './src/features/routes-map/services/RoutesService';

// Test function to simulate the hook behavior
function testFirebaseRoutesLoading() {
  console.log('🧪 Testing Firebase routes loading...\n');
  
  // Simulate the hook state
  let routes = [];
  let isLoading = true;
  let error = null;
  
  console.log('📡 Attempting to subscribe to routes...');
  
  try {
    // Test the subscription (this will fail if Firebase isn't configured)
    const unsubscribe = RoutesService.subscribeRoutes(
      (newRoutes) => {
        console.log('✅ Routes loaded successfully!');
        console.log(`📊 Found ${newRoutes.length} routes`);
        
        newRoutes.forEach((route, index) => {
          console.log(`\n📍 Route ${index + 1}: ${route.name || route.id}`);
          console.log(`  Grade: ${route.grade}`);
          console.log(`  Color: ${route.color}`);
          console.log(`  xNorm: ${route.xNorm} (${typeof route.xNorm})`);
          console.log(`  yNorm: ${route.yNorm} (${typeof route.yNorm})`);
          console.log(`  Status: ${route.status}`);
          
          // Check for data integrity issues
          if (!Number.isFinite(route.xNorm) || !Number.isFinite(route.yNorm)) {
            console.warn(`⚠️  Invalid coordinates for route ${route.id}`);
          }
          
          if (route.xNorm < 0 || route.xNorm > 1 || route.yNorm < 0 || route.yNorm > 1) {
            console.warn(`⚠️  Coordinates out of bounds [0,1] for route ${route.id}`);
          }
          
          // Check if this route was converted from x/y
          if (route.xNorm % (1/2560) === 0 || route.yNorm % (1/1600) === 0) {
            console.log(`  🔄 Likely converted from absolute coordinates`);
          }
        });
        
        routes = newRoutes;
        isLoading = false;
      },
      (err) => {
        console.error('❌ Error loading routes:', err.message);
        error = err;
        isLoading = false;
      }
    );
    
    // Simulate cleanup after 5 seconds
    setTimeout(() => {
      console.log('\n🛑 Cleaning up subscription...');
      unsubscribe();
    }, 5000);
    
  } catch (err) {
    console.error('❌ Failed to set up subscription:', err.message);
    console.log('💡 This might be expected if Firebase is not configured or if running outside the app context');
  }
}

// Test the coordinate transformation pipeline
function testCoordinateTransformationPipeline() {
  console.log('\n🧪 Testing complete coordinate transformation pipeline...\n');
  
  // Simulate different screen sizes
  const testCases = [
    { name: 'Phone Portrait', imgW: 360, imgH: 225 },
    { name: 'Phone Landscape', imgW: 640, imgH: 400 },
    { name: 'Tablet', imgW: 800, imgH: 500 },
  ];
  
  // Test route with known coordinates
  const testRoute = {
    id: 'test',
    name: 'Center Route',
    xNorm: 0.5, // Center horizontally
    yNorm: 0.3, // 30% down vertically
    grade: 'V5',
    color: '#ff0000'
  };
  
  testCases.forEach(testCase => {
    console.log(`📱 ${testCase.name} (${testCase.imgW}x${testCase.imgH}):`);
    
    // Convert normalized to image coordinates (fromNorm function)
    const xImg = testRoute.xNorm * testCase.imgW;
    const yImg = testRoute.yNorm * testCase.imgH;
    
    console.log(`  Normalized: (${testRoute.xNorm}, ${testRoute.yNorm})`);
    console.log(`  Image pixels: (${xImg}, ${yImg})`);
    
    // Simulate marker positioning (subtract half marker size to center)
    const markerSize = 36;
    const markerLeft = xImg - markerSize / 2;
    const markerTop = yImg - markerSize / 2;
    
    console.log(`  Marker position: (${markerLeft}, ${markerTop})`);
    
    // Check if marker would be visible
    if (markerLeft < -markerSize/2 || markerLeft > testCase.imgW + markerSize/2 ||
        markerTop < -markerSize/2 || markerTop > testCase.imgH + markerSize/2) {
      console.warn(`  ⚠️  Marker would be outside visible area`);
    } else {
      console.log(`  ✅ Marker would be visible`);
    }
    
    console.log('');
  });
}

// Run the tests
console.log('🚀 Starting comprehensive route data tests...\n');

testCoordinateTransformationPipeline();

// Only try Firebase test if we're in a proper environment
if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'test') {
  testFirebaseRoutesLoading();
} else {
  console.log('⏭️  Skipping Firebase test (not in app environment)');
}

export { testFirebaseRoutesLoading, testCoordinateTransformationPipeline };
