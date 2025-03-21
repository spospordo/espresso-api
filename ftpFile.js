// ftpFile.js
const ftp = require('basic-ftp');
const { ftpConfig, fileConfig } = require('./config'); // Import FTP and file configuration from config.js

async function uploadToFTP(filePath) {
  const client = new ftp.Client();
  client.ftp.verbose = true; // Enable verbose logging (optional, helpful for debugging)

  try {
    // Connect to the FTP server using values from config.js
    await client.access({
      host: ftpConfig.host,
      user: ftpConfig.user,
      password: ftpConfig.password,
      secure: ftpConfig.secure,
      pasv: ftpConfig.pasv,
    });

    // Upload the JPEG file to the remote server using the remote path from config.js
    console.log(`Uploading ${filePath} to FTP server...`);
    await client.uploadFrom(filePath, fileConfig.remoteOutputPath); // Remote path from config.js
    console.log('File uploaded successfully!');
  } catch (error) {
    console.error('Error uploading file to FTP:', error);
  } finally {
    client.close();
  }
}

module.exports = uploadToFTP;
