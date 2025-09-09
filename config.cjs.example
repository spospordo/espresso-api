// config.js
module.exports = {
  ftpConfig: {
    host: 'ftpupload url', //leave value blank to skip ftp
    user: 'UserID',
    password: 'Password',
    secure: false,
    pasv: true
  },
  vidiots: {
    posterBaseUrl: "https://example.github.io/TRMNL/",
    // Add more Vidiots-related config values here as needed
  },
  fileConfig: {
    localFilePath: 'http://localhost/espresso/output.html',  // The webpage URL to capture or leave blank to skip converting to Jpeg
    localOutputPath: 'output.jpeg',  // The local path to save the screenshot
    remoteOutputPath: '/your-folder/output.jpeg',  // The remote FTP path where the file will be uploaded
  },
  htmlConfig: {
    originalHTMLPath: '/your-folder/index.html',
    outputHTMLPath: '/your-folder/output.html',
    serverURL: 'http://<server IP>:3000/get-text',
    imagePaths: {
      smallcontainer: 'https://<githubUsername>.github.io/TRMNL/smallContainer.png',
      mediumcontainer: 'https://<githubUsername>.github.io/TRMNL/mediumContainer.png',
      largecontainer: 'https://<githubUsername>.github.io/TRMNL/largeContainer.png'
    }
  },
  serverConfig: {
    port: 3000,
    staticFilesDirectory: '/yourfolder/folder',
    textFilePath: '/home/<username or folder>/espresso-api/textValues.json'
  },
  outputFiles: {
    html: '/home/pi/pages/example.github.io/output.html',
    jpeg: '/home/pi/pages/example.github.io/output.jpeg',
    logs: '/home/pi/pages/example.github.io/logs.txt'
    // Add more as needed
  },
  github: {
    username: 'username',
    token: 'tokenText',
    repo: '<username>.github.io',
    branch: 'main',
    repoLocalPath: '/absolute/path/to/your/repo', // <-- NEW: Local repo path for git CLI commands
  },

  file: {
    filesToUpload: [
      {
        sourceFile: '/yourFolder/output.html',
        destinationPath: 'foldername/output.html'
      },
      {
        sourceFile: '/yourFolder/output.jpeg',
        destinationPath: 'foldername/output.jpeg'
      },
      {
        sourceFile: '/yourFolder/logs.txt',
        destinationPath: 'foldername/logs.txt'
      }
    ]
  }
}
