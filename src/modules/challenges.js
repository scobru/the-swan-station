// Challenges module - Challenge system, events, and competition functionality
(function() {
  'use strict';

  // Challenge system state
  let challengeCooldownActive = false;
  let challengeCooldownEndTime = 0;
  let pendingChallenge = null;
  let challengeEvents = [];
  let challengeHistory = [];

  // Challenge types configuration
  const challengeTypes = {
    standard: {
      name: "Standard Challenge",
      reputationCost: 1,
      pointsReward: 10,
      description: "A standard operator challenge"
    },
    advanced: {
      name: "Advanced Challenge", 
      reputationCost: 3,
      pointsReward: 25,
      description: "An advanced operator challenge"
    },
    elite: {
      name: "Elite Challenge",
      reputationCost: 5,
      pointsReward: 50,
      description: "An elite operator challenge"
    }
  };

  // Reputation rules
  const reputationRules = {
    startingReputation: 10,
    maxReputation: 100,
    reputationGain: 2,
    reputationLoss: 1
  };

  // Initiate challenge
  function initiateChallenge(targetPub, challengeType = "standard") {
    const currentUser = window.core.user;
    if (!currentUser) {
      window.ui.addLog("ERROR: Must be logged in to initiate challenges", "error");
      return;
    }

    // Check if we have enough points
    if (currentUser.points < 5) {
      window.ui.addLog("ERROR: Need at least 5 points to initiate a challenge", "error");
      return;
    }

    // Check if user has enough reputation
    const requiredReputation = challengeTypes[challengeType].reputationCost;
    const currentReputation = currentUser.reputation || reputationRules.startingReputation;

    if (currentReputation < requiredReputation) {
      window.ui.addLog(
        `ERROR: Need at least ${requiredReputation} reputation to initiate a ${challengeType}`,
        "error"
      );
      return;
    }

    // Check challenge cooldown
    if (challengeCooldownActive) {
      const remaining = Math.ceil((challengeCooldownEndTime - Date.now()) / 1000);
      window.ui.addLog(
        `ERROR: Challenge cooldown active. Wait ${remaining}s before next challenge.`,
        "error"
      );
      return;
    }

    // Check if there's already a pending challenge
    if (pendingChallenge) {
      window.ui.addLog(
        `ERROR: Challenge already in progress. Complete the current challenge first.`,
        "error"
      );
      return;
    }

    // Check cooldown
    if (window.operators && window.operators.isOperatorOnCooldown(targetPub)) {
      window.ui.addLog("ERROR: Target operator is on cooldown", "error");
      return;
    }

    // Get target operator info
    let targetOperator = null;
    
    // Try to get from operators module
    if (window.operators) {
      window.operators.getActiveOperators().then(operators => {
        targetOperator = operators.find(op => op.pub === targetPub);
        continueWithChallenge(targetOperator, challengeType);
      });
    } else {
      // Fallback: create basic operator info
      targetOperator = {
        pub: targetPub,
        name: "Unknown Operator",
        level: 1,
        isOnline: false,
        lastSeen: Date.now()
      };
      continueWithChallenge(targetOperator, challengeType);
    }
  }

  // Continue with challenge
  function continueWithChallenge(targetOperator, challengeType) {
    if (!targetOperator) {
      window.ui.addLog("ERROR: Target operator not found", "error");
      return;
    }

    const currentUser = window.core.user;
    
    // Check if target is offline and inform user
    if (targetOperator && !targetOperator.isOnline) {
      window.ui.addLog(
        `INFO: Challenging offline operator ${targetOperator.name} - easier target!`,
        "info"
      );
    }

    // Create challenge object
    const challenge = {
      id: crypto.randomUUID(),
      initiator: currentUser.alias,
      target: targetOperator.name,
      targetPub: targetOperator.pub,
      type: challengeType,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 300000, // 5 minutes
      result: null
    };

    // Set as pending challenge
    pendingChallenge = challenge;

    // Show challenge interface
    showChallengeInterface(challenge);
  }

  // Show challenge interface
  function showChallengeInterface(challenge) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="challenge-modal">
        <h2>&gt; OPERATOR CHALLENGE</h2>
        
        <div class="challenge-info">
          <div class="challenge-details">
            <div class="detail-item">
              <span class="label">CHALLENGER:</span>
              <span class="value">${challenge.initiator}</span>
            </div>
            <div class="detail-item">
              <span class="label">TARGET:</span>
              <span class="value">${challenge.target}</span>
            </div>
            <div class="detail-item">
              <span class="label">TYPE:</span>
              <span class="value">${challengeTypes[challenge.type].name}</span>
            </div>
            <div class="detail-item">
              <span class="label">REWARD:</span>
              <span class="value">${challengeTypes[challenge.type].pointsReward} POINTS</span>
            </div>
          </div>
          
          <div class="challenge-description">
            ${challengeTypes[challenge.type].description}
          </div>
        </div>
        
        <div class="challenge-actions">
          <button id="executeChallengeBtn" class="challenge-btn">EXECUTE CHALLENGE</button>
          <button id="cancelChallengeBtn" class="challenge-btn">CANCEL</button>
        </div>
        
        <div class="challenge-timer" id="challengeTimer">
          Time remaining: 5:00
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Setup event listeners
    const executeBtn = overlay.querySelector("#executeChallengeBtn");
    const cancelBtn = overlay.querySelector("#cancelChallengeBtn");

    if (executeBtn) {
      window.core.safeAddEventListener(executeBtn, "click", () => {
        executeChallenge(challenge);
      });
    }

    if (cancelBtn) {
      window.core.safeAddEventListener(cancelBtn, "click", () => {
        cancelChallenge();
        overlay.remove();
      });
    }

    // Start challenge timer
    startChallengeTimer(challenge, overlay);
  }

  // Execute challenge
  function executeChallenge(challenge) {
    const currentUser = window.core.user;
    if (!currentUser) return;

    // Calculate challenge success
    const success = calculateChallengeSuccess(challenge);
    
    // Update challenge result
    challenge.result = success ? "victory" : "defeat";
    challenge.completedAt = Date.now();
    challenge.status = "completed";

    // Apply results
    if (success) {
      // Award points
      const pointsReward = challengeTypes[challenge.type].pointsReward;
      currentUser.points = (currentUser.points || 0) + pointsReward;
      
      // Update reputation
      currentUser.reputation = Math.min(
        (currentUser.reputation || reputationRules.startingReputation) + reputationRules.reputationGain,
        reputationRules.maxReputation
      );

      // Update GunDB
      if (window.core.gun) {
        window.core.gun.user().get('points').put(currentUser.points);
        window.core.gun.user().get('reputation').put(currentUser.reputation);
      }

      window.ui.addLog(`Challenge victory! +${pointsReward} points, +${reputationRules.reputationGain} reputation`, "success");
    } else {
      // Lose reputation
      currentUser.reputation = Math.max(
        (currentUser.reputation || reputationRules.startingReputation) - reputationRules.reputationLoss,
        0
      );

      // Update GunDB
      if (window.core.gun) {
        window.core.gun.user().get('reputation').put(currentUser.reputation);
      }

      window.ui.addLog(`Challenge defeat! -${reputationRules.reputationLoss} reputation`, "error");
    }

    // Add to history
    challengeHistory.push(challenge);

    // Show result
    showChallengeResult(challenge);

    // Clear pending challenge
    pendingChallenge = null;

    // Start cooldown
    startChallengeCooldown();
  }

  // Calculate challenge success
  function calculateChallengeSuccess(challenge) {
    const currentUser = window.core.user;
    if (!currentUser) return false;

    // Base success rate based on challenge type
    let baseSuccessRate = 0.5; // 50% for standard
    
    switch (challenge.type) {
      case "advanced":
        baseSuccessRate = 0.4; // 40% for advanced
        break;
      case "elite":
        baseSuccessRate = 0.3; // 30% for elite
        break;
    }

    // Factor in user level vs target level
    const userLevel = currentUser.level || 1;
    const targetLevel = 1; // Default target level
    
    const levelFactor = Math.max(0.1, Math.min(2.0, userLevel / targetLevel));
    
    // Factor in reputation
    const reputation = currentUser.reputation || reputationRules.startingReputation;
    const reputationFactor = Math.max(0.5, Math.min(1.5, reputation / reputationRules.maxReputation));
    
    // Random factor
    const randomFactor = Math.random();
    
    // Calculate final success rate
    const successRate = baseSuccessRate * levelFactor * reputationFactor;
    
    return randomFactor < successRate;
  }

  // Show challenge result
  function showChallengeResult(challenge) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="challenge-result-modal">
        <h2>&gt; CHALLENGE RESULT</h2>
        
        <div class="result-content">
          <div class="result-header ${challenge.result}">
            ${challenge.result === "victory" ? "VICTORY!" : "DEFEAT!"}
          </div>
          
          <div class="result-details">
            <div class="detail-item">
              <span class="label">CHALLENGER:</span>
              <span class="value">${challenge.initiator}</span>
            </div>
            <div class="detail-item">
              <span class="label">TARGET:</span>
              <span class="value">${challenge.target}</span>
            </div>
            <div class="detail-item">
              <span class="label">TYPE:</span>
              <span class="value">${challengeTypes[challenge.type].name}</span>
            </div>
            <div class="detail-item">
              <span class="label">RESULT:</span>
              <span class="value ${challenge.result}">${challenge.result.toUpperCase()}</span>
            </div>
            ${challenge.result === "victory" ? 
              `<div class="detail-item">
                <span class="label">REWARD:</span>
                <span class="value">+${challengeTypes[challenge.type].pointsReward} POINTS</span>
              </div>` : ""
            }
          </div>
        </div>
        
        <div class="button" id="closeResult">CONTINUE</div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Add event listener
    const closeBtn = overlay.querySelector("#closeResult");
    if (closeBtn) {
      window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
    }

    // Auto-close after 5 seconds
    window.core.safeSetTimeout(() => {
      if (overlay.parentElement) {
        overlay.remove();
      }
    }, 5000);
  }

  // Cancel challenge
  function cancelChallenge() {
    pendingChallenge = null;
    window.ui.addLog("Challenge cancelled", "info");
  }

  // Start challenge timer
  function startChallengeTimer(challenge, overlay) {
    const timerElement = overlay.querySelector("#challengeTimer");
    if (!timerElement) return;

    const updateTimer = () => {
      const remaining = Math.max(0, challenge.expiresAt - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      
      timerElement.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      if (remaining <= 0) {
        // Challenge expired
        cancelChallenge();
        overlay.remove();
        window.ui.addLog("Challenge expired", "warning");
      }
    };

    updateTimer();
    const timerInterval = window.core.safeSetInterval(updateTimer, 1000);
    
    // Store interval for cleanup
    if (overlay) {
      overlay.challengeTimer = timerInterval;
    }
  }

  // Show challenge events
  function showChallengeEvents() {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="challenge-events-modal">
        <h2>&gt; CHALLENGE EVENTS</h2>
        
        <div class="challenge-tabs">
          <button class="tab-btn active" data-tab="recent">RECENT EVENTS</button>
          <button class="tab-btn" data-tab="history">CHALLENGE HISTORY</button>
          <button class="tab-btn" data-tab="stats">CHALLENGE STATS</button>
        </div>
        
        <div class="challenge-content">
          <div id="recentEvents" class="tab-content active">
            <div class="events-list" id="recentEventsList">
              Loading recent events...
            </div>
          </div>
          
          <div id="challengeHistory" class="tab-content">
            <div class="events-list" id="challengeHistoryList">
              Loading challenge history...
            </div>
          </div>
          
          <div id="challengeStats" class="tab-content">
            <div class="stats-grid" id="challengeStatsGrid">
              Loading challenge statistics...
            </div>
          </div>
        </div>
        
        <div class="challenge-controls">
          <button id="refreshEventsBtn" class="terminal-button">REFRESH</button>
          <button id="clearHistoryBtn" class="terminal-button">CLEAR HISTORY</button>
          <button id="fixCorruptedBtn" class="terminal-button">FIX CORRUPTED</button>
        </div>
        
        <div class="button" id="closeChallengeEvents">CLOSE</div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Initialize challenge events
    loadChallengeEvents();
    loadChallengeHistory();
    loadChallengeStats();

    // Add tab handlers
    const tabBtns = overlay.querySelectorAll(".tab-btn");
    tabBtns.forEach((btn) => {
      window.core.safeAddEventListener(btn, "click", () => {
        // Remove active class from all tab buttons
        tabBtns.forEach((b) => b.classList.remove("active"));
        // Add active class to clicked button
        btn.classList.add("active");

        // Remove active class from all tab contents
        const tabContents = overlay.querySelectorAll(".tab-content");
        tabContents.forEach((content) => content.classList.remove("active"));

        // Add active class to target tab content
        const targetTab = btn.dataset.tab;
        if (targetTab) {
          const targetContent = overlay.querySelector(`#${targetTab}`);
          if (targetContent) {
            targetContent.classList.add("active");
          }
        }
      });
    });

    // Add button handlers
    const refreshBtn = overlay.querySelector("#refreshEventsBtn");
    const clearBtn = overlay.querySelector("#clearHistoryBtn");
    const fixBtn = overlay.querySelector("#fixCorruptedBtn");
    const closeBtn = overlay.querySelector("#closeChallengeEvents");

    if (refreshBtn) {
      window.core.safeAddEventListener(refreshBtn, "click", () => {
        loadChallengeEvents();
        loadChallengeHistory();
        loadChallengeStats();
      });
    }

    if (clearBtn) {
      window.core.safeAddEventListener(clearBtn, "click", () => {
        clearChallengeHistory();
      });
    }

    if (fixBtn) {
      window.core.safeAddEventListener(fixBtn, "click", () => {
        fixCorruptedChallenges();
      });
    }

    if (closeBtn) {
      window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
    }
  }

  // Load challenge events
  function loadChallengeEvents() {
    const eventsList = document.getElementById("recentEventsList");
    if (!eventsList) return;

    // Get recent events (last 10)
    const recentEvents = challengeHistory.slice(-10).reverse();
    
    if (recentEvents.length === 0) {
      eventsList.innerHTML = '<div class="no-events">No recent challenge events</div>';
      return;
    }

    eventsList.innerHTML = "";
    recentEvents.forEach(event => {
      const eventElement = document.createElement("div");
      eventElement.className = `event-item ${event.result}`;
      eventElement.innerHTML = `
        <div class="event-header">
          <span class="event-type">${challengeTypes[event.type].name}</span>
          <span class="event-result ${event.result}">${event.result.toUpperCase()}</span>
        </div>
        <div class="event-details">
          <span class="challenger">${event.initiator}</span>
          <span class="vs">vs</span>
          <span class="target">${event.target}</span>
        </div>
        <div class="event-time">${new Date(event.createdAt).toLocaleString()}</div>
      `;
      eventsList.appendChild(eventElement);
    });
  }

  // Load challenge history
  function loadChallengeHistory() {
    const historyList = document.getElementById("challengeHistoryList");
    if (!historyList) return;

    if (challengeHistory.length === 0) {
      historyList.innerHTML = '<div class="no-history">No challenge history</div>';
      return;
    }

    historyList.innerHTML = "";
    challengeHistory.slice().reverse().forEach(event => {
      const eventElement = document.createElement("div");
      eventElement.className = `history-item ${event.result}`;
      eventElement.innerHTML = `
        <div class="history-header">
          <span class="history-type">${challengeTypes[event.type].name}</span>
          <span class="history-result ${event.result}">${event.result.toUpperCase()}</span>
        </div>
        <div class="history-details">
          <span class="challenger">${event.initiator}</span>
          <span class="vs">vs</span>
          <span class="target">${event.target}</span>
        </div>
        <div class="history-time">${new Date(event.createdAt).toLocaleString()}</div>
      `;
      historyList.appendChild(eventElement);
    });
  }

  // Load challenge stats
  function loadChallengeStats() {
    const statsGrid = document.getElementById("challengeStatsGrid");
    if (!statsGrid) return;

    const stats = calculateChallengeStats();
    
    statsGrid.innerHTML = `
      <div class="stat-item">
        <div class="stat-label">TOTAL CHALLENGES</div>
        <div class="stat-value">${stats.total}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">VICTORIES</div>
        <div class="stat-value">${stats.victories}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">DEFEATS</div>
        <div class="stat-value">${stats.defeats}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">WIN RATE</div>
        <div class="stat-value">${stats.winRate}%</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">TOTAL POINTS EARNED</div>
        <div class="stat-value">${stats.totalPoints}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">AVERAGE REPUTATION</div>
        <div class="stat-value">${stats.avgReputation}</div>
      </div>
    `;
  }

  // Calculate challenge stats
  function calculateChallengeStats() {
    const total = challengeHistory.length;
    const victories = challengeHistory.filter(c => c.result === "victory").length;
    const defeats = challengeHistory.filter(c => c.result === "defeat").length;
    const winRate = total > 0 ? Math.round((victories / total) * 100) : 0;
    
    const totalPoints = challengeHistory
      .filter(c => c.result === "victory")
      .reduce((sum, c) => sum + challengeTypes[c.type].pointsReward, 0);
    
    const currentUser = window.core.user;
    const avgReputation = currentUser ? (currentUser.reputation || reputationRules.startingReputation) : 0;

    return {
      total,
      victories,
      defeats,
      winRate,
      totalPoints,
      avgReputation
    };
  }

  // Clear challenge history
  function clearChallengeHistory() {
    challengeHistory = [];
    window.ui.addLog("Challenge history cleared", "info");
    loadChallengeHistory();
    loadChallengeStats();
  }

  // Fix corrupted challenges
  function fixCorruptedChallenges() {
    const originalLength = challengeHistory.length;
    challengeHistory = challengeHistory.filter(challenge => 
      challenge && challenge.id && challenge.initiator && challenge.target && challenge.type
    );
    
    const fixedCount = originalLength - challengeHistory.length;
    window.ui.addLog(`Fixed ${fixedCount} corrupted challenges`, "info");
    
    loadChallengeHistory();
    loadChallengeStats();
  }

  // Start challenge cooldown
  function startChallengeCooldown() {
    challengeCooldownActive = true;
    challengeCooldownEndTime = Date.now() + 300000; // 5 minutes
    
    window.ui.addLog("Challenge cooldown started (5 minutes)", "info");
    
    // Update cooldown UI
    updateChallengeCooldownUI();
    
    // Clear cooldown after time expires
    window.core.safeSetTimeout(() => {
      challengeCooldownActive = false;
      challengeCooldownEndTime = 0;
      updateChallengeCooldownUI();
      window.ui.addLog("Challenge cooldown expired", "info");
    }, 300000);
  }

  // Update challenge cooldown UI
  function updateChallengeCooldownUI() {
    const cooldownBar = document.getElementById("challengeCooldownBar");
    if (!cooldownBar) return;

    if (challengeCooldownActive) {
      const remaining = Math.max(0, challengeCooldownEndTime - Date.now());
      const progress = Math.max(0, Math.min(100, (remaining / 300000) * 100));
      
      cooldownBar.style.display = "block";
      cooldownBar.querySelector(".cooldown-progress").style.width = `${progress}%`;
      cooldownBar.querySelector(".cooldown-text").textContent = 
        `Challenge Cooldown: ${Math.ceil(remaining / 1000)}s remaining`;
    } else {
      cooldownBar.style.display = "none";
    }
  }

  // Get challenge cooldown status
  function getChallengeCooldownStatus() {
    return {
      active: challengeCooldownActive,
      endTime: challengeCooldownEndTime,
      remaining: challengeCooldownActive ? Math.max(0, challengeCooldownEndTime - Date.now()) : 0
    };
  }

  // Get challenge history
  function getChallengeHistory() {
    return [...challengeHistory];
  }

  // Get pending challenge
  function getPendingChallenge() {
    return pendingChallenge;
  }

  // Export challenges functions
  window.challenges = {
    initiateChallenge,
    continueWithChallenge,
    executeChallenge,
    calculateChallengeSuccess,
    showChallengeResult,
    cancelChallenge,
    showChallengeEvents,
    loadChallengeEvents,
    loadChallengeHistory,
    loadChallengeStats,
    calculateChallengeStats,
    clearChallengeHistory,
    fixCorruptedChallenges,
    startChallengeCooldown,
    updateChallengeCooldownUI,
    getChallengeCooldownStatus,
    getChallengeHistory,
    getPendingChallenge,
    challengeTypes,
    reputationRules
  };
})();
