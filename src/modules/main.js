// Main module - Core application logic and lifecycle management
// This module contains the main application initialization and core functions

// Global variables
let currentUser = null;
let decrementInterval = null;
let retryCount = 0;
const MAX_RETRIES = 3;

// Initialize Shogun Core and main application
async function initializeShogun() {
  try {
    // Show loading state
    document.title = "INITIALIZING SWAN STATION...";

    // Add error boundary for unhandled errors
    window.addEventListener("error", (event) => {
      console.error("Unhandled error:", event.error);
      if (window.core && window.core.performanceMonitor) {
        window.core.performanceMonitor.logError(event.error);
      }
      if (window.ui && window.ui.addLog) {
        window.ui.addLog(`CRITICAL ERROR: ${event.error.message}`, "error");
      }

      // Prevent app crash by showing error state
      document.title = "SWAN STATION - ERROR";
      if (window.ui && window.ui.updateConnectionStatus) {
        window.ui.updateConnectionStatus("SYSTEM ERROR", "error");
      }
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      if (window.core && window.core.performanceMonitor) {
        window.core.performanceMonitor.logError(new Error(event.reason));
      }
      if (window.ui && window.ui.addLog) {
        window.ui.addLog(
          `CRITICAL ERROR: Promise rejected - ${event.reason}`,
          "error"
        );
      }

      // Prevent app crash
      event.preventDefault();
    });

    // Start performance monitoring
    window.core.safeSetInterval(() => {
      window.core.performanceMonitor.logMemory();

      // Log performance stats every 5 minutes
      const stats = window.core.performanceMonitor.getStats();
      if (stats.errorCount > 10) {
        console.warn("High error count detected:", stats.errorCount);
      }
    }, 300000); // Every 5 minutes

    // Initialize Shogun Core
    const shogun = await window.SHOGUN_CORE({
      peers: [
        "https://relay.shogun-eco.xyz/gun",
        "https://peer.wallie.io/gun",
        "https://gun-manhattan.herokuapp.com/gun",
      ],
      localStorage: true,
      radisk: true,
      scope: "shogun/swan-station",
      web3: { enabled: false },
      webauthn: { enabled: false },
      nostr: { enabled: false },
      oauth: { enabled: false },
      plugins: {
        autoRegister: [],
      },
      timeouts: {
        login: 30000,
        signup: 30000,
        operation: 60000,
      },
    });

    await shogun.initialize();

    console.log("shogun initialized");
    console.log("shogun", shogun);

    // Get GunDB instance and user from shogun-core
    const gun = shogun.db.gun;
    const user = shogun.db.gun.user().recall({ sessionStorage: true });

    // Set core references
    window.core.setShogun(shogun);
    window.core.setGun(gun);
    window.core.setUser(user);

    // Update title and connection status
    document.title = "SWAN STATION - CONNECTED";
    if (window.ui && window.ui.updateConnectionStatus) {
      window.ui.updateConnectionStatus("CONNECTED", "connected");
    }

    // Show contribution indicator
    const contributionIndicator = document.getElementById(
      "contributionIndicator"
    );
    if (contributionIndicator) {
      contributionIndicator.textContent = "CONTRIBUTING TO NETWORK";
      contributionIndicator.style.display = "block";
    }

    // Initialize GunDB references
    if (gun) {
      window.core.setTimerRef(gun.get("swan").get("timer"));
      window.core.setOperatorsRef(gun.get("swan").get("operators"));
      window.core.setHistoryRef(gun.get("swan").get("history"));
      window.core.setStatsRef(gun.get("swan").get("stats"));
      window.core.setChatRef(gun.get("swan").get("chat"));
      window.core.setTaskRef(gun.get("swan").get("tasks"));
      window.core.setStationParamsRef(gun.get("swan").get("stationParams"));
      console.log("✅ GunDB references initialized");
    } else {
      console.warn("⚠️ Gun.js not available, running in offline mode");
      if (window.ui && window.ui.addLog) {
        window.ui.addLog(
          "Running in offline mode - data will sync when connection is available",
          "warning"
        );
      }
    }

    console.log("Shogun Core initialized successfully");

    // Initialize UI elements
    if (window.ui) {
      window.ui.initializeMenuToggle();
      window.ui.initializeUIButtons();
      console.log("✅ UI elements initialized");
    } else {
      console.warn("⚠️ UI module not available");
    }

    // Initialize task system
    if (window.tasks) {
      window.tasks.initializeTaskSystem();
      console.log("✅ Task system initialized");
    } else {
      console.warn("⚠️ Tasks module not available");
    }

    // Initialize chat system
    if (window.chat) {
      console.log("✅ Chat system available");
    } else {
      console.warn("⚠️ Chat module not available");
    }

    // Setup Shogun Core event listeners
    shogun.on("auth:login", (data) => {
      console.log("Authentication successful for:", data.username);
      const overlay = document.querySelector(".overlay");
      if (overlay) overlay.remove();
    });

    shogun.on("auth:logout", () => {
      console.log("User logged out");
      showAuthPrompt();
    });

    // Setup timer listener after initialization
    if (window.timer && window.timer.setupTimerListener) {
      window.timer.setupTimerListener();
    }

    // Initialize the system after shogun-core is ready
    initializeSystem();

    // Ensure timer is visible and initialized
    window.core.safeSetTimeout(() => {
      const bigTimer = document.getElementById("bigTimer");
      if (bigTimer) {
        console.log("Timer element found:", bigTimer);
        console.log("Timer current value:", bigTimer.textContent);
        console.log(
          "Timer visibility:",
          window.getComputedStyle(bigTimer).display
        );

        // Force timer to be visible
        bigTimer.style.display = "block";
        bigTimer.style.visibility = "visible";
        bigTimer.style.opacity = "1";
        bigTimer.style.position = "relative";
        bigTimer.style.zIndex = "100";

        // Set initial value if empty
        if (!bigTimer.textContent || bigTimer.textContent === "108") {
          bigTimer.textContent = "108";
          console.log("Timer initialized to 108");
        }

        // Add a test message to verify timer is working
        window.ui.addLog("Timer system initialized - countdown active");
      } else {
        console.error("Timer element not found!");
        window.ui.addLog("ERROR: Timer element not found!", "error");
      }
    }, 1000);

    // Clean up corrupted tasks
    window.core.safeSetTimeout(() => {
      if (window.tasks && window.tasks.cleanupCorruptedTasks) {
        window.tasks.cleanupCorruptedTasks();
      }
    }, 2000);

    // Check if user is already logged in
    if (shogun.isLoggedIn()) {
      console.log("User already logged in");
      const userPub = user.is.pub;
      const alias = await window.auth.getUserAlias(userPub);
      if (alias) {
        startApp(alias);
      } else {
        showAuthPrompt();
      }
    } else {
      showAuthPrompt();
    }
  } catch (error) {
    console.error("Failed to initialize Shogun Core:", error);
    window.core.performanceMonitor.logError(error);
    document.title = "SWAN STATION - CONNECTION ERROR";

    if (window.ui && window.ui.updateConnectionStatus) {
      window.ui.updateConnectionStatus("CONNECTION ERROR", "error");
    }

    if (window.ui && window.ui.addLog) {
      window.ui.addLog(
        "CRITICAL: Connection to station network failed",
        "error"
      );
    }

    // Only retry if we haven't reached max retries
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(() => {
        if (window.ui && window.ui.addLog) {
          window.ui.addLog(
            `Attempting to reconnect to station network... (${retryCount}/${MAX_RETRIES})`,
            "info"
          );
        }
        initializeShogun();
      }, 5000);
    } else {
      if (window.ui && window.ui.addLog) {
        window.ui.addLog(
          "Max retries reached. Please refresh the page to try again.",
          "error"
        );
      }
    }
  }
}

// Stop application and cleanup
function stopApp() {
  // Clear all intervals and timeouts
  if (decrementInterval) {
    clearInterval(decrementInterval);
    decrementInterval = null;
  }

  // Clear any app-specific timeouts
  if (window.appStartTimeout) {
    clearTimeout(window.appStartTimeout);
    window.appStartTimeout = null;
  }

  // Reset user state
  currentUser = null;

  console.log("App UI focus paused and timeouts cleared.");
}

// Start application with user alias
function startApp(alias) {
  stopApp(); // Prevent duplicate intervals
  console.log(`Operator ${alias} is active. App resumed.`);

  currentUser = {
    alias: alias,
    points: 0,
    level: 1,
    connectionTime: Date.now(), // Record connection time
  };

  console.log(
    `Operator ${alias} connected at ${new Date(
      currentUser.connectionTime
    ).toLocaleTimeString()}`
  );
  console.log(
    `Task filter: Only showing tasks created after ${new Date(
      currentUser.connectionTime - 30000
    ).toLocaleTimeString()}`
  );

  // Register the operator immediately
  if (window.operators && window.operators.registerOperator) {
    window.operators.registerOperator(alias);
  }

  // Load existing tasks from GunDB (after currentUser is set)
  // Use a flag to prevent sync conflicts during initial load
  window.initialTaskLoadComplete = false;

  // Add a comprehensive safety timeout to prevent the app from getting stuck
  const appStartTimeout = setTimeout(() => {
    console.warn("⚠️ App initialization timeout - forcing completion");
    window.initialTaskLoadComplete = true;

    if (window.tasks && window.tasks.updateTaskDisplay) {
      window.tasks.updateTaskDisplay();
    }

    // Force UI to show even if profile loading is stuck
    const container = document.querySelector(".container");
    const headerSection = document.querySelector(".header-section");
    const statsContainer = document.getElementById("statsContainer");

    if (container) {
      container.style.display = "flex";
      container.classList.add("centered");
    }

    if (headerSection) {
      headerSection.style.display = "none";
    }

    if (statsContainer) {
      statsContainer.style.display = "none";
    }

    console.log("🚀 App forced to start with timeout protection");
  }, 15000); // 15 second timeout

  // Start task loading with completion callback
  if (window.tasks && window.tasks.loadTasksFromGunDB) {
    window.tasks.loadTasksFromGunDB();
  }

  // Store the app timeout reference for cleanup
  window.appStartTimeout = appStartTimeout;

  // Keep operator status updated
  const operatorUpdateInterval = window.core.safeSetInterval(() => {
    if (
      window.core.operatorsRef &&
      window.core.user &&
      window.core.user.is &&
      window.core.user.is.pub
    ) {
      window.core.operatorsRef.get(window.core.user.is.pub).put({
        name: alias,
        pub: window.core.user.is.pub,
        lastSeen: Date.now(),
      });
    }
  }, 30000);

  // Update operators list periodically to handle cooldown expiration
  const cooldownUpdateInterval = window.core.safeSetInterval(() => {
    if (
      window.operators &&
      window.operators.currentOperatorsData &&
      window.operators.currentOperatorsData.length > 0
    ) {
      window.operators.updateActiveOperatorsList(
        window.operators.currentOperatorsData
      );
    }
  }, 5000); // Check every 5 seconds

  // Fetch or initialize user profile with timeout protection
  console.log("🔍 Fetching user profile...");
  const profileTimeout = setTimeout(() => {
    console.warn("⚠️ Profile fetch timeout - using default values");
    currentUser.points = 5;
    currentUser.level = 1;
  }, 5000); // 5 second timeout for profile fetch

  window.core.user.get("profile").once((profile) => {
    clearTimeout(profileTimeout);
    console.log("📋 Profile data received:", profile);

    if (!profile) {
      console.log("🆕 Creating initial profile for new user");
      const initialProfile = {
        points: 5,
        level: 1,
        resetStreak: 0,
        reputation: window.core.reputationRules.startingReputation,
        challengesWon: 0,
        challengesLost: 0,
        totalPointsStolen: 0,
        totalPointsLost: 0,
        hashGamesWon: 0,
        totalHashPoints: 0,
      };
      window.core.user.get("profile").put(initialProfile);
      // Also add the new user to the public leaderboard
      window.core.gun.get("leaderboard").get(alias).put({
        points: 5,
        level: 1,
        reputation: window.core.reputationRules.startingReputation,
      });
      currentUser.points = 5;
      currentUser.level = 1;
    } else {
      console.log("✅ Using existing profile data");
      currentUser.points = profile.points;
      currentUser.level = window.auth.getLevelFromPoints(profile.points);
    }
  });

  // Listen for profile updates with timeout protection (only if not already set up)
  if (!window.profileListenerSet) {
    window.profileListenerSet = true;
    window.core.user.get("profile").on((profile) => {
      if (profile && currentUser) {
        currentUser.points = profile.points;
        currentUser.level = window.auth.getLevelFromPoints(profile.points);

        // Update UI if available
        if (window.stats && window.stats.updateStatsUI) {
          window.stats.updateStatsUI({
            points: profile.points,
            level: currentUser.level,
          });
        }
      }
    });
  }

  // Initialize operators map
  if (window.operators && window.operators.initializeOperatorsMap) {
    window.operators.initializeOperatorsMap();
  }

  // Initialize active operators list
  if (window.operators && window.operators.initializeActiveOperatorsList) {
    window.operators.initializeActiveOperatorsList();
  }

  // Initialize menu toggle button
  if (window.ui && window.ui.initializeMenuToggle) {
    window.ui.initializeMenuToggle();
  }

  // Initialize all UI buttons
  if (window.ui && window.ui.initializeUIButtons) {
    window.ui.initializeUIButtons();
  }

  // Initialize network metrics
  if (window.stats && window.stats.initializeNetworkMetrics) {
    window.stats.initializeNetworkMetrics();
  }

  // Initialize relay management
  if (window.stats && window.stats.initializeRelayManagement) {
    window.stats.initializeRelayManagement();
  }

  // Load challenge cooldown from GunDB
  if (window.challenges && window.challenges.loadChallengeCooldownFromGunDB) {
    window.challenges.loadChallengeCooldownFromGunDB();
  }

  // Load cooldowns from GunDB
  if (window.operators && window.operators.loadCooldownsFromGunDB) {
    window.operators.loadCooldownsFromGunDB();
  }

  // Start challenge cooldown system
  if (window.challenges && window.challenges.startChallengeCooldown) {
    window.challenges.startChallengeCooldown();
  }

  // Show the main interface
  const container = document.querySelector(".container");
  const headerSection = document.querySelector(".header-section");
  const statsContainer = document.getElementById("statsContainer");

  if (container) {
    container.style.display = "flex";
    container.classList.add("centered");
  }

  if (headerSection) {
    headerSection.style.display = "none";
  }

  if (statsContainer) {
    statsContainer.style.display = "none";
  }

  console.log("🚀 Application started successfully");
}

// Show authentication prompt
function showAuthPrompt() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="auth-modal">
      <h2>&gt; SWAN STATION ACCESS</h2>
      <p class="info">Welcome to Swan Station. Please authenticate to continue.</p>
      
      <div class="auth-buttons">
        <button id="loginBtn" class="btn btn-primary">LOGIN</button>
        <button id="signupBtn" class="btn btn-secondary">SIGNUP</button>
      </div>
      
      <div class="auth-info">
        <p class="warning">⚠️ This is an experimental decentralized application.</p>
        <p class="info">Your data is stored locally and shared peer-to-peer.</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Add event listeners
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");

  if (loginBtn) {
    window.core.safeAddEventListener(loginBtn, "click", () => {
      if (window.auth && window.auth.performLogin) {
        window.auth.performLogin();
      }
    });
  }

  if (signupBtn) {
    window.core.safeAddEventListener(signupBtn, "click", () => {
      if (window.auth && window.auth.performSignup) {
        window.auth.performSignup();
      }
    });
  }
}

// Main system initializer - called after shogun-core initialization
function initializeSystem() {
  document.title = "AUTHENTICATING...";

  // Add event listener for rules button
  document.addEventListener("DOMContentLoaded", () => {
    const rulesBtn = document.getElementById("rulesBtn");
    if (rulesBtn) {
      window.core.safeAddEventListener(rulesBtn, "click", showStationRules);
    }

    const aboutBtn = document.getElementById("aboutBtn");
    if (aboutBtn) {
      window.core.safeAddEventListener(aboutBtn, "click", showAboutSection);
    }
  });

  // Setup listeners that don't depend on a logged-in user
  if (window.core.statsRef) {
    window.core.statsRef.on((data) => {
      if (data) {
        if (window.stats && window.stats.updateStatsUI) {
          window.stats.updateStatsUI(data);
        }
      }
    });
  }

  // Initialize timer immediately, regardless of auth status
  if (window.core.timerRef) {
    window.core.timerRef.once((data) => {
      if (!data || typeof data.value !== "number") {
        console.log(
          "Global timer not found. Waiting for first operator to set timer..."
        );
        // Don't auto-initialize - let operators control the timer
        if (window.timer && window.timer.updateInputState) {
          window.timer.updateInputState(0);
        }
      } else {
        // Initialize input state for existing timer
        if (window.timer && window.timer.updateInputState) {
          window.timer.updateInputState(data.value);
        }
      }

      // Start the global countdown immediately
      if (decrementInterval) {
        clearInterval(decrementInterval);
        decrementInterval = null;
      }

      if (window.timer && window.timer.decrementTimer) {
        decrementInterval = window.core.safeSetInterval(
          window.timer.decrementTimer,
          60000
        );
      }

      // Sync timer with server time
      const now = Date.now();
      if (data && data.lastUpdate) {
        const minutesPassed = Math.floor((now - data.lastUpdate) / 60000);
        if (minutesPassed > 0) {
          const newValue = Math.max(1, data.value - minutesPassed);
          if (window.timer && window.timer.updateTimer) {
            window.timer.updateTimer(newValue, "time_sync");
          }
        }
      }
    });

    // Timer display listener (secondary - for redundancy)
    window.core.timerRef.on((data) => {
      console.log("📨 Secondary timer listener received data:", data);
      if (data && typeof data.value === "number") {
        console.log(
          "✅ Secondary timer listener updating display to:",
          data.value
        );
        document.title = data.value;

        const bigTimer = document.getElementById("bigTimer");
        if (bigTimer) {
          bigTimer.textContent = data.value;
        }

        // Update input state based on timer value
        if (window.timer && window.timer.updateInputState) {
          window.timer.updateInputState(data.value);
        }

        if (data.value <= 4) {
          if (window.timer && window.timer.siren) {
            window.timer.siren.play().catch(() => {});
          }
        } else {
          if (window.timer && window.timer.siren) {
            window.timer.siren.pause();
            window.timer.siren.currentTime = 0;
          }
          // Stop system failure display if timer is reset above 4
          if (window.timer && window.timer.systemFailureActive) {
            if (window.timer && window.timer.stopSystemFailureDisplay) {
              window.timer.stopSystemFailureDisplay();
            }
          }
        }
      }
    });
  }

  // Add a periodic check of the timer
  window.core.safeSetInterval(() => {
    if (!decrementInterval) {
      console.log("Timer interval lost, restarting...");
      if (window.timer && window.timer.decrementTimer) {
        decrementInterval = window.core.safeSetInterval(
          window.timer.decrementTimer,
          60000
        );
      }
    }
  }, 30000);
}

// Show station rules
function showStationRules() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="rules-modal">
      <h2>&gt; SWAN STATION OPERATIONAL PROTOCOL</h2>
      
      <div class="rules-section">
        <h3>EXPERIMENT OVERVIEW</h3>
        <p class="success">Swan Station is an experimental decentralized application (dApp) developed by <strong>shogun-eco.xyz</strong> to demonstrate the power of peer-to-peer collaboration and decentralized technology.</p>
        <p class="info">This experiment showcases how a multiplayer game can operate entirely on a decentralized network without central servers, proving the viability of censorship-resistant, community-driven applications.</p>
      </div>
      
      <div class="rules-section">
        <h3>OPERATIONAL PROTOCOL</h3>
        <p class="warning"><strong>MISSION:</strong> Maintain the countdown timer above 0 to prevent system failure.</p>
        <p class="info"><strong>COLLABORATION:</strong> Work with other operators to complete tasks and maintain station stability.</p>
        <p class="info"><strong>COMPETITION:</strong> Challenge other operators to steal points and climb the leaderboard.</p>
      </div>
      
      <div class="rules-section">
        <h3>KEY SYSTEMS</h3>
        <ul>
          <li><strong>Timer:</strong> The countdown that must be maintained</li>
          <li><strong>Tasks:</strong> Missions that reward points and affect station parameters</li>
          <li><strong>Challenges:</strong> Competitive duels with other operators</li>
          <li><strong>Calibration:</strong> Mini-game to balance station parameters</li>
          <li><strong>Chat:</strong> Communication with other operators</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>DECENTRALIZED FEATURES</h3>
        <ul>
          <li><strong>Peer-to-Peer:</strong> No central servers - data shared directly between users</li>
          <li><strong>Censorship Resistant:</strong> Cannot be shut down by authorities</li>
          <li><strong>Community Driven:</strong> All decisions made by the operator community</li>
          <li><strong>Transparent:</strong> All code and data publicly visible</li>
        </ul>
      </div>
      
      <button class="btn btn-primary close-btn">UNDERSTOOD</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector(".close-btn");
  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
}

// Show about section
function showAboutSection() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="about-modal">
      <h2>&gt; ABOUT SWAN STATION</h2>
      
      <div class="about-section">
        <h3>EXPERIMENTAL DECENTRALIZED APPLICATION</h3>
        <p class="info">Swan Station is a proof-of-concept demonstrating the potential of decentralized technology for collaborative applications.</p>
        <p class="success">Built with <strong>shogun-core</strong> - a decentralized application framework.</p>
      </div>
      
      <div class="about-section">
        <h3>TECHNOLOGY STACK</h3>
        <ul>
          <li><strong>Frontend:</strong> Vanilla JavaScript, HTML5, CSS3</li>
          <li><strong>Backend:</strong> GunDB (decentralized database)</li>
          <li><strong>Framework:</strong> Shogun Core</li>
          <li><strong>Network:</strong> Peer-to-peer mesh network</li>
        </ul>
      </div>
      
      <div class="about-section">
        <h3>DEVELOPMENT</h3>
        <p class="info">Developed by <strong>shogun-eco.xyz</strong></p>
        <p class="info">Open source and community-driven</p>
        <p class="warning">This is experimental software - use at your own risk</p>
      </div>
      
      <button class="btn btn-primary close-btn">CLOSE</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector(".close-btn");
  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
}

// Export main module functions
window.main = {
  initializeShogun,
  startApp,
  stopApp,
  showAuthPrompt,
  initializeSystem,
  showStationRules,
  showAboutSection,
  currentUser: () => currentUser,
  setCurrentUser: (user) => {
    currentUser = user;
  },
  decrementInterval: () => decrementInterval,
  setDecrementInterval: (interval) => {
    decrementInterval = interval;
  },
};

console.log("✅ Main module loaded");
