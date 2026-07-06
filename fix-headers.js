const fs = require('fs');
const path = require('path');
const base = 'src/app/dashboard';
fs.readdirSync(base).forEach(dir => {
  const p = path.join(base, dir, 'page.tsx');
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    let changed = false;
    
    // Replace standard h1 header class
    if (content.includes('text-2xl font-bold text-slate-800"')) {
      content = content.replace(/text-2xl font-bold text-slate-800"/g, 'text-2xl font-bold text-slate-800 dark:text-zinc-100"');
      changed = true;
    }
    // Replace standard description paragraph class
    if (content.includes('text-slate-500 mt-1"')) {
      content = content.replace(/text-slate-500 mt-1"/g, 'text-slate-500 dark:text-zinc-400 mt-1"');
      changed = true;
    }
    // Replace main container
    if (content.includes('className="bg-white rounded-2xl shadow-sm border overflow-hidden"')) {
      content = content.replace(/className="bg-white rounded-2xl shadow-sm border overflow-hidden"/g, 'className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden transition-colors duration-300"');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(p, content);
      console.log('Fixed:', p);
    }
  }
});
