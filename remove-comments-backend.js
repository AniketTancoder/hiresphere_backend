const fs = require('fs');
const path = require('path');
const strip = require('strip-comments');

function removeCommentsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const stripped = strip(content);
  fs.writeFileSync(filePath, stripped, 'utf8');
}

function processDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (path.extname(fullPath) === '.js') {
      console.log(`Processing ${fullPath}`);
      removeCommentsFromFile(fullPath);
    }
  }
}

// Start from the current directory (backend)
processDirectory('.');
console.log('Comments removed from all .js files.');