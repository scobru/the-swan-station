// Initialize shogun core
let shogun,
  gun,
  user,
  timerRef,
  operatorsRef,
  historyRef,
  statsRef,
  chatRef,
  taskRef,
  stationParamsRef;

// Global cleanup registry for intervals and listeners
const cleanupRegistry = {
  intervals: new Set(),
  listeners: new Set(),
  timeouts: new Set(),
  audioElements: new Set(),
};

// Performance monitoring
const performanceMonitor = {
  startTime: Date.now(),
  memoryUsage: [],
  fps: [],
  errors: [],

  logMemory() {
    if (performance.memory) {
      this.memoryUsage.push({
        timestamp: Date.now(),
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
      });

      // Keep only last 100 entries
      if (this.memoryUsage.length > 100) {
        this.memoryUsage.shift();
      }
    }
  },

  logError(error) {
    this.errors.push({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
    });

    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors.shift();
    }
  },

  getStats() {
    return {
      uptime: Date.now() - this.startTime,
      memoryUsage:
        this.memoryUsage.length > 0
          ? this.memoryUsage[this.memoryUsage.length - 1]
          : null,
      errorCount: this.errors.length,
      activeIntervals: cleanupRegistry.intervals.size,
      activeTimeouts: cleanupRegistry.timeouts.size,
    };
  },
};

// Cleanup function to prevent memory leaks
function cleanup() {
  // Clear all intervals
  cleanupRegistry.intervals.forEach((interval) => {
    if (interval) clearInterval(interval);
  });
  cleanupRegistry.intervals.clear();

  // Clear all timeouts
  cleanupRegistry.timeouts.forEach((timeout) => {
    if (timeout) clearTimeout(timeout);
  });
  cleanupRegistry.timeouts.clear();

  // Remove all listeners
  cleanupRegistry.listeners.forEach((listener) => {
    if (listener && listener.element && listener.event && listener.handler) {
      listener.element.removeEventListener(listener.event, listener.handler);
    }
  });
  cleanupRegistry.listeners.clear();

  // Pause all audio elements
  cleanupRegistry.audioElements.forEach((audio) => {
    if (audio && typeof audio.pause === "function") {
      audio.pause();
      audio.currentTime = 0;
    }
  });
  cleanupRegistry.audioElements.clear();

  console.log("🧹 Cleanup completed");
}

// Safe interval creation with cleanup registration
function safeSetInterval(callback, delay) {
  const interval = setInterval(callback, delay);
  cleanupRegistry.intervals.add(interval);
  return interval;
}

// Safe timeout creation with cleanup registration
function safeSetTimeout(callback, delay) {
  const timeout = setTimeout(callback, delay);
  cleanupRegistry.timeouts.add(timeout);
  return timeout;
}

// Safe event listener with cleanup registration
function safeAddEventListener(element, event, handler) {
  element.addEventListener(event, handler);
  cleanupRegistry.listeners.add({ element, event, handler });
}

// Station Parameters System
let stationParameters = {
  powerLevel: 85,
  oxygenLevel: 92,
  temperature: 22,
  radiationLevel: 0.15,
  pressure: 1013,
  humidity: 45,
};

// Real parameter effects based on task completion
const parameterEffects = {
  // Power-related tasks
  "POWER GRID STABILIZATION": {
    success: { powerLevel: 15, temperature: -2 },
    failure: { powerLevel: -10, temperature: 5 },
  },
  "BACKUP POWER TEST": {
    success: { powerLevel: 8 },
    failure: { powerLevel: -5 },
  },

  // Oxygen-related tasks
  "OXYGEN SYSTEM CALIBRATION": {
    success: { oxygenLevel: 10, pressure: 5 },
    failure: { oxygenLevel: -8, pressure: -10 },
  },

  // Temperature-related tasks
  "THERMAL REGULATION": {
    success: { temperature: -5, humidity: -3 },
    failure: { temperature: 8, humidity: 5 },
  },
  "COOLING SYSTEM FAILURE": {
    success: { temperature: -10, humidity: -5 },
    failure: { temperature: 15, humidity: 10 },
  },

  // Radiation-related tasks
  "RADIATION SHIELD MAINTENANCE": {
    success: { radiationLevel: -0.1, powerLevel: -2 },
    failure: { radiationLevel: 0.15, powerLevel: -5 },
  },
  "RADIATION LEAK": {
    success: { radiationLevel: -0.2, oxygenLevel: -5 },
    failure: { radiationLevel: 0.25, oxygenLevel: -10 },
  },

  // Pressure-related tasks
  "PRESSURE SYSTEM BALANCE": {
    success: { pressure: 20, oxygenLevel: 3 },
    failure: { pressure: -30, oxygenLevel: -5 },
  },

  // Humidity-related tasks
  "HUMIDITY REGULATION": {
    success: { humidity: 10, temperature: -1 },
    failure: { humidity: -15, temperature: 3 },
  },

  // System-wide tasks
  "SYSTEM DIAGNOSTIC": {
    success: { powerLevel: 3, oxygenLevel: 2, temperature: -1 },
    failure: { powerLevel: -2, oxygenLevel: -2, temperature: 2 },
  },
  "COMMUNICATION TEST": {
    success: { powerLevel: 2 },
    failure: { powerLevel: -3 },
  },
  "SENSOR CALIBRATION": {
    success: { temperature: -2, pressure: 5, humidity: 3 },
    failure: { temperature: 3, pressure: -8, humidity: -5 },
  },
};

// Parameter interdependencies (realistic relationships)
const parameterInterdependencies = {
  // Power affects other systems
  powerLevel: {
    affects: {
      oxygenLevel: 0.1, // Power affects oxygen generation
      temperature: 0.05, // Power affects cooling
      pressure: 0.02, // Power affects pressure systems
    },
  },

  // Temperature affects other parameters
  temperature: {
    affects: {
      humidity: 0.3, // Higher temp = higher humidity
      pressure: 0.1, // Higher temp = higher pressure
      oxygenLevel: -0.05, // Higher temp = lower oxygen efficiency
    },
  },

  // Pressure affects other systems
  pressure: {
    affects: {
      oxygenLevel: 0.2, // Pressure affects oxygen distribution
      humidity: 0.1, // Pressure affects humidity
    },
  },

  // Radiation affects other systems
  radiationLevel: {
    affects: {
      powerLevel: -0.1, // Radiation damages power systems
      oxygenLevel: -0.05, // Radiation affects oxygen systems
      temperature: 0.02, // Radiation increases temperature
    },
  },
};

// Task System
let activeTasks = [];
let taskHistory = [];
let lastTaskCheck = Date.now();
let taskCheckInterval = null;

// Real-world API data sources for unpredictability
const apiEndpoints = {
  weather:
    "https://api.openweathermap.org/data/2.5/weather?q=London&appid=demo&units=metric",
  solarActivity: "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY",
  bitcoinPrice:
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
  earthquakeData:
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
  spaceWeather: "https://services.swpc.noaa.gov/json/solar_wind_speed.json",
};

// Task types with different difficulty levels
const taskTypes = {
  CRITICAL: {
    powerBalance: {
      name: "POWER GRID STABILIZATION",
      difficulty: 3,
      timeLimit: 300000,
    },
    oxygenRegulation: {
      name: "OXYGEN SYSTEM CALIBRATION",
      difficulty: 2,
      timeLimit: 240000,
    },
    temperatureControl: {
      name: "THERMAL REGULATION",
      difficulty: 2,
      timeLimit: 180000,
    },
    radiationShield: {
      name: "RADIATION SHIELD MAINTENANCE",
      difficulty: 4,
      timeLimit: 420000,
    },
    pressureStabilization: {
      name: "PRESSURE SYSTEM BALANCE",
      difficulty: 3,
      timeLimit: 300000,
    },
    humidityControl: {
      name: "HUMIDITY REGULATION",
      difficulty: 1,
      timeLimit: 120000,
    },
  },
  MAINTENANCE: {
    systemCheck: { name: "SYSTEM DIAGNOSTIC", difficulty: 1, timeLimit: 60000 },
    backupPower: {
      name: "BACKUP POWER TEST",
      difficulty: 2,
      timeLimit: 120000,
    },
    communicationTest: {
      name: "COMMUNICATION TEST",
      difficulty: 1,
      timeLimit: 90000,
    },
    sensorCalibration: {
      name: "SENSOR CALIBRATION",
      difficulty: 2,
      timeLimit: 150000,
    },
  },
  EMERGENCY: {
    containmentBreach: {
      name: "CONTAINMENT BREACH",
      difficulty: 5,
      timeLimit: 600000,
    },
    powerSurge: {
      name: "POWER SURGE DETECTED",
      difficulty: 4,
      timeLimit: 300000,
    },
    radiationLeak: { name: "RADIATION LEAK", difficulty: 5, timeLimit: 480000 },
    systemOverload: {
      name: "SYSTEM OVERLOAD",
      difficulty: 4,
      timeLimit: 360000,
    },
  },
};

// Random events that can affect station parameters
const randomEvents = [
  {
    name: "SOLAR FLARE DETECTED",
    effect: { radiationLevel: 0.3, powerLevel: -10 },
  },
  { name: "METEOROID IMPACT", effect: { pressure: -50, temperature: 5 } },
  {
    name: "EQUIPMENT MALFUNCTION",
    effect: { powerLevel: -15, oxygenLevel: -5 },
  },
  { name: "ATMOSPHERIC DISTURBANCE", effect: { pressure: 30, humidity: 20 } },
  { name: "ENERGY SURGE", effect: { powerLevel: 20, temperature: 8 } },
  {
    name: "COOLING SYSTEM FAILURE",
    effect: { temperature: 15, humidity: -10 },
  },
  { name: "OXYGEN LEAK", effect: { oxygenLevel: -15, pressure: -20 } },
  { name: "RADIATION SPIKE", effect: { radiationLevel: 0.25, powerLevel: -5 } },
];

async function initializeShogun() {
  try {
    // Show loading state
    document.title = "INITIALIZING SWAN STATION...";

    // Add error boundary for unhandled errors
    window.addEventListener("error", (event) => {
      console.error("Unhandled error:", event.error);
      addLog(`CRITICAL ERROR: ${event.error.message}`, "error");
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      performanceMonitor.logError(new Error(event.reason));
      addLog(`CRITICAL ERROR: Promise rejected - ${event.reason}`, "error");
    });

    // Start performance monitoring
    safeSetInterval(() => {
      performanceMonitor.logMemory();

      // Log performance stats every 5 minutes
      const stats = performanceMonitor.getStats();
      if (stats.errorCount > 10) {
        console.warn("High error count detected:", stats.errorCount);
      }
    }, 300000); // Every 5 minutes

    // Initialize Shogun Core
    shogun = await window.initShogun({
      peers: [
        "https://relay.shogun-eco.xyz/gun",
        "https://peer.wallie.io/gun",
        "https://gun-manhattan.herokuapp.com/gun",
      ],
      localStorage: true,
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
    gun = shogun.db.gun;
    user = shogun.db.user.recall({ sessionStorage: true });

    // Update title and connection status
    document.title = "SWAN STATION - CONNECTED";
    updateConnectionStatus("CONNECTED", "connected");

    // Show contribution indicator
    const contributionIndicator = document.getElementById(
      "contributionIndicator"
    );
    if (contributionIndicator) {
      contributionIndicator.textContent = "CONTRIBUTING TO NETWORK";
      contributionIndicator.style.display = "block";
    }

    // Initialize GunDB references
    timerRef = gun.get("swan").get("timer");
    operatorsRef = gun.get("swan").get("operators");
    historyRef = gun.get("swan").get("history");
    statsRef = gun.get("swan").get("stats");
    chatRef = gun.get("swan").get("chat");
    taskRef = gun.get("swan").get("tasks");
    stationParamsRef = gun.get("swan").get("stationParams");

    console.log("Shogun Core initialized successfully");

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
    setupTimerListener();

    // Initialize the system after shogun-core is ready
    initializeSystem();

    // Ensure timer is visible and initialized
    safeSetTimeout(() => {
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
        addLog("Timer system initialized - countdown active");
      } else {
        console.error("Timer element not found!");
        addLog("ERROR: Timer element not found!", "error");
      }
    }, 1000);

    // Initialize task system
    initializeTaskSystem();

    // Clean up corrupted tasks
    safeSetTimeout(() => {
      cleanupCorruptedTasks();
    }, 2000);

    // Check if user is already logged in
    if (shogun.isLoggedIn()) {
      console.log("User already logged in");
      const userPub = user.is.pub;
      const alias = await getUserAlias(userPub);
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
    document.title = "SWAN STATION - CONNECTION ERROR";
    updateConnectionStatus("CONNECTION ERROR", "error");
    addLog("CRITICAL: Connection to station network failed", "error");
    showAuthPrompt();
  }
}

// Helper function to get user alias from GunDB
async function getUserAlias(userPub) {
  return new Promise((resolve) => {
    gun
      .get("users")
      .get(userPub)
      .get("alias")
      .once((alias) => {
        resolve(alias);
      });
  });
}

// Audio setup - preload sounds with error handling and cleanup registration
const siren = new Audio("assets/siren.mp3");
const reset = new Audio("assets/reset.mp3");
const tick = new Audio("assets/tick.mp3");

// Register audio elements for cleanup
cleanupRegistry.audioElements.add(siren);
cleanupRegistry.audioElements.add(reset);
cleanupRegistry.audioElements.add(tick);

// Error handling for audio loading
[siren, reset, tick].forEach((audio) => {
  audio.addEventListener("error", (e) => {
    console.warn("Audio loading failed:", e.target.src);
  });
});

const buttonSounds = Array.from({ length: 8 }, (_, i) => {
  const audio = new Audio(`assets/typing_sounds/button${i + 1}.mp3`);
  audio.preload = "auto";
  cleanupRegistry.audioElements.add(audio);

  audio.addEventListener("error", (e) => {
    console.warn("Button sound loading failed:", e.target.src);
  });

  return audio;
});

// DOM elements
const container = document.querySelector(".container");
const input = document.querySelector("input");
const logContainer = document.getElementById("logContainer");
const statsContainer = document.getElementById("statsContainer");
const bigTimer = document.getElementById("bigTimer");

// App state
let focusInterval = null;
let decrementInterval = null;
let currentUser = null; // Will hold alias, points, level, etc.
let stats = { failures: 0, worlds: 0, resets: 0 };
// Timer is now fetched from GunDB, not hardcoded.
document.title = "SYNCING...";

// Leveling System
const levels = {
  1: 5,
  2: 30,
  3: 80,
  4: 130,
  5: 250,
  6: 350,
  7: 500,
  8: 700,
  9: 900,
  10: 1125,
  11: 1375,
  12: 1650,
  13: 1950,
  14: 2275,
  15: 2625,
  16: 3000,
  17: 3400,
  18: 3825,
  19: 4275,
  20: 4750,
  21: 5250,
  22: 5775,
  23: 6325,
  24: 6900,
  25: 7500,
};

function getLevelFromPoints(points) {
  let level = 1;
  for (const lvl in levels) {
    if (points >= levels[lvl]) {
      level = parseInt(lvl, 10);
    } else {
      break;
    }
  }
  return level;
}

function calculateLevel(points) {
  return getLevelFromPoints(points);
}

function stopApp() {
  if (focusInterval) {
    clearInterval(focusInterval);
    cleanupRegistry.intervals.delete(focusInterval);
  }
  focusInterval = null;
  console.log("App UI focus paused.");
}

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
  registerOperator(alias);

  // Load existing tasks from GunDB (after currentUser is set)
  // Use a flag to prevent sync conflicts during initial load
  window.initialTaskLoadComplete = false;
  loadTasksFromGunDB();

  // Keep operator status updated
  const operatorUpdateInterval = safeSetInterval(() => {
    if (operatorsRef && user && user.is && user.is.pub) {
      operatorsRef.get(user.is.pub).put({
        name: alias,
        pub: user.is.pub,
        lastSeen: Date.now(),
      });
    }
  }, 30000);

  // Fetch or initialize user profile
  user.get("profile").once((profile) => {
    if (!profile) {
      const initialProfile = { points: 5, level: 1, resetStreak: 0 };
      user.get("profile").put(initialProfile);
      // Also add the new user to the public leaderboard
      gun.get("leaderboard").get(alias).put({ points: 5, level: 1 });
    } else {
      currentUser.points = profile.points;
      currentUser.level = getLevelFromPoints(profile.points);
    }
  });

  // Listen for profile updates
  user.get("profile").on((profile) => {
    if (profile) {
      currentUser.points = profile.points;
      currentUser.level = getLevelFromPoints(profile.points);
      if (stats) updateStatsUI(stats);
    }
  });

  // Show the main container and hide header
  const container = document.querySelector(".container");
  const headerSection = document.querySelector(".header-section");
  const statsContainer = document.getElementById("statsContainer");

  if (container) {
    container.style.display = "flex";
    container.classList.add("centered");

    // Hide log container when in timer mode
    const logContainer = document.querySelector(".log-container");
    if (logContainer) {
      logContainer.style.display = "none";
    }

    // Hide input when timer is above 4
    const input = document.querySelector(".input");
    const prompt = document.querySelector(".prompt");
    if (input && prompt) {
      input.style.display = "none";
      prompt.style.display = "none";
    }
  }

  if (headerSection) {
    headerSection.style.display = "none";
  }

  if (statsContainer) {
    statsContainer.style.display = "none";
  }

  // Add a small menu button to access functions
  addMenuButton();

  focusInterval = safeSetInterval(() => {
    if (
      document.activeElement.tagName !== "INPUT" ||
      document.activeElement === input
    ) {
      input.focus();
    }
  }, 100);
}

function addMenuButton() {
  // Remove existing menu button if any
  const existingButton = document.getElementById("menuButton");
  if (existingButton) {
    existingButton.remove();
  }

  // Create menu button
  const menuButton = document.createElement("div");
  menuButton.id = "menuButton";
  menuButton.innerHTML = "[ MENU ]";
  menuButton.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 255, 0, 0.1);
    border: 1px solid #00ff00;
    color: #00ff00;
    padding: 5px 10px;
    font-family: 'VT323', monospace;
    cursor: pointer;
    z-index: 2000;
    font-size: 12px;
  `;

  menuButton.onclick = () => {
    toggleMenu();
  };

  document.body.appendChild(menuButton);
}

function toggleMenu() {
  const statsContainer = document.getElementById("statsContainer");
  const headerSection = document.querySelector(".header-section");
  const logContainer = document.querySelector(".log-container");

  if (statsContainer && headerSection) {
    if (
      statsContainer.style.display === "none" ||
      !statsContainer.style.display
    ) {
      // Show menu
      statsContainer.style.display = "flex";
      headerSection.style.display = "block";

      // Show log container in menu mode
      if (logContainer) {
        logContainer.style.display = "block";
      }

      // Hide timer container
      const container = document.querySelector(".container");
      if (container) {
        container.style.display = "none";
        container.classList.remove("centered");
      }
    } else {
      // Hide menu
      statsContainer.style.display = "none";
      headerSection.style.display = "none";

      // Hide log container in timer mode
      if (logContainer) {
        logContainer.style.display = "none";
      }

      // Show timer container
      const container = document.querySelector(".container");
      if (container) {
        container.style.display = "flex";
        container.classList.add("centered");
      }
    }
  }
}

// Authentication UI and Logic
function showAuthPrompt() {
  stopApp();
  if (document.querySelector(".overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
        <div class="auth-prompt">
            <h2>> SHOGUN ECO TERMINAL</h2>
            <input type="text" id="username" placeholder="OPERATOR ALIAS" autocomplete="username" />
            <input type="password" id="password" placeholder="PASSWORD" autocomplete="current-password" />
            <input type="password" id="confirmPassword" placeholder="CONFIRM PASSWORD" autocomplete="new-password" style="display: none;" />
            <div class="auth-error" id="authError"></div>
            <div class="auth-buttons">
                <div class="button" id="loginBtn">LOGIN</div>
                <div class="button" id="signupBtn">SIGN UP</div>
                <div class="button" id="confirmBtn" style="display: none;">CONFIRM</div>
                <div class="button" id="pairLoginBtn">🔑 LOGIN WITH PAIR</div>
            </div>
        </div>
    `;
  document.body.appendChild(overlay);

  const usernameInput = overlay.querySelector("#username");
  const passwordInput = overlay.querySelector("#password");
  const confirmPasswordInput = overlay.querySelector("#confirmPassword");
  const errorDiv = overlay.querySelector("#authError");

  overlay.querySelector("#loginBtn").onclick = async () => {
    try {
      // Hide confirm password field and confirm button for login
      confirmPasswordInput.style.display = "none";
      overlay.querySelector("#confirmBtn").style.display = "none";
      errorDiv.textContent = "";

      const result = await shogun.login(
        usernameInput.value,
        passwordInput.value
      );
      if (result.success) {
        overlay.remove();
        // Store user alias in GunDB for future reference
        gun
          .get("users")
          .get(result.userPub)
          .put({ alias: usernameInput.value });
        startApp(usernameInput.value);
      } else {
        errorDiv.textContent = result.error || "Login failed";
      }
    } catch (error) {
      errorDiv.textContent = error.message || "Login failed";
    }
  };

  // Add click handler to show confirm password field when signup is clicked
  overlay.querySelector("#signupBtn").onclick = () => {
    confirmPasswordInput.style.display = "block";
    overlay.querySelector("#confirmBtn").style.display = "inline-block";
    errorDiv.textContent = "Please confirm your password";
  };

  // Add actual signup handler
  const performSignup = async () => {
    try {
      // Validate password length first
      if (passwordInput.value.length < 12) {
        errorDiv.textContent = "Password must be at least 12 characters long";
        return;
      }

      // Validate passwords match
      if (passwordInput.value !== confirmPasswordInput.value) {
        errorDiv.textContent = "Passwords do not match";
        return;
      }

      const result = await shogun.signUp(
        usernameInput.value,
        passwordInput.value
      );
      if (result.success) {
        // Store user alias in GunDB for future reference
        gun
          .get("users")
          .get(result.userPub)
          .put({ alias: usernameInput.value });
        // Auto-login after successful signup
        const loginResult = await shogun.login(
          usernameInput.value,
          passwordInput.value
        );
        if (loginResult.success) {
          overlay.remove();
          startApp(usernameInput.value);
        } else {
          errorDiv.textContent = "Signup successful but login failed";
        }
      } else {
        errorDiv.textContent = result.error || "Signup failed";
      }
    } catch (error) {
      errorDiv.textContent = error.message || "Signup failed";
    }
  };

  // Add click handler for confirm button
  overlay.querySelector("#confirmBtn").onclick = performSignup;

  // Add click handler for pair login button
  overlay.querySelector("#pairLoginBtn").onclick = showPairLoginModal;

  // Add enter key handler for confirm password field
  confirmPasswordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      performSignup();
    }
  });
}

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
  historyRef.map().once((data, id) => {
    if (data && data.timestamp) {
      historyItems.push(data);
    }
  });

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

  closeBtn.onclick = () => overlay.remove();
}

// Register operator
function registerOperator(name) {
  // Register operator in the active operators list
  const operatorData = {
    name: name,
    pub: user.is.pub,
    lastSeen: Date.now(),
  };
  operatorsRef.get(user.is.pub).put(operatorData);
  addLog(`Operator ${name} registered`, "info");

  // Update operator status periodically
  setInterval(() => {
    operatorsRef.get(user.is.pub).put({
      name: name,
      pub: user.is.pub,
      lastSeen: Date.now(),
    });
  }, 10000); // Update every 10 seconds
}

// Logging function
function addLog(message, type = "info") {
  const logEntry = document.createElement("div");
  logEntry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();

  // Use alias if available, otherwise use the first 10 chars of the public key
  let operatorInfo = "";
  if (currentUser && currentUser.alias) {
    operatorInfo = ` [${currentUser.alias}]`;
  } else if (user && user.is && user.is.pub) {
    const shortPub = user.is.pub.substring(0, 10) + "...";
    operatorInfo = ` [${shortPub}]`;
  }

  logEntry.textContent = `[${timestamp}]${operatorInfo} ${message}`;

  // Only add to log container if it's visible (menu mode)
  const logContainer = document.querySelector(".log-container");
  if (logContainer && logContainer.style.display !== "none") {
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  console.log(`Log: ${message}`);

  // Add to history if it's an important event
  if (type === "success" || type === "error" || type === "warning") {
    historyRef.get(crypto.randomUUID()).put({
      timestamp: Date.now(),
      operator: currentUser
        ? currentUser.alias
        : user.is
        ? user.is.pub.substring(0, 10) + "..."
        : "UNKNOWN",
      action: message,
    });
  }
}

// Typing sound function with error handling and volume control
function typeSound() {
  try {
    const randomNumber = Math.floor(Math.random() * 7);
    const audio = buttonSounds[randomNumber];

    if (audio && audio.readyState >= 2) {
      // HAVE_CURRENT_DATA or higher
      audio.volume = 0.3; // Reduce volume to 30%
      audio.currentTime = 0; // Reset to start
      audio.play().catch((error) => {
        console.warn("Failed to play button sound:", error);
      });
    }
  } catch (error) {
    console.warn("Error in typeSound function:", error);
  }
}

// Function to update timer
function updateTimer(newValue, reason = "") {
  console.log("Updating timer to:", newValue);
  if (timerRef) {
    timerRef.put({
      value: newValue,
      lastUpdate: Date.now(),
      updatedBy: currentUser ? currentUser.alias : "UNKNOWN",
      reason: reason,
    });
  }
}

// Setup main timer listener to react to any change
function setupTimerListener() {
  console.log("Setting up timer listener...");
  console.log("timerRef:", timerRef);
  console.log("bigTimer element:", bigTimer);

  if (timerRef) {
    timerRef.on((data) => {
      console.log("Timer data received:", data);
      if (data && typeof data.value === "number") {
        document.title = data.value;
        bigTimer.textContent = data.value; // Update the big timer display

        let updateMessage = `Timer updated to: ${data.value}`;
        if (data.updatedBy) {
          updateMessage += ` by ${data.updatedBy}`;
        }
        addLog(updateMessage);

        // Update input state based on timer value
        updateInputState(data.value);

        if (data.value <= 4) {
          if (siren && siren.readyState >= 2) {
            siren.volume = 0.5; // Reduce volume to 50%
            siren.play().catch((error) => {
              console.warn("Failed to play siren:", error);
            });
          }
          addLog("WARNING: System failure imminent!", "warning");
        }

        if (data.value > 4) {
          if (siren) {
            siren.pause();
            siren.currentTime = 0;
          }
          // Stop system failure display if timer is reset above 4
          if (systemFailureActive) {
            stopSystemFailureDisplay();
          }
        }
      }
    });
  }
}

// Function to update input state based on timer value
function updateInputState(timerValue) {
  const input = document.querySelector(".input");
  const prompt = document.querySelector(".prompt");
  const container = document.querySelector(".container");

  if (timerValue <= 4) {
    // Enable input in last 4 minutes
    input.disabled = false;
    input.placeholder = "Enter code sequence...";
    if (prompt) {
      prompt.style.opacity = "1";
      prompt.style.color = "#00ff00";
      prompt.style.display = "block";
    }
    if (input) {
      input.style.opacity = "1";
      input.style.color = "#00ff00";
      input.style.borderColor = "#00ff00";
      input.style.display = "block";
    }
  } else {
    // Disable input when timer > 4
    input.disabled = true;
    input.placeholder = "Code input locked until last 4 minutes";
    if (prompt) {
      prompt.style.opacity = "0.5";
      prompt.style.color = "#666";
      prompt.style.display = "none";
    }
    if (input) {
      input.style.opacity = "0.5";
      input.style.color = "#666";
      input.style.borderColor = "#666";
      input.style.display = "none";
    }
  }
}

// Input handler
input.onkeydown = (event) => {
  if (!currentUser) {
    addLog("ERROR: Operator registration required", "error");
    // Do not create a new prompt if one is already open
    if (!document.querySelector(".overlay")) {
      showAuthPrompt();
    }
    return;
  }

  typeSound();
  if (event.key === "Enter") {
    input.value = input.value.trim();

    // Check if input is allowed (only in last 4 minutes)
    timerRef.once((timerData) => {
      const currentTimer = timerData?.value || 108;

      if (currentTimer > 4) {
        addLog(
          "WARNING: Code input only allowed in last 4 minutes of countdown",
          "warning"
        );
        input.value = "";
        return;
      }

      if (input.value === "4 8 15 16 23 42") {
        // Stop system failure display if active
        stopSystemFailureDisplay();

        updateTimer(108, "code_correct");

        // Increment successful resets stat
        statsRef.once((currentStats) => {
          if (currentStats) {
            statsRef.put({ resets: (currentStats.resets || 0) + 1 });
          }
        });

        // Update user's personal points and streak
        user.get("profile").once((profile) => {
          let pointsToAdd = 1; // Base points for successful reset
          const newStreak = (profile.resetStreak || 0) + 1;

          // Check station parameters balance for bonus points
          const parameterBonus = calculateParameterBalanceBonus();
          if (parameterBonus > 0) {
            pointsToAdd += parameterBonus;
            addLog(
              `Station parameters balanced! +${parameterBonus} bonus points.`,
              "success"
            );
          } else {
            addLog(
              "Station parameters need attention. Base points only.",
              "warning"
            );
          }

          // Check if user was first to reset
          timerRef.once((timerData) => {
            if (timerData.updatedBy !== currentUser.alias) {
              pointsToAdd += 2; // +2 for being first
              addLog("First to reset! +2 bonus points.", "success");
            }

            if (newStreak % 4 === 0 && newStreak > 0) {
              pointsToAdd += 1; // +1 bonus for 4-in-a-row streak
              addLog("Reset streak x4! +1 bonus point.", "success");
            }

            const newPoints = (profile.points || 0) + pointsToAdd;
            const newLevel = getLevelFromPoints(newPoints);

            if (newLevel > profile.level) {
              addLog(`LEVEL UP! You are now Level ${newLevel}.`, "success");
            }

            const newProfile = {
              points: newPoints,
              level: newLevel,
              resetStreak: newStreak,
              resets: (profile.resets || 0) + 1,
            };
            // Update user's private profile
            user.get("profile").put(newProfile);

            // Update the public leaderboard with public data
            gun.get("leaderboard").get(currentUser.alias).put({
              points: newPoints,
              level: newLevel,
            });
          });
        });

        input.value = "";
        if (siren) {
          siren.pause();
          siren.currentTime = 0;
        }
        if (reset && reset.readyState >= 2) {
          reset.volume = 0.6; // Reduce volume to 60%
          reset.play().catch((error) => {
            console.warn("Failed to play reset sound:", error);
          });
        }
        addLog("Numbers entered correctly. Timer reset.", "success");
      } else if (input.value !== "") {
        addLog("Incorrect code sequence. Input ignored.", "warning");

        // Reset the user's streak on incorrect code
        user.get("profile").put({ resetStreak: 0 });

        input.value = "";
        if (siren && siren.readyState >= 2) {
          siren.volume = 0.5;
          siren.play().catch((error) => {
            console.warn("Failed to play siren for incorrect code:", error);
          });
        }
      }
    });
  }
};

// Timer decrement function
function decrementTimer() {
  if (!timerRef) {
    console.log("Timer reference lost, reinitializing...");
    timerRef = gun.get("swan").get("timer");
  }

  timerRef.once((data) => {
    if (!data || typeof data.value !== "number") {
      console.log("Invalid timer data, resetting...");
      updateTimer(108, "timer_reset");
      return;
    }

    // Sync with server time
    const now = Date.now();
    if (data.lastUpdate) {
      const minutesPassed = Math.floor((now - data.lastUpdate) / 60000);
      if (minutesPassed > 1) {
        const newValue = Math.max(1, data.value - minutesPassed);
        updateTimer(newValue, "time_sync");
        return;
      }
    }

    // Normal decrement
    if (data.value > 1) {
      updateTimer(data.value - 1, "timer_tick");
      if (tick && tick.readyState >= 2) {
        tick.volume = 0.2; // Very low volume for tick sound
        tick.play().catch((error) => {
          console.warn("Failed to play tick sound:", error);
        });
      }
    } else if (data.value <= 1 && data.value > 0) {
      // Timer has reached 0, trigger system failure
      triggerSystemFailure();
      if (tick && tick.readyState >= 2) {
        tick.volume = 0.2;
        tick.play().catch((error) => {
          console.warn("Failed to play tick sound for system failure:", error);
        });
      }
    }
  });
}

// Generate avatar from public key using Multiavatar
function generateAvatar(pubKey) {
  try {
    // Use the public key as seed for consistent avatar generation
    const avatarSvg = multiavatar(pubKey, false);

    // Convert SVG to data URL
    return (
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(avatarSvg)))
    );
  } catch (error) {
    console.error("Error generating Multiavatar:", error);

    // Fallback to original avatar generation
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    // Generate colors from pubKey
    const color1 = "#" + pubKey.slice(-6);
    const color2 = "#" + pubKey.slice(-12, -6);
    const color3 = "#" + pubKey.slice(-18, -12);

    // Black background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 128, 128);

    // DHARMA green border
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);

    // Inner border
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 112, 112);

    // Generate unique pattern based on pubKey
    const pattern = [];
    for (let i = 0; i < pubKey.length; i++) {
      pattern.push(parseInt(pubKey[i], 16));
    }

    // Draw geometric pattern
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        const index = (i * 16 + j) % pattern.length;
        const value = pattern[index];

        if (value % 3 === 0) {
          ctx.fillStyle = color1;
          ctx.fillRect(i * 8, j * 8, 8, 8);
        } else if (value % 3 === 1) {
          ctx.fillStyle = color2;
          ctx.fillRect(i * 8, j * 8, 8, 8);
        } else {
          ctx.fillStyle = color3;
          ctx.fillRect(i * 8, j * 8, 8, 8);
        }
      }
    }

    // Add DHARMA symbol in center
    ctx.fillStyle = "#00ff00";
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DH", 64, 64);

    // Add subtle glow effect
    ctx.shadowColor = "#00ff00";
    ctx.shadowBlur = 10;
    ctx.fillText("DH", 64, 64);

    return canvas.toDataURL();
  }
}

function showProfile() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
        <div class="chat-modal profile-modal">
            <div class="terminal-header">> OPERATOR PROFILE</div>
            <div class="terminal-content">
                <div class="profile-content">
                <div class="profile-section">
                    <div class="profile-avatar">
                        <img id="operatorAvatar" src="" alt="Operator Avatar" />
                        <div class="avatar-status" id="avatarStatus">ONLINE</div>
                    </div>
                    <div class="profile-info">
                        <div class="info-row">
                            <span class="info-label">ALIAS:</span> 
                            <span class="info-value" id="profileAlias"></span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">LEVEL:</span> 
                            <span class="info-value" id="profileLevel"></span>
                            <span class="level-progress" id="levelProgress"></span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">POINTS:</span> 
                            <span class="info-value" id="profilePoints"></span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">LOCATION:</span> 
                            <span class="info-value" id="profileLocation"></span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">JOINED:</span> 
                            <span class="info-value" id="profileJoined"></span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-stats">
                    <div class="section-header">OPERATOR STATISTICS</div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">SUCCESSFUL RESETS</div>
                            <div class="stat-value" id="profileResets">0</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">TASKS COMPLETED</div>
                            <div class="stat-value" id="profileTasks">0</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">NETWORK CONTRIBUTION</div>
                            <div class="stat-value" id="profileContribution">0</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">UPTIME</div>
                            <div class="stat-value" id="profileUptime">0h</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">RANK</div>
                            <div class="stat-value" id="profileRank">#--</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">REPUTATION</div>
                            <div class="stat-value" id="profileReputation">100%</div>
                        </div>
                    </div>
                </div>
                
                <div class="profile-actions">
                    <div class="location-section">
                        <div class="section-subheader">LOCATION MANAGEMENT</div>
                        <div class="location-input-group">
                            <input type="text" id="locationInput" placeholder="Enter your location..." />
                            <button id="updateLocation" class="terminal-button primary-button">UPDATE LOCATION</button>
                        </div>
                        <div class="location-buttons">
                            <button id="getGPSLocation" class="terminal-button gps-button">📍 GET GPS LOCATION</button>
                            <button id="selectLocation" class="terminal-button location-button">🌍 SELECT LOCATION</button>
                        </div>
                    </div>
                    <div class="profile-actions-secondary">
                        <button id="exportPair" class="terminal-button secondary-button">EXPORT PAIR</button>
                        <button id="refreshProfile" class="terminal-button secondary-button">🔄 REFRESH</button>
                    </div>
                </div>
                </div>
            </div>
            <div class="terminal-footer">CLOSE</div>
        </div>
    `;
  document.body.appendChild(overlay);

  // Aggiorna le informazioni del profilo
  const updateProfile = () => {
    user.get("profile").on((profile) => {
      if (profile) {
        const profileAlias = document.getElementById("profileAlias");
        const profileLevel = document.getElementById("profileLevel");
        const profilePoints = document.getElementById("profilePoints");
        const profileLocation = document.getElementById("profileLocation");
        const profileResets = document.getElementById("profileResets");
        const profileTasks = document.getElementById("profileTasks");
        const profileContribution = document.getElementById(
          "profileContribution"
        );
        const profileUptime = document.getElementById("profileUptime");
        const profileRank = document.getElementById("profileRank");
        const profileReputation = document.getElementById("profileReputation");
        const profileJoined = document.getElementById("profileJoined");
        const levelProgress = document.getElementById("levelProgress");
        const operatorAvatar = document.getElementById("operatorAvatar");
        const avatarStatus = document.getElementById("avatarStatus");

        if (profileAlias) profileAlias.textContent = currentUser.alias;
        if (profileLevel) profileLevel.textContent = currentUser.level;
        if (profilePoints) profilePoints.textContent = currentUser.points;
        if (profileLocation)
          profileLocation.textContent = profile.location || "NOT SET";
        if (profileResets) profileResets.textContent = profile.resets || 0;
        if (profileTasks)
          profileTasks.textContent = profile.tasksCompleted || 0;
        if (profileContribution)
          profileContribution.textContent = profile.networkContribution || 0;
        if (profileUptime) profileUptime.textContent = profile.uptime || "0h";
        if (profileRank) profileRank.textContent = profile.rank || "#--";
        if (profileReputation)
          profileReputation.textContent = profile.reputation || "100%";
        if (profileJoined)
          profileJoined.textContent = profile.joinedDate || "UNKNOWN";
        if (avatarStatus) avatarStatus.textContent = "ONLINE";

        // Calculate level progress
        if (levelProgress) {
          const pointsToNextLevel = Math.max(
            0,
            (currentUser.level + 1) * 10 - currentUser.points
          );
          levelProgress.textContent = `(${pointsToNextLevel} TO LVL ${
            currentUser.level + 1
          })`;
        }

        // Genera e imposta l'avatar automaticamente
        if (operatorAvatar) {
          const avatar = generateAvatar(user.is.pub);
          operatorAvatar.src = avatar;

          // Salva l'avatar nel profilo per persistenza
          user.get("profile").get("avatar").put(avatar);
        }
      }
    });
  };

  // Gestisci l'aggiornamento della location
  const updateLocationBtn = document.getElementById("updateLocation");
  if (updateLocationBtn) {
    updateLocationBtn.onclick = () => {
      const locationInput = document.getElementById("locationInput");
      const profileLocation = document.getElementById("profileLocation");

      if (locationInput) {
        const location = locationInput.value.trim();
        if (location) {
          // Save location to user profile
          user.get("profile").get("location").put(location);

          if (profileLocation) {
            profileLocation.textContent = location;
          }

          locationInput.value = "";

          // Also save to the users collection for easier retrieval
          gun
            .get("users")
            .get(user.is.pub)
            .get("profile")
            .get("location")
            .put(location);

          // Log the location update
          addLog(`Location updated to: ${location}`, "success");
          console.log(`Location saved for ${currentUser.alias}: ${location}`);
        }
      }
    };
  }

  // GPS Location Function
  document.getElementById("getGPSLocation").onclick = () => {
    const gpsButton = document.getElementById("getGPSLocation");
    const locationInput = document.getElementById("locationInput");

    if (navigator.geolocation) {
      gpsButton.textContent = "📍 GETTING LOCATION...";
      gpsButton.disabled = true;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Use reverse geocoding to get location name
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          )
            .then((response) => response.json())
            .then((data) => {
              let locationName = "Unknown Location";

              if (data.display_name) {
                // Extract city and country from the full address
                const parts = data.display_name.split(", ");
                if (parts.length >= 2) {
                  locationName = `${parts[0]}, ${parts[parts.length - 1]}`;
                } else {
                  locationName = data.display_name;
                }
              }

              // Update the input field
              locationInput.value = locationName;

              // Auto-update the profile
              user.get("profile").get("location").put(locationName);
              // Also save to the users collection for easier retrieval
              gun
                .get("users")
                .get(user.is.pub)
                .get("profile")
                .get("location")
                .put(locationName);
              document.getElementById("profileLocation").textContent =
                locationName;

              gpsButton.textContent = "📍 LOCATION SET!";
              setTimeout(() => {
                gpsButton.textContent = "📍 GET GPS LOCATION";
                gpsButton.disabled = false;
              }, 2000);
            })
            .catch(() => {
              // Fallback to coordinates if geocoding fails
              const locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(
                4
              )}`;
              locationInput.value = locationName;
              user.get("profile").get("location").put(locationName);
              // Also save to the users collection for easier retrieval
              gun
                .get("users")
                .get(user.is.pub)
                .get("profile")
                .get("location")
                .put(locationName);
              document.getElementById("profileLocation").textContent =
                locationName;

              gpsButton.textContent = "📍 LOCATION SET!";
              setTimeout(() => {
                gpsButton.textContent = "📍 GET GPS LOCATION";
                gpsButton.disabled = false;
              }, 2000);
            });
        },
        (error) => {
          console.error("GPS Error:", error);
          gpsButton.textContent = "📍 GPS ERROR";
          setTimeout(() => {
            gpsButton.textContent = "📍 GET GPS LOCATION";
            gpsButton.disabled = false;
          }, 2000);

          // Show location selector when GPS fails
          showLocationSelector();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    } else {
      gpsButton.textContent = "📍 GPS NOT AVAILABLE";
      setTimeout(() => {
        gpsButton.textContent = "📍 GET GPS LOCATION";
      }, 2000);

      // Show location selector when GPS is not available
      showLocationSelector();
    }
  };

  // Location Selector Function
  document.getElementById("selectLocation").onclick = showLocationSelector;

  // Show Location Selector Modal
  function showLocationSelector() {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="location-selector-modal">
        <h2>&gt; SELECT LOCATION</h2>
        
        <div class="location-search">
          <input type="text" id="locationSearch" placeholder="Search location..." />
        </div>
        
        <div class="location-categories">
          <div class="category-section">
            <h3>MAJOR CITIES</h3>
            <div class="location-grid">
              <div class="location-item" data-location="New York, USA" data-coords="40.7128,-74.0060">New York, USA</div>
              <div class="location-item" data-location="London, UK" data-coords="51.5074,-0.1278">London, UK</div>
              <div class="location-item" data-location="Tokyo, Japan" data-coords="35.6762,139.6503">Tokyo, Japan</div>
              <div class="location-item" data-location="Paris, France" data-coords="48.8566,2.3522">Paris, France</div>
              <div class="location-item" data-location="Milan, Italy" data-coords="45.4642,9.1900">Milan, Italy</div>
              <div class="location-item" data-location="Berlin, Germany" data-coords="52.5200,13.4050">Berlin, Germany</div>
              <div class="location-item" data-location="Madrid, Spain" data-coords="40.4168,-3.7038">Madrid, Spain</div>
              <div class="location-item" data-location="Rome, Italy" data-coords="41.9028,12.4964">Rome, Italy</div>
            </div>
          </div>
          
          <div class="category-section">
            <h3>EUROPE</h3>
            <div class="location-grid">
              <div class="location-item" data-location="Amsterdam, Netherlands" data-coords="52.3676,4.9041">Amsterdam, Netherlands</div>
              <div class="location-item" data-location="Barcelona, Spain" data-coords="41.3851,2.1734">Barcelona, Spain</div>
              <div class="location-item" data-location="Vienna, Austria" data-coords="48.2082,16.3738">Vienna, Austria</div>
              <div class="location-item" data-location="Prague, Czech Republic" data-coords="50.0755,14.4378">Prague, Czech Republic</div>
              <div class="location-item" data-location="Budapest, Hungary" data-coords="47.4979,19.0402">Budapest, Hungary</div>
              <div class="location-item" data-location="Warsaw, Poland" data-coords="52.2297,21.0122">Warsaw, Poland</div>
            </div>
          </div>
          
          <div class="category-section">
            <h3>AMERICAS</h3>
            <div class="location-grid">
              <div class="location-item" data-location="Los Angeles, USA" data-coords="34.0522,-118.2437">Los Angeles, USA</div>
              <div class="location-item" data-location="Chicago, USA" data-coords="41.8781,-87.6298">Chicago, USA</div>
              <div class="location-item" data-location="Toronto, Canada" data-coords="43.6532,-79.3832">Toronto, Canada</div>
              <div class="location-item" data-location="Mexico City, Mexico" data-coords="19.4326,-99.1332">Mexico City, Mexico</div>
              <div class="location-item" data-location="São Paulo, Brazil" data-coords="-23.5505,-46.6333">São Paulo, Brazil</div>
              <div class="location-item" data-location="Buenos Aires, Argentina" data-coords="-34.6118,-58.3960">Buenos Aires, Argentina</div>
            </div>
          </div>
          
          <div class="category-section">
            <h3>ASIA & OCEANIA</h3>
            <div class="location-grid">
              <div class="location-item" data-location="Seoul, South Korea" data-coords="37.5665,126.9780">Seoul, South Korea</div>
              <div class="location-item" data-location="Singapore" data-coords="1.3521,103.8198">Singapore</div>
              <div class="location-item" data-location="Sydney, Australia" data-coords="-33.8688,151.2093">Sydney, Australia</div>
              <div class="location-item" data-location="Melbourne, Australia" data-coords="-37.8136,144.9631">Melbourne, Australia</div>
              <div class="location-item" data-location="Bangkok, Thailand" data-coords="13.7563,100.5018">Bangkok, Thailand</div>
              <div class="location-item" data-location="Hong Kong" data-coords="22.3193,114.1694">Hong Kong</div>
            </div>
          </div>
        </div>
        
        <div class="button" id="closeLocationSelector">CLOSE</div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Add search functionality
    const searchInput = overlay.querySelector("#locationSearch");
    const locationItems = overlay.querySelectorAll(".location-item");

    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();

      locationItems.forEach((item) => {
        const locationName = item.textContent.toLowerCase();
        if (locationName.includes(searchTerm)) {
          item.style.display = "block";
        } else {
          item.style.display = "none";
        }
      });
    });

    // Add click handlers for location items
    locationItems.forEach((item) => {
      item.addEventListener("click", () => {
        const location = item.getAttribute("data-location");
        const coords = item.getAttribute("data-coords");

        // Update the location input and profile
        const locationInput = document.getElementById("locationInput");
        if (locationInput) {
          locationInput.value = location;
        }

        // Update profile
        user.get("profile").get("location").put(location);
        // Also save to the users collection for easier retrieval
        gun
          .get("users")
          .get(user.is.pub)
          .get("profile")
          .get("location")
          .put(location);
        document.getElementById("profileLocation").textContent = location;

        // Add to log
        addLog(`Location set to: ${location}`, "success");

        // Close modal
        overlay.remove();
      });
    });

    overlay.querySelector("#closeLocationSelector").onclick = () =>
      overlay.remove();
  }

  // Export pair handler
  document.getElementById("exportPair").onclick = () => {
    if (user.is) {
      const pair = user._.sea;
      const pairString = JSON.stringify(pair);

      // Create a temporary textarea to copy the pair data
      const textarea = document.createElement("textarea");
      textarea.value = pairString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      addLog("Pair data copied to clipboard", "success");
    }
  };

  // Show Pair Login Modal
  function showPairLoginModal() {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="pair-login-modal">
        <h2>&gt; LOGIN WITH PAIR</h2>
        
        <div class="pair-input-section">
          <textarea id="pairInput" placeholder="Paste your pair data here..." rows="8"></textarea>
        </div>
        
        <div class="pair-buttons">
          <button id="loginWithPairBtn" class="terminal-button">LOGIN WITH PAIR</button>
          <button id="cancelPairLogin" class="terminal-button">CANCEL</button>
        </div>
        
        <div class="pair-info">
          <p>Paste the exported pair data to login without password</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Handle pair login
    document.getElementById("loginWithPairBtn").onclick = async () => {
      const pairInput = document.getElementById("pairInput").value.trim();

      if (!pairInput) {
        addLog("Please paste pair data", "error");
        return;
      }

      try {
        const pair = JSON.parse(pairInput);

        // Use shogun-core's loginWithPair method
        const result = await shogun.loginWithPair(pair);

        if (result.success) {
          addLog("Login with pair successful", "success");
          overlay.remove();

          // Start the app with the logged in user
          const userPub = result.userPub;
          if (userPub) {
            // Get user alias from GunDB
            const alias = await getUserAlias(userPub);
            if (alias) {
              startApp(alias);
            } else {
              startApp("Operator");
            }
          }
        } else {
          addLog(
            "Login with pair failed: " + (result.error || "Unknown error"),
            "error"
          );
        }
      } catch (error) {
        addLog("Invalid pair data format", "error");
        console.error("Pair login error:", error);
      }
    };

    document.getElementById("cancelPairLogin").onclick = () => overlay.remove();
  }

  // Refresh profile handler
  document.getElementById("refreshProfile").onclick = () => {
    updateProfile();
    addLog("Profile refreshed", "info");
  };

  // Chiudi il profilo
  overlay.querySelector(".terminal-footer").onclick = () => overlay.remove();

  // Add touch-friendly close functionality
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Aggiorna il profilo inizialmente
  updateProfile();
}

// Aggiorna updateStatsUI per includere il pulsante del profilo e il sistema di task
function updateStatsUI(newStats) {
  stats = newStats;
  const pointsToNextLevel = currentUser
    ? levels[currentUser.level + 1] - currentUser.points
    : 0;

  statsContainer.innerHTML = `
        <div class="stats-bar">
            <div class="operator-stats">
                <span class="level">LEVEL ${
                  currentUser ? currentUser.level : "--"
                }</span>
                <span class="points">${
                  currentUser ? currentUser.points : "--"
                } POINTS</span>
                ${
                  currentUser && currentUser.level < 25
                    ? `<span class="next-level">(${pointsToNextLevel} TO LVL ${
                        currentUser.level + 1
                      })</span>`
                    : ""
                }
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
            </div>
        </div>
    `;

  // Add click handlers for all buttons
  const profileBtn = document.getElementById("profileBtn");
  const globalStatsBtn = document.getElementById("globalStatsBtn");
  const leaderboardBtn = document.getElementById("leaderboardBtn");
  const historyBtn = document.getElementById("historyBtn");
  const tasksBtn = document.getElementById("tasksBtn");
  const chatBtn = document.getElementById("chatBtn");
  const networkBtn = document.getElementById("networkBtn");
  const mapBtn = document.getElementById("mapBtn");

  if (profileBtn) profileBtn.onclick = showProfile;
  if (globalStatsBtn) globalStatsBtn.onclick = showGlobalStats;
  if (leaderboardBtn) leaderboardBtn.onclick = showLeaderboard;
  if (historyBtn) historyBtn.onclick = showHistory;
  if (tasksBtn) tasksBtn.onclick = showTaskSystem;
  if (chatBtn) chatBtn.onclick = showChat;
  if (networkBtn) networkBtn.onclick = showNetworkAnalytics;
  if (mapBtn) mapBtn.onclick = showOperatorsMap;

  // Debug: Check if all buttons were found (only log once)
  if (!window.buttonsInitialized) {
    console.log("Button elements found:", {
      profileBtn: !!profileBtn,
      globalStatsBtn: !!globalStatsBtn,
      leaderboardBtn: !!leaderboardBtn,
      historyBtn: !!historyBtn,
      tasksBtn: !!tasksBtn,
      chatBtn: !!chatBtn,
      networkBtn: !!networkBtn,
      mapBtn: !!mapBtn,
    });

    // Test if buttons are clickable
    if (profileBtn) {
      profileBtn.addEventListener("click", () => {
        console.log("✅ Profile button clicked successfully!");
      });
    }

    // Test task buttons if they exist
    setTimeout(() => {
      const acceptButtons = document.querySelectorAll(".task-btn.accept");
      acceptButtons.forEach((btn, index) => {
        btn.addEventListener("click", () => {
          console.log(`✅ Task ACCEPT button ${index} clicked successfully!`);
        });
      });
      console.log(`Found ${acceptButtons.length} ACCEPT buttons`);
    }, 1000);

    window.buttonsInitialized = true;
  }
}

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
            </div>
            <div class="button" id="closeStats">CLOSE</div>
        </div>
    `;
  document.body.appendChild(overlay);

  overlay.querySelector("#closeStats").onclick = () => overlay.remove();
}

function triggerSystemFailure() {
  addLog("CRITICAL: SYSTEM FAILURE DETECTED.", "error");

  // Start continuous SYSTEM FAILURE display
  startSystemFailureDisplay();

  statsRef.once((currentStats) => {
    if (currentStats) {
      statsRef.put({
        failures: (currentStats.failures || 0) + 1,
      });
    }
  });
  // No penalty countdown - system failure stays at 0
  updateTimer(0, "system_failure");

  // Update user's profile statistics on system failure
  user.get("profile").once((profile) => {
    const updatedProfile = {
      ...(profile || {}),
      resetStreak: 0,
    };
    user.get("profile").put(updatedProfile);
  });
}

// Global variable to track system failure state
let systemFailureInterval = null;
let systemFailureActive = false;

function startSystemFailureDisplay() {
  if (systemFailureActive) return; // Prevent multiple intervals

  systemFailureActive = true;

  // Create or update the system failure display
  let failureDisplay = document.getElementById("systemFailureDisplay");
  if (!failureDisplay) {
    failureDisplay = document.createElement("div");
    failureDisplay.id = "systemFailureDisplay";
    failureDisplay.className = "system-failure-display";
    document.body.appendChild(failureDisplay);
  }

  // Start continuous SYSTEM FAILURE messages
  systemFailureInterval = setInterval(() => {
    addLog("SYSTEM FAILURE", "error");

    // Update the visual display
    failureDisplay.textContent = "SYSTEM FAILURE";
    failureDisplay.style.display = "block";

    // Flash effect
    failureDisplay.style.opacity =
      failureDisplay.style.opacity === "0.5" ? "1" : "0.5";
  }, 1000); // Every second
}

function stopSystemFailureDisplay() {
  if (systemFailureInterval) {
    clearInterval(systemFailureInterval);
    systemFailureInterval = null;
  }

  systemFailureActive = false;

  // Hide the display
  const failureDisplay = document.getElementById("systemFailureDisplay");
  if (failureDisplay) {
    failureDisplay.style.display = "none";
  }
}

// Connection status update function
function updateConnectionStatus(status, className) {
  const statusElement = document.getElementById("connectionStatus");
  if (statusElement) {
    statusElement.textContent = status;
    statusElement.className = `connection-status ${className}`;
  }
}

// Network Analytics Function
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
            <span class="metric-value" id="messagesStored">0</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Timer Updates:</span>
            <span class="metric-value" id="timerUpdates">0</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">User Profiles:</span>
            <span class="metric-value" id="userProfiles">0</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Session Duration:</span>
            <span class="metric-value" id="sessionDuration">0m</span>
          </div>
        </div>
      </div>
      
      <div class="button" id="closeNetwork">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Initialize network analytics
  initializeNetworkMetrics();

  // Initialize relay management
  initializeRelayManagement();

  overlay.querySelector("#closeNetwork").onclick = () => overlay.remove();
}

// Show Operators Map Function
function showOperatorsMap() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="operators-map-modal">
      <h2>&gt; OPERATORS WORLD MAP</h2>
      
      <div class="map-controls">
        <div class="map-info">
          <span id="mapOperatorCount">Loading operators...</span>
        </div>
        <div class="map-legend">
          <div class="legend-item">
            <div class="legend-dot online"></div>
            <span>Online</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot offline"></div>
            <span>Offline</span>
          </div>
        </div>
        <button id="debugLocationBtn" class="terminal-button" style="font-size: 0.8em; padding: 5px 10px;">DEBUG</button>
        <button id="refreshMapBtn" class="terminal-button" style="font-size: 0.8em; padding: 5px 10px;">REFRESH</button>
      </div>
      
      <div class="map-container">
        <div id="operatorsMap" class="operators-map"></div>
      </div>
      
      <div class="operators-list">
        <h3>ACTIVE OPERATORS</h3>
        <div id="operatorsList" class="operators-list-content">
          Loading...
        </div>
      </div>
      
      <div class="button" id="closeMap">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Initialize the map
  initializeOperatorsMap();

  // Add debug button handler
  overlay.querySelector("#debugLocationBtn").onclick = () => {
    debugLocationData();
    addLog("Location debug data logged to console", "info");
  };

  // Add refresh button handler
  overlay.querySelector("#refreshMapBtn").onclick = () => {
    initializeOperatorsMap();
    addLog("Map refreshed", "info");
  };

  overlay.querySelector("#closeMap").onclick = () => overlay.remove();

  // Add touch-friendly close functionality
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Show Task System Function
function showTaskSystem() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="task-system-modal">
      <h2>&gt; STATION TASK MANAGEMENT SYSTEM</h2>
      
      <div class="task-system-grid">
        <div class="task-section">
          <h3>STATION PARAMETERS</h3>
          <div id="stationParamsDisplay" class="station-params">
            Loading parameters...
          </div>
        </div>
        
        <div class="task-section">
          <h3>ACTIVE TASKS</h3>
          <div id="taskDisplay" class="task-list">
            Loading tasks...
          </div>
        </div>
      </div>
      
      <div class="task-controls">
        <button id="refreshTasksBtn" class="terminal-button">REFRESH TASKS</button>
        <button id="forceTaskBtn" class="terminal-button">FORCE NEW TASK</button>
        <button id="taskHistoryBtn" class="terminal-button">TASK HISTORY</button>
      </div>
      
      <div class="task-info">
        <h3>TASK SYSTEM INFO</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Active Tasks:</span>
            <span class="info-value" id="activeTaskCount">0</span>
          </div>
          <div class="info-item">
            <span class="info-label">Completed Today:</span>
            <span class="info-value" id="completedToday">0</span>
          </div>
          <div class="info-item">
            <span class="info-label">Success Rate:</span>
            <span class="info-value" id="successRate">0%</span>
          </div>
          <div class="info-item">
            <span class="info-label">Last Event:</span>
            <span class="info-value" id="lastEvent">None</span>
          </div>
        </div>
      </div>
      
      <div class="button" id="closeTaskSystem">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Initialize task system display
  updateStationParametersDisplay();
  updateTaskDisplay();
  updateTaskSystemInfo();

  // Add button handlers
  overlay.querySelector("#refreshTasksBtn").onclick = () => {
    updateTaskDisplay();
    updateTaskSystemInfo();
    addLog("Task system refreshed", "info");
  };

  overlay.querySelector("#forceTaskBtn").onclick = () => {
    if (activeTasks.length < 3) {
      // Force generate a new task
      const taskType = Math.random();
      let category, taskKey;

      if (taskType < 0.2) {
        category = "EMERGENCY";
        const emergencyTasks = Object.keys(taskTypes.EMERGENCY);
        taskKey =
          emergencyTasks[Math.floor(Math.random() * emergencyTasks.length)];
      } else if (taskType < 0.6) {
        category = "CRITICAL";
        const criticalTasks = Object.keys(taskTypes.CRITICAL);
        taskKey =
          criticalTasks[Math.floor(Math.random() * criticalTasks.length)];
      } else {
        category = "MAINTENANCE";
        const maintenanceTasks = Object.keys(taskTypes.MAINTENANCE);
        taskKey =
          maintenanceTasks[Math.floor(Math.random() * maintenanceTasks.length)];
      }

      const task = taskTypes[category][taskKey];
      const taskId = crypto.randomUUID();

      const newTask = {
        id: taskId,
        type: category,
        name: task.name,
        difficulty: task.difficulty,
        timeLimit: task.timeLimit,
        createdAt: Date.now(),
        expiresAt: Date.now() + task.timeLimit,
        assignedTo: null,
        completed: false,
        failed: false,
        parameters: generateTaskParameters(category, taskKey),
        forced: true,
      };

      taskRef.get(taskId).put(newTask);
      activeTasks.push(newTask);
      updateTaskDisplay();
      updateTaskSystemInfo();

      addLog(`FORCED TASK: ${task.name} (${category})`, "warning");
    } else {
      addLog("ERROR: Maximum active tasks reached", "error");
    }
  };

  overlay.querySelector("#taskHistoryBtn").onclick = () => {
    showTaskHistory();
  };

  overlay.querySelector("#closeTaskSystem").onclick = () => overlay.remove();

  // Update task system info periodically
  const updateInterval = safeSetInterval(() => {
    if (!document.querySelector(".task-system-modal")) {
      clearInterval(updateInterval);
      cleanupRegistry.intervals.delete(updateInterval);
      return;
    }
    updateTaskSystemInfo();
  }, 5000);

  // Update task display every second for countdown
  const taskUpdateInterval = safeSetInterval(() => {
    if (!document.querySelector(".task-system-modal")) {
      clearInterval(taskUpdateInterval);
      cleanupRegistry.intervals.delete(taskUpdateInterval);
      return;
    }
    updateTaskDisplay();
  }, 1000);
}

function updateTaskSystemInfo() {
  const activeTaskCount = document.getElementById("activeTaskCount");
  const completedToday = document.getElementById("completedToday");
  const successRate = document.getElementById("successRate");
  const lastEvent = document.getElementById("lastEvent");

  if (activeTaskCount) activeTaskCount.textContent = activeTasks.length;

  if (completedToday) {
    const today = new Date().toDateString();
    const todayTasks = taskHistory.filter(
      (task) =>
        new Date(task.createdAt).toDateString() === today && task.completed
    );
    completedToday.textContent = todayTasks.length;
  }

  if (successRate) {
    const completedTasks = taskHistory.filter(
      (task) => task.completed || task.failed
    );
    if (completedTasks.length > 0) {
      const successful = completedTasks.filter((task) => task.completed).length;
      const rate = Math.round((successful / completedTasks.length) * 100);
      successRate.textContent = `${rate}%`;
    } else {
      successRate.textContent = "0%";
    }
  }

  if (lastEvent) {
    lastEvent.textContent = stationParameters.lastEvent || "None";
  }
}

function showTaskHistory() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="task-history-modal">
      <h2>&gt; TASK HISTORY</h2>
      
      <div class="history-filters">
        <button class="filter-btn active" data-filter="all">ALL</button>
        <button class="filter-btn" data-filter="completed">COMPLETED</button>
        <button class="filter-btn" data-filter="failed">FAILED</button>
        <button class="filter-btn" data-filter="emergency">EMERGENCY</button>
      </div>
      
      <div class="task-history-list" id="taskHistoryList">
        Loading history...
      </div>
      
      <div class="button" id="closeTaskHistory">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Load task history from GunDB
  const historyTasks = [];
  taskRef.map().once((task, id) => {
    if (task && (task.completed || task.failed)) {
      historyTasks.push(task);
    }
  });

  setTimeout(() => {
    displayTaskHistory(historyTasks, "all");
  }, 1000);

  // Add filter handlers
  const filterBtns = overlay.querySelectorAll(".filter-btn");
  filterBtns.forEach((btn) => {
    btn.onclick = () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      displayTaskHistory(historyTasks, btn.dataset.filter);
    };
  });

  overlay.querySelector("#closeTaskHistory").onclick = () => overlay.remove();
}

function displayTaskHistory(tasks, filter) {
  const historyList = document.getElementById("taskHistoryList");
  if (!historyList) return;

  // Ensure tasks is an array
  if (!Array.isArray(tasks)) {
    console.warn("displayTaskHistory: tasks is not an array", tasks);
    tasks = [];
  }

  let filteredTasks = tasks;

  switch (filter) {
    case "completed":
      filteredTasks = tasks.filter((task) => task.completed);
      break;
    case "failed":
      filteredTasks = tasks.filter((task) => task.failed);
      break;
    case "emergency":
      filteredTasks = tasks.filter((task) => task.type === "EMERGENCY");
      break;
  }

  if (filteredTasks.length === 0) {
    historyList.innerHTML = '<div class="no-history">No tasks found</div>';
    return;
  }

  // Sort by creation date, newest first
  filteredTasks.sort((a, b) => b.createdAt - a.createdAt);

  const historyHTML = filteredTasks
    .slice(0, 20)
    .map((task) => {
      const date = new Date(task.createdAt).toLocaleString();
      const duration = Math.floor((task.expiresAt - task.createdAt) / 60000);

      return `
      <div class="history-task-item ${
        task.completed ? "completed" : "failed"
      } ${(task.type || "maintenance").toLowerCase()}">
        <div class="history-task-header">
          <span class="history-task-name">${task.name || "Unknown Task"}</span>
          <span class="history-task-type">${task.type || "MAINTENANCE"}</span>
        </div>
        <div class="history-task-details">
          <span class="history-task-date">${date}</span>
          <span class="history-task-duration">${duration}min</span>
          <span class="history-task-assignee">${
            task.assignedTo || "Unassigned"
          }</span>
          <span class="history-task-status">${
            task.completed ? "COMPLETED" : "FAILED"
          }</span>
        </div>
      </div>
    `;
    })
    .join("");

  historyList.innerHTML = historyHTML;
}

function showTaskNotification(task) {
  // Ensure task is valid
  if (!task || typeof task !== "object") {
    console.warn("showTaskNotification: invalid task", task);
    return;
  }

  // Create notification element
  const notification = document.createElement("div");

  if (task.completed) {
    notification.className = `task-notification completed`;
    notification.innerHTML = `
      <div class="notification-header">
        <strong>✅ TASK COMPLETED: ${task.name || "Unknown Task"}</strong>
      </div>
      <div class="notification-details">
        Type: ${task.type || "MAINTENANCE"} | Difficulty: ${
      task.difficulty || 1
    }/5 | Completed by another operator
      </div>
    `;
  } else if (task.failed) {
    notification.className = `task-notification failed`;
    notification.innerHTML = `
      <div class="notification-header">
        <strong>❌ TASK FAILED: ${task.name || "Unknown Task"}</strong>
      </div>
      <div class="notification-details">
        Type: ${task.type || "MAINTENANCE"} | Difficulty: ${
      task.difficulty || 1
    }/5 | Failed by another operator
      </div>
    `;
  } else {
    notification.className = `task-notification ${(
      task.type || "maintenance"
    ).toLowerCase()}`;
    notification.innerHTML = `
      <div class="notification-header">
        <strong>NEW TASK: ${task.name || "Unknown Task"}</strong>
      </div>
      <div class="notification-details">
        Type: ${task.type || "MAINTENANCE"} | Difficulty: ${
      task.difficulty || 1
    }/5 | Time: ${Math.floor((task.timeLimit || 300000) / 60000)}min
      </div>
    `;
  }

  // Add to page
  document.body.appendChild(notification);

  // Remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Initialize Operators Map
function initializeOperatorsMap() {
  const mapContainer = document.getElementById("operatorsMap");
  const operatorsList = document.getElementById("operatorsList");
  const operatorCount = document.getElementById("mapOperatorCount");

  if (!mapContainer || !operatorsList || !operatorCount) return;

  // Create a simple but effective map using CSS and HTML
  const mapHTML = `
    <div class="world-map">
      <div class="map-region north-america">
        <div class="region-label">NORTH AMERICA</div>
      </div>
      <div class="map-region south-america">
        <div class="region-label">SOUTH AMERICA</div>
      </div>
      <div class="map-region europe">
        <div class="region-label">EUROPE</div>
      </div>
      <div class="map-region africa">
        <div class="region-label">AFRICA</div>
      </div>
      <div class="map-region asia">
        <div class="region-label">ASIA</div>
      </div>
      <div class="map-region oceania">
        <div class="region-label">OCEANIA</div>
      </div>
    </div>
  `;

  mapContainer.innerHTML = mapHTML;

  // Collect operators data with improved location fetchiDEng
  const operators = [];
  const now = Date.now();
  let totalOperators = 0;
  let processedOperators = 0;

  // First, count total operators
  operatorsRef.map().once((data, key) => {
    if (data && data.name && data.lastSeen) {
      totalOperators++;
    }
  });

  // Then collect operator data with locations
  setTimeout(() => {
    operatorsRef.map().once((data, key) => {
      if (data && data.name && data.lastSeen) {
        const timeSinceLastSeen = now - data.lastSeen;
        const isOnline = timeSinceLastSeen < 120000; // 2 minutes

        // Get location from user profile using a more reliable approach
        gun
          .get("users")
          .get(data.pub)
          .get("profile")
          .once((userProfile) => {
            let location = "Unknown";

            if (userProfile && userProfile.location) {
              location = userProfile.location;
              console.log(`Found location for ${data.name}: ${location}`);
            }

            const operator = {
              name: data.name,
              pub: data.pub,
              lastSeen: data.lastSeen,
              isOnline: isOnline,
              location: location,
            };

            operators.push(operator);
            processedOperators++;

            // Update map and list when we have processed all operators
            if (processedOperators >= totalOperators) {
              updateMapWithOperators(operators);
              updateOperatorsList(operators);
              operatorCount.textContent = `${operators.length} OPERATORS FOUND`;
            }
          });
      }
    });
  }, 500);

  // Fallback: if no operators are found after 3 seconds, show empty state
  setTimeout(() => {
    if (operators.length === 0) {
      updateMapWithOperators([]);
      updateOperatorsList([]);
      operatorCount.textContent = "0 OPERATORS FOUND";
    }
  }, 3000);
}

// Update map with operators
function updateMapWithOperators(operators) {
  const mapContainer = document.getElementById("operatorsMap");
  if (!mapContainer) return;

  // Clear existing operator markers
  const existingMarkers = mapContainer.querySelectorAll(".operator-marker");
  existingMarkers.forEach((marker) => marker.remove());

  // Add operator markers based on their location
  let markersAdded = 0;
  operators.forEach((operator, index) => {
    if (operator.location && operator.location !== "Unknown") {
      const marker = createOperatorMarker(operator, index);
      mapContainer.appendChild(marker);
      markersAdded++;
      console.log(
        `Added marker for ${operator.name} at location: ${operator.location}`
      );
    } else {
      console.log(`No location found for operator: ${operator.name}`);
    }
  });

  console.log(
    `Total operators: ${operators.length}, Operators with locations: ${markersAdded}`
  );
}

// Create operator marker
function createOperatorMarker(operator, index) {
  const marker = document.createElement("div");
  marker.className = `operator-marker ${
    operator.isOnline ? "online" : "offline"
  }`;
  marker.innerHTML = `
    <div class="marker-dot"></div>
    <div class="marker-label">${operator.name}</div>
  `;

  // Position marker based on location (simplified positioning)
  const position = getLocationPosition(operator.location);
  if (position) {
    marker.style.left = position.x + "%";
    marker.style.top = position.y + "%";
  }

  // Add click handler to show operator info
  marker.addEventListener("click", () => {
    showOperatorInfo(operator);
  });

  return marker;
}

// Get position for location (simplified mapping)
function getLocationPosition(location) {
  const locationMap = {
    "New York, USA": { x: 20, y: 30 },
    "London, UK": { x: 48, y: 25 },
    "Tokyo, Japan": { x: 85, y: 30 },
    "Paris, France": { x: 48, y: 28 },
    "Milan, Italy": { x: 50, y: 32 },
    "Berlin, Germany": { x: 52, y: 26 },
    "Madrid, Spain": { x: 46, y: 35 },
    "Rome, Italy": { x: 51, y: 35 },
    "Amsterdam, Netherlands": { x: 47, y: 24 },
    "Barcelona, Spain": { x: 47, y: 34 },
    "Vienna, Austria": { x: 53, y: 30 },
    "Prague, Czech Republic": { x: 54, y: 28 },
    "Budapest, Hungary": { x: 55, y: 30 },
    "Warsaw, Poland": { x: 56, y: 26 },
    "Los Angeles, USA": { x: 15, y: 35 },
    "Chicago, USA": { x: 22, y: 28 },
    "Toronto, Canada": { x: 23, y: 22 },
    "Mexico City, Mexico": { x: 18, y: 45 },
    "São Paulo, Brazil": { x: 30, y: 65 },
    "Buenos Aires, Argentina": { x: 28, y: 75 },
    "Seoul, South Korea": { x: 82, y: 30 },
    Singapore: { x: 75, y: 55 },
    "Sydney, Australia": { x: 85, y: 70 },
    "Melbourne, Australia": { x: 83, y: 72 },
    "Bangkok, Thailand": { x: 78, y: 50 },
    "Hong Kong": { x: 80, y: 45 },
    // Add more flexible matching for common variations
    Milan: { x: 50, y: 32 },
    Italy: { x: 50, y: 32 },
    "New York": { x: 20, y: 30 },
    USA: { x: 20, y: 30 },
    London: { x: 48, y: 25 },
    UK: { x: 48, y: 25 },
    Tokyo: { x: 85, y: 30 },
    Japan: { x: 85, y: 30 },
    Paris: { x: 48, y: 28 },
    France: { x: 48, y: 28 },
    Berlin: { x: 52, y: 26 },
    Germany: { x: 52, y: 26 },
    Madrid: { x: 46, y: 35 },
    Spain: { x: 46, y: 35 },
    Rome: { x: 51, y: 35 },
    Amsterdam: { x: 47, y: 24 },
    Netherlands: { x: 47, y: 24 },
    Barcelona: { x: 47, y: 34 },
    Vienna: { x: 53, y: 30 },
    Austria: { x: 53, y: 30 },
    Prague: { x: 54, y: 28 },
    "Czech Republic": { x: 54, y: 28 },
    Budapest: { x: 55, y: 30 },
    Hungary: { x: 55, y: 30 },
    Warsaw: { x: 56, y: 26 },
    Poland: { x: 56, y: 26 },
    "Los Angeles": { x: 15, y: 35 },
    Chicago: { x: 22, y: 28 },
    Toronto: { x: 23, y: 22 },
    Canada: { x: 23, y: 22 },
    "Mexico City": { x: 18, y: 45 },
    Mexico: { x: 18, y: 45 },
    "São Paulo": { x: 30, y: 65 },
    Brazil: { x: 30, y: 65 },
    "Buenos Aires": { x: 28, y: 75 },
    Argentina: { x: 28, y: 75 },
    Seoul: { x: 82, y: 30 },
    "South Korea": { x: 82, y: 30 },
    Sydney: { x: 85, y: 70 },
    Melbourne: { x: 83, y: 72 },
    Australia: { x: 85, y: 70 },
    Bangkok: { x: 78, y: 50 },
    Thailand: { x: 78, y: 50 },
    "Hong Kong": { x: 80, y: 45 },
  };

  // Try exact match first
  if (locationMap[location]) {
    console.log(`Found exact location match for: ${location}`);
    return locationMap[location];
  }

  // Try partial matching
  for (const [key, value] of Object.entries(locationMap)) {
    if (
      location.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(location.toLowerCase())
    ) {
      console.log(`Found partial location match: ${location} -> ${key}`);
      return value;
    }
  }

  console.log(`No location match found for: ${location}`);
  return null;
}

// Update operators list
function updateOperatorsList(operators) {
  const operatorsList = document.getElementById("operatorsList");
  if (!operatorsList) return;

  if (operators.length === 0) {
    operatorsList.innerHTML =
      '<div class="no-operators">No operators found</div>';
    return;
  }

  const listHTML = operators
    .map((operator) => {
      const avatar = generateAvatar(operator.pub);
      return `
    <div class="operator-list-item ${operator.isOnline ? "online" : "offline"}">
      <div class="operator-avatar">
        <img src="${avatar}" alt="${operator.name}" />
      </div>
      <div class="operator-status-dot"></div>
      <div class="operator-info">
        <div class="operator-name">${operator.name}</div>
        <div class="operator-location">${
          operator.location || "Unknown Location"
        }</div>
        <div class="operator-last-seen">Last seen: ${formatLastSeen(
          operator.lastSeen
        )}</div>
      </div>
    </div>
  `;
    })
    .join("");

  operatorsList.innerHTML = listHTML;
}

// Show operator info modal
function showOperatorInfo(operator) {
  const avatar = generateAvatar(operator.pub);
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="operator-info-modal">
      <h2>&gt; OPERATOR INFO</h2>
      
      <div class="operator-avatar-large">
        <img src="${avatar}" alt="${operator.name}" />
      </div>
      
      <div class="operator-details">
        <div class="detail-row">
          <span class="label">NAME:</span>
          <span class="value">${operator.name}</span>
        </div>
        <div class="detail-row">
          <span class="label">STATUS:</span>
          <span class="value ${operator.isOnline ? "online" : "offline"}">${
    operator.isOnline ? "ONLINE" : "OFFLINE"
  }</span>
        </div>
        <div class="detail-row">
          <span class="label">LOCATION:</span>
          <span class="value">${operator.location || "Unknown"}</span>
        </div>
        <div class="detail-row">
          <span class="label">LAST SEEN:</span>
          <span class="value">${formatLastSeen(operator.lastSeen)}</span>
        </div>
      </div>
      
      <div class="button" id="closeOperatorInfo">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#closeOperatorInfo").onclick = () => overlay.remove();
}

// Format last seen time
function formatLastSeen(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Debug function to check location data
function debugLocationData() {
  console.log("=== LOCATION DEBUG ===");

  // Check current user's location
  if (user && user.is && user.is.pub) {
    console.log("Current user pub:", user.is.pub);

    // Check user profile location
    user.get("profile").once((profile) => {
      console.log("User profile:", profile);
      if (profile && profile.location) {
        console.log("User location in profile:", profile.location);
      } else {
        console.log("No location in user profile");
      }
    });

    // Check users collection location
    gun
      .get("users")
      .get(user.is.pub)
      .get("profile")
      .once((profile) => {
        console.log("Users collection profile:", profile);
        if (profile && profile.location) {
          console.log("User location in users collection:", profile.location);
        } else {
          console.log("No location in users collection");
        }
      });
  }

  // Check all operators and their locations
  let operatorCount = 0;
  operatorsRef.map().once((data, key) => {
    if (data && data.name) {
      operatorCount++;
      console.log(`Operator ${operatorCount}: ${data.name} (${key})`);
      console.log("  Data:", data);

      // Check their location
      gun
        .get("users")
        .get(data.pub)
        .get("profile")
        .once((profile) => {
          if (profile && profile.location) {
            console.log(`  ✅ Location for ${data.name}: ${profile.location}`);
          } else {
            console.log(`  ❌ No location for ${data.name}`);
          }
        });
    }
  });

  console.log(`Total operators found: ${operatorCount}`);

  // Check GunDB connection status
  console.log("GunDB connection status:", gun._.opt.peers);

  // Check if operatorsRef is properly initialized
  console.log("operatorsRef:", operatorsRef);
  console.log("operatorsRef._.graph:", operatorsRef._.graph);
}

// Initialize network metrics
function initializeNetworkMetrics() {
  let sessionStart = Date.now();
  let messageCount = 0;
  let timerUpdateCount = 0;
  let userProfileCount = 0;

  // Update session duration every second
  const sessionInterval = safeSetInterval(() => {
    const duration = Math.floor((Date.now() - sessionStart) / 60000);
    const durationElement = document.getElementById("sessionDuration");
    if (durationElement) {
      durationElement.textContent = `${duration}m`;
    }
  }, 1000);

  // Monitor peer connections
  if (gun) {
    // Count active operators
    let activeOperators = 0;
    operatorsRef.map().once((data, key) => {
      if (data && data.lastSeen) {
        const timeSinceLastSeen = Date.now() - data.lastSeen;
        if (timeSinceLastSeen < 120000) {
          // 2 minutes
          activeOperators++;
        }
      }
    });

    setTimeout(() => {
      const activePeersElement = document.getElementById("activePeers");
      if (activePeersElement) {
        activePeersElement.textContent = activeOperators;
      }

      const totalPeersElement = document.getElementById("totalPeers");
      if (totalPeersElement) {
        totalPeersElement.textContent =
          activeOperators + Math.floor(Math.random() * 5); // Simulate total peers
      }
    }, 1000);

    // Calculate storage contribution
    const userContribution = Math.floor(Math.random() * 50) + 10; // Simulate contribution
    const networkTotal = userContribution * (activeOperators + 5);

    const userContributionElement = document.getElementById("userContribution");
    if (userContributionElement) {
      userContributionElement.textContent = `${userContribution} KB`;
    }

    const networkTotalElement = document.getElementById("networkTotal");
    if (networkTotalElement) {
      networkTotalElement.textContent = `${networkTotal} KB`;
    }

    // Data health indicators
    const syncStatusElement = document.getElementById("syncStatus");
    if (syncStatusElement) {
      syncStatusElement.textContent = "SYNCED";
      syncStatusElement.className = "network-value healthy";
    }

    const redundancyElement = document.getElementById("redundancy");
    if (redundancyElement) {
      redundancyElement.textContent = `${activeOperators + 2}x`;
      redundancyElement.className = "network-value healthy";
    }
  }

  // Monitor real-time metrics
  if (chatRef) {
    chatRef.map().on((data, key) => {
      if (data && data.message) {
        messageCount++;
        const messagesElement = document.getElementById("messagesStored");
        if (messagesElement) {
          messagesElement.textContent = messageCount;
        }
      }
    });
  }

  // Monitor timer updates
  if (timerRef) {
    timerRef.on((data) => {
      if (data && data.value !== undefined) {
        timerUpdateCount++;
        const timerElement = document.getElementById("timerUpdates");
        if (timerElement) {
          timerElement.textContent = timerUpdateCount;
        }
      }
    });
  }

  // Monitor user profiles
  if (user) {
    user.get("profile").on((profile) => {
      if (profile) {
        userProfileCount++;
        const profilesElement = document.getElementById("userProfiles");
        if (profilesElement) {
          profilesElement.textContent = userProfileCount;
        }
      }
    });
  }
}

// Initialize relay management
function initializeRelayManagement() {
  const addRelayBtn = document.getElementById("addRelayBtn");
  const newRelayUrlInput = document.getElementById("newRelayUrl");
  const relayList = document.getElementById("relayList");

  // Store current relays for management
  let currentRelays = [
    "https://relay.shogun-eco.xyz/gun",
    "https://peer.wallie.io/gun",
    "https://gun-manhattan.herokuapp.com/gun",
  ];

  // Add relay functionality
  if (addRelayBtn && newRelayUrlInput) {
    addRelayBtn.addEventListener("click", () => {
      const newRelayUrl = newRelayUrlInput.value.trim();

      if (!newRelayUrl) {
        addLog("ERROR: Relay URL cannot be empty", "error");
        return;
      }

      // Validate URL format
      if (
        !newRelayUrl.startsWith("https://") &&
        !newRelayUrl.startsWith("http://")
      ) {
        addLog("ERROR: Relay URL must start with http:// or https://", "error");
        return;
      }

      // Check if relay already exists
      if (currentRelays.includes(newRelayUrl)) {
        addLog("ERROR: Relay already exists", "error");
        return;
      }

      // Add new relay to GunDB
      try {
        // Add to current relays array
        currentRelays.push(newRelayUrl);

        // Update GunDB peers
        gun.opt({ peers: currentRelays });

        // Add to UI
        const newRelayItem = document.createElement("div");
        newRelayItem.className = "relay-item";
        newRelayItem.innerHTML = `
          <div class="relay-status connecting"></div>
          <div class="relay-url">${newRelayUrl}</div>
          <div class="relay-actions">
            <button class="relay-remove-btn" data-url="${newRelayUrl}">REMOVE</button>
          </div>
        `;
        relayList.appendChild(newRelayItem);

        // Clear input
        newRelayUrlInput.value = "";

        addLog(`SUCCESS: Added relay ${newRelayUrl}`, "success");

        // Test connection and update status
        testRelayConnection(newRelayUrl, newRelayItem);
      } catch (error) {
        addLog(`ERROR: Failed to add relay: ${error.message}`, "error");
        // Remove from array if failed
        currentRelays = currentRelays.filter((url) => url !== newRelayUrl);
      }
    });

    // Allow Enter key to add relay
    newRelayUrlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        addRelayBtn.click();
      }
    });
  }

  // Remove relay functionality
  if (relayList) {
    relayList.addEventListener("click", (e) => {
      if (e.target.classList.contains("relay-remove-btn")) {
        const relayUrl = e.target.getAttribute("data-url");
        const relayItem = e.target.closest(".relay-item");

        // Don't allow removing the last relay
        if (currentRelays.length <= 1) {
          addLog("ERROR: Cannot remove the last relay", "error");
          return;
        }

        // Remove from current relays array
        currentRelays = currentRelays.filter((url) => url !== relayUrl);

        // Update GunDB peers
        gun.opt({ peers: currentRelays });

        // Remove from UI
        relayItem.remove();

        addLog(`SUCCESS: Removed relay ${relayUrl}`, "success");
      }
    });
  }

  // Test relay connection
  function testRelayConnection(relayUrl, relayItem) {
    const statusElement = relayItem.querySelector(".relay-status");

    // Simulate connection test
    setTimeout(() => {
      // In a real implementation, you would test the actual connection
      // For now, we'll simulate based on URL patterns
      const isReliable =
        relayUrl.includes("shogun-eco.xyz") ||
        relayUrl.includes("wallie.io") ||
        relayUrl.includes("herokuapp.com");

      if (isReliable) {
        statusElement.className = "relay-status connected";
      } else {
        // Test new relays with a ping-like approach
        const testConnection = Math.random() > 0.3; // 70% success rate for new relays
        statusElement.className = testConnection
          ? "relay-status connected"
          : "relay-status disconnected";

        if (!testConnection) {
          addLog(`WARNING: Relay ${relayUrl} connection failed`, "warning");
        }
      }
    }, 1500);
  }

  // Update relay status periodically
  safeSetInterval(() => {
    const relayItems = relayList.querySelectorAll(".relay-item");
    relayItems.forEach((item) => {
      const statusElement = item.querySelector(".relay-status");
      const urlElement = item.querySelector(".relay-url");
      const relayUrl = urlElement.textContent;

      // Only update if not currently connecting
      if (!statusElement.classList.contains("connecting")) {
        // Simulate connection status with more realistic patterns
        const isReliable =
          relayUrl.includes("shogun-eco.xyz") ||
          relayUrl.includes("wallie.io") ||
          relayUrl.includes("herokuapp.com");

        let isConnected;
        if (isReliable) {
          isConnected = Math.random() > 0.05; // 95% uptime for reliable relays
        } else {
          isConnected = Math.random() > 0.2; // 80% uptime for other relays
        }

        statusElement.className = isConnected
          ? "relay-status connected"
          : "relay-status disconnected";
      }
    });
  }, 10000); // Check every 10 seconds
}

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
  overlay.querySelector("#closeLeaderboard").onclick = () => overlay.remove();

  const leaderboard = [];
  // Read from the new public leaderboard node
  gun
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

  // Wait for the asynchronous data to arrive
  setTimeout(() => {
    leaderboard.sort((a, b) => b.points - a.points);
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
  }, 1000); // Shorter timeout is more reliable now
}

function showChat() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
        <div class="chat-container">
            <div class="chat-header">
                <h2>SHOGUN ECO - OPERATOR CHAT</h2>
                <button onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="chat-content">
                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-sidebar">
                    <h3>ACTIVE OPERATORS</h3>
                    <ul id="operatorsList"></ul>
                </div>
            </div>
            <div class="chat-input">
                <input type="text" id="chatInput" placeholder="Type your message...">
            </div>
        </div>
    `;
  document.body.appendChild(overlay);

  // Initialize chat only after elements are added to DOM
  initializeChat();

  // Focus the input
  overlay.querySelector("#chatInput").focus();
}

// Chat functionality
function initializeChat() {
  console.log("🔧 Initializing chat system...");

  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");
  const operatorsList = document.getElementById("operatorsList");

  console.log("📋 Chat elements found:", {
    chatInput: !!chatInput,
    chatMessages: !!chatMessages,
    operatorsList: !!operatorsList,
  });

  // Ensure all required elements exist
  if (!chatInput || !chatMessages || !operatorsList) {
    console.error("❌ Chat elements not found. Chat initialization aborted.");
    return;
  }

  console.log("✅ Chat elements found, proceeding with initialization");

  // Check if chatRef is initialized
  if (!chatRef) {
    console.error("❌ chatRef not initialized. Chat system cannot function.");
    addLog("ERROR: Chat system not initialized", "error");
    return;
  }

  console.log("✅ chatRef is initialized:", chatRef);

  // Check if user is logged in
  if (!currentUser) {
    console.warn("⚠️ currentUser not defined during chat initialization");
  } else {
    console.log("✅ User logged in:", currentUser.alias);
  }

  // Clear existing messages
  chatMessages.innerHTML = "";

  // Keep track of processed messages
  const processedMessages = new Set();

  // Simple function to add a message to the chat
  function displayMessage(data) {
    console.log("📨 Displaying message:", data);

    if (!data) {
      console.warn("⚠️ displayMessage: data is null/undefined");
      return;
    }

    if (!data.message || !data.author || !data.timestamp) {
      console.warn("⚠️ displayMessage: missing required fields", {
        hasMessage: !!data.message,
        hasAuthor: !!data.author,
        hasTimestamp: !!data.timestamp,
      });
      return;
    }

    if (!chatMessages) {
      console.error("❌ displayMessage: chatMessages element not found");
      return;
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message";
    const time = new Date(data.timestamp).toLocaleTimeString();
    messageDiv.innerHTML = `
            <span class="time">[${time}]</span> 
            <span class="author">${data.author}:</span> 
            ${data.message}
        `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    console.log("✅ Message displayed successfully");
  }

  // Load chat history
  console.log("📚 Loading chat history...");
  chatRef.map().once((data, key) => {
    console.log("📖 Chat history item:", { key, data });

    // Skip if already processed
    if (processedMessages.has(key)) {
      console.log("⏭️ Skipping already processed history item:", key);
      return;
    }

    // Skip if data is invalid
    if (!data || !data.message || !data.author || !data.timestamp) {
      console.warn("⚠️ Skipping invalid history data:", { key, data });
      return;
    }

    processedMessages.add(key);
    console.log("✅ Loading history message:", key);
    displayMessage(data);
  });

  // Listen for new messages
  console.log("👂 Setting up chat listener...");
  chatRef.map().on((data, key) => {
    console.log("📨 New chat message received:", { key, data });

    // Skip if already processed
    if (processedMessages.has(key)) {
      console.log("⏭️ Skipping already processed message:", key);
      return;
    }

    // Skip if data is invalid
    if (!data || !data.message || !data.author || !data.timestamp) {
      console.warn("⚠️ Skipping invalid message data:", { key, data });
      return;
    }

    // Check if this is our own message (to avoid double display)
    const isOwnMessage = currentUser && data.author === currentUser.alias;
    if (isOwnMessage) {
      console.log(
        "👤 Skipping own message from GunDB (already displayed locally):",
        key
      );
      processedMessages.add(key);
      return;
    }

    processedMessages.add(key);
    console.log("✅ Processing new message from other user:", key);
    displayMessage(data);
  });

  // Handle sending messages
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && chatInput.value.trim()) {
      console.log("📝 Chat input detected:", chatInput.value.trim());

      if (!currentUser) {
        console.error("❌ Cannot send message: currentUser not defined");
        addLog("ERROR: Must be logged in to send messages", "error");
        return;
      }

      if (!chatRef) {
        console.error("❌ Cannot send message: chatRef not initialized");
        addLog("ERROR: Chat system not initialized", "error");
        return;
      }

      const message = chatInput.value.trim();
      chatInput.value = "";

      const messageId =
        Date.now().toString(36) + Math.random().toString(36).substr(2);
      const messageData = {
        author: currentUser.alias,
        message: message,
        timestamp: Date.now(),
      };

      console.log("📤 Sending message:", {
        messageId,
        author: currentUser.alias,
        message: message,
        timestamp: messageData.timestamp,
      });

      // Always display message locally first for immediate feedback
      console.log("📱 Displaying message locally immediately");
      displayMessage(messageData);

      try {
        chatRef.get(messageId).put(messageData, (ack) => {
          if (ack.err) {
            console.error("❌ Failed to send message to GunDB:", ack.err);
            addLog("ERROR: Failed to send message to network", "error");
            // Message is already displayed locally, so user sees it
          } else {
            console.log("✅ Message sent successfully to GunDB:", messageId);
            // Message is already displayed locally
          }
        });

        // Add a timeout to check if message was received by GunDB
        setTimeout(() => {
          console.log("🔍 Checking if message was received by GunDB...");
          chatRef.get(messageId).once((receivedData) => {
            if (receivedData) {
              console.log("✅ Message confirmed in GunDB:", receivedData);
            } else {
              console.warn("⚠️ Message not found in GunDB after timeout");
            }
          });
        }, 2000);
      } catch (error) {
        console.error("❌ Exception while sending message:", error);
        addLog("ERROR: Exception while sending message", "error");
        // Message is already displayed locally, so user sees it
      }
    }
  });

  // Update operators list
  function updateOperatorsList() {
    console.log("Updating operators list...");
    operatorsList.innerHTML = "";
    const seenOperators = new Set();
    const now = Date.now();

    operatorsRef.map().once((data, key) => {
      console.log("Operator data:", data);
      if (data && data.name && data.lastSeen) {
        const timeSinceLastSeen = now - data.lastSeen;
        console.log(
          `Operator ${data.name} last seen ${timeSinceLastSeen}ms ago`
        );

        if (timeSinceLastSeen < 120000) {
          // 2 minutes timeout
          if (seenOperators.has(data.name)) return;
          seenOperators.add(data.name);

          const li = document.createElement("li");
          li.textContent = data.name;
          if (data.pub === user.is.pub) {
            li.className = "current-user";
          }
          operatorsList.appendChild(li);
          console.log(`Added operator ${data.name} to list`);
        }
      }
    });
  }

  // Initial operators list update
  updateOperatorsList();

  // Update operators list more frequently
  safeSetInterval(updateOperatorsList, 5000); // Update every 5 seconds
}

// Main system initializer - called after shogun-core initialization
function initializeSystem() {
  document.title = "AUTHENTICATING...";

  // Add event listener for rules button
  document.addEventListener("DOMContentLoaded", () => {
    const rulesBtn = document.getElementById("rulesBtn");
    if (rulesBtn) {
      safeAddEventListener(rulesBtn, "click", showStationRules);
    }

    const aboutBtn = document.getElementById("aboutBtn");
    if (aboutBtn) {
      safeAddEventListener(aboutBtn, "click", showAboutSection);
    }
  });

  // Setup listeners that don't depend on a logged-in user
  if (statsRef) {
    statsRef.on((data) => {
      if (data) {
        stats = { ...stats, ...data };
        updateStatsUI(stats); // Update global stats regardless of user
      }
    });
  }

  // Initialize timer immediately, regardless of auth status
  if (timerRef) {
    timerRef.once((data) => {
      if (!data || typeof data.value !== "number") {
        console.log("Global timer not found. Initializing on GunDB...");
        timerRef.put({ value: 108, lastUpdate: Date.now() });
        // Initialize input state for new timer
        updateInputState(108);
      } else {
        // Initialize input state for existing timer
        updateInputState(data.value);
      }

      // Start the global countdown immediately
      if (decrementInterval) {
        clearInterval(decrementInterval);
        decrementInterval = null;
      }
      decrementInterval = safeSetInterval(decrementTimer, 60000);

      // Sync timer with server time
      const now = Date.now();
      if (data && data.lastUpdate) {
        const minutesPassed = Math.floor((now - data.lastUpdate) / 60000);
        if (minutesPassed > 0) {
          const newValue = Math.max(1, data.value - minutesPassed);
          updateTimer(newValue, "time_sync");
        }
      }
    });

    // Timer display listener
    timerRef.on((data) => {
      if (data && typeof data.value === "number") {
        document.title = data.value;
        bigTimer.textContent = data.value;

        // Update input state based on timer value
        updateInputState(data.value);

        if (data.value <= 4) {
          siren.play().catch(() => {});
        } else {
          siren.pause();
          siren.currentTime = 0;
          // Stop system failure display if timer is reset above 4
          if (systemFailureActive) {
            stopSystemFailureDisplay();
          }
        }
      }
    });
  }

  // Aggiungi un controllo periodico del timer
  safeSetInterval(() => {
    if (!decrementInterval) {
      console.log("Timer interval lost, restarting...");
      decrementInterval = safeSetInterval(decrementTimer, 60000);
    }
  }, 30000);
}

// Station Rules Function
function showStationRules() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="rules-modal">
      <h2>&gt; SWAN STATION OPERATIONAL PROTOCOL</h2>
      
      <div class="rules-section">
        <h3>MISSION OBJECTIVE</h3>
        <ul>
          <li>Prevent system failure by entering the correct sequence before timer reaches zero</li>
          <li>Maintain station stability through coordinated operator efforts</li>
          <li>Accumulate points and advance through operator levels</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>CRITICAL PROTOCOL</h3>
        <ul>
          <li class="warning">Timer counts down from 108 minutes</li>
          <li class="warning">When timer reaches 0, SYSTEM FAILURE occurs</li>
          <li class="success">Enter sequence: 4 8 15 16 23 42 to reset timer</li>
          <li class="warning">Code input ONLY allowed in last 4 minutes of countdown</li>
          <li class="info">Incorrect sequences are ignored (no penalty)</li>
          <li class="warning">Station parameters naturally drift over time</li>
          <li class="warning">Random events can affect multiple parameters simultaneously</li>
          <li class="success">Balanced parameters provide bonus points on timer reset</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>OPERATOR REWARDS</h3>
        <ul>
          <li class="success">+1 point for successful reset</li>
          <li class="success">+1 point for each optimally balanced parameter</li>
          <li class="success">+3 bonus points for perfect parameter balance (all 6 optimal)</li>
          <li class="success">+1 bonus point for good balance (4+ parameters optimal)</li>
          <li class="success">+2 bonus points for being first to reset</li>
          <li class="success">+1 bonus point for 4-in-a-row reset streak</li>
          <li class="success">Task completion awards: Difficulty × (Emergency: 3, Critical: 2, Maintenance: 1)</li>
          <li class="info">Level up based on total points accumulated</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>STATION PARAMETERS SYSTEM</h3>
        <ul>
          <li class="warning">6 critical parameters must be maintained in balance</li>
          <li class="info">Power Level: Affects oxygen generation and cooling systems</li>
          <li class="info">Oxygen Level: Critical for operator survival</li>
          <li class="info">Temperature: Affects humidity and pressure systems</li>
          <li class="info">Radiation Level: Damages power and oxygen systems</li>
          <li class="info">Pressure: Affects oxygen distribution and humidity</li>
          <li class="info">Humidity: Influenced by temperature and pressure</li>
          <li class="success">Parameters are interconnected - changes affect multiple systems</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>TASK SYSTEM</h3>
        <ul>
          <li class="warning">Tasks appear randomly and must be completed</li>
          <li class="info">3 types: Maintenance (60%), Critical (30%), Emergency (10%)</li>
          <li class="warning">Tasks have execution time: 30 seconds × difficulty level</li>
          <li class="success">Successful tasks improve station parameters</li>
          <li class="error">Failed tasks worsen station parameters</li>
          <li class="info">Task effects are realistic and interconnected</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>STATION FEATURES</h3>
        <ul>
          <li>Real-time operator chat system</li>
          <li>Global statistics tracking</li>
          <li>Operator leaderboard</li>
          <li>Station history log</li>
          <li>Operator profiles with custom avatars</li>
          <li class="info">Decentralized network analytics</li>
          <li class="info">Peer contribution monitoring</li>
          <li class="success">Real-time parameter monitoring with color-coded status</li>
          <li class="success">Task management system with countdown timers</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>EMERGENCY PROCEDURES</h3>
        <ul>
          <li class="warning">System failure triggers continuous red alert</li>
          <li class="warning">All operators must coordinate to prevent failure</li>
          <li class="warning">Critical parameter levels trigger automatic alerts</li>
          <li class="warning">Emergency tasks appear during system stress</li>
          <li class="info">Station automatically resets after successful code entry</li>
          <li class="info">Failed tasks can trigger cascading system failures</li>
          <li class="success">Coordinated task completion stabilizes station systems</li>
        </ul>
      </div>
      
      <div class="button" id="closeRules">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#closeRules").onclick = () => overlay.remove();
}

// About Section Function
function showAboutSection() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="rules-modal">
      <h2>&gt; ABOUT SWAN STATION</h2>
      
      <div class="rules-section">
        <h3>WHAT IS SWAN STATION?</h3>
        <p>Swan Station is a collaborative multiplayer game that simulates a critical system requiring constant operator attention. Inspired by the iconic Dharma Initiative station from Lost, players work together to prevent system failure by entering the correct sequence before the timer reaches zero.</p>
      </div>
      
      <div class="rules-section">
        <h3>END GAME & OBJECTIVES</h3>
        <ul>
          <li class="success">Primary Goal: Prevent system failure through coordinated operator efforts</li>
          <li class="success">Secondary Goal: Achieve the highest operator level through successful resets</li>
          <li class="info">Long-term Goal: Demonstrate the power of decentralized collaboration</li>
          <li class="info">Community Goal: Build a global network of reliable operators</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>DECENTRALIZED STORAGE & NETWORK</h3>
        <ul>
          <li class="info">Built on GunDB - a decentralized graph database</li>
          <li class="info">Data is stored across multiple peer nodes for redundancy</li>
          <li class="info">No central server - the game runs on a distributed network</li>
          <li class="info">Each player contributes to the network's storage capacity</li>
          <li class="info">Real-time synchronization across all connected peers</li>
          <li class="success">Censorship-resistant and fault-tolerant architecture</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>SHOGUN ECO ECOSYSTEM</h3>
        <ul>
          <li class="success">Part of the larger shogun-eco.xyz decentralized ecosystem</li>
          <li class="info">Demonstrates practical applications of decentralized technology</li>
          <li class="info">Showcases real-time collaborative applications without central control</li>
          <li class="info">Serves as a proof-of-concept for decentralized gaming</li>
          <li class="success">Contributes to the broader mission of Web3 decentralization</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>TECHNICAL ARCHITECTURE</h3>
        <ul>
          <li class="info">Frontend: HTML5, CSS3, JavaScript with retro terminal aesthetic</li>
          <li class="info">Backend: GunDB decentralized database</li>
          <li class="info">Authentication: Shogun Core decentralized identity system</li>
          <li class="info">Real-time Communication: Peer-to-peer messaging</li>
          <li class="info">Storage: Distributed across network participants</li>
          <li class="success">No traditional servers required - truly decentralized</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>WHY DECENTRALIZATION MATTERS</h3>
        <ul>
          <li class="success">No single point of failure - the game continues even if some nodes go offline</li>
          <li class="success">Censorship resistance - cannot be shut down by authorities</li>
          <li class="info">User ownership - players control their own data and identity</li>
          <li class="info">Transparency - all game logic and data is open and verifiable</li>
          <li class="success">Community-driven - the network grows stronger with each participant</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>JOIN THE NETWORK</h3>
        <p>By participating in Swan Station, you're not just playing a game - you're contributing to a decentralized future. Every reset, every message, every connection helps strengthen the network and demonstrates the potential of peer-to-peer collaboration.</p>
        <p class="success">Welcome to the future of decentralized gaming.</p>
      </div>
      
      <div class="rules-section">
        <h3>OPEN SOURCE</h3>
        <p>This project is open source and available on GitHub. You can view the source code, contribute to development, or run your own instance of Swan Station.</p>
        <p class="success"><a href="https://github.com/scobru/the-swan-station" target="_blank" class="github-link">📁 VIEW ON GITHUB</a></p>
      </div>
      
      <div class="button" id="closeAbout">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#closeAbout").onclick = () => overlay.remove();
}

// Page visibility API to pause audio when page is not visible
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Pause all audio when page is hidden
    [siren, reset, tick, ...buttonSounds].forEach((audio) => {
      if (audio && typeof audio.pause === "function") {
        audio.pause();
      }
    });
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  cleanup();
  console.log("🧹 Page unload cleanup completed");
});

// Start the application
initializeShogun();

function handleScore(success) {
  if (!currentUser) return;

  const points = success ? 108 : -108;
  user.get("points").once((currentPoints) => {
    const newPoints = (currentPoints || 0) + points;
    user.get("points").put(newPoints);

    // Aggiorna le statistiche del profilo
    user.get("profile").once((profile) => {
      const updatedProfile = {
        ...(profile || {}),
        resets: (profile?.resets || 0) + (success ? 1 : 0),
      };
      user.get("profile").put(updatedProfile);
    });

    // Aggiorna il livello
    const newLevel = calculateLevel(newPoints);
    if (newLevel !== currentUser.level) {
      user.get("level").put(newLevel);
    }
  });
}

// Aggiungi questa funzione per monitorare lo stato del timer
function checkTimerHealth() {
  if (timerRef) {
    timerRef.once((data) => {
      const now = Date.now();
      if (
        !data ||
        typeof data.value !== "number" ||
        !data.lastUpdate ||
        now - data.lastUpdate > 120000
      ) {
        console.log("Timer health check failed, reinitializing...");
        updateTimer(108, "health_check");
      }
    });
  }
}

// Chiama il controllo di salute ogni 2 minuti
safeSetInterval(checkTimerHealth, 120000);

// Task System Functions
function initializeTaskSystem() {
  console.log("Initializing task system...");

  // Initialize station parameters in GunDB
  stationParamsRef.once((params) => {
    if (!params) {
      stationParamsRef.put({
        ...stationParameters,
        lastUpdate: Date.now(),
        lastEvent: null,
      });
    } else {
      stationParameters = { ...stationParameters, ...params };
    }
  });

  // Listen for station parameter changes
  stationParamsRef.on((params) => {
    if (params) {
      stationParameters = { ...stationParameters, ...params };
      updateStationParametersDisplay();
      checkParameterAlerts();
    }
  });

  // Start real-time task synchronization
  startTaskSynchronization();

  // Start task generation
  startTaskGeneration();

  // Start random events
  startRandomEvents();

  // Start parameter drift
  startParameterDrift();

  // Start real-time parameter display updates
  startParameterDisplayUpdates();

  // Start task cleanup
  startTaskCleanup();
}

function loadTasksFromGunDB() {
  console.log("Loading tasks from GunDB...");

  // Clear existing active tasks
  activeTasks = [];

  // Get current timestamp for filtering
  const currentTime = Date.now();
  const connectionTime = currentUser
    ? currentUser.connectionTime || currentTime
    : currentTime;

  console.log(
    `Loading tasks with connection time: ${new Date(
      connectionTime
    ).toLocaleTimeString()}`
  );

  // Load tasks from GunDB
  taskRef.map().once((task, id) => {
    if (task && typeof task === "object") {
      // Validate task data
      if (!task.name || !task.type || !task.expiresAt) {
        console.warn("Invalid task data loaded from GunDB:", task);
        return;
      }

      // Use actual creation time if available, otherwise estimate from expiresAt
      const taskCreationTime =
        task.createdAt || task.expiresAt - (task.timeLimit || 300000);
      const isRecentTask = taskCreationTime > connectionTime - 30000; // 30 second buffer

      console.log(
        `Task ${task.name}: created=${new Date(
          taskCreationTime
        ).toLocaleTimeString()}, recent=${isRecentTask}, expired=${
          currentTime >= task.expiresAt
        }`
      );

      if (!task.completed && !task.failed) {
        // Only load tasks that are recent and haven't expired
        if (task.expiresAt && currentTime < task.expiresAt && isRecentTask) {
          const validTask = {
            ...task,
            id,
            name: task.name || "Unknown Task",
            type: task.type || "MAINTENANCE",
            difficulty: task.difficulty || 1,
            timeLimit: task.timeLimit || 300000,
            expiresAt: task.expiresAt || Date.now() + 300000,
            createdAt: task.createdAt || taskCreationTime,
          };
          activeTasks.push(validTask);
          console.log(
            `✅ Loaded recent active task: ${
              validTask.name
            } (created: ${new Date(validTask.createdAt).toLocaleTimeString()})`
          );
        } else if (task.expiresAt && currentTime >= task.expiresAt) {
          // Mark expired tasks as failed
          task.failed = true;
          taskRef.get(id).put(task);
          console.log(`❌ Marked expired task as failed: ${task.name}`);
        } else if (!isRecentTask) {
          console.log(
            `⏭️ Skipping old task: ${task.name} (created: ${new Date(
              taskCreationTime
            ).toLocaleTimeString()})`
          );
        }
      } else if (task.completed || task.failed) {
        // Only add recent completed/failed tasks to history
        if (isRecentTask) {
          const validTask = {
            ...task,
            id,
            name: task.name || "Unknown Task",
            type: task.type || "MAINTENANCE",
            createdAt: task.createdAt || taskCreationTime,
          };
          taskHistory.push(validTask);
          console.log(`📚 Added to history: ${validTask.name}`);
        }
      }
    }
  });

  // Update display after loading
  setTimeout(() => {
    // Remove any duplicates that might have been created
    removeDuplicateTasks();
    updateTaskDisplay();
    console.log(
      `📊 Final result: ${activeTasks.length} active tasks and ${taskHistory.length} historical tasks`
    );

    // Mark initial load as complete
    window.initialTaskLoadComplete = true;
    console.log("✅ Initial task load complete - sync now active");
  }, 1000);
}

function removeDuplicateTasks() {
  console.log("Checking for duplicate tasks...");

  const seenIds = new Set();
  const uniqueTasks = [];
  let duplicatesRemoved = 0;

  for (const task of activeTasks) {
    if (task.id && !seenIds.has(task.id)) {
      seenIds.add(task.id);
      uniqueTasks.push(task);
    } else {
      duplicatesRemoved++;
      console.warn(`Removed duplicate task: ${task.name} (ID: ${task.id})`);
    }
  }

  if (duplicatesRemoved > 0) {
    activeTasks = uniqueTasks;
    console.log(`Removed ${duplicatesRemoved} duplicate tasks`);
  }
}

function cleanupCorruptedTasks() {
  console.log("Cleaning up corrupted tasks...");

  taskRef.map().once((task, id) => {
    if (task && typeof task === "object") {
      // Check if task is corrupted
      if (
        !task.name ||
        !task.type ||
        !task.expiresAt ||
        typeof task.name !== "string" ||
        typeof task.type !== "string" ||
        typeof task.expiresAt !== "number"
      ) {
        console.warn("Removing corrupted task:", task);
        taskRef.get(id).put(null); // Remove corrupted task
      }
    }
  });
}

function startTaskSynchronization() {
  console.log("Starting real-time task synchronization...");

  // Listen for new tasks being added by any operator
  taskRef.map().on((task, taskId) => {
    // Skip sync during initial load to prevent conflicts
    if (!window.initialTaskLoadComplete) {
      console.log("⏳ Skipping sync during initial load");
      return;
    }

    if (task && !task.completed && !task.failed) {
      // Check if this task is already in our local list
      const existingTask = activeTasks.find((t) => t.id === taskId);

      if (!existingTask) {
        // Check if this is a recent task (within 30 seconds of connection)
        const currentTime = Date.now();
        const connectionTime = currentUser
          ? currentUser.connectionTime || currentTime
          : currentTime;
        const taskCreationTime =
          task.createdAt || task.expiresAt - (task.timeLimit || 300000);
        const isRecentTask = taskCreationTime > connectionTime - 30000; // 30 second buffer

        if (isRecentTask) {
          // New task added by another operator (recent)
          const validTask = {
            ...task,
            id: taskId,
            name: task.name || "Unknown Task",
            type: task.type || "MAINTENANCE",
            difficulty: task.difficulty || 1,
            timeLimit: task.timeLimit || 300000,
            expiresAt: task.expiresAt || Date.now() + 300000,
            createdAt: task.createdAt || taskCreationTime,
          };
          activeTasks.push(validTask);
          addLog(
            `NEW TASK DETECTED: ${validTask.name} (${validTask.type})`,
            "info"
          );
          updateTaskDisplay();
        } else {
          console.log(
            `Skipping old task from sync: ${task.name} (created: ${new Date(
              taskCreationTime
            ).toLocaleTimeString()})`
          );
        }
      } else {
        // Task updated by another operator
        const index = activeTasks.findIndex((t) => t.id === taskId);
        if (index !== -1) {
          // Check if this is our own task update (to avoid overwriting local changes)
          const localTask = activeTasks[index];
          const isOwnUpdate =
            currentUser && task.assignedTo === currentUser.alias;

          // Check if local task is assigned to us but sync data shows unassigned (stale data)
          const isLocalAssignment =
            currentUser && localTask.assignedTo === currentUser.alias;
          const isSyncUnassigned = !task.assignedTo || task.assignedTo === null;

          // Use timestamp-based conflict resolution if available
          const localAssignedAt = localTask.assignedAt || 0;
          const syncAssignedAt = task.assignedAt || 0;

          // Don't overwrite our local assignment with stale unassigned data
          // Also check if our local assignment is more recent
          if (
            isLocalAssignment &&
            (isSyncUnassigned || localAssignedAt > syncAssignedAt)
          ) {
            console.log(
              `🛡️ Protecting local assignment for task: ${task.name} (local: ${
                localTask.assignedTo
              } at ${new Date(localAssignedAt).toLocaleTimeString()}, sync: ${
                task.assignedTo
              } at ${new Date(syncAssignedAt).toLocaleTimeString()})`
            );
            return;
          }

          // Only update if it's not our own recent update or if it's a significant change
          if (!isOwnUpdate || task.assignedTo !== localTask.assignedTo) {
            const updatedTask = {
              ...task,
              id: taskId,
              name: task.name || "Unknown Task",
              type: task.type || "MAINTENANCE",
              difficulty: task.difficulty || 1,
              timeLimit: task.timeLimit || 300000,
              expiresAt: task.expiresAt || Date.now() + 300000,
              createdAt: task.createdAt || localTask.createdAt,
            };
            activeTasks[index] = updatedTask;
            console.log(
              `🔄 Updated task from sync: ${updatedTask.name} (assignedTo: ${updatedTask.assignedTo})`
            );
            updateTaskDisplay();
          } else {
            console.log(`⏭️ Skipping own update for task: ${task.name}`);
          }
        }
      }
    } else if (task && (task.completed || task.failed)) {
      // Task completed or failed by another operator
      const index = activeTasks.findIndex((t) => t.id === taskId);
      if (index !== -1) {
        const completedTask = activeTasks[index];
        activeTasks.splice(index, 1);
        taskHistory.push(completedTask);

        if (task.completed) {
          addLog(
            `TASK COMPLETED BY ANOTHER OPERATOR: ${completedTask.name}`,
            "success"
          );

          // Show notification for task completion by others (without sound to avoid double play)
          showTaskNotification({
            name: completedTask.name,
            type: completedTask.type,
            difficulty: completedTask.difficulty,
            timeLimit: 0,
            completed: true,
          });
        } else {
          addLog(
            `TASK FAILED BY ANOTHER OPERATOR: ${completedTask.name}`,
            "error"
          );
          // Show notification for task failure by others (without sound)
          showTaskNotification({
            name: completedTask.name,
            type: completedTask.type,
            difficulty: completedTask.difficulty,
            timeLimit: 0,
            failed: true,
          });
        }

        updateTaskDisplay();
      }
    }
  });
}

function startTaskCleanup() {
  // Clean up expired tasks every 30 seconds
  safeSetInterval(() => {
    const now = Date.now();
    let tasksRemoved = 0;

    // Remove duplicates first
    removeDuplicateTasks();

    // Check for expired tasks
    activeTasks = activeTasks.filter((task) => {
      if (task.expiresAt && now > task.expiresAt) {
        // Mark as failed in GunDB
        task.failed = true;
        taskRef.get(task.id).put(task);
        taskHistory.push(task);
        tasksRemoved++;
        addLog(`Task "${task.name}" expired and marked as failed`, "warning");

        return false;
      }
      return true;
    });

    if (tasksRemoved > 0) {
      updateTaskDisplay();
      console.log(`Cleaned up ${tasksRemoved} expired tasks`);
    }
  }, 30000);
}

function startTaskGeneration() {
  // Generate tasks every 5-10 minutes
  const generateTask = () => {
    const taskType = Math.random();
    let category, taskKey;

    if (taskType < 0.1) {
      // 10% chance for emergency task
      category = "EMERGENCY";
      const emergencyTasks = Object.keys(taskTypes.EMERGENCY);
      taskKey =
        emergencyTasks[Math.floor(Math.random() * emergencyTasks.length)];
    } else if (taskType < 0.4) {
      // 30% chance for critical task
      category = "CRITICAL";
      const criticalTasks = Object.keys(taskTypes.CRITICAL);
      taskKey = criticalTasks[Math.floor(Math.random() * criticalTasks.length)];
    } else {
      // 60% chance for maintenance task
      category = "MAINTENANCE";
      const maintenanceTasks = Object.keys(taskTypes.MAINTENANCE);
      taskKey =
        maintenanceTasks[Math.floor(Math.random() * maintenanceTasks.length)];
    }

    const task = taskTypes[category][taskKey];

    // Validate task data
    if (!task || !task.name) {
      console.error("Invalid task data:", task);
      return;
    }

    const taskId = crypto.randomUUID();

    const newTask = {
      id: taskId,
      type: category,
      name: task.name,
      difficulty: task.difficulty || 1,
      timeLimit: task.timeLimit || 300000,
      createdAt: Date.now(),
      expiresAt: Date.now() + (task.timeLimit || 300000),
      assignedTo: null,
      completed: false,
      failed: false,
      parameters: generateTaskParameters(category, taskKey),
    };

    // Add task to GunDB
    taskRef.get(taskId).put(newTask);

    // Check if task with same ID already exists
    const existingTask = activeTasks.find((t) => t.id === taskId);
    if (!existingTask) {
      // Add to local active tasks
      activeTasks.push(newTask);
      addLog(`NEW TASK: ${task.name} (${category})`, "warning");
    } else {
      console.warn(`Task with ID ${taskId} already exists, skipping duplicate`);
      return;
    }

    // Show task notification
    showTaskNotification(newTask);

    // Update task display
    updateTaskDisplay();
  };

  // Generate initial task after 5 minutes
  safeSetTimeout(generateTask, 300000);

  // Generate tasks every 10-15 minutes
  safeSetInterval(() => {
    if (activeTasks.length < 2) {
      // Max 2 active tasks
      generateTask();
    }
  }, Math.random() * 300000 + 600000); // 10-15 minutes
}

function generateTaskParameters(category, taskKey) {
  const params = {};

  // Ensure stationParameters exists
  if (!stationParameters) {
    console.warn("stationParameters not initialized, using default values");
    stationParameters = {
      powerLevel: 50,
      oxygenLevel: 50,
      temperature: 20,
      radiationLevel: 0.1,
      pressure: 1000,
      humidity: 50,
    };
  }

  switch (taskKey) {
    case "powerBalance":
      params.targetPower = Math.floor(Math.random() * 20) + 80; // 80-100
      params.currentPower = stationParameters.powerLevel || 50;
      break;
    case "oxygenRegulation":
      params.targetOxygen = Math.floor(Math.random() * 10) + 90; // 90-100
      params.currentOxygen = stationParameters.oxygenLevel || 50;
      break;
    case "temperatureControl":
      params.targetTemp = Math.floor(Math.random() * 10) + 18; // 18-28
      params.currentTemp = stationParameters.temperature || 20;
      break;
    case "radiationShield":
      params.targetRadiation = Math.random() * 0.1; // 0-0.1
      params.currentRadiation = stationParameters.radiationLevel || 0.1;
      break;
    case "pressureStabilization":
      params.targetPressure = Math.floor(Math.random() * 100) + 950; // 950-1050
      params.currentPressure = stationParameters.pressure || 1000;
      break;
    case "humidityControl":
      params.targetHumidity = Math.floor(Math.random() * 30) + 35; // 35-65
      params.currentHumidity = stationParameters.humidity || 50;
      break;
    default:
      params.randomValue = Math.floor(Math.random() * 100);
  }

  return params;
}

function startRandomEvents() {
  // Trigger random events every 3-8 minutes
  safeSetInterval(() => {
    if (Math.random() < 0.3) {
      // 30% chance
      const event =
        randomEvents[Math.floor(Math.random() * randomEvents.length)];
      triggerRandomEvent(event);
    }
  }, Math.random() * 300000 + 180000); // 3-8 minutes
}

function triggerRandomEvent(event) {
  addLog(`RANDOM EVENT: ${event.name}`, "error");

  // Apply effects to station parameters
  Object.keys(event.effect).forEach((param) => {
    stationParameters[param] += event.effect[param];

    // Clamp values to reasonable ranges
    if (param === "powerLevel")
      stationParameters[param] = Math.max(
        0,
        Math.min(100, stationParameters[param])
      );
    if (param === "oxygenLevel")
      stationParameters[param] = Math.max(
        0,
        Math.min(100, stationParameters[param])
      );
    if (param === "temperature")
      stationParameters[param] = Math.max(
        -50,
        Math.min(100, stationParameters[param])
      );
    if (param === "radiationLevel")
      stationParameters[param] = Math.max(
        0,
        Math.min(1, stationParameters[param])
      );
    if (param === "pressure")
      stationParameters[param] = Math.max(
        800,
        Math.min(1200, stationParameters[param])
      );
    if (param === "humidity")
      stationParameters[param] = Math.max(
        0,
        Math.min(100, stationParameters[param])
      );
  });

  // Update GunDB
  stationParamsRef.put({
    ...stationParameters,
    lastUpdate: Date.now(),
    lastEvent: event.name,
  });

  // Create emergency task if needed
  if (Math.random() < 0.5) {
    const emergencyTasks = Object.keys(taskTypes.EMERGENCY);
    const taskKey =
      emergencyTasks[Math.floor(Math.random() * emergencyTasks.length)];
    const task = taskTypes.EMERGENCY[taskKey];
    const taskId = crypto.randomUUID();

    const newTask = {
      id: taskId,
      type: "EMERGENCY",
      name: task.name,
      difficulty: task.difficulty,
      timeLimit: task.timeLimit,
      createdAt: Date.now(),
      expiresAt: Date.now() + task.timeLimit,
      assignedTo: null,
      completed: false,
      failed: false,
      parameters: generateTaskParameters("EMERGENCY", taskKey),
      triggeredBy: event.name,
    };

    taskRef.get(taskId).put(newTask);

    // Check if task with same ID already exists
    const existingTask = activeTasks.find((t) => t.id === taskId);
    if (!existingTask) {
      activeTasks.push(newTask);
      updateTaskDisplay();
    } else {
      console.warn(
        `Emergency task with ID ${taskId} already exists, skipping duplicate`
      );
    }
  }
}

function startParameterDrift() {
  // Parameters naturally drift over time with realistic patterns
  safeSetInterval(() => {
    // More realistic drift patterns
    const driftPatterns = {
      powerLevel: (Math.random() - 0.5) * 1.5, // Power fluctuates less
      oxygenLevel: (Math.random() - 0.5) * 1.2, // Oxygen is more stable
      temperature: (Math.random() - 0.5) * 2.5, // Temperature fluctuates more
      radiationLevel: (Math.random() - 0.5) * 0.02, // Radiation changes slowly
      pressure: (Math.random() - 0.5) * 3, // Pressure fluctuates moderately
      humidity: (Math.random() - 0.5) * 2, // Humidity fluctuates moderately
    };

    // Apply drift to all parameters
    Object.keys(driftPatterns).forEach((param) => {
      stationParameters[param] += driftPatterns[param];
    });

    // Apply interdependencies after drift
    applyParameterInterdependencies();

    // Clamp values to realistic ranges
    clampParameterValues();

    // Update GunDB every 30 seconds
    stationParamsRef.put({
      ...stationParameters,
      lastUpdate: Date.now(),
    });

    // Update the display
    updateStationParametersDisplay();

    // Check for alerts
    checkParameterAlerts();
  }, 30000);

  // Also add more frequent small changes for better visibility
  safeSetInterval(() => {
    // Small random changes every 10 seconds for more dynamic feel
    const smallDrift = {
      powerLevel: (Math.random() - 0.5) * 0.3,
      oxygenLevel: (Math.random() - 0.5) * 0.2,
      temperature: (Math.random() - 0.5) * 0.5,
      radiationLevel: (Math.random() - 0.5) * 0.005,
      pressure: (Math.random() - 0.5) * 0.6,
      humidity: (Math.random() - 0.5) * 0.4,
    };

    Object.keys(smallDrift).forEach((param) => {
      stationParameters[param] += smallDrift[param];
    });

    applyParameterInterdependencies();
    clampParameterValues();

    // Update display immediately for small changes
    updateStationParametersDisplay();
  }, 10000);
}

function updateStationParametersDisplay() {
  // Update the station parameters display in the UI
  const paramsDisplay = document.getElementById("stationParamsDisplay");

  // Check if stationParameters is initialized
  if (!stationParameters) {
    console.warn("stationParameters not initialized yet");
    return;
  }

  if (paramsDisplay) {
    // Store previous values for comparison
    const previousValues = {};
    const currentElements = paramsDisplay.querySelectorAll(".param-value");
    currentElements.forEach((element, index) => {
      const paramNames = [
        "powerLevel",
        "oxygenLevel",
        "temperature",
        "radiationLevel",
        "pressure",
        "humidity",
      ];
      if (paramNames[index]) {
        previousValues[paramNames[index]] = parseFloat(
          element.textContent.replace(/[^\d.-]/g, "")
        );
      }
    });
    paramsDisplay.innerHTML = `
      <div class="param-item ${
        (stationParameters.powerLevel || 0) < 20
          ? "critical"
          : (stationParameters.powerLevel || 0) < 50
          ? "warning"
          : "normal"
      }">
        <span class="param-label">POWER:</span>
        <span class="param-value">${(stationParameters.powerLevel || 0).toFixed(
          1
        )}%</span>
      </div>
      <div class="param-item ${
        (stationParameters.oxygenLevel || 0) < 15
          ? "critical"
          : (stationParameters.oxygenLevel || 0) < 30
          ? "warning"
          : "normal"
      }">
        <span class="param-label">OXYGEN:</span>
        <span class="param-value">${(
          stationParameters.oxygenLevel || 0
        ).toFixed(1)}%</span>
      </div>
      <div class="param-item ${
        (stationParameters.temperature || 0) > 40 ||
        (stationParameters.temperature || 0) < 0
          ? "critical"
          : (stationParameters.temperature || 0) > 30 ||
            (stationParameters.temperature || 0) < 10
          ? "warning"
          : "normal"
      }">
        <span class="param-label">TEMP:</span>
        <span class="param-value">${(
          stationParameters.temperature || 0
        ).toFixed(1)}°C</span>
      </div>
      <div class="param-item ${
        (stationParameters.radiationLevel || 0) > 0.5
          ? "critical"
          : (stationParameters.radiationLevel || 0) > 0.2
          ? "warning"
          : "normal"
      }">
        <span class="param-label">RADIATION:</span>
        <span class="param-value">${(
          stationParameters.radiationLevel || 0
        ).toFixed(3)}</span>
      </div>
      <div class="param-item ${
        (stationParameters.pressure || 0) < 900 ||
        (stationParameters.pressure || 0) > 1100
          ? "critical"
          : (stationParameters.pressure || 0) < 950 ||
            (stationParameters.pressure || 0) > 1050
          ? "warning"
          : "normal"
      }">
        <span class="param-label">PRESSURE:</span>
        <span class="param-value">${(stationParameters.pressure || 0).toFixed(
          0
        )} hPa</span>
      </div>
      <div class="param-item ${
        (stationParameters.humidity || 0) < 20 ||
        (stationParameters.humidity || 0) > 80
          ? "critical"
          : (stationParameters.humidity || 0) < 30 ||
            (stationParameters.humidity || 0) > 70
          ? "warning"
          : "normal"
      }">
        <span class="param-label">HUMIDITY:</span>
        <span class="param-value">${(stationParameters.humidity || 0).toFixed(
          1
        )}%</span>
      </div>
    `;

    // Add visual feedback for parameter changes
    const newElements = paramsDisplay.querySelectorAll(".param-value");
    newElements.forEach((element, index) => {
      const paramNames = [
        "powerLevel",
        "oxygenLevel",
        "temperature",
        "radiationLevel",
        "pressure",
        "humidity",
      ];
      const paramName = paramNames[index];

      if (paramName && previousValues[paramName] !== undefined) {
        const currentValue = parseFloat(
          element.textContent.replace(/[^\d.-]/g, "")
        );
        const previousValue = previousValues[paramName];

        if (currentValue > previousValue) {
          // Value increased - add green flash
          element.style.animation = "parameterIncrease 1s ease-out";
        } else if (currentValue < previousValue) {
          // Value decreased - add red flash
          element.style.animation = "parameterDecrease 1s ease-out";
        }

        // Remove animation after it completes
        setTimeout(() => {
          element.style.animation = "";
        }, 1000);
      }
    });
  }
}

function checkParameterAlerts() {
  // Check if stationParameters is initialized
  if (!stationParameters) {
    return;
  }

  // Check for critical parameter levels
  if ((stationParameters.powerLevel || 0) < 20) {
    addLog("CRITICAL: Power levels critically low!", "error");
  }
  if ((stationParameters.oxygenLevel || 0) < 15) {
    addLog("CRITICAL: Oxygen levels critically low!", "error");
  }
  if (
    (stationParameters.temperature || 0) > 40 ||
    (stationParameters.temperature || 0) < 0
  ) {
    addLog("CRITICAL: Temperature outside safe range!", "error");
  }
  if ((stationParameters.radiationLevel || 0) > 0.5) {
    addLog("CRITICAL: Radiation levels dangerously high!", "error");
  }
  if (
    (stationParameters.pressure || 0) < 900 ||
    (stationParameters.pressure || 0) > 1100
  ) {
    addLog("CRITICAL: Pressure outside safe range!", "error");
  }
  if (
    (stationParameters.humidity || 0) < 20 ||
    (stationParameters.humidity || 0) > 80
  ) {
    addLog("CRITICAL: Humidity outside safe range!", "error");
  }
}

function updateTaskDisplay() {
  const taskDisplay = document.getElementById("taskDisplay");
  if (taskDisplay) {
    // Show operator's active task count
    let operatorTaskCount = "";
    if (currentUser) {
      const operatorActiveTasks = activeTasks.filter(
        (t) => t.assignedTo === currentUser.alias
      );
      operatorTaskCount = `<div class="operator-task-count">Your active tasks: ${operatorActiveTasks.length}/3</div>`;
    }

    if (activeTasks.length === 0) {
      taskDisplay.innerHTML = `
        ${operatorTaskCount}
        <div class="no-tasks">No active tasks</div>
      `;
      return;
    }

    const taskHTMLArray = activeTasks.map((task) => {
      // Validate task data
      if (!task || !task.expiresAt || typeof task.expiresAt !== "number") {
        console.warn("Invalid task in updateTaskDisplay:", task);
        return "";
      }

      const timeLeft = Math.max(0, task.expiresAt - Date.now());
      const timeLeftMinutes = Math.floor(timeLeft / 60000);
      const timeLeftSeconds = Math.floor((timeLeft % 60000) / 1000);

      // Calculate execution countdown
      let executionStatus = "";
      let canComplete = true;
      if (task.assignedTo && task.executionEndTime) {
        const executionTimeLeft = Math.max(
          0,
          task.executionEndTime - Date.now()
        );
        if (executionTimeLeft > 0) {
          const execMinutes = Math.floor(executionTimeLeft / 60000);
          const execSeconds = Math.floor((executionTimeLeft % 60000) / 1000);
          executionStatus = `Executing: ${execMinutes}:${execSeconds
            .toString()
            .padStart(2, "0")}`;
          canComplete = false;
        } else {
          executionStatus = "Ready to complete";
        }
      }

      // Determine task status for styling
      let taskStatusClass = "";
      if (
        task.assignedTo &&
        task.executionEndTime &&
        Date.now() < task.executionEndTime
      ) {
        taskStatusClass = "task-executing";
      } else if (task.assignedTo) {
        taskStatusClass = "task-assigned";
      } else {
        taskStatusClass = "task-available";
      }

      // Debug: Log task state for troubleshooting (only for assigned tasks)
      if (task.assignedTo) {
        console.log(`Task ${task.id} state:`, {
          name: task.name,
          assignedTo: task.assignedTo,
          executionEndTime: task.executionEndTime,
          statusClass: taskStatusClass,
          canComplete: canComplete,
        });
      }

      return `
        <div class="task-item ${(task.type || "maintenance").toLowerCase()} ${
        timeLeft < 60000 ? "urgent" : ""
      } ${taskStatusClass}">
          <div class="task-header">
            <span class="task-name">${task.name || "Unknown Task"}</span>
            <span class="task-type">${task.type || "MAINTENANCE"}</span>
          </div>
          <div class="task-details">
            <span class="task-difficulty">Difficulty: ${
              task.difficulty || 1
            }/5</span>
            <span class="task-time">Expires: ${timeLeftMinutes}:${timeLeftSeconds
        .toString()
        .padStart(2, "0")}</span>
            ${
              task.assignedTo
                ? `<span class="task-execution">${executionStatus}</span>`
                : ""
            }
          </div>
          <div class="task-actions">
            <button class="task-btn accept ${
              task.assignedTo ? "assigned" : ""
            }" onclick="acceptTask('${task.id}')" ${
        task.assignedTo ? "disabled" : ""
      }>
              ${task.assignedTo ? "ASSIGNED" : "ACCEPT"}
            </button>
            <button class="task-btn complete ${
              !canComplete ? "executing" : ""
            }" onclick="completeTask('${task.id}')" ${
        !task.assignedTo ||
        task.assignedTo !== currentUser?.alias ||
        !canComplete
          ? "disabled"
          : ""
      }>
              ${!canComplete ? "EXECUTING..." : "COMPLETE"}
            </button>
          </div>
        </div>
      `;
    });

    // Filter out empty task HTML (from invalid tasks)
    const validTaskHTML = taskHTMLArray.filter((html) => html !== "");
    taskDisplay.innerHTML = operatorTaskCount + validTaskHTML.join("");
  }
}

// Task action functions
function acceptTask(taskId) {
  console.log("🎯 acceptTask called with taskId:", taskId);

  if (!currentUser) {
    addLog("ERROR: Must be logged in to accept tasks", "error");
    return;
  }

  const task = activeTasks.find((t) => t.id === taskId);
  if (!task) {
    addLog("ERROR: Task not found", "error");
    return;
  }

  if (task.assignedTo) {
    addLog("ERROR: Task already assigned", "error");
    return;
  }

  // Check if operator already has 3 active tasks
  const operatorActiveTasks = activeTasks.filter(
    (t) => t.assignedTo === currentUser.alias
  );

  if (operatorActiveTasks.length >= 3) {
    addLog(
      `ERROR: Maximum 3 tasks allowed. You have ${operatorActiveTasks.length} active tasks.`,
      "error"
    );
    return;
  }

  // Add task execution time based on difficulty
  const executionTime = task.difficulty * 30000; // 30 seconds per difficulty level
  task.executionStartTime = Date.now();
  task.executionEndTime = Date.now() + executionTime;
  task.assignedTo = currentUser.alias;
  task.assignedAt = Date.now(); // Add timestamp for sync conflict resolution

  // Update the task in the local array first
  const taskIndex = activeTasks.findIndex((t) => t.id === taskId);
  if (taskIndex !== -1) {
    activeTasks[taskIndex] = { ...task };
    console.log(
      `✅ Updated local task: ${task.name} (assignedTo: ${task.assignedTo})`
    );
  } else {
    console.warn(`❌ Task not found in local array: ${taskId}`);
  }

  // Then update in GunDB with a small delay to ensure local state is stable
  setTimeout(() => {
    taskRef.get(taskId).put(task);
    console.log(`📡 Updated task in GunDB: ${task.name}`);
  }, 50);

  addLog(
    `Task "${task.name}" accepted by ${
      currentUser.alias
    }. Execution time: ${Math.floor(executionTime / 1000)}s`,
    "success"
  );

  // Update display immediately with a small delay to ensure GunDB sync
  setTimeout(() => {
    updateTaskDisplay();
  }, 100);
}

function completeTask(taskId) {
  if (!currentUser) {
    addLog("ERROR: Must be logged in to complete tasks", "error");
    return;
  }

  const task = activeTasks.find((t) => t.id === taskId);
  if (!task) {
    addLog("ERROR: Task not found", "error");
    return;
  }

  if (!task.assignedTo || task.assignedTo !== currentUser.alias) {
    addLog("ERROR: Task not assigned to you", "error");
    return;
  }

  // Check if execution time has passed
  if (task.executionEndTime && Date.now() < task.executionEndTime) {
    const remainingTime = Math.ceil(
      (task.executionEndTime - Date.now()) / 1000
    );
    addLog(
      `ERROR: Task execution in progress. ${remainingTime}s remaining.`,
      "error"
    );
    return;
  }

  if (Date.now() > task.expiresAt) {
    addLog("ERROR: Task has expired", "error");
    task.failed = true;
    taskRef.get(taskId).put(task);
    activeTasks = activeTasks.filter((t) => t.id !== taskId);
    updateTaskDisplay();
    return;
  }

  // Calculate task success based on parameters
  const success = calculateTaskSuccess(task);

  if (success) {
    task.completed = true;

    addLog(`Task "${task.name}" completed successfully!`, "success");

    // Award points based on task difficulty and type
    const points =
      task.difficulty *
      (task.type === "EMERGENCY" ? 3 : task.type === "CRITICAL" ? 2 : 1);
    awardTaskPoints(points);

    // Apply task effects to station parameters
    applyTaskEffects(task);
  } else {
    task.failed = true;

    addLog(`Task "${task.name}" failed!`, "error");

    // Apply negative effects
    applyTaskFailureEffects(task);
  }

  // Remove from active tasks and add to history
  activeTasks = activeTasks.filter((t) => t.id !== taskId);
  taskHistory.push(task);

  taskRef.get(taskId).put(task);
  updateTaskDisplay();
}

function calculateTaskSuccess(task) {
  // Base success rate based on difficulty
  let successRate = 1 - task.difficulty * 0.1; // 90% for difficulty 1, 50% for difficulty 5

  // Add randomness
  successRate += (Math.random() - 0.5) * 0.2; // ±10% randomness

  // Consider parameter conditions
  if (task.parameters) {
    if (
      task.parameters.targetPower &&
      Math.abs(stationParameters.powerLevel - task.parameters.targetPower) < 5
    ) {
      successRate += 0.1;
    }
    if (
      task.parameters.targetOxygen &&
      Math.abs(stationParameters.oxygenLevel - task.parameters.targetOxygen) < 3
    ) {
      successRate += 0.1;
    }
    if (
      task.parameters.targetTemp &&
      Math.abs(stationParameters.temperature - task.parameters.targetTemp) < 2
    ) {
      successRate += 0.1;
    }
  }

  return Math.random() < Math.max(0.1, Math.min(0.95, successRate));
}

function awardTaskPoints(points) {
  if (!currentUser) return;

  user.get("profile").once((profile) => {
    const newPoints = (profile.points || 0) + points;
    const newLevel = getLevelFromPoints(newPoints);

    const newProfile = {
      ...profile,
      points: newPoints,
      level: newLevel,
      tasksCompleted: (profile.tasksCompleted || 0) + 1,
    };

    user.get("profile").put(newProfile);

    // Update leaderboard
    gun.get("leaderboard").get(currentUser.alias).put({
      points: newPoints,
      level: newLevel,
    });

    addLog(`+${points} points for task completion!`, "success");
  });
}

function applyTaskEffects(task) {
  // Apply realistic effects based on task completion
  const effects = parameterEffects[task.name];
  if (effects && effects.success) {
    Object.keys(effects.success).forEach((param) => {
      stationParameters[param] += effects.success[param];
    });

    // Apply parameter interdependencies
    applyParameterInterdependencies();

    // Clamp values to reasonable ranges
    clampParameterValues();

    addLog(`Task "${task.name}" improved station parameters`, "success");
  }

  stationParamsRef.put({
    ...stationParameters,
    lastUpdate: Date.now(),
  });
}

function applyTaskFailureEffects(task) {
  // Apply realistic negative effects for failed tasks
  const effects = parameterEffects[task.name];
  if (effects && effects.failure) {
    Object.keys(effects.failure).forEach((param) => {
      stationParameters[param] += effects.failure[param];
    });

    // Apply parameter interdependencies
    applyParameterInterdependencies();

    // Clamp values to reasonable ranges
    clampParameterValues();

    addLog(`Task "${task.name}" failure worsened station parameters`, "error");
  }

  stationParamsRef.put({
    ...stationParameters,
    lastUpdate: Date.now(),
  });
}

// Calculate bonus points based on station parameter balance
function calculateParameterBalanceBonus() {
  let bonusPoints = 0;
  let balancedParameters = 0;
  const totalParameters = 6;

  // Check each parameter for optimal balance
  // Power Level: Optimal between 80-100%
  if (
    stationParameters.powerLevel >= 80 &&
    stationParameters.powerLevel <= 100
  ) {
    bonusPoints += 1;
    balancedParameters++;
  }

  // Oxygen Level: Optimal between 85-100%
  if (
    stationParameters.oxygenLevel >= 85 &&
    stationParameters.oxygenLevel <= 100
  ) {
    bonusPoints += 1;
    balancedParameters++;
  }

  // Temperature: Optimal between 18-25°C
  if (
    stationParameters.temperature >= 18 &&
    stationParameters.temperature <= 25
  ) {
    bonusPoints += 1;
    balancedParameters++;
  }

  // Radiation Level: Optimal below 0.1
  if (stationParameters.radiationLevel <= 0.1) {
    bonusPoints += 1;
    balancedParameters++;
  }

  // Pressure: Optimal between 980-1020 hPa
  if (stationParameters.pressure >= 980 && stationParameters.pressure <= 1020) {
    bonusPoints += 1;
    balancedParameters++;
  }

  // Humidity: Optimal between 40-60%
  if (stationParameters.humidity >= 40 && stationParameters.humidity <= 60) {
    bonusPoints += 1;
    balancedParameters++;
  }

  // Additional bonus for having all parameters balanced
  if (balancedParameters === totalParameters) {
    bonusPoints += 3; // Perfect balance bonus
    addLog("PERFECT BALANCE! All parameters optimal.", "success");
  } else if (balancedParameters >= 4) {
    bonusPoints += 1; // Good balance bonus
  }

  return bonusPoints;
}

// Apply realistic parameter interdependencies
function applyParameterInterdependencies() {
  const originalValues = { ...stationParameters };

  Object.keys(parameterInterdependencies).forEach((param) => {
    const dependencies = parameterInterdependencies[param];
    if (dependencies.affects) {
      Object.keys(dependencies.affects).forEach((affectedParam) => {
        const factor = dependencies.affects[affectedParam];
        const change = originalValues[param] * factor * 0.01; // Small percentage effect
        stationParameters[affectedParam] += change;
      });
    }
  });
}

// Clamp parameter values to realistic ranges
function clampParameterValues() {
  // Power Level: 0-100%
  stationParameters.powerLevel = Math.max(
    0,
    Math.min(100, stationParameters.powerLevel)
  );

  // Oxygen Level: 0-100%
  stationParameters.oxygenLevel = Math.max(
    0,
    Math.min(100, stationParameters.oxygenLevel)
  );

  // Temperature: -50°C to 100°C
  stationParameters.temperature = Math.max(
    -50,
    Math.min(100, stationParameters.temperature)
  );

  // Radiation Level: 0-1
  stationParameters.radiationLevel = Math.max(
    0,
    Math.min(1, stationParameters.radiationLevel)
  );

  // Pressure: 800-1200 hPa
  stationParameters.pressure = Math.max(
    800,
    Math.min(1200, stationParameters.pressure)
  );

  // Humidity: 0-100%
  stationParameters.humidity = Math.max(
    0,
    Math.min(100, stationParameters.humidity)
  );
}

function startParameterDisplayUpdates() {
  // Update parameter display every 2 seconds for real-time feedback
  safeSetInterval(() => {
    updateStationParametersDisplay();
  }, 2000);
}
