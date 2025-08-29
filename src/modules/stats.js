// Stats module - Statistics, analytics, and data visualization

// Stats state
let stats = {
  resets: 0,
  failures: 0,
  messages: 0,
  timerUpdates: 0,
  userProfiles: 0,
  sessionStart: Date.now()
};

// Levels configuration
const levels = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1350,
  8: 1750,
  9: 2200,
  10: 2700,
  11: 3250,
  12: 3850,
  13: 4500,
  14: 5200,
  15: 5950,
  16: 6750,
  17: 7600,
  18: 8500,
  19: 9450,
  20: 10450,
  21: 11500,
  22: 12600,
  23: 13750,
  24: 14950,
  25: 16200
};

// Update stats UI
function updateStatsUI(newStats) {
  if (newStats) {
    stats = { ...stats, ...newStats };
  }
  
  const currentUser = window.core.user;
  const pointsToNextLevel = currentUser
    ? levels[currentUser.level + 1] - currentUser.points
    : 0;

  const statsContainer = document.getElementById("statsContainer");
  if (!statsContainer) return;

  statsContainer.innerHTML = `
    <div class="stats-bar">
      <div class="operator-stats">
        <span class="level">LEVEL ${currentUser ? currentUser.level : "--"}</span>
        <span class="points">${currentUser ? currentUser.points : "--"} POINTS</span>
        ${
          currentUser && currentUser.level < 25
            ? `<span class="next-level">(${pointsToNextLevel} TO LVL ${currentUser.level + 1})</span>`
            : ""
        }
      </div>
      <div id="challengeCooldownBar" class="challenge-cooldown-bar" style="display: none;">
        <div class="cooldown-progress"></div>
        <div class="cooldown-text">Challenge Cooldown: 300s remaining</div>
      </div>
      <div class="stats-buttons">
        <button id="profileBtn" class="stats-button">[ PROFILE ]</button>
        <button id="globalStatsBtn" class="stats-button">[ GLOBAL STATS ]</button>
        <button id="leaderboardBtn" class="stats-button">[ LEADERBOARD ]</button>
        <button id="historyBtn" class="stats-button">[ HISTORY ]</button>
        <button id="tasksBtn" class="stats-button">[ TASKS ]</button>
        <button id="chatBtn" class="stats-button">[ CHAT ]</button>
        <button id="networkBtn" class="stats-button">[ NETWORK ]</button>
        <button id="mapBtn" class="stats-button">[ MAP ]</button>
        <button id="activeOperatorsBtn" class="stats-button">[ ACTIVE OPERATORS ]</button>
        <button id="challengeEventsBtn" class="stats-button">[ CHALLENGES ]</button>
        <button id="calibrationBtn" class="stats-button">[ CALIBRATION ]</button>
      </div>
    </div>
  `;

  // Add click handlers for all buttons
  setupStatsButtonHandlers();

  // Debug: Check if all buttons were found (only log once)
  if (!window.buttonsInitialized) {
    console.log("Button elements found:", {
      profileBtn: !!document.getElementById("profileBtn"),
      globalStatsBtn: !!document.getElementById("globalStatsBtn"),
      leaderboardBtn: !!document.getElementById("leaderboardBtn"),
      historyBtn: !!document.getElementById("historyBtn"),
      tasksBtn: !!document.getElementById("tasksBtn"),
      chatBtn: !!document.getElementById("chatBtn"),
      networkBtn: !!document.getElementById("networkBtn"),
      mapBtn: !!document.getElementById("mapBtn"),
      activeOperatorsBtn: !!document.getElementById("activeOperatorsBtn"),
    });

    window.buttonsInitialized = true;
  }
}

// Setup stats button handlers
function setupStatsButtonHandlers() {
  const buttons = {
    profileBtn: window.auth?.showProfile,
    globalStatsBtn: showGlobalStats,
    leaderboardBtn: window.operators?.showLeaderboard,
    historyBtn: window.operators?.showHistory,
    tasksBtn: window.tasks?.showTaskSystem,
    chatBtn: window.chat?.showChat,
    networkBtn: showNetworkAnalytics,
    mapBtn: window.operators?.showOperatorsMap,
    activeOperatorsBtn: window.operators?.showActiveOperators,
    challengeEventsBtn: window.challenges?.showChallengeEvents,
    calibrationBtn: window.calibration?.showCalibrationGame
  };

  Object.entries(buttons).forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (button && handler) {
      window.core.safeAddEventListener(button, "click", handler);
    }
  });
}

// Show global statistics
function showGlobalStats() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="global-stats-modal">
      <h2>&gt; GLOBAL STATISTICS</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">GLOBAL RESETS</div>
          <div class="stat-value">${stats.resets}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">SYSTEM FAILURES</div>
          <div class="stat-value">${stats.failures}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">MESSAGES STORED</div>
          <div class="stat-value">${stats.messages}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">TIMER UPDATES</div>
          <div class="stat-value">${stats.timerUpdates}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">USER PROFILES</div>
          <div class="stat-value">${stats.userProfiles}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">SESSION DURATION</div>
          <div class="stat-value">${getSessionDuration()}</div>
        </div>
      </div>
      <div class="button" id="closeStats">CLOSE</div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const closeBtn = overlay.querySelector("#closeStats");
  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
}

// Show network analytics
function showNetworkAnalytics() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="network-analytics-modal">
      <h2>&gt; DECENTRALIZED NETWORK ANALYTICS</h2>
      
      <div class="network-section">
        <h3>GUNDB RELAYS</h3>
        <div class="relay-management">
          <div class="relay-list" id="relayList">
            <div class="relay-item">
              <div class="relay-status connected"></div>
              <div class="relay-url">https://relay.shogun-eco.xyz/gun</div>
              <div class="relay-actions">
                <button class="relay-remove-btn" data-url="https://relay.shogun-eco.xyz/gun">REMOVE</button>
              </div>
            </div>
            <div class="relay-item">
              <div class="relay-status connected"></div>
              <div class="relay-url">https://peer.wallie.io/gun</div>
              <div class="relay-actions">
                <button class="relay-remove-btn" data-url="https://peer.wallie.io/gun">REMOVE</button>
              </div>
            </div>
            <div class="relay-item">
              <div class="relay-status connected"></div>
              <div class="relay-url">https://gun-manhattan.herokuapp.com/gun</div>
              <div class="relay-actions">
                <button class="relay-remove-btn" data-url="https://gun-manhattan.herokuapp.com/gun">REMOVE</button>
              </div>
            </div>
          </div>
          <div class="add-relay-section">
            <input type="text" id="newRelayUrl" placeholder="https://your-relay.com/gun" class="relay-input">
            <button id="addRelayBtn" class="terminal-button">ADD RELAY</button>
          </div>
        </div>
      </div>
      
      <div class="network-section">
        <h3>PEER CONNECTIONS</h3>
        <div class="network-grid">
          <div class="network-item">
            <div class="network-label">ACTIVE PEERS</div>
            <div class="network-value" id="activePeers">Loading...</div>
          </div>
          <div class="network-item">
            <div class="network-label">TOTAL PEERS</div>
            <div class="network-value" id="totalPeers">Loading...</div>
          </div>
        </div>
      </div>
      
      <div class="network-section">
        <h3>STORAGE CONTRIBUTION</h3>
        <div class="network-grid">
          <div class="network-item">
            <div class="network-label">YOUR CONTRIBUTION</div>
            <div class="network-value" id="userContribution">Loading...</div>
          </div>
          <div class="network-item">
            <div class="network-label">NETWORK TOTAL</div>
            <div class="network-value" id="networkTotal">Loading...</div>
          </div>
        </div>
      </div>
      
      <div class="network-section">
        <h3>DATA HEALTH</h3>
        <div class="network-grid">
          <div class="network-item">
            <div class="network-label">SYNC STATUS</div>
            <div class="network-value" id="syncStatus">Loading...</div>
          </div>
          <div class="network-item">
            <div class="network-label">REDUNDANCY</div>
            <div class="network-value" id="redundancy">Loading...</div>
          </div>
        </div>
      </div>
      
      <div class="network-section">
        <h3>REAL-TIME METRICS</h3>
        <div class="network-metrics">
          <div class="metric-item">
            <span class="metric-label">Messages Stored:</span>
            <span class="metric-value" id="messagesStored">${stats.messages}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Timer Updates:</span>
            <span class="metric-value" id="timerUpdates">${stats.timerUpdates}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">User Profiles:</span>
            <span class="metric-value" id="userProfiles">${stats.userProfiles}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Session Duration:</span>
            <span class="metric-value" id="sessionDuration">${getSessionDuration()}</span>
          </div>
        </div>
      </div>
      
      <div class="button" id="closeNetwork">CLOSE</div>
    </div>
  `;
  
  document.body.appendChild(overlay);

  // Initialize network metrics
  initializeNetworkMetrics();

  // Initialize relay management
  initializeRelayManagement();

  const closeBtn = overlay.querySelector("#closeNetwork");
  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
}

// Initialize network metrics
function initializeNetworkMetrics() {
  // Update network metrics every 5 seconds
  const updateMetrics = () => {
    const activePeers = document.getElementById("activePeers");
    const totalPeers = document.getElementById("totalPeers");
    const userContribution = document.getElementById("userContribution");
    const networkTotal = document.getElementById("networkTotal");
    const syncStatus = document.getElementById("syncStatus");
    const redundancy = document.getElementById("redundancy");

    if (activePeers) activePeers.textContent = Math.floor(Math.random() * 50) + 10;
    if (totalPeers) totalPeers.textContent = Math.floor(Math.random() * 200) + 50;
    if (userContribution) userContribution.textContent = `${Math.floor(Math.random() * 1000) + 100} MB`;
    if (networkTotal) networkTotal.textContent = `${Math.floor(Math.random() * 10000) + 1000} MB`;
    if (syncStatus) syncStatus.textContent = "SYNCED";
    if (redundancy) redundancy.textContent = `${Math.floor(Math.random() * 5) + 3}x`;
  };

  updateMetrics();
  window.core.safeSetInterval(updateMetrics, 5000);
}

// Initialize relay management
function initializeRelayManagement() {
  const addRelayBtn = document.getElementById("addRelayBtn");
  const newRelayUrl = document.getElementById("newRelayUrl");

  if (addRelayBtn && newRelayUrl) {
    window.core.safeAddEventListener(addRelayBtn, "click", () => {
      const url = newRelayUrl.value.trim();
      if (url) {
        addRelay(url);
        newRelayUrl.value = "";
      }
    });

    window.core.safeAddEventListener(newRelayUrl, "keypress", (e) => {
      if (e.key === "Enter") {
        const url = newRelayUrl.value.trim();
        if (url) {
          addRelay(url);
          newRelayUrl.value = "";
        }
      }
    });
  }

  // Setup relay remove buttons
  const removeButtons = document.querySelectorAll(".relay-remove-btn");
  removeButtons.forEach(btn => {
    window.core.safeAddEventListener(btn, "click", () => {
      const url = btn.getAttribute("data-url");
      removeRelay(url);
    });
  });
}

// Add relay
function addRelay(url) {
  window.ui.addLog(`Adding relay: ${url}`, "info");
  // Implementation for adding relay
}

// Remove relay
function removeRelay(url) {
  window.ui.addLog(`Removing relay: ${url}`, "info");
  // Implementation for removing relay
}

// Get session duration
function getSessionDuration() {
  const duration = Date.now() - stats.sessionStart;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// Update specific stats
function updateStat(key, value) {
  stats[key] = value;
  window.ui.addLog(`Stat updated: ${key} = ${value}`, "info");
}

// Increment specific stats
function incrementStat(key, amount = 1) {
  stats[key] = (stats[key] || 0) + amount;
}

// Get current stats
function getStats() {
  return { ...stats };
}

// Reset stats
function resetStats() {
  stats = {
    resets: 0,
    failures: 0,
    messages: 0,
    timerUpdates: 0,
    userProfiles: 0,
    sessionStart: Date.now()
  };
  window.ui.addLog("Statistics reset", "info");
}

// Calculate advanced stats
function calculateAdvancedStats() {
  const currentUser = window.core.user;
  if (!currentUser) return null;

  return {
    level: currentUser.level,
    points: currentUser.points,
    pointsToNextLevel: levels[currentUser.level + 1] - currentUser.points,
    progress: ((currentUser.points - levels[currentUser.level]) / (levels[currentUser.level + 1] - levels[currentUser.level])) * 100,
    sessionDuration: getSessionDuration(),
    totalStats: stats
  };
}

// Export stats functions
window.stats = {
  updateStatsUI,
  setupStatsButtonHandlers,
  showGlobalStats,
  showNetworkAnalytics,
  initializeNetworkMetrics,
  initializeRelayManagement,
  addRelay,
  removeRelay,
  getSessionDuration,
  updateStat,
  incrementStat,
  getStats,
  resetStats,
  calculateAdvancedStats,
  levels
};
