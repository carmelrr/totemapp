/* eslint-disable quotes, require-jsdoc, valid-jsdoc, arrow-parens, no-unused-vars, one-var */
/**
 * OBJ to Top View Image - Converts OBJ file to a top-down view image
 * Takes OBJ file data and renders it from above as a PNG image
 */

const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// Maximum number of edges to render (to prevent memory issues)
const MAX_EDGES = 2000;

/**
 * Parse OBJ file and extract vertices and edges
 * Tracks edge counts to identify outline edges (edges that appear only once)
 */
function parseOBJ(objContent) {
  const lines = objContent.split('\n');
  const vertices = [];
  const edgeCounts = new Map(); // Track how many faces share each edge
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Parse vertex: v x y z
    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        vertices.push({
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3]),
        });
      }
    }
    
    // Parse face: f v1 v2 v3 ... (can have texture/normal indices like v1/vt1/vn1)
    if (trimmed.startsWith('f ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      const faceVertices = parts.map(p => {
        const idx = parseInt(p.split('/')[0], 10);
        // OBJ indices are 1-based, convert to 0-based
        return idx > 0 ? idx - 1 : vertices.length + idx;
      });
      
      // Create edges from face vertices and count occurrences
      for (let i = 0; i < faceVertices.length; i++) {
        const v1 = faceVertices[i];
        const v2 = faceVertices[(i + 1) % faceVertices.length];
        // Store edge as sorted pair to normalize
        const edgeKey = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
        edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) || 0) + 1);
      }
    }
  }
  
  // Separate outline edges (appear once) from internal edges (appear twice or more)
  const outlineEdges = [];
  const internalEdges = [];
  
  for (const [edge, count] of edgeCounts) {
    if (count === 1) {
      outlineEdges.push(edge);
    } else {
      internalEdges.push(edge);
    }
  }
  
  return { vertices, outlineEdges, internalEdges, allEdges: Array.from(edgeCounts.keys()) };
}

/**
 * Simplify edges by keeping only significant ones
 * Uses edge length filtering - keeps longer edges which are usually structural
 */
function simplifyEdges(vertices2D, edges, maxEdges) {
  if (edges.length <= maxEdges) return edges;
  
  // Calculate edge lengths
  const edgesWithLength = edges.map(edge => {
    const [i1, i2] = edge.split('-').map(Number);
    if (i1 >= vertices2D.length || i2 >= vertices2D.length) {
      return { edge, length: 0 };
    }
    const p1 = vertices2D[i1];
    const p2 = vertices2D[i2];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    return { edge, length };
  });
  
  // Sort by length (descending) and keep top maxEdges
  edgesWithLength.sort((a, b) => b.length - a.length);
  return edgesWithLength.slice(0, maxEdges).map(e => e.edge);
}

/**
 * Detect model orientation and determine the best projection plane
 * Returns which axes to use for the 2D projection
 */
function detectProjectionPlane(vertices) {
  if (vertices.length === 0) return { xAxis: 'x', yAxis: 'y', zAxis: 'z' };
  
  // Calculate bounding box extents
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
    minZ = Math.min(minZ, v.z);
    maxZ = Math.max(maxZ, v.z);
  }
  
  const extentX = maxX - minX;
  const extentY = maxY - minY;
  const extentZ = maxZ - minZ;
  
  // Find the axis with smallest extent - this is likely the "up" direction
  // For a climbing wall model viewed from front, the "depth" will be smallest
  
  // Sort extents to find smallest
  const extents = [
    { axis: 'x', extent: extentX },
    { axis: 'y', extent: extentY },
    { axis: 'z', extent: extentZ },
  ];
  extents.sort((a, b) => a.extent - b.extent);
  
  // Smallest extent is the view direction (depth)
  // Two larger extents form the projection plane
  const upAxis = extents[0].axis;
  const horizontal = extents.slice(1).map(e => e.axis);
  
  return {
    viewAxis: upAxis,
    horizontalAxes: horizontal,
  };
}

/**
 * Project vertices to 2D
 * Automatically detects the best projection plane based on model extents
 * Option to force a specific projection view
 */
function projectTopDown(vertices, forceView = 'auto') {
  if (vertices.length === 0) return [];
  
  // Determine projection plane
  let xAxisSrc, yAxisSrc;
  
  if (forceView === 'auto') {
    const projection = detectProjectionPlane(vertices);
    xAxisSrc = projection.horizontalAxes[0];
    yAxisSrc = projection.horizontalAxes[1];
  } else if (forceView === 'front') {
    // Front view: X horizontal, Z vertical (Y is depth)
    xAxisSrc = 'x';
    yAxisSrc = 'z';
  } else if (forceView === 'top') {
    // Top view: X horizontal, Y vertical (Z is up/depth)
    xAxisSrc = 'x';
    yAxisSrc = 'y';
  } else if (forceView === 'side') {
    // Side view: Y horizontal, Z vertical (X is depth)
    xAxisSrc = 'y';
    yAxisSrc = 'z';
  } else {
    // Default: standard top-down (Y up convention - use X and Z)
    xAxisSrc = 'x';
    yAxisSrc = 'z';
  }
  
  return vertices.map(v => ({
    x: v[xAxisSrc],
    y: v[yAxisSrc],
  }));
}

/**
 * Create SVG from projected vertices and edges
 */
function createSVG(vertices2D, edges, width = 1000, height = 1000, padding = 50) {
  if (vertices2D.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="50%" y="50%" text-anchor="middle" fill="#666">No geometry found</text>
    </svg>`;
  }
  
  // Calculate bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const v of vertices2D) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  
  const dataWidth = maxX - minX || 1;
  const dataHeight = maxY - minY || 1;
  
  // Calculate scale to fit in canvas with padding
  const availWidth = width - 2 * padding;
  const availHeight = height - 2 * padding;
  const scale = Math.min(availWidth / dataWidth, availHeight / dataHeight);
  
  // Transform function
  const transform = (v) => ({
    x: padding + (v.x - minX) * scale,
    y: padding + (v.y - minY) * scale,
  });
  
  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g stroke="#333333" stroke-width="1" fill="none">`;
  
  // Draw edges
  for (const edge of edges) {
    const [i1, i2] = edge.split('-').map(Number);
    if (i1 < vertices2D.length && i2 < vertices2D.length) {
      const p1 = transform(vertices2D[i1]);
      const p2 = transform(vertices2D[i2]);
      svg += `\n    <line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}"/>`;
    }
  }
  
  svg += `\n  </g>
</svg>`;
  
  return svg;
}

/**
 * Convert SVG to PNG using canvas (for Cloud Function environment)
 * Since we don't have canvas in Cloud Functions easily, we'll return SVG
 * and convert to data URL on client, or use SVG directly
 */
function svgToDataUrl(svg) {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Main Cloud Function
 */
exports.objToTopView = onRequest(
  { cors: true, memory: "256MiB", timeoutSeconds: 60 },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      const { fileData, filename, options = {} } = req.body;
      
      if (!fileData) {
        res.status(400).json({ error: 'Missing fileData' });
        return;
      }
      
      logger.info('Processing OBJ file:', { filename });
      
      // Decode base64 file data
      const objContent = Buffer.from(fileData, 'base64').toString('utf-8');
      
      // Parse OBJ - now returns outline and internal edges separately
      const { vertices, outlineEdges, internalEdges, allEdges } = parseOBJ(objContent);
      logger.info('Parsed OBJ:', { 
        vertexCount: vertices.length, 
        outlineEdgeCount: outlineEdges.length,
        internalEdgeCount: internalEdges.length,
        totalEdgeCount: allEdges.length 
      });
      
      if (vertices.length === 0) {
        res.status(400).json({ 
          success: false, 
          error: 'No vertices found in OBJ file' 
        });
        return;
      }
      
      // Get view option (auto, front, top, side)
      const viewMode = options.view || 'auto';
      
      // Project to 2D with specified view
      const vertices2D = projectTopDown(vertices, viewMode);
      
      // Determine which edges to use based on options
      // Default: prefer outline edges (cleaner look), fall back to all if too few
      const useOutlineOnly = options.outlineOnly !== false;
      let edgesToRender = useOutlineOnly && outlineEdges.length > 10 ?
        outlineEdges :
        allEdges;
      
      // Simplify edges if there are too many
      if (edgesToRender.length > MAX_EDGES) {
        logger.info(`Simplifying edges from ${edgesToRender.length} to ${MAX_EDGES}`);
        edgesToRender = simplifyEdges(vertices2D, edgesToRender, MAX_EDGES);
      }
      
      // Create SVG
      const width = options.width || 1000;
      const height = options.height || 1000;
      const svg = createSVG(vertices2D, edgesToRender, width, height);
      
      // Convert to data URL
      const imageUrl = svgToDataUrl(svg);
      
      // Calculate bounds for scaling info
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (const v of vertices2D) {
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      }
      
      res.json({
        success: true,
        imageUrl,
        bounds: {
          width: maxX - minX,
          height: maxY - minY,
          minX,
          maxX,
          minY,
          maxY,
        },
        stats: {
          vertexCount: vertices.length,
          outlineEdgeCount: outlineEdges.length,
          internalEdgeCount: internalEdges.length,
          renderedEdgeCount: edgesToRender.length,
          viewMode,
        },
      });
      
    } catch (error) {
      logger.error('Error processing OBJ:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal server error' 
      });
    }
  }
);
