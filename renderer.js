// Get DOM elements
const extensionIdInput = document.getElementById('extension-id');
const outputDirInput = document.getElementById('output-dir');
const browseBtn = document.getElementById('browse-btn');
const downloadBtn = document.getElementById('download-btn');
const resultsCard = document.getElementById('results-card');
const resultsContent = document.getElementById('results-content');
const loader = document.getElementById('loader');
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const historyList = document.getElementById('history-list');
const tabNavigation = document.getElementById('tab-navigation');

// Initialize history array from localStorage or create empty array
let downloadHistory = JSON.parse(localStorage.getItem('downloadHistory') || '[]');

// Function to check if content has scrollbar
function updateScrollbarClass() {
  const content = document.querySelector('.app-content');
  if (content.scrollHeight > content.clientHeight) {
    content.classList.add('has-scrollbar');
  } else {
    content.classList.remove('has-scrollbar');
  }
}

// Add scroll event listener
document.querySelector('.app-content').addEventListener('scroll', updateScrollbarClass);

// Add resize observer to handle window resizing
const resizeObserver = new ResizeObserver(updateScrollbarClass);
resizeObserver.observe(document.querySelector('.app-content'));

// Update scrollbar class after content changes
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    setTimeout(updateScrollbarClass, 100);
  });
});

// Window controls
minimizeBtn.addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

maximizeBtn.addEventListener('click', () => {
  window.electronAPI.maximizeWindow();
});

closeBtn.addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

// Tab navigation
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove active class from all buttons and contents
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked button and corresponding content
    button.classList.add('active');
    const tabId = button.getAttribute('data-tab');
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // If history tab is clicked, refresh the history list
    if (tabId === 'history') {
      renderHistoryList();
    }
  });
});

// Browse for output directory
browseBtn.addEventListener('click', async () => {
  const directory = await window.electronAPI.selectDirectory();
  if (directory) {
    outputDirInput.value = directory;
  }
});

// Download and extract extension
downloadBtn.addEventListener('click', async () => {
  const extensionId = document.getElementById('extension-id').value.trim();
  const outputDir = document.getElementById('output-dir').value.trim();
  const resultsCard = document.getElementById('results-card');
  const resultsContent = document.getElementById('results-content');
  const loader = document.getElementById('loader');
  const tabNavigation = document.getElementById('tab-navigation');
  
  if (!extensionId) {
    alert('Please enter a Chrome Extension ID');
    return;
  }
  
  if (!outputDir) {
    alert('Please select an output directory');
    return;
  }
  
  // Show loader and hide previous results
  loader.classList.remove('hidden');
  resultsCard.classList.add('hidden');
  
  try {
    // Call the main process to download and extract the extension
    const result = await window.electronAPI.downloadExtension(extensionId, outputDir);
    
    // Add to history
    addToHistory(extensionId, outputDir, result.filesExtracted);
    
    // Show success message
    showSuccess(extensionId, outputDir, result.filesExtracted);
    
    // Update scrollbar class after content changes
    setTimeout(updateScrollbarClass, 100);
    
    // Ensure tab navigation remains visible
    setTimeout(() => {
      if (tabNavigation) {
        // Force a reflow
        tabNavigation.style.display = 'flex';
        tabNavigation.style.width = 'calc(100% - 4rem)';
      }
    }, 100);
    
  } catch (error) {
    // Show error message
    showError(error.message || 'Failed to download extension');
    
    // Update scrollbar class after error message
    setTimeout(updateScrollbarClass, 100);
    
    // Ensure tab navigation remains visible
    setTimeout(() => {
      if (tabNavigation) {
        // Force a reflow
        tabNavigation.style.display = 'flex';
        tabNavigation.style.width = 'calc(100% - 4rem)';
      }
    }, 100);
  } finally {
    // Hide loader
    loader.classList.add('hidden');
    
    // Final check for scrollbar
    setTimeout(updateScrollbarClass, 500);
    
    // Final check to ensure tab navigation is visible
    setTimeout(() => {
      if (tabNavigation) {
        // Force a reflow
        tabNavigation.style.display = 'flex';
        tabNavigation.style.width = 'calc(100% - 4rem)';
      }
    }, 500);
  }
});

// Add extension to history
function addToHistory(extensionId, outputPath, filesExtracted) {
  const timestamp = new Date().toISOString();
  const historyItem = {
    id: extensionId,
    outputPath,
    filesExtracted,
    timestamp,
    iconUrl: `https://chrome.google.com/webstore/detail/${extensionId}`,
    name: extensionId // We'll use the ID as name until we implement metadata fetching
  };
  
  // Add to the beginning of the array (newest first)
  downloadHistory.unshift(historyItem);
  
  // Limit history to 50 items
  if (downloadHistory.length > 50) {
    downloadHistory = downloadHistory.slice(0, 50);
  }
  
  // Save to localStorage
  localStorage.setItem('downloadHistory', JSON.stringify(downloadHistory));
}

// Render history list
function renderHistoryList() {
  // Clear current list
  historyList.innerHTML = '';
  
  if (downloadHistory.length === 0) {
    historyList.innerHTML = '<div class="empty-history-message">No download history yet.</div>';
    return;
  }
  
  // Create history items
  downloadHistory.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    const date = new Date(item.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
    historyItem.innerHTML = `
      <div class="history-icon">
        <i class="fa-solid fa-puzzle-piece"></i>
      </div>
      <div class="history-details">
        <div class="history-title">${item.name}</div>
        <div class="history-meta">
          <span><i class="fa-solid fa-calendar"></i> ${formattedDate}</span>
          <span><i class="fa-solid fa-file"></i> ${item.filesExtracted} files</span>
        </div>
        <div class="history-id">${item.id}</div>
      </div>
      <div class="history-actions">
        <button class="btn btn-primary btn-icon download-again" data-id="${item.id}" title="Download Again">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
    `;
    
    historyList.appendChild(historyItem);
    
    // Add event listener to the download again button
    const downloadAgainBtn = historyItem.querySelector('.download-again');
    downloadAgainBtn.addEventListener('click', () => {
      // Set the extension ID and switch to download tab
      extensionIdInput.value = item.id;
      outputDirInput.value = item.outputPath;
      
      // Switch to download tab
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      document.querySelector('[data-tab="download"]').classList.add('active');
      document.getElementById('download-tab').classList.add('active');
      
      // Scroll to top
      window.scrollTo(0, 0);
    });
  });
}

// Show success message
function showSuccess(extensionId, outputDir, filesExtracted) {
  const resultsCard = document.getElementById('results-card');
  const resultsContent = document.getElementById('results-content');
  
  // Create success message with proper path formatting
  const successHtml = `
    <div class="result-item result-success">
      <div class="result-title">
        <i class="fa-solid fa-circle-check"></i> Extension Downloaded Successfully
      </div>
      <div class="result-details">
        <div class="result-detail">
          <span class="result-label">Extension ID:</span>
          <span>${extensionId}</span>
        </div>
        <div class="result-detail">
          <span class="result-label">Extracted to:</span>
          <span>${outputDir}\\${extensionId}</span>
        </div>
        <div class="result-detail">
          <span class="result-label">Files extracted:</span>
          <span>${filesExtracted}</span>
        </div>
      </div>
    </div>
  `;
  
  resultsContent.innerHTML = successHtml;
  resultsCard.classList.remove('hidden');
}

// Show error message
function showError(message) {
  // Ensure tab navigation is visible
  if (tabNavigation) {
    tabNavigation.style.display = 'flex';
  }
  
  resultsContent.innerHTML = `
    <div class="result-item result-error">
      <div class="result-title">
        <i class="fa-solid fa-circle-exclamation"></i> Error
      </div>
      <div class="result-details">
        <div class="result-detail">${message}</div>
      </div>
    </div>
  `;
  
  resultsCard.classList.remove('hidden');
  
  // Force a reflow to ensure the tab navigation is visible
  setTimeout(() => {
    if (tabNavigation) {
      tabNavigation.style.display = 'flex';
    }
  }, 0);
}

// Initialize the app
function init() {
  // Set default output directory if available
  window.electronAPI.getDefaultDirectory().then(directory => {
    if (directory) {
      outputDirInput.value = directory;
    }
  });
  
  // Ensure tab navigation is visible
  if (tabNavigation) {
    tabNavigation.style.display = 'flex';
  }
  
  // Render history list
  renderHistoryList();
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
