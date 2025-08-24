/**
 * Test script to verify route data loading and xNorm/yNorm conversion
 * This will help debug the data conversion logic
 */

// Mock data to test the conversion logic
const mockFirebaseData = [
  // Case 1: Route with xNorm/yNorm already set
  {
    id: 'route1',
    name: 'Test Route 1',
    grade: 'V3',
    color: '#ff0000',
    xNorm: 0.5,
    yNorm: 0.3,
    status: 'active'
  },
  
  // Case 2: Route with x/y that needs conversion
  {
    id: 'route2', 
    name: 'Test Route 2',
    grade: 'V5',
    color: '#00ff00',
    x: 1280, // Half of 2560
    y: 480,  // 30% of 1600
    status: 'active'
  },
  
  // Case 3: Route with both x/y and xNorm/yNorm (should prefer xNorm/yNorm)
  {
    id: 'route3',
    name: 'Test Route 3', 
    grade: 'V7',
    color: '#0000ff',
    x: 100,
    y: 100,
    xNorm: 0.8,
    yNorm: 0.9,
    status: 'active'
  },
  
  // Case 4: Route with invalid/missing coordinates
  {
    id: 'route4',
    name: 'Test Route 4',
    grade: 'V1', 
    color: '#ffff00',
    status: 'active'
  },
  
  // Case 5: Route with coordinates outside bounds
  {
    id: 'route5',
    name: 'Test Route 5',
    grade: 'V4',
    color: '#ff00ff', 
    x: 3000, // > 2560 (should clamp to 1)
    y: -100, // < 0 (should clamp to 0)
    status: 'active'
  }
];

// Simulate the conversion logic from RoutesService
function convertRouteData(data) {
  const VIEWBOX_W = 2560;
  const VIEWBOX_H = 1600;
  
  let xNorm = data.xNorm;
  let yNorm = data.yNorm;
  
  // If no normalization but has absolute coordinates - convert
  if ((xNorm == null || yNorm == null) && 
      Number.isFinite(data.x) && Number.isFinite(data.y)) {
    xNorm = Math.min(Math.max(data.x / VIEWBOX_W, 0), 1);
    yNorm = Math.min(Math.max(data.y / VIEWBOX_H, 0), 1);
    console.log(`🔍 Route ${data.id}: converted x=${data.x}, y=${data.y} to xNorm=${xNorm}, yNorm=${yNorm}`);
  }
  
  return {
    id: data.id,
    name: data.name || '',
    grade: data.grade || 'V0',
    color: data.color || '#ef4444',
    xNorm: Number.isFinite(xNorm) ? xNorm : 0,
    yNorm: Number.isFinite(yNorm) ? yNorm : 0,
    status: data.status || 'active',
    originalX: data.x,
    originalY: data.y,
    originalXNorm: data.xNorm,
    originalYNorm: data.yNorm
  };
}

console.log('🧪 Testing route data conversion logic...\n');

mockFirebaseData.forEach((mockData, index) => {
  console.log(`📍 Test Case ${index + 1}: ${mockData.name}`);
  console.log('Input:', {
    x: mockData.x,
    y: mockData.y, 
    xNorm: mockData.xNorm,
    yNorm: mockData.yNorm
  });
  
  const converted = convertRouteData(mockData);
  console.log('Output:', {
    xNorm: converted.xNorm,
    yNorm: converted.yNorm
  });
  
  // Validate conversion
  if (converted.xNorm < 0 || converted.xNorm > 1) {
    console.warn('⚠️  xNorm out of bounds [0,1]');
  }
  if (converted.yNorm < 0 || converted.yNorm > 1) {
    console.warn('⚠️  yNorm out of bounds [0,1]');
  }
  
  console.log('---\n');
});

// Test coordinate conversion to image pixels
function testCoordinateConversion() {
  console.log('🧪 Testing coordinate conversion to image pixels...\n');
  
  const imageWidth = 400;
  const imageHeight = 250; // Aspect ratio maintained
  
  const testRoutes = mockFirebaseData.map(convertRouteData);
  
  testRoutes.forEach(route => {
    const xImg = route.xNorm * imageWidth;
    const yImg = route.yNorm * imageHeight;
    
    console.log(`📍 ${route.name}:`);
    console.log(`  Normalized: (${route.xNorm.toFixed(3)}, ${route.yNorm.toFixed(3)})`);
    console.log(`  Image pixels: (${xImg.toFixed(1)}, ${yImg.toFixed(1)})`);
    
    // Check if coordinates are within image bounds
    if (xImg < 0 || xImg > imageWidth || yImg < 0 || yImg > imageHeight) {
      console.warn('⚠️  Coordinates outside image bounds');
    }
    
    console.log('');
  });
}

testCoordinateConversion();

console.log('✅ Test complete. Check output for any warnings or issues.');
