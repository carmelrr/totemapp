#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Import mapping rules
const importMappings = {
  // Firebase config mappings
  "from './firebase-config'": "from '@/features/data/firebase'",
  "from '../firebase-config'": "from '@/features/data/firebase'",
  "from '../../firebase-config'": "from '@/features/data/firebase'",
  "from '../../../firebase-config'": "from '@/features/data/firebase'",
  
  // Context mappings
  "from './context/UserContext'": "from '@/features/auth/UserContext'",
  "from '../context/UserContext'": "from '@/features/auth/UserContext'",
  "from '../../context/UserContext'": "from '@/features/auth/UserContext'",
  "from './context/ThemeContext'": "from '@/features/theme/ThemeContext'",
  "from '../context/ThemeContext'": "from '@/features/theme/ThemeContext'",
  "from '../../context/ThemeContext'": "from '@/features/theme/ThemeContext'",
  
  // Service mappings
  "from './routesService'": "from '@/features/routes/routesService'",
  "from '../routesService'": "from '@/features/routes/routesService'",
  "from '../../routesService'": "from '@/features/routes/routesService'",
  "from './services/socialService'": "from '@/features/social/socialService'",
  "from '../services/socialService'": "from '@/features/social/socialService'",
  "from '../../services/socialService'": "from '@/features/social/socialService'",
  
  // Spray services
  "from '../../services/spray/sprayApi'": "from '@/features/spraywall/sprayApi'",
  "from '../../../services/spray/sprayApi'": "from '@/features/spraywall/sprayApi'",
  "from './services/spray/sprayApi'": "from '@/features/spraywall/sprayApi'",
  "from '../../services/spray/validations'": "from '@/features/spraywall/validations'",
  
  // State/hooks mappings
  "from '../../state/spray/useSprayWall'": "from '@/features/spraywall/useSprayWall'",
  "from '../../state/spray/useSprayEditor'": "from '@/features/spraywall/useSprayEditor'",
  "from '../../../state/spray/useSprayWall'": "from '@/features/spraywall/useSprayWall'",
  "from '../../../state/spray/useSprayEditor'": "from '@/features/spraywall/useSprayEditor'",
  
  // Component mappings
  "from './components/ErrorBoundary'": "from '@/components/ui/ErrorBoundary'",
  "from '../components/ErrorBoundary'": "from '@/components/ui/ErrorBoundary'",
  "from '../../components/ErrorBoundary'": "from '@/components/ui/ErrorBoundary'",
  "from './components/spray/SprayHeader'": "from '@/components/spray/SprayHeader'",
  "from '../components/spray/SprayHeader'": "from '@/components/spray/SprayHeader'",
  "from '../../components/spray/SprayHeader'": "from '@/components/spray/SprayHeader'",
  
  // Utility mappings
  "from '../../utils/permissions'": "from '@/features/auth/permissions'",
  "from '../../../utils/permissions'": "from '@/features/auth/permissions'",
  "from './utils/permissions'": "from '@/features/auth/permissions'",
  "from '../utils/permissions'": "from '@/features/auth/permissions'",
  
  // Screen mappings
  "from './screens/": "from '@/screens/",
  "from '../screens/": "from '@/screens/",
  "from '../../screens/": "from '@/screens/",
  
  // Navigation mappings
  "from './navigation/SprayNavigator'": "from '@/navigation/SprayNavigator'",
  "from '../navigation/SprayNavigator'": "from '@/navigation/SprayNavigator'",
  "from '../../navigation/SprayNavigator'": "from '@/navigation/SprayNavigator'",
  
  // Asset mappings
  "from '../../assets/spray/placeholder.jpg'": "from '@/assets/spray/placeholder.jpg'",
  "from '../../../assets/spray/placeholder.jpg'": "from '@/assets/spray/placeholder.jpg'"
};

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Apply import mappings
    Object.entries(importMappings).forEach(([oldPattern, newPattern]) => {
      const regex = new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      if (content.includes(oldPattern)) {
        content = content.replace(regex, newPattern);
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed imports in: ${filePath}`);
    }
    
    return changed;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function fixAllImports() {
  console.log('🔧 Fixing import paths...');
  
  const patterns = [
    'App.js',
    'src/**/*.js',
    'src/**/*.jsx', 
    'src/**/*.ts',
    'src/**/*.tsx'
  ];
  
  let totalFixed = 0;
  
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, { 
      ignore: ['node_modules/**', 'dataconnect-generated/**'],
      cwd: process.cwd()
    });
    
    files.forEach(filePath => {
      if (fixImportsInFile(filePath)) {
        totalFixed++;
      }
    });
  });
  
  console.log(`\n🎉 Fixed imports in ${totalFixed} files`);
}

if (require.main === module) {
  fixAllImports();
}

module.exports = { fixAllImports };
