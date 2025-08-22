#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Helper to recursively get all JS/TS files
function getAllFiles(pattern) {
  return glob.sync(pattern, { 
    ignore: ['node_modules/**', 'dataconnect-generated/**', '.git/**'],
    cwd: process.cwd()
  });
}

// Calculate file size and line count
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const lines = content.split('\n').length;
    const nonEmptyLines = content.split('\n').filter(line => line.trim().length > 0).length;
    
    return {
      sizeKB: Math.round(stats.size / 1024 * 100) / 100,
      totalLines: lines,
      codeLines: nonEmptyLines,
      content
    };
  } catch (error) {
    return {
      sizeKB: 0,
      totalLines: 0,
      codeLines: 0,
      content: '',
      error: error.message
    };
  }
}

// Extract imports from file content
function extractImports(content, filePath) {
  const imports = [];
  const exportedSymbols = [];
  
  // Match import statements
  const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(?:{[^}]*}|\*\s+as\s+\w+|\w+))?\s*from\s+['"]([^'"]+)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      type: 'import',
      path: match[1],
      raw: match[0]
    });
  }
  
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push({
      type: 'require',
      path: match[1],
      raw: match[0]
    });
  }
  
  // Extract exports
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*(\w+)?/g;
  while ((match = exportRegex.exec(content)) !== null) {
    if (match[1]) {
      exportedSymbols.push(match[1]);
    }
  }
  
  // Extract component names from JSX/React files
  if (content.includes('React') || content.includes('jsx') || filePath.includes('.jsx') || filePath.includes('.tsx')) {
    const componentRegex = /(?:function|const)\s+([A-Z]\w*)/g;
    while ((match = componentRegex.exec(content)) !== null) {
      exportedSymbols.push(match[1]);
    }
  }
  
  return { imports, exportedSymbols };
}

// Main analysis
function analyzeCodebase() {
  console.log('🔍 Analyzing codebase...');
  
  const patterns = [
    '**/*.js',
    '**/*.jsx', 
    '**/*.ts',
    '**/*.tsx'
  ];
  
  const allFiles = patterns.flatMap(pattern => getAllFiles(pattern));
  const analysis = {};
  const dependencyGraph = {};
  
  // Analyze each file
  allFiles.forEach(filePath => {
    const fileInfo = analyzeFile(filePath);
    const { imports, exportedSymbols } = extractImports(fileInfo.content, filePath);
    
    analysis[filePath] = {
      ...fileInfo,
      imports,
      exportedSymbols,
      relativePaths: imports.filter(imp => imp.path.startsWith('.') || imp.path.startsWith('../')),
      deepRelatives: imports.filter(imp => imp.path.includes('../..')),
      crossFeatureImports: []
    };
    
    // Build dependency graph
    dependencyGraph[filePath] = imports.map(imp => imp.path);
  });
  
  // Detect cross-feature imports
  Object.keys(analysis).forEach(filePath => {
    const fileDir = path.dirname(filePath);
    analysis[filePath].imports.forEach(imp => {
      if (imp.path.startsWith('.')) {
        const resolvedPath = path.resolve(fileDir, imp.path);
        const relativePath = path.relative(process.cwd(), resolvedPath);
        
        // Check if it's crossing feature boundaries
        if (filePath.includes('/features/') && relativePath.includes('/features/')) {
          const sourceFeature = filePath.split('/features/')[1]?.split('/')[0];
          const targetFeature = relativePath.split('/features/')[1]?.split('/')[0];
          
          if (sourceFeature && targetFeature && sourceFeature !== targetFeature) {
            analysis[filePath].crossFeatureImports.push({
              import: imp,
              sourceFeature,
              targetFeature
            });
          }
        }
      }
    });
  });
  
  return { analysis, dependencyGraph };
}

// Generate reports
function generateReports() {
  const { analysis, dependencyGraph } = analyzeCodebase();
  
  // Summary stats
  const totalFiles = Object.keys(analysis).length;
  const totalSize = Object.values(analysis).reduce((sum, file) => sum + file.sizeKB, 0);
  const totalLines = Object.values(analysis).reduce((sum, file) => sum + file.codeLines, 0);
  
  console.log(`\n📊 CODEBASE ANALYSIS SUMMARY`);
  console.log(`Files analyzed: ${totalFiles}`);
  console.log(`Total size: ${Math.round(totalSize)} KB`);
  console.log(`Total lines of code: ${totalLines}`);
  
  // Write detailed analysis
  const reportContent = `# PROJECT INVENTORY - Automated Analysis
Generated: ${new Date().toISOString()}

## Summary
- **Total Files**: ${totalFiles}
- **Total Size**: ${Math.round(totalSize)} KB
- **Total Lines of Code**: ${totalLines}

## File Analysis
${Object.entries(analysis).map(([filePath, info]) => {
  return `### ${filePath}
- **Size**: ${info.sizeKB} KB
- **Lines**: ${info.codeLines} LOC
- **Exports**: ${info.exportedSymbols.join(', ') || 'None detected'}
- **Deep Relatives**: ${info.deepRelatives.length}
- **Cross-Feature Imports**: ${info.crossFeatureImports.length}
${info.crossFeatureImports.length > 0 ? info.crossFeatureImports.map(cf => `  - ${cf.sourceFeature} → ${cf.targetFeature}: ${cf.import.path}`).join('\n') : ''}
`;
}).join('\n')}

## Dependency Issues
### Deep Relative Imports (../../)
${Object.entries(analysis).filter(([_, info]) => info.deepRelatives.length > 0).map(([filePath, info]) => {
  return `- **${filePath}**: ${info.deepRelatives.length} deep imports\n${info.deepRelatives.map(imp => `  - ${imp.path}`).join('\n')}`;
}).join('\n')}

### Cross-Feature Dependencies
${Object.entries(analysis).filter(([_, info]) => info.crossFeatureImports.length > 0).map(([filePath, info]) => {
  return `- **${filePath}**:\n${info.crossFeatureImports.map(cf => `  - ${cf.sourceFeature} → ${cf.targetFeature}`).join('\n')}`;
}).join('\n')}
`;

  fs.writeFileSync('PROJECT_INVENTORY.md', reportContent);
  
  // Generate dependency graph
  const depGraphContent = `# DEPENDENCY GRAPH - Automated Analysis
Generated: ${new Date().toISOString()}

## Problematic Dependencies

### Files with Deep Relative Imports
${Object.entries(analysis).filter(([_, info]) => info.deepRelatives.length > 0).map(([filePath, info]) => {
  return `#### ${filePath}\n${info.deepRelatives.map(imp => `- \`${imp.path}\``).join('\n')}`;
}).join('\n\n')}

### Cross-Feature Dependencies  
${Object.entries(analysis).filter(([_, info]) => info.crossFeatureImports.length > 0).map(([filePath, info]) => {
  return `#### ${filePath}\n${info.crossFeatureImports.map(cf => `- ${cf.sourceFeature} → ${cf.targetFeature}: \`${cf.import.path}\``).join('\n')}`;
}).join('\n\n')}

## Full Dependency Graph
\`\`\`
${Object.entries(dependencyGraph).map(([file, deps]) => `${file} depends on:\n${deps.map(dep => `  - ${dep}`).join('\n')}`).join('\n\n')}
\`\`\`
`;

  fs.writeFileSync('DEPENDENCY_GRAPH.md', depGraphContent);
  
  console.log('✅ Reports generated: PROJECT_INVENTORY.md, DEPENDENCY_GRAPH.md');
  
  return analysis;
}

// Install glob if not available
try {
  require('glob');
} catch (e) {
  console.log('Installing glob for analysis...');
  require('child_process').execSync('npm install --save-dev glob', { stdio: 'inherit' });
}

// Run analysis
if (require.main === module) {
  generateReports();
}

module.exports = { analyzeCodebase, generateReports };
