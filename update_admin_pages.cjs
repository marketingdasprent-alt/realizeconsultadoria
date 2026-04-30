const fs = require('fs');
const path = require('path');

const dir = 'src/pages/admin';
fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).forEach(file => {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/^import\s+AdminLayout\s+from\s+['"].*?['"];?[\r\n]+/gm, '');
  content = content.replace(/<AdminLayout>/g, '<>');
  content = content.replace(/<\/AdminLayout>/g, '</>');
  fs.writeFileSync(p, content);
  console.log(`Updated ${file}`);
});
