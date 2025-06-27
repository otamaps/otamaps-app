const fs = require('fs');
const path = require('path');
const https = require('https');

// Create assets/fonts directory if it doesn't exist
const fontDir = path.join(__dirname, '../assets/fonts');
if (!fs.existsSync(fontDir)) {
  fs.mkdirSync(fontDir, { recursive: true });
}

// Figtree font variants to download
const fontFiles = [
  'https://github.com/google/fonts/raw/main/ofl/figtree/Figtree%5Bwght%5D.ttf',
  'https://github.com/google/fonts/raw/main/ofl/figtree/static/Figtree-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/figtree/static/Figtree-Medium.ttf',
  'https://github.com/google/fonts/raw/main/ofl/figtree/static/Figtree-SemiBold.ttf',
  'https://github.com/google/fonts/raw/main/ofl/figtree/static/Figtree-Bold.ttf',
];

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(fontDir, filename);
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
        console.log(`Downloaded ${filename}`);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete the file async
      reject(err);
    });
  });
}

async function downloadFonts() {
  try {
    for (const fontUrl of fontFiles) {
      const filename = fontUrl.split('/').pop().replace('%5Bwght%5D', '-Variable');
      await downloadFile(fontUrl, filename);
    }
    console.log('All fonts downloaded successfully!');
  } catch (error) {
    console.error('Error downloading fonts:', error);
    process.exit(1);
  }
}

downloadFonts();
