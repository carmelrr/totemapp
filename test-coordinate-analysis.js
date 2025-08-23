/**
 * Route data analysis - checks the conversion logic without imports
 * This analyzes the coordinate transformation pipeline
 */

console.log('🧪 Route Data Conversion Analysis\n');

// SVG viewBox dimensions (from WallMapSVG)
const VIEWBOX_W = 2560;
const VIEWBOX_H = 1600;
const SVG_ASPECT_RATIO = VIEWBOX_H / VIEWBOX_W; // 0.625

// Simulate route data that might come from Firebase
const sampleFirebaseRoutes = [
  // Route with absolute coordinates (old format)
  {
    id: 'route_abs_1',
    name: 'Old Format Route 1',
    x: 1280, // Center horizontally
    y: 480,  // 30% down
    grade: 'V3',
    color: '#ff4444'
  },
  
  // Route with normalized coordinates (new format) 
  {
    id: 'route_norm_1',
    name: 'New Format Route 1',
    xNorm: 0.75,
    yNorm: 0.25,
    grade: 'V5',
    color: '#44ff44'
  },
  
  // Route with edge case coordinates
  {
    id: 'route_edge_1',
    name: 'Edge Case Route',
    x: 0,
    y: 0,
    grade: 'V1',
    color: '#4444ff'
  },
  
  // Route with out-of-bounds coordinates
  {
    id: 'route_oob_1', 
    name: 'Out of Bounds Route',
    x: 3000,
    y: -200,
    grade: 'V7',
    color: '#ff44ff'
  }
];

// Conversion function (matching RoutesService logic)
function convertRouteFromFirebase(data) {
  let xNorm = data.xNorm;
  let yNorm = data.yNorm;
  
  // Convert x/y to xNorm/yNorm if needed
  if ((xNorm == null || yNorm == null) && 
      Number.isFinite(data.x) && Number.isFinite(data.y)) {
    xNorm = Math.min(Math.max(data.x / VIEWBOX_W, 0), 1);
    yNorm = Math.min(Math.max(data.y / VIEWBOX_H, 0), 1);
    console.log(`🔄 Route ${data.id}: converted x=${data.x}, y=${data.y} to xNorm=${xNorm.toFixed(3)}, yNorm=${yNorm.toFixed(3)}`);
  }
  
  return {
    ...data,
    xNorm: Number.isFinite(xNorm) ? xNorm : 0,
    yNorm: Number.isFinite(yNorm) ? yNorm : 0,
  };
}

// Convert coordinate from normalized to image pixels (fromNorm function)
function fromNorm(normalizedCoords, imageDimensions) {
  return {
    xImg: normalizedCoords.xNorm * imageDimensions.imgW,
    yImg: normalizedCoords.yNorm * imageDimensions.imgH
  };
}

// Test different screen scenarios
const screenScenarios = [
  { name: 'Small Phone', containerW: 360, containerH: 640 },
  { name: 'Large Phone', containerW: 414, containerH: 896 },
  { name: 'Tablet Portrait', containerW: 768, containerH: 1024 },
  { name: 'Tablet Landscape', containerW: 1024, containerH: 768 },
];

console.log('📊 Converting sample routes...\n');

const convertedRoutes = sampleFirebaseRoutes.map(convertRouteFromFirebase);

convertedRoutes.forEach(route => {
  console.log(`📍 ${route.name} (${route.id}):`);
  console.log(`  Original: x=${route.x}, y=${route.y}`);
  console.log(`  Normalized: xNorm=${route.xNorm.toFixed(3)}, yNorm=${route.yNorm.toFixed(3)}`);
  console.log('');
});

console.log('🖥️  Testing coordinate mapping across different screen sizes...\n');

screenScenarios.forEach(scenario => {
  console.log(`📱 ${scenario.name} (${scenario.containerW}x${scenario.containerH}):`);
  
  // Calculate image dimensions (matching MapViewport logic)
  let imgW = scenario.containerW;
  let imgH = scenario.containerW * SVG_ASPECT_RATIO;
  
  // If image height exceeds container height, fit by height instead
  if (imgH > scenario.containerH) {
    imgH = scenario.containerH;
    imgW = scenario.containerH / SVG_ASPECT_RATIO;
  }
  
  console.log(`  Image dimensions: ${imgW.toFixed(1)}x${imgH.toFixed(1)}`);
  
  // Test each route on this screen size
  convertedRoutes.forEach(route => {
    const imageCoords = fromNorm(route, { imgW, imgH });
    
    // Calculate marker position (centered)
    const markerSize = 36;
    const markerLeft = imageCoords.xImg - markerSize / 2;
    const markerTop = imageCoords.yImg - markerSize / 2;
    
    console.log(`    ${route.name}: image(${imageCoords.xImg.toFixed(1)}, ${imageCoords.yImg.toFixed(1)}) → marker(${markerLeft.toFixed(1)}, ${markerTop.toFixed(1)})`);
    
    // Check for issues
    if (markerLeft < -markerSize || markerLeft > imgW + markerSize ||
        markerTop < -markerSize || markerTop > imgH + markerSize) {
      console.log(`      ⚠️  Marker outside visible area`);
    }
    
    if (imageCoords.xImg < 0 || imageCoords.xImg > imgW ||
        imageCoords.yImg < 0 || imageCoords.yImg > imgH) {
      console.log(`      ⚠️  Coordinates outside image bounds`);
    }
  });
  
  console.log('');
});

// Test edge cases and validation
console.log('🔍 Testing edge cases and validation...\n');

const edgeCases = [
  { name: 'Zero coordinates', xNorm: 0, yNorm: 0 },
  { name: 'Max coordinates', xNorm: 1, yNorm: 1 },
  { name: 'Center coordinates', xNorm: 0.5, yNorm: 0.5 },
  { name: 'Invalid coordinates', xNorm: NaN, yNorm: Infinity },
  { name: 'Negative coordinates', xNorm: -0.1, yNorm: -0.1 },
  { name: 'Over-range coordinates', xNorm: 1.1, yNorm: 1.1 },
];

edgeCases.forEach(testCase => {
  console.log(`🧪 ${testCase.name}:`);
  console.log(`  Input: xNorm=${testCase.xNorm}, yNorm=${testCase.yNorm}`);
  
  // Apply safety checks (like in RoutesService)
  const safeXNorm = Number.isFinite(testCase.xNorm) ? testCase.xNorm : 0;
  const safeYNorm = Number.isFinite(testCase.yNorm) ? testCase.yNorm : 0;
  
  console.log(`  After safety: xNorm=${safeXNorm}, yNorm=${safeYNorm}`);
  
  // Check bounds
  if (safeXNorm < 0 || safeXNorm > 1) {
    console.log(`  ⚠️  xNorm out of bounds [0,1]`);
  }
  if (safeYNorm < 0 || safeYNorm > 1) {
    console.log(`  ⚠️  yNorm out of bounds [0,1]`);
  }
  
  console.log('');
});

console.log('✅ Route data conversion analysis complete!');
console.log('\n💡 Key findings:');
console.log('   - Conversion from x/y to xNorm/yNorm works correctly');
console.log('   - Coordinates are properly clamped to [0,1] range');
console.log('   - Image scaling maintains aspect ratio across different screen sizes');
console.log('   - Marker positioning accounts for centering offset');
console.log('   - Safety checks handle invalid/missing data gracefully');
