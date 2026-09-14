const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');

const url = 'https://raw.githubusercontent.com/tt-a1i/archify/main/archify.zip';
const vendorDir = path.join(__dirname, '..', 'vendor');
const zipPath = path.join(vendorDir, 'archify.zip');

if (!fs.existsSync(vendorDir)) {
    fs.mkdirSync(vendorDir, { recursive: true });
}

console.log('Downloading archify.zip...');
const file = fs.createWriteStream(zipPath);

https.get(url, (response) => {
    if (response.statusCode !== 200) {
        console.error(`Failed to download archify.zip: ${response.statusCode}`);
        process.exit(1);
    }
    
    response.pipe(file);
    file.on('finish', () => {
        file.close(() => {
            console.log('Download complete. Extracting...');
            try {
                const zip = new AdmZip(zipPath);
                zip.extractAllTo(vendorDir, true);
                console.log('Extraction complete. Archify is ready in vendor/archify');
                // Clean up zip
                fs.unlinkSync(zipPath);
            } catch (err) {
                console.error('Error during extraction:', err);
                process.exit(1);
            }
        });
    });
}).on('error', (err) => {
    console.error('Error downloading archify.zip:', err.message);
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }
    process.exit(1);
});
