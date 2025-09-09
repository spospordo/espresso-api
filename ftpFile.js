const ftp = require('basic-ftp');
const { ftp: ftpConfig } = require('./config.cjs'); // Import FTP configuration from config.js
const fs = require('fs');  // Import fs module to check file existence

async function uploadToFTP() {
  const client = new ftp.Client();
  client.ftp.verbose = true; // Enable verbose logging (optional, helpful for debugging)

  try {
    // Log the FTP config for debugging purposes (make sure the values are correct)
    console.log('Connecting to FTP server...');
    console.log(`Host: ${ftpConfig.host}, User: ${ftpConfig.user}, Secure: ${ftpConfig.secure}, PASV: ${ftpConfig.pasv}`);
    
    // Connect to the FTP server using values from config.js
    await client.access({
      host: ftpConfig.host,
      user: ftpConfig.user,
      password: ftpConfig.password,
      secure: ftpConfig.secure,
      pasv: ftpConfig.pasv,
    });
    console.log('FTP connection established.');

    // Get the local file path from config.js
    const localFilePath = ftpConfig.localFilePath;
    
    // Check if the local file exists before attempting to upload
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      console.error(`File does not exist at the provided path: ${localFilePath}`);
      return; // Exit early if the file doesn't exist
    }

    // Log file path before upload
    console.log(`Uploading ${localFilePath} to FTP server...`);

    // Upload the file to the remote FTP server using the remote path from config.js
    await client.uploadFrom(localFilePath, ftpConfig.remoteOutputPath); // Remote path from config.js
    console.log('File uploaded successfully!');
  } catch (error) {
    console.error('Error uploading file to FTP:', error);
  } finally {
    client.close();
    console.log('FTP client closed.');
  }
}

uploadToFTP(); // Call the function to start the upload process
