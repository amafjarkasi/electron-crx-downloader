const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // Create the browser window with modern styling
  mainWindow = new BrowserWindow({
    width: 900,
    height: 720, 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#2f3241',
      symbolColor: '#ffffff'
    },
    backgroundColor: '#2f3241',
    frame: false // Remove default frame for custom title bar
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Open DevTools for debugging
  // mainWindow.webContents.openDevTools();

  // Handle window being closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for window controls
ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// IPC handler for directory selection
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// IPC handler to get default directory
ipcMain.handle('get-default-directory', async () => {
  return app.getPath('documents');
});

// IPC handler for extension download
ipcMain.handle('download-extension', async (event, extensionId, outputDir) => {
  try {
    // Create the extension URL
    const extensionUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=89.0.4389.82&acceptformat=crx2,crx3&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;
    
    // Download the extension
    const crxBuffer = await downloadFile(extensionUrl);
    
    // Create the output directory if it doesn't exist
    const extensionDir = path.join(outputDir, extensionId);
    if (!fs.existsSync(extensionDir)) {
      fs.mkdirSync(extensionDir, { recursive: true });
    }
    
    // Process the CRX file to extract the ZIP data
    const zipData = extractZipFromCrx(crxBuffer);
    
    // Save the ZIP data to a temporary file
    const zipPath = path.join(extensionDir, 'temp.zip');
    fs.writeFileSync(zipPath, zipData);
    
    // Extract the ZIP file
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extensionDir, true);
    
    // Delete the temporary ZIP file
    fs.unlinkSync(zipPath);
    
    // Count the number of files extracted
    const filesExtracted = countFiles(extensionDir);
    
    return {
      success: true,
      extensionId,
      outputDir: extensionDir,
      filesExtracted
    };
  } catch (error) {
    console.error('Error downloading extension:', error);
    throw new Error(`Failed to download or extract extension: ${error.message}`);
  }
});

// IPC handler for opening directory in file explorer
ipcMain.handle('open-directory', async (event, dirPath) => {
  try {
    await shell.openPath(dirPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Helper function to extract ZIP data from CRX file
function extractZipFromCrx(buffer) {
  // Check for the magic number 'Cr24'
  const magic = buffer.toString('ascii', 0, 4);
  if (magic !== 'Cr24') {
    throw new Error('Invalid CRX format: Missing Cr24 magic number');
  }
  
  // Read the version number (4 bytes)
  const version = buffer.readUInt32LE(4);
  console.log(`CRX version: ${version}`);
  
  let zipStartOffset;
  
  if (version === 2) {
    // Version 2 format:
    // bytes 0-3: Chrome magic number (Cr24)
    // bytes 4-7: Version (2)
    // bytes 8-11: Public key length
    // bytes 12-15: Signature length
    // bytes 16-*: Public key
    // bytes *-*: Signature
    // bytes *-end: ZIP data
    const publicKeyLength = buffer.readUInt32LE(8);
    const signatureLength = buffer.readUInt32LE(12);
    zipStartOffset = 16 + publicKeyLength + signatureLength;
  } else if (version === 3) {
    // Version 3 format:
    // bytes 0-3: Chrome magic number (Cr24)
    // bytes 4-7: Version (3)
    // bytes 8-11: Header size
    // bytes 12-*: Header (JSON)
    // bytes *-end: ZIP data
    const headerSize = buffer.readUInt32LE(8);
    zipStartOffset = 12 + headerSize;
  } else {
    throw new Error(`Unsupported CRX version: ${version}`);
  }
  
  // Extract the ZIP data
  return buffer.slice(zipStartOffset);
}

// Helper function to download a file
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return resolve(downloadFile(response.headers.location));
      }
      
      // Check for successful response
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
      }
      
      // Collect the data
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

// Helper function to count files in a directory (recursive)
function countFiles(dir) {
  let count = 0;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      count += countFiles(filePath);
    } else {
      count++;
    }
  }
  
  return count;
}
