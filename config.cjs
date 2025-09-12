// Test configuration file for development
module.exports = {
  
  // =================================================================
  // EXPRESS SERVER CONFIGURATION (used by server.js)
  // =================================================================
  server: {
    port: 3000,
    staticFilesDirectory: '/tmp/static',
    textFilePath: '/home/runner/work/espresso-api/espresso-api/textValues.json'
  },

  // =================================================================
  // HTML GENERATION CONFIGURATION (used by generateHTML.cjs)
  // =================================================================
  htmlGeneration: {
    originalHTMLPath: '/tmp/index.html',
    serverURL: 'http://localhost:3000/get-text',
    imagePaths: {
      smallcontainer: 'https://example.github.io/TRMNL/smallContainer.png',
      mediumcontainer: 'https://example.github.io/TRMNL/mediumContainer.png',
      largecontainer: 'https://example.github.io/TRMNL/largeContainer.png'
    }
  },

  // =================================================================
  // IMAGE CONVERSION CONFIGURATION (used by convertToJpeg.cjs)
  // =================================================================
  conversion: {
    localFilePath: 'http://localhost/espresso/output.html'
  },

  // =================================================================
  // FTP UPLOAD CONFIGURATION (used by ftpFile.js)
  // =================================================================
  ftp: {
    host: '',
    user: '',
    password: '',
    secure: false,
    pasv: true,
    localFilePath: '',
    remoteOutputPath: ''
  },

  // =================================================================
  // GITHUB UPLOAD CONFIGURATION (used by uploadToGitHub.mjs)
  // =================================================================
  github: {
    username: 'testuser',
    token: 'testtoken',
    repo: 'testuser.github.io',
    branch: 'main',
    repoLocalPath: '/tmp/test-repo'
  },

  // =================================================================
  // OUTPUT FILE PATHS (used by multiple modules)
  // =================================================================
  outputFiles: {
    html: '/tmp/output.html',
    jpeg: '/tmp/output.jpeg',
    logs: '/tmp/logs.txt',
    vidiots: '/tmp/vidiots.html'
  },

  // =================================================================
  // VIDIOTS SCRAPING CONFIGURATION (used by scrapeVidiots.cjs)
  // =================================================================
  vidiots: {
    posterBaseUrl: "https://example.github.io/TRMNL/"
  }
}