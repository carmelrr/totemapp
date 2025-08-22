#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Additional import mappings for remaining issues
const additionalMappings = {
  "from '../../components/NewSprayEditor'": "from '@/components/NewSprayEditor'",
  "from '../../constants/colors'": "from '@/constants/colors'",
  "from '../../features/image/homography'": "from '@/features/image/homography'",
  "from '../../features/image/picker'": "from '@/features/image/picker'",
  "from '../../features/image/exif'": "from '@/features/image/exif'",
  "from '../../features/image/resize'": "from '@/features/image/resize'",
  "from '../../utils/matrix'": "from '@/utils/matrix'",
  "from '../../utils/geometry'": "from '@/utils/geometry'",
  "from '../../components/spray/Simple4x3Viewer'": "from '@/components/spray/Simple4x3Viewer'",
  "from '../../components/ui/BottomToolbar'": "from '@/components/ui/BottomToolbar'",
  "from '../../components/ui/FloatingPanel'": "from '@/components/ui/FloatingPanel'",
  "from '../../components/ui/ToolButton'": "from '@/components/ui/ToolButton'",
  
  // Single level relative imports within src that should be path aliases
  "from '../components/": "from '@/components/'",
  "from '../features/": "from '@/features/'",
  "from '../constants/": "from '@/constants/'",
  "from '../utils/": "from '@/utils/'",
  "from '../hooks/": "from '@/hooks/'",
  "from '../screens/": "from '@/screens/'",
  "from '../navigation/": "from '@/navigation/'",
  "from '../assets/": "from '@/assets/'"
};

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Apply additional import mappings
    Object.entries(additionalMappings).forEach(([oldPattern, newPattern]) => {
      const regex = new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      if (content.includes(oldPattern)) {
        content = content.replace(regex, newPattern);
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed additional imports in: ${filePath}`);
    }
    
    return changed;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function fixAllAdditionalImports() {
  console.log('🔧 Fixing remaining deep relative imports...');
  
  const patterns = [
    'src/**/*.js',
    'src/**/*.jsx', 
    'src/**/*.ts',
    'src/**/*.tsx'
  ];
  
  let totalFixed = 0;
  
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, { 
      ignore: ['node_modules/**'],
      cwd: process.cwd()
    });
    
    files.forEach(filePath => {
      if (fixImportsInFile(filePath)) {
        totalFixed++;
      }
    });
  });
  
  console.log(`\n🎉 Fixed additional imports in ${totalFixed} files`);
}

if (require.main === module) {
  fixAllAdditionalImports();
}

module.exports = { fixAllAdditionalImports };
