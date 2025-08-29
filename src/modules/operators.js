// Operators module - Operator management, leaderboard, history, and map functionality

// Operators state
let operators = [];
let activeOperators = [];
let operatorCooldowns = new Map();
let operatorsSortOrder = "name"; // 'name' or 'lastSeen'

// Show history overlay
function showHistory() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="history-view">
      <h2>&gt; SWAN STATION HISTORY</h2>
      <div class="history-content">Loading...</div>
      <div class="button" id="closeHistory">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const historyContent = overlay.querySelector(".history-content");
  const closeBtn = overlay.querySelector("#closeHistory");

  const historyItems = [];
  if (window.core.historyRef) {
    window.core.historyRef.map().once((data, id) => {
      if (data && data.timestamp) {
        historyItems.push(data);
      }
    });
  }

  // GunDB is asynchronous. We wait a moment for all data to arrive before sorting.
  setTimeout(() => {
    // Sort by timestamp, newest first
    historyItems.sort((a, b) => b.timestamp - a.timestamp);

    historyContent.innerHTML = ""; // Clear loading message

    if (historyItems.length === 0) {
      historyContent.textContent = "No history recorded.";
    } else {
      historyItems.forEach((data) => {
        if (data) {
          const entry = document.createElement("div");
          entry.className = "history-entry";
          const date = new Date(data.timestamp).toLocaleString();
          const operator = data.operator || "UNKNOWN";
          const action = data.action || "No action recorded";
          entry.textContent = `[${date}] ${operator}: ${action}`;
          historyContent.appendChild(entry);
        }
      });
    }
  }, 750); // Wait for data to be fetched

  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
}

// Register operator
function registerOperator(name) {
  if (!window.core.user || !window.core.operatorsRef) return;

  // Register operator in the active operators list
  const operatorData = {
    name: name,
    pub: window.core.user.pub,
    lastSeen: Date.now(),
  };
  window.core.operatorsRef.get(window.core.user.pub).put(operatorData);
  window.ui.addLog(`Operator ${name} registered`, "info");

  // Update operator status periodically
  window.core.safeSetInterval(() => {
    window.core.operatorsRef.get(window.core.user.pub).put({
      name: name,
      pub: window.core.user.pub,
      lastSeen: Date.now(),
    });
  }, 10000); // Update every 10 seconds
}

// Show leaderboard
function showLeaderboard() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="leaderboard-view">
      <h2>> TOP OPERATORS</h2>
      <div class="history-content">
        <div class="leaderboard-entry" style="border-bottom: 2px solid #00ff00;">
          <div class="rank">RANK</div>
          <div class="name">OPERATOR</div>
          <div class="level">LEVEL</div>
          <div class="points">POINTS</div>
        </div>
        <div id="leaderboardContent">Loading...</div>
      </div>
      <div class="button" id="closeLeaderboard">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const leaderboardContent = overlay.querySelector("#leaderboardContent");
  const closeBtn = overlay.querySelector("#closeLeaderboard");

  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }

  const leaderboard = [];
  // Read from the new public leaderboard node
  if (window.core.gun) {
    window.core.gun
      .get("leaderboard")
      .map()
      .once((playerProfile, playerAlias) => {
        if (playerProfile && playerProfile.points > 0) {
          leaderboard.push({
            alias: playerAlias,
            points: playerProfile.points,
            level: playerProfile.level,
          });
        }
      });
  }

  // Wait for the asynchronous data to arrive
  setTimeout(() => {
    leaderboard.sort((a, b) => b.points - a.points);
    if (leaderboardContent) {
      leaderboardContent.innerHTML = "";

      if (leaderboard.length === 0) {
        leaderboardContent.innerHTML =
          '<div class="history-entry">No operator data found. Be the first!</div>';
        return;
      }

      // Display top 20 players
      leaderboard.slice(0, 20).forEach((player, index) => {
        const entry = document.createElement("div");
        entry.className = "leaderboard-entry";
        entry.innerHTML = `
          <div class="rank">${index + 1}</div>
          <div class="name">${player.alias}</div>
          <div class="level">LVL ${player.level || 1}</div>
          <div class="points">${player.points} PTS</div>
        `;
        leaderboardContent.appendChild(entry);
      });
    }
  }, 1000); // Shorter timeout is more reliable now
}

// Show operators map
function showOperatorsMap() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="operators-map-view">
      <h2>&gt; OPERATORS MAP</h2>
      <div class="map-container">
        <div id="operatorsMap" class="operators-map">Loading map...</div>
        <div class="map-controls">
          <button id="refreshMap" class="map-button">[ REFRESH ]</button>
          <button id="toggleMapView" class="map-button">[ TOGGLE VIEW ]</button>
        </div>
      </div>
      <div class="operators-list" id="operatorsList">
        <h3>ACTIVE OPERATORS</h3>
        <div class="operators-grid" id="operatorsGrid">Loading...</div>
      </div>
      <div class="button" id="closeMap">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Initialize map
  initializeOperatorsMap();

  // Setup event listeners
  const closeBtn = overlay.querySelector("#closeMap");
  const refreshBtn = overlay.querySelector("#refreshMap");
  const toggleBtn = overlay.querySelector("#toggleMapView");

  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
  if (refreshBtn) {
    window.core.safeAddEventListener(refreshBtn, "click", () => {
      loadOperatorsData();
    });
  }
  if (toggleBtn) {
    window.core.safeAddEventListener(toggleBtn, "click", () => {
      toggleMapView();
    });
  }
}

// Initialize operators map
function initializeOperatorsMap() {
  const mapContainer = document.getElementById("operatorsMap");
  if (!mapContainer) return;

  // Create a simple map visualization
  mapContainer.innerHTML = `
    <div class="map-grid">
      <div class="map-header">OPERATORS NETWORK</div>
      <div class="map-content" id="mapContent">
        <div class="map-node center-node">SWAN STATION</div>
      </div>
    </div>
  `;

  // Load operators data
  loadOperatorsData();
}

// Load operators data
function loadOperatorsData() {
  if (!window.core.operatorsRef) return;

  const operatorsData = [];
  window.core.operatorsRef.map().once((operator, pub) => {
    if (operator && operator.name) {
      operatorsData.push({
        ...operator,
        pub: pub,
      });
    }
  });

  setTimeout(() => {
    operators = operatorsData;
    updateMapWithOperators(operators);
    updateOperatorsList(operators);
  }, 1000);
}

// Update map with operators
function updateMapWithOperators(operators) {
  const mapContent = document.getElementById("mapContent");
  if (!mapContent) return;

  // Clear existing nodes (except center)
  const centerNode = mapContent.querySelector(".center-node");
  mapContent.innerHTML = "";
  if (centerNode) {
    mapContent.appendChild(centerNode);
  }

  // Add operator nodes
  operators.forEach((operator, index) => {
    const node = createOperatorMarker(operator, index);
    mapContent.appendChild(node);
  });
}

// Create operator marker
function createOperatorMarker(operator, index) {
  const node = document.createElement("div");
  node.className = "map-node operator-node";
  node.innerHTML = `
    <div class="node-info">
      <div class="node-name">${operator.name}</div>
      <div class="node-status">${getOperatorStatus(operator)}</div>
    </div>
  `;

  // Position nodes in a circle around center
  const angle = (index / operators.length) * 2 * Math.PI;
  const radius = 150;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;

  node.style.left = `calc(50% + ${x}px)`;
  node.style.top = `calc(50% + ${y}px)`;

  // Add click handler
  window.core.safeAddEventListener(node, "click", () => {
    showOperatorInfo(operator);
  });

  return node;
}

// Get operator status
function getOperatorStatus(operator) {
  const now = Date.now();
  const lastSeen = operator.lastSeen || 0;
  const timeDiff = now - lastSeen;

  if (timeDiff < 60000) return "ONLINE";
  if (timeDiff < 300000) return "RECENT";
  return "OFFLINE";
}

// Update operators list
function updateOperatorsList(operators) {
  const operatorsGrid = document.getElementById("operatorsGrid");
  if (!operatorsGrid) return;

  operatorsGrid.innerHTML = "";

  if (operators.length === 0) {
    operatorsGrid.innerHTML =
      '<div class="no-operators">No operators found</div>';
    return;
  }

  // Sort operators
  const sortedOperators = [...operators].sort((a, b) => {
    if (operatorsSortOrder === "name") {
      return a.name.localeCompare(b.name);
    } else {
      return (b.lastSeen || 0) - (a.lastSeen || 0);
    }
  });

  sortedOperators.forEach((operator) => {
    const operatorCard = document.createElement("div");
    operatorCard.className = "operator-card";
    operatorCard.innerHTML = `
      <div class="operator-name">${operator.name}</div>
      <div class="operator-status ${getOperatorStatus(
        operator
      ).toLowerCase()}">${getOperatorStatus(operator)}</div>
      <div class="operator-last-seen">${formatLastSeen(operator.lastSeen)}</div>
    `;

    window.core.safeAddEventListener(operatorCard, "click", () => {
      showOperatorInfo(operator);
    });

    operatorsGrid.appendChild(operatorCard);
  });
}

// Show active operators
function showActiveOperators() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="active-operators-view">
      <h2>&gt; ACTIVE OPERATORS</h2>
      <div class="operators-controls">
        <button id="filterOnline" class="filter-button active">ONLINE</button>
        <button id="filterRecent" class="filter-button">RECENT</button>
        <button id="filterAll" class="filter-button">ALL</button>
        <button id="sortOperators" class="sort-button">SORT: NAME</button>
      </div>
      <div class="operators-list" id="activeOperatorsList">Loading...</div>
      <div class="button" id="closeActiveOperators">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Initialize active operators list
  initializeActiveOperatorsList();

  // Setup event listeners
  const closeBtn = overlay.querySelector("#closeActiveOperators");
  const filterOnline = overlay.querySelector("#filterOnline");
  const filterRecent = overlay.querySelector("#filterRecent");
  const filterAll = overlay.querySelector("#filterAll");
  const sortBtn = overlay.querySelector("#sortOperators");

  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
  if (filterOnline) {
    window.core.safeAddEventListener(filterOnline, "click", () =>
      filterOperators("online")
    );
  }
  if (filterRecent) {
    window.core.safeAddEventListener(filterRecent, "click", () =>
      filterOperators("recent")
    );
  }
  if (filterAll) {
    window.core.safeAddEventListener(filterAll, "click", () =>
      filterOperators("all")
    );
  }
  if (sortBtn) {
    window.core.safeAddEventListener(sortBtn, "click", () =>
      toggleOperatorSort()
    );
  }
}

// Initialize active operators list
function initializeActiveOperatorsList() {
  const operatorsList = document.getElementById("activeOperatorsList");
  if (!operatorsList) return;

  // Load operators from GunDB
  if (window.core.operatorsRef) {
    window.core.operatorsRef.map().once((operator, pub) => {
      if (operator && operator.name) {
        activeOperators.push({
          ...operator,
          pub: pub,
        });
      }
    });

    setTimeout(() => {
      updateActiveOperatorsList(activeOperators);
    }, 1000);
  }
}

// Update active operators list
function updateActiveOperatorsList(operators) {
  const operatorsList = document.getElementById("activeOperatorsList");
  if (!operatorsList) return;

  operatorsList.innerHTML = "";

  if (operators.length === 0) {
    operatorsList.innerHTML =
      '<div class="no-operators">No active operators</div>';
    return;
  }

  operators.forEach((operator) => {
    const operatorItem = document.createElement("div");
    operatorItem.className = "operator-item";
    operatorItem.innerHTML = `
      <div class="operator-info">
        <div class="operator-name">${operator.name}</div>
        <div class="operator-status ${getOperatorStatus(
          operator
        ).toLowerCase()}">${getOperatorStatus(operator)}</div>
      </div>
      <div class="operator-details">
        <div class="operator-last-seen">Last seen: ${formatLastSeen(
          operator.lastSeen
        )}</div>
        <button class="operator-challenge-btn" data-pub="${
          operator.pub
        }">CHALLENGE</button>
      </div>
    `;

    // Add challenge button handler
    const challengeBtn = operatorItem.querySelector(".operator-challenge-btn");
    if (challengeBtn) {
      window.core.safeAddEventListener(challengeBtn, "click", () => {
        const targetPub = challengeBtn.getAttribute("data-pub");
        if (targetPub && window.challenges) {
          window.challenges.initiateChallenge(targetPub, "standard");
        }
      });
    }

    operatorsList.appendChild(operatorItem);
  });
}

// Filter operators
function filterOperators(filter) {
  let filteredOperators = [...activeOperators];
  const now = Date.now();

  switch (filter) {
    case "online":
      filteredOperators = activeOperators.filter(
        (op) => now - (op.lastSeen || 0) < 60000
      );
      break;
    case "recent":
      filteredOperators = activeOperators.filter(
        (op) => now - (op.lastSeen || 0) < 300000
      );
      break;
    case "all":
    default:
      // No filtering
      break;
  }

  updateActiveOperatorsList(filteredOperators);
}

// Toggle operator sort
function toggleOperatorSort() {
  operatorsSortOrder = operatorsSortOrder === "name" ? "lastSeen" : "name";
  const sortBtn = document.getElementById("sortOperators");
  if (sortBtn) {
    sortBtn.textContent = `SORT: ${operatorsSortOrder.toUpperCase()}`;
  }
  updateOperatorsList(operators);
}

// Show operator info
function showOperatorInfo(operator) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="operator-info-modal">
      <h2>&gt; OPERATOR INFO</h2>
      <div class="operator-details">
        <div class="detail-item">
          <span class="label">NAME:</span>
          <span class="value">${operator.name}</span>
        </div>
        <div class="detail-item">
          <span class="label">STATUS:</span>
          <span class="value ${getOperatorStatus(
            operator
          ).toLowerCase()}">${getOperatorStatus(operator)}</span>
        </div>
        <div class="detail-item">
          <span class="label">LAST SEEN:</span>
          <span class="value">${formatLastSeen(operator.lastSeen)}</span>
        </div>
        <div class="detail-item">
          <span class="label">PUBLIC KEY:</span>
          <span class="value">${
            operator.pub ? operator.pub.substring(0, 20) + "..." : "Unknown"
          }</span>
        </div>
      </div>
      <div class="operator-actions">
        <button id="challengeOperator" class="action-button">[ CHALLENGE ]</button>
        <button id="closeOperatorInfo" class="action-button">[ CLOSE ]</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Setup event listeners
  const challengeBtn = overlay.querySelector("#challengeOperator");
  const closeBtn = overlay.querySelector("#closeOperatorInfo");

  if (challengeBtn) {
    window.core.safeAddEventListener(challengeBtn, "click", () => {
      if (operator.pub && window.challenges) {
        window.challenges.initiateChallenge(operator.pub, "standard");
      }
      overlay.remove();
    });
  }
  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
}

// Format last seen timestamp
function formatLastSeen(timestamp) {
  if (!timestamp) return "Never";

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Toggle map view
function toggleMapView() {
  const mapContainer = document.getElementById("operatorsMap");
  if (mapContainer) {
    mapContainer.classList.toggle("map-view-2d");
  }
}

// Set operator cooldown
function setOperatorCooldown(operatorPub, duration) {
  operatorCooldowns.set(operatorPub, {
    startTime: Date.now(),
    duration: duration,
  });
}

// Check if operator is on cooldown
function isOperatorOnCooldown(operatorPub) {
  const cooldown = operatorCooldowns.get(operatorPub);
  if (!cooldown) return false;

  const now = Date.now();
  const elapsed = now - cooldown.startTime;

  if (elapsed >= cooldown.duration) {
    operatorCooldowns.delete(operatorPub);
    return false;
  }

  return true;
}

// Get cooldown remaining time
function getCooldownRemaining(operatorPub) {
  const cooldown = operatorCooldowns.get(operatorPub);
  if (!cooldown) return 0;

  const now = Date.now();
  const elapsed = now - cooldown.startTime;
  const remaining = cooldown.duration - elapsed;

  return Math.max(0, remaining);
}

// Export operators functions
window.operators = {
  showHistory,
  registerOperator,
  showLeaderboard,
  showOperatorsMap,
  showActiveOperators,
  initializeOperatorsMap,
  updateMapWithOperators,
  createOperatorMarker,
  updateOperatorsList,
  initializeActiveOperatorsList,
  updateActiveOperatorsList,
  filterOperators,
  toggleOperatorSort,
  showOperatorInfo,
  formatLastSeen,
  toggleMapView,
  setOperatorCooldown,
  isOperatorOnCooldown,
  getCooldownRemaining,
  getOperatorStatus,
};
