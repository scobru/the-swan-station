// UI module - User interface functions, logging, and display management

// Logging function
function addLog(message, type = "info") {
  const logContainer = document.getElementById("logContainer");
  if (!logContainer) return;

  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement("div");
  logEntry.className = `log-entry log-${type}`;
  logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;

  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;

  // Limit log entries to prevent memory issues
  while (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.firstChild);
  }
}

// Menu management
function addMenuButton() {
  const container = document.querySelector(".container");
  if (!container) return;

  const menuButton = document.createElement("button");
  menuButton.id = "menuButton";
  menuButton.className = "menu-button";
  menuButton.textContent = "[ MENU ]";
  menuButton.onclick = toggleMenu;

  container.appendChild(menuButton);
}

// Initialize existing menu toggle button
function initializeMenuToggle() {
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  if (menuToggleBtn) {
    // Add event listener to existing button
    window.core.safeAddEventListener(menuToggleBtn, "click", toggleMenu);
    console.log("✅ Menu toggle button initialized");
  } else {
    console.warn("⚠️ Menu toggle button not found, creating new one");
    addMenuButton();
  }
}

// Initialize all UI buttons
function initializeUIButtons() {
  // Initialize menu toggle
  initializeMenuToggle();

  // Initialize ABOUT button
  const aboutBtn = document.getElementById("aboutBtn");
  if (aboutBtn) {
    window.core.safeAddEventListener(aboutBtn, "click", showAboutSection);
    console.log("✅ About button initialized");
  }

  // Initialize STATION RULES button
  const rulesBtn = document.getElementById("rulesBtn");
  if (rulesBtn) {
    window.core.safeAddEventListener(rulesBtn, "click", showStationRules);
    console.log("✅ Station rules button initialized");
  }
}

// Show about section
function showAboutSection() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="about-modal">
      <h2>&gt; ABOUT SWAN STATION</h2>
      <div class="about-content">
        <p>Swan Station is a decentralized station management system built on the SHOGUN ECO platform.</p>
        <p>Features:</p>
        <ul>
          <li>Real-time timer synchronization</li>
          <li>Operator challenges and reputation system</li>
          <li>Task management and completion tracking</li>
          <li>Decentralized chat system</li>
          <li>Network statistics and monitoring</li>
        </ul>
        <p>Built with Gun.js for decentralized data storage and real-time synchronization.</p>
      </div>
      <div class="button" onclick="this.parentElement.parentElement.remove()">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// Show station rules
function showStationRules() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="rules-modal">
      <h2>&gt; STATION RULES</h2>
      <div class="rules-content">
        <div class="rules-section">
          <h3>Timer Management</h3>
          <ul>
            <li>Timer must be maintained between 0-108</li>
            <li>Operators can reset timer to 108</li>
            <li>Timer decrements automatically</li>
            <li>First reset gets bonus points</li>
          </ul>
        </div>
        <div class="rules-section">
          <h3>Operator System</h3>
          <ul>
            <li>Operators can challenge each other</li>
            <li>Reputation affects challenge success</li>
            <li>Cooldowns prevent spam</li>
            <li>Points earned through various activities</li>
          </ul>
        </div>
        <div class="rules-section">
          <h3>Task System</h3>
          <ul>
            <li>Complete tasks for points and reputation</li>
            <li>Tasks have time limits</li>
            <li>Failed tasks reduce reputation</li>
            <li>Tasks are randomly generated</li>
          </ul>
        </div>
      </div>
      <div class="button" onclick="this.parentElement.parentElement.remove()">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function toggleMenu() {
  const bigTimer = document.getElementById("bigTimer");
  const prompt = document.querySelector(".prompt");
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  const menuButton = document.getElementById("menuButton");

  if (bigTimer && bigTimer.style.display === "none") {
    // Show timer
    bigTimer.style.display = "block";
    if (prompt) prompt.style.display = "block";
    if (menuToggleBtn) menuToggleBtn.textContent = "[ TIMER ]";
    if (menuButton) menuButton.textContent = "[ MENU ]";
  } else {
    // Hide timer
    if (bigTimer) bigTimer.style.display = "none";
    if (prompt) prompt.style.display = "none";
    if (menuToggleBtn) menuToggleBtn.textContent = "[ MENU ]";
    if (menuButton) menuButton.textContent = "[ TIMER ]";
  }
}

// Audio functions
function typeSound() {
  try {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
    );
    audio.volume = 0.1;
    audio.play().catch(() => {});
    window.core.cleanupRegistry.audioElements.add(audio);
  } catch (error) {
    console.warn("Audio playback failed:", error);
  }
}

function playClickSound() {
  try {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
    );
    audio.volume = 0.2;
    audio.play().catch(() => {});
    window.core.cleanupRegistry.audioElements.add(audio);
  } catch (error) {
    console.warn("Audio playback failed:", error);
  }
}

// Reset sound function
function uiReset() {
  try {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
    );
    audio.volume = 0.6;
    audio.play().catch(() => {});
    window.core.cleanupRegistry.audioElements.add(audio);
  } catch (error) {
    console.warn("Reset sound playback failed:", error);
  }
}

// Timer display functions
function updateTimer(newValue, reason = "") {
  const bigTimer = document.getElementById("bigTimer");
  if (bigTimer) {
    bigTimer.textContent = newValue;
    if (reason) {
      addLog(`Timer updated to ${newValue}: ${reason}`, "timer");
    }
  }
}

function updateInputState(timerValue) {
  const input = document.querySelector(".input");
  if (input) {
    input.value = timerValue;
    input.focus();
  }
}

// Avatar generation
function generateAvatar(pubKey) {
  try {
    if (typeof multiavatar !== "undefined" && pubKey) {
      return multiavatar(pubKey, 100);
    }
    return "👤"; // Fallback
  } catch (error) {
    console.warn("Avatar generation failed:", error);
    return "👤";
  }
}

// Connection status updates
function updateConnectionStatus(status, className) {
  const statusElement = document.getElementById("connectionStatus");
  if (statusElement) {
    statusElement.textContent = status;
    statusElement.className = `connection-status ${className || ""}`;
  }
}

// Export UI functions
window.ui = {
  addLog,
  addMenuButton,
  initializeMenuToggle,
  initializeUIButtons,
  toggleMenu,
  showAboutSection,
  showStationRules,
  typeSound,
  playClickSound,
  uiReset,
  updateTimer,
  updateInputState,
  generateAvatar,
  updateConnectionStatus,
};
