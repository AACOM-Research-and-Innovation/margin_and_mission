const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(output, 'index.html'));
fs.mkdirSync(path.join(output, 'docs'), { recursive: true });
fs.copyFileSync(path.join(root, 'docs', 'card-impact-differential-explanations.md'),
  path.join(output, 'docs', 'card-impact-differential-explanations.md'));
console.log('Prepared app and downloadable scoring guide for Netlify; functions are bundled separately.');
