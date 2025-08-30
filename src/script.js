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
  profileListeners: new Set(),
};

// Performance monitoring
const performanceMonitor = {
  startTime: Date.now(),
  memoryUsage: [],
  errors: [],

  logMemory() {
    if (performance.memory) {
      this.memoryUsage.push({
        timestamp: Date.now(),
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
      });
      if (this.memoryUsage.length > 100) this.memoryUsage.shift();
    }
  },

  logError(error) {
    this.errors.push({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
    });
    if (this.errors.length > 50) this.errors.shift();
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
  cleanupRegistry.intervals.forEach(
    (interval) => interval && clearInterval(interval)
  );
  cleanupRegistry.timeouts.forEach(
    (timeout) => timeout && clearTimeout(timeout)
  );
  cleanupRegistry.listeners.forEach((listener) => {
    if (listener?.element?.removeEventListener) {
      listener.element.removeEventListener(listener.event, listener.handler);
    }
  });
  cleanupRegistry.audioElements.forEach((audio) => {
    if (audio?.pause) {
      audio.pause();
      audio.currentTime = 0;
    }
  });

  // Also cleanup click sounds
  [click1, click2].forEach((audio) => {
    if (audio?.pause) {
      audio.pause();
      audio.currentTime = 0;
    }
  });

  cleanupRegistry.intervals.clear();
  cleanupRegistry.timeouts.clear();
  cleanupRegistry.listeners.clear();
  cleanupRegistry.audioElements.clear();
  cleanupRegistry.profileListeners.clear();

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
      performanceMonitor.logError(event.error);
      addLog(`CRITICAL ERROR: ${event.error.message}`, "error");

      // Prevent app crash by showing error state
      document.title = "SWAN STATION - ERROR";
      updateConnectionStatus("SYSTEM ERROR", "error");
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      performanceMonitor.logError(new Error(event.reason));
      addLog(`CRITICAL ERROR: Promise rejected - ${event.reason}`, "error");

      // Prevent app crash
      event.preventDefault();
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
    shogun = await window.SHOGUN_CORE({
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
    gun = shogun.db.gun;
    user = shogun.db.gun.user().recall({ sessionStorage: true });

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

    // Expose core functions to timer module
    window.core = {
      safeSetInterval: safeSetInterval,
      safeSetTimeout: safeSetTimeout,
      timerRef: timerRef,
      setTimerRef: (ref) => {
        timerRef = ref;
      },
      gun: gun,
      addLog: addLog,
      user: user
    };

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
    performanceMonitor.logError(error);
    document.title = "SWAN STATION - CONNECTION ERROR";
    updateConnectionStatus("CONNECTION ERROR", "error");
    addLog("CRITICAL: Connection to station network failed", "error");

    // Retry initialization after 5 seconds
    setTimeout(() => {
      addLog("Attempting to reconnect to station network...", "info");
      initializeShogun();
    }, 5000);
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
const task = new Audio("assets/task.mp3");
const click1 = new Audio("assets/click.mp3");
const click2 = new Audio("assets/click2.mp3");

// Make task audio globally available
window.task = task;

[siren, reset, tick, task, click1, click2].forEach((audio) => {
  cleanupRegistry.audioElements.add(audio);
  audio.addEventListener("error", (e) => {
    console.warn("Audio loading failed:", e.target.src);
    addLog(`WARNING: Audio file failed to load: ${e.target.src}`, "warning");
  });
  audio.addEventListener("loadstart", () => {
    console.log("Audio loading started:", audio.src);
  });
  audio.addEventListener("canplaythrough", () => {
    console.log("Audio loaded successfully:", audio.src);
  });
});

const buttonSounds = Array.from({ length: 8 }, (_, i) => {
  const audio = new Audio(`assets/typing_sounds/button${i + 1}.mp3`);
  audio.preload = "auto";
  cleanupRegistry.audioElements.add(audio);
  audio.addEventListener("error", (e) =>
    console.warn("Button sound loading failed:", e.target.src)
  );
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

// BALANCED LEVELING SYSTEM - More accessible progression
// Updated to provide better early-game experience and smoother progression
const levels = {
  1: 0, // Starting level (no points required)
  2: 15, // Very accessible early progression
  3: 35, // Easy to reach
  4: 60, // Smooth progression
  5: 90, // Early game milestone
  6: 130, // Challenge begins
  7: 180, // Mid-game entry
  8: 240, // Advanced play
  9: 310, // Expert level
  10: 390, // Master level
  11: 480, // Elite level
  12: 580, // Legendary
  13: 690, // Mythic
  14: 810, // Transcendent
  15: 940, // Divine
  16: 1080, // Immortal
  17: 1230, // Eternal
  18: 1390, // Cosmic
  19: 1560, // Universal
  20: 1740, // Multiversal
  21: 1930, // Omniversal
  22: 2130, // Absolute
  23: 2340, // Infinite
  24: 2560, // Ultimate
  25: 2790, // Supreme
  26: 3030, // Transcendent Master
  27: 3280, // Divine Master
  28: 3540, // Immortal Master
  29: 3810, // Eternal Master
  30: 4090, // Cosmic Master
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

function stopApp() {
  if (focusInterval) {
    clearInterval(focusInterval);
    cleanupRegistry.intervals.delete(focusInterval);
  }
  focusInterval = null;

  // Clear any pending timeouts
  if (window.appStartTimeout) {
    clearTimeout(window.appStartTimeout);
    window.appStartTimeout = null;
  }
  if (window.profileTimeout) {
    clearTimeout(window.profileTimeout);
    window.profileTimeout = null;
  }
  if (window.profileListenerTimeout) {
    clearTimeout(window.profileListenerTimeout);
    window.profileListenerTimeout = null;
  }

  console.log("App UI focus paused and timeouts cleared.");
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

  // Add a comprehensive safety timeout to prevent the app from getting stuck
  const appStartTimeout = setTimeout(() => {
    console.warn("⚠️ App initialization timeout - forcing completion");
    window.initialTaskLoadComplete = true;
    updateTaskDisplay();

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
  loadTasksFromGunDB();

  // Store the app timeout reference for cleanup
  window.appStartTimeout = appStartTimeout;

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

  // Update operators list periodically to handle cooldown expiration
  const cooldownUpdateInterval = safeSetInterval(() => {
    if (currentOperatorsData.length > 0) {
      updateActiveOperatorsList(currentOperatorsData);
    }
  }, 5000); // Check every 5 seconds

  // Fetch or initialize user profile with timeout protection
  console.log("🔍 Fetching user profile...");
  const profileTimeout = setTimeout(() => {
    console.warn("⚠️ Profile fetch timeout - using default values");
    currentUser.points = 5;
    currentUser.level = 1;
  }, 5000); // 5 second timeout for profile fetch

  user.get("profile").once((profile) => {
    clearTimeout(profileTimeout);
    console.log("📋 Profile data received:", profile);

    if (!profile) {
      console.log("🆕 Creating initial profile for new user");
      const initialProfile = {
        points: 5,
        level: 1,
        resetStreak: 0,
        reputation: reputationRules.startingReputation,
        challengesWon: 0,
        challengesLost: 0,
        totalPointsStolen: 0,
        totalPointsLost: 0,
        hashGamesWon: 0,
        totalHashPoints: 0,
      };
      user.get("profile").put(initialProfile);
      // Also add the new user to the public leaderboard
      gun.get("leaderboard").get(alias).put({
        points: 5,
        level: 1,
        reputation: reputationRules.startingReputation,
      });
      currentUser.points = 5;
      currentUser.level = 1;
    } else {
      console.log("✅ Using existing profile data");
      currentUser.points = profile.points;
      currentUser.level = getLevelFromPoints(profile.points);
      currentUser.calibrationSessions = profile.calibrationSessions || 0;
      currentUser.totalCalibrationScore =
        profile.totalCalibrationScore || profile.calibrationScore || 0;
      currentUser.bestCalibrationScore = profile.bestCalibrationScore || 0;
      currentUser.lastCalibrationScore = profile.lastCalibrationScore || 0;
    }
  });

  // Listen for profile updates with timeout protection (only if not already set up)
  if (!window.profileListenerSet) {
    const profileListenerTimeout = setTimeout(() => {
      console.warn("⚠️ Profile listener timeout - removing listener");
      user.get("profile").off(); // Remove the listener if it times out
    }, 10000); // 10 second timeout for profile listener

    const profileListener = user.get("profile").on((profile) => {
      clearTimeout(profileListenerTimeout);

      // Add rate limiting to prevent excessive logging and processing
      const now = Date.now();
      if (
        !window.lastProfileLogTime ||
        now - window.lastProfileLogTime > 5000
      ) {
        console.log("🔄 Profile update received:", profile);
        window.lastProfileLogTime = now;

        if (profile) {
          currentUser.points = profile.points;
          currentUser.level = getLevelFromPoints(profile.points);

          // Skip calibration data update if calibration just completed
          if (!window.calibrationJustCompleted) {
            // Preserve calibration data when updating from profile
            currentUser.calibrationSessions =
              profile.calibrationSessions ||
              currentUser.calibrationSessions ||
              0;
            currentUser.totalCalibrationScore =
              profile.totalCalibrationScore ||
              profile.calibrationScore ||
              currentUser.totalCalibrationScore ||
              0;
            currentUser.bestCalibrationScore =
              profile.bestCalibrationScore ||
              currentUser.bestCalibrationScore ||
              0;
            currentUser.lastCalibrationScore =
              profile.lastCalibrationScore ||
              currentUser.lastCalibrationScore ||
              0;
          } else {
            console.log(
              "🔧 Skipping calibration data update in profile listener (calibration just completed)"
            );
          }
          updateStatsUI();
        }
      } else {
        // Still update the data but don't log or update UI as frequently
        if (profile) {
          currentUser.points = profile.points;
          currentUser.level = getLevelFromPoints(profile.points);

          // Skip calibration data update if calibration just completed
          if (!window.calibrationJustCompleted) {
            // Preserve calibration data when updating from profile
            currentUser.calibrationSessions =
              profile.calibrationSessions ||
              currentUser.calibrationSessions ||
              0;
            currentUser.totalCalibrationScore =
              profile.totalCalibrationScore ||
              profile.calibrationScore ||
              currentUser.totalCalibrationScore ||
              0;
            currentUser.bestCalibrationScore =
              profile.bestCalibrationScore ||
              currentUser.bestCalibrationScore ||
              0;
            currentUser.lastCalibrationScore =
              profile.lastCalibrationScore ||
              currentUser.lastCalibrationScore ||
              0;
          }
        }
      }
    });

    // Register the profile listener for cleanup
    cleanupRegistry.profileListeners.add(profileListener);
    window.profileListenerSet = true;
  }

  // Store the profile timeout references for cleanup (disabled since listener is disabled)
  // window.profileTimeout = profileTimeout;
  // window.profileListenerTimeout = profileListenerTimeout;

  // Manual profile update function (replaces continuous listener)
  window.updateUserProfile = () => {
    user.get("profile").once((profile) => {
      if (profile) {
        currentUser.points = profile.points;
        currentUser.level = getLevelFromPoints(profile.points);
        currentUser.reputation =
          profile.reputation || reputationRules.startingReputation;
        // Preserve calibration data when updating from profile
        currentUser.calibrationSessions =
          profile.calibrationSessions || currentUser.calibrationSessions || 0;
        currentUser.totalCalibrationScore =
          profile.totalCalibrationScore ||
          profile.calibrationScore ||
          currentUser.totalCalibrationScore ||
          0;
        currentUser.bestCalibrationScore =
          profile.bestCalibrationScore || currentUser.bestCalibrationScore || 0;
        currentUser.lastCalibrationScore =
          profile.lastCalibrationScore || currentUser.lastCalibrationScore || 0;
        if (stats) updateStatsUI(stats);
        console.log("📊 Manual profile update completed");
      }
    });
  };

  // Initial profile update
  window.updateUserProfile();

  // Sync profile with leaderboard data on startup
  gun
    .get("leaderboard")
    .get(alias)
    .once((leaderboardData) => {
      if (leaderboardData && leaderboardData.points !== undefined) {
        console.log("🔄 Startup sync with leaderboard data:", leaderboardData);
        currentUser.points = leaderboardData.points;
        currentUser.level =
          leaderboardData.level || getLevelFromPoints(leaderboardData.points);

        // Update profile in GunDB to match leaderboard
        user.get("profile").once((profile) => {
          if (profile && profile.points !== leaderboardData.points) {
            const updatedProfile = {
              ...profile,
              points: leaderboardData.points,
              level:
                leaderboardData.level ||
                getLevelFromPoints(leaderboardData.points),
            };
            user.get("profile").put(updatedProfile);
            console.log(
              "🔄 Profile synced with leaderboard on startup:",
              updatedProfile
            );
          }
        });
      }
    });

  // Function to force sync calibration data from profile
  window.syncCalibrationFromProfile = () => {
    user.get("profile").once((profile) => {
      if (profile) {
        console.log("🔧 Force syncing calibration data from profile:", profile);
        console.log("🔧 Profile calibration fields:", {
          calibrationSessions: profile.calibrationSessions,
          totalCalibrationScore: profile.totalCalibrationScore,
          calibrationScore: profile.calibrationScore,
          bestCalibrationScore: profile.bestCalibrationScore,
          lastCalibrationScore: profile.lastCalibrationScore,
        });

        // Store original values before assignment
        const originalSessions = currentUser.calibrationSessions;
        const originalTotal = currentUser.totalCalibrationScore;
        const originalBest = currentUser.bestCalibrationScore;
        const originalLast = currentUser.lastCalibrationScore;

        // Use explicit checks for GunDB data structure
        currentUser.calibrationSessions =
          profile.calibrationSessions !== undefined &&
          profile.calibrationSessions !== null
            ? profile.calibrationSessions
            : currentUser.calibrationSessions || 0;

        currentUser.totalCalibrationScore =
          profile.totalCalibrationScore !== undefined &&
          profile.totalCalibrationScore !== null
            ? profile.totalCalibrationScore
            : profile.calibrationScore !== undefined &&
              profile.calibrationScore !== null
            ? profile.calibrationScore
            : currentUser.totalCalibrationScore || 0;

        currentUser.bestCalibrationScore =
          profile.bestCalibrationScore !== undefined &&
          profile.bestCalibrationScore !== null
            ? profile.bestCalibrationScore
            : currentUser.bestCalibrationScore || 0;

        currentUser.lastCalibrationScore =
          profile.lastCalibrationScore !== undefined &&
          profile.lastCalibrationScore !== null
            ? profile.lastCalibrationScore
            : currentUser.lastCalibrationScore || 0;

        console.log("🔧 Calibration data synced to currentUser:", {
          calibrationSessions: currentUser.calibrationSessions,
          totalCalibrationScore: currentUser.totalCalibrationScore,
          bestCalibrationScore: currentUser.bestCalibrationScore,
          lastCalibrationScore: currentUser.lastCalibrationScore,
        });

        console.log("🔧 Values changed:", {
          sessions: `${originalSessions} -> ${currentUser.calibrationSessions}`,
          total: `${originalTotal} -> ${currentUser.totalCalibrationScore}`,
          best: `${originalBest} -> ${currentUser.bestCalibrationScore}`,
          last: `${originalLast} -> ${currentUser.lastCalibrationScore}`,
        });
      }
    });
  };

  // Function to force sync current user points to leaderboard
  window.syncPointsToLeaderboard = () => {
    if (currentUser && currentUser.alias) {
      console.log("🔄 Syncing current user points to leaderboard:", {
        alias: currentUser.alias,
        points: currentUser.points,
        level: currentUser.level,
      });

      gun.get("leaderboard").get(currentUser.alias).put({
        points: currentUser.points,
        level: currentUser.level,
      });

      // Also update profile to ensure consistency
      user.get("profile").once((profile) => {
        if (profile) {
          const updatedProfile = {
            ...profile,
            points: currentUser.points,
            level: currentUser.level,
          };
          user.get("profile").put(updatedProfile);
          console.log("🔄 Profile also synced with current user data");
        }
      });

      // Also update the modular system if it exists
      if (window.core && window.core.gun) {
        window.core.gun.user().get("points").put(currentUser.points);
        window.core.gun.user().get("level").put(currentUser.level);
        console.log("🔄 Modular system also synced");
      }
    }
  };

  // Function to debug profile data
  window.debugProfileData = () => {
    user.get("profile").once((profile) => {
      console.log("🔍 Debug Profile Data:", profile);
      if (profile) {
        console.log("🔍 Profile keys:", Object.keys(profile));
        console.log("🔍 Calibration data in profile:", {
          calibrationSessions: profile.calibrationSessions,
          totalCalibrationScore: profile.totalCalibrationScore,
          calibrationScore: profile.calibrationScore,
          bestCalibrationScore: profile.bestCalibrationScore,
          lastCalibrationScore: profile.lastCalibrationScore,
        });
        console.log("🔍 Current user calibration data:", {
          calibrationSessions: currentUser.calibrationSessions,
          totalCalibrationScore: currentUser.totalCalibrationScore,
          bestCalibrationScore: currentUser.bestCalibrationScore,
          lastCalibrationScore: currentUser.lastCalibrationScore,
        });
      }
    });
  };

  // Debug function to check points synchronization
  window.debugPointsSync = () => {
    console.log("🔍 Points Synchronization Debug:");
    console.log("Current User:", {
      alias: currentUser?.alias,
      points: currentUser?.points,
      level: currentUser?.level,
    });

    if (currentUser?.alias) {
      // Check leaderboard data
      gun
        .get("leaderboard")
        .get(currentUser.alias)
        .once((leaderboardData) => {
          console.log("Leaderboard Data:", leaderboardData);

          // Check profile data
          user.get("profile").once((profile) => {
            console.log("Profile Data:", profile);

            const isSynced =
              leaderboardData?.points === currentUser.points &&
              profile?.points === currentUser.points;

            console.log(
              "Synchronization Status:",
              isSynced ? "✅ SYNCED" : "❌ NOT SYNCED"
            );

            if (!isSynced) {
              console.log("🔄 Forcing sync...");
              window.syncPointsToLeaderboard();
            }
          });
        });
    }
  };

  // Unified function to update points across all systems
  window.updateUserPoints = (
    pointsToAdd,
    reason = "points update",
    calibrationData = null
  ) => {
    if (!currentUser) {
      console.error("❌ Cannot update points: no current user");
      return;
    }

    const oldPoints = currentUser.points || 0;
    const newPoints = oldPoints + pointsToAdd;
    const newLevel = getLevelFromPoints(newPoints);

    console.log(
      `🔄 Updating points: ${oldPoints} + ${pointsToAdd} = ${newPoints} (${reason})`
    );

    // Update local user data
    currentUser.points = newPoints;
    currentUser.level = newLevel;

    // Update profile in GunDB
    user.get("profile").once((profile) => {
      let updatedProfile = {
        ...profile,
        points: newPoints,
        level: newLevel,
      };

      // Add calibration data if provided
      if (calibrationData) {
        updatedProfile = {
          ...updatedProfile,
          calibrationSessions: (profile.calibrationSessions || 0) + 1,
          totalCalibrationScore:
            (profile.totalCalibrationScore || 0) + calibrationData.score,
          lastCalibrationScore: calibrationData.score,
          bestCalibrationScore: Math.max(
            profile.bestCalibrationScore || 0,
            calibrationData.score
          ),
          lastCalibrationDate: Date.now(),
        };

        // Update local calibration data
        currentUser.calibrationSessions = updatedProfile.calibrationSessions;
        currentUser.totalCalibrationScore =
          updatedProfile.totalCalibrationScore;
        currentUser.bestCalibrationScore = updatedProfile.bestCalibrationScore;
        currentUser.lastCalibrationScore = updatedProfile.lastCalibrationScore;
      }

      user.get("profile").put(updatedProfile);
      console.log("🔄 Profile updated in GunDB");
    });

    // Update leaderboard
    gun.get("leaderboard").get(currentUser.alias).put({
      points: newPoints,
      level: newLevel,
    });
    console.log("🔄 Leaderboard updated");

    // Update modular system if it exists
    if (window.core && window.core.gun) {
      window.core.gun.user().get("points").put(newPoints);
      window.core.gun.user().get("level").put(newLevel);
      console.log("🔄 Modular system updated");
    }

    // Update UI
    if (stats) updateStatsUI(stats);

    // Force profile UI update if profile modal is open
    if (window.updateUserProfile) {
      window.updateUserProfile();
    }

    console.log(
      `✅ Points update complete: ${newPoints} points (Level ${newLevel})`
    );
  };

  // Setup menu toggle button in header
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  if (menuToggleBtn) {
    menuToggleBtn.onclick = () => {
      console.log("🔘 Header menu button clicked");
      toggleMenu();
    };
    console.log("✅ Header menu button setup complete");
  }

  // Load cooldowns from GunDB
  loadCooldownsFromGunDB();
  loadCalibrationFromGunDB();
  loadChallengeCooldownFromGunDB();

  // Start challenge cooldown update interval
  const challengeCooldownInterval = safeSetInterval(() => {
    updateChallengeCooldownUI();
  }, 1000); // Update every second

  // Periodic sync to ensure data consistency
  const periodicSyncInterval = safeSetInterval(() => {
    if (currentUser && currentUser.alias && window.syncPointsToLeaderboard) {
      window.syncPointsToLeaderboard();
    }
  }, 30000); // Sync every 30 seconds

  // Show the main container and hide header
  const container = document.querySelector(".container");
  const headerSection = document.querySelector(".header-section");
  const statsContainer = document.getElementById("statsContainer");

  // Initially hide all interface elements (menu OFF state)
  if (container) {
    container.style.display = "none";
    container.classList.remove("centered");
  }
  if (headerSection) {
    headerSection.style.display = "none";
  }
  if (statsContainer) {
    statsContainer.style.display = "none";
  }

  // Hide log container when in timer mode
  const logContainer = document.querySelector(".log-container");
  if (logContainer) {
    logContainer.style.display = "none";
  }

  // Show timer and input box initially (menu OFF state)
  const bigTimer = document.getElementById("bigTimer");
  const input = document.querySelector(".input");
  const prompt = document.querySelector(".prompt");

  if (bigTimer) {
    bigTimer.style.display = "block";
    bigTimer.style.position = "fixed";
    bigTimer.style.top = "20px";
    bigTimer.style.left = "50%";
    bigTimer.style.transform = "translateX(-50%)";
    bigTimer.style.zIndex = "1000";
    bigTimer.style.fontSize = "48px";
    bigTimer.style.color = "#00ff00";
    bigTimer.style.textAlign = "center";
    bigTimer.style.margin = "20px 0";
    bigTimer.style.background = "transparent";
    bigTimer.style.border = "none";
    bigTimer.style.padding = "0";
    bigTimer.style.boxShadow = "none";
  }

  if (input && prompt) {
    input.style.display = "block";
    prompt.style.display = "block";
    prompt.style.position = "fixed";
    prompt.style.top = "100px";
    prompt.style.left = "50%";
    prompt.style.transform = "translateX(-50%)";
    prompt.style.zIndex = "1000";
    prompt.style.color = "#00ff00";
    prompt.style.opacity = "1";
    prompt.style.background = "transparent";
    prompt.style.border = "none";
    prompt.style.padding = "0";
  }

  if (headerSection) {
    headerSection.style.display = "none";
  }

  if (statsContainer) {
    statsContainer.style.display = "none";
  }

  // Add a small menu button to access functions
  addMenuButton();

  // Debug: Log initial state
  console.log("🚀 App started with menu OFF state");
  console.log("📊 Timer element:", bigTimer);
  console.log("📝 Prompt element:", prompt);
  console.log("🎯 Container element:", container);

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
    console.log("🔘 Menu button clicked");
    toggleMenu();
  };

  document.body.appendChild(menuButton);
  console.log("✅ Floating menu button added");
}

function toggleMenu() {
  const statsContainer = document.getElementById("statsContainer");
  const logContainer = document.querySelector(".log-container");
  const headerSection = document.querySelector(".header-section");
  const container = document.querySelector(".container");
  const bigTimer = document.getElementById("bigTimer");
  const prompt = document.querySelector(".prompt");

  if (statsContainer) {
    // Check if menu is currently OFF (showing only timer/input)
    const isMenuOff =
      statsContainer.style.display === "none" || !statsContainer.style.display;

    if (isMenuOff) {
      // MENU ATTIVATO (on): Show full interface, hide timer/input
      console.log("🔄 Activating menu - showing full interface");

      // Show all interface elements
      statsContainer.style.display = "flex";
      if (logContainer) {
        logContainer.style.display = "block";
      }
      if (headerSection) {
        headerSection.style.display = "block";
      }
      if (container) {
        container.style.display = "block";
        container.classList.remove("centered"); // Remove centered class to show normal layout
      }

      // Show the header menu button when menu is on
      const menuToggleBtn = document.getElementById("menuToggleBtn");
      if (menuToggleBtn) {
        menuToggleBtn.style.display = "block";
      }

      // Hide the floating menu button when menu is on to avoid confusion
      const floatingMenuBtn = document.getElementById("menuButton");
      if (floatingMenuBtn) {
        floatingMenuBtn.style.display = "none";
      }

      // Hide timer and input box completely
      if (bigTimer) {
        bigTimer.style.display = "none";
      }
      if (prompt) {
        prompt.style.display = "none";
      }
    } else {
      // MENU DISATTIVATO (off): Show only timer and input box
      console.log("🔄 Deactivating menu - showing timer only");

      // Hide ALL interface elements completely
      statsContainer.style.display = "none";
      if (logContainer) {
        logContainer.style.display = "none";
      }
      if (headerSection) {
        headerSection.style.display = "none";
      }
      if (container) {
        container.style.display = "none";
        container.classList.remove("centered"); // Remove centered class
      }

      // Hide the header menu button when menu is off
      const menuToggleBtn = document.getElementById("menuToggleBtn");
      if (menuToggleBtn) {
        menuToggleBtn.style.display = "none";
      }

      // Ensure the floating menu button is visible
      const floatingMenuBtn = document.getElementById("menuButton");
      if (floatingMenuBtn) {
        floatingMenuBtn.style.display = "block";
      }

      // Show only timer and input box at the top with proper styling
      if (bigTimer) {
        bigTimer.style.display = "block";
        bigTimer.style.position = "fixed";
        bigTimer.style.top = "20px";
        bigTimer.style.left = "50%";
        bigTimer.style.transform = "translateX(-50%)";
        bigTimer.style.zIndex = "1000";
        bigTimer.style.fontSize = "48px";
        bigTimer.style.color = "#00ff00";
        bigTimer.style.textAlign = "center";
        bigTimer.style.margin = "20px 0";
        bigTimer.style.background = "transparent";
        bigTimer.style.border = "none";
        bigTimer.style.padding = "0";
        bigTimer.style.boxShadow = "none";
      }
      if (prompt) {
        prompt.style.display = "block";
        prompt.style.position = "fixed";
        prompt.style.top = "100px";
        prompt.style.left = "50%";
        prompt.style.transform = "translateX(-50%)";
        prompt.style.zIndex = "1000";
        prompt.style.color = "#00ff00";
        prompt.style.opacity = "1";
        prompt.style.background = "transparent";
        prompt.style.border = "none";
        prompt.style.padding = "0";
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
            <div class="auth-instructions" id="authInstructions" style="display: none; color: #00ff00; font-size: 12px; margin: 10px 0; text-align: center;">
                Click CONFIRM to complete registration
            </div>
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
  const instructionsDiv = overlay.querySelector("#authInstructions");

  overlay.querySelector("#loginBtn").onclick = async () => {
    try {
      // Hide confirm password field and confirm button for login
      confirmPasswordInput.style.display = "none";
      overlay.querySelector("#confirmBtn").style.display = "none";
      instructionsDiv.style.display = "none";

      // Show loading state
      const loginBtn = overlay.querySelector("#loginBtn");
      const originalText = loginBtn.textContent;
      loginBtn.textContent = "LOGGING IN...";
      loginBtn.style.opacity = "0.7";
      loginBtn.disabled = true;
      errorDiv.textContent = "Authenticating...";
      errorDiv.style.color = "#00ff00"; // Green for info

      // Validate inputs
      if (!usernameInput.value.trim()) {
        errorDiv.textContent = "Please enter a username";
        errorDiv.style.color = "#ff0000"; // Red for error
        loginBtn.textContent = originalText;
        loginBtn.style.opacity = "1";
        loginBtn.disabled = false;
        return;
      }

      if (!passwordInput.value.trim()) {
        errorDiv.textContent = "Please enter a password";
        errorDiv.style.color = "#ff0000"; // Red for error
        loginBtn.textContent = originalText;
        loginBtn.style.opacity = "1";
        loginBtn.disabled = false;
        return;
      }

      const result = await shogun.login(
        usernameInput.value,
        passwordInput.value
      );
      if (result.success) {
        errorDiv.textContent = "Login successful! Starting application...";
        errorDiv.style.color = "#00ff00"; // Green for success
        setTimeout(() => {
          overlay.remove();
          // Store user alias in GunDB for future reference
          gun
            .get("users")
            .get(result.userPub)
            .put({ alias: usernameInput.value });
          startApp(usernameInput.value);
        }, 1000);
      } else {
        errorDiv.textContent = result.error || "Login failed";
        errorDiv.style.color = "#ff0000"; // Red for error
        loginBtn.textContent = originalText;
        loginBtn.style.opacity = "1";
        loginBtn.disabled = false;
      }
    } catch (error) {
      errorDiv.textContent = error.message || "Login failed";
      errorDiv.style.color = "#ff0000"; // Red for error
      const loginBtn = overlay.querySelector("#loginBtn");
      loginBtn.textContent = "LOGIN";
      loginBtn.style.opacity = "1";
      loginBtn.disabled = false;
    }
  };

  // Add click handler to show confirm password field when signup is clicked
  overlay.querySelector("#signupBtn").onclick = () => {
    confirmPasswordInput.style.display = "block";
    overlay.querySelector("#confirmBtn").style.display = "inline-block";
    instructionsDiv.style.display = "block";
    errorDiv.textContent = "Please confirm your password";
    errorDiv.style.color = "#00ff00"; // Green for info
  };

  // Add actual signup handler
  const performSignup = async () => {
    try {
      // Show loading state
      const confirmBtn = overlay.querySelector("#confirmBtn");
      const originalText = confirmBtn.textContent;
      confirmBtn.textContent = "REGISTERING...";
      confirmBtn.style.opacity = "0.7";
      confirmBtn.disabled = true;
      errorDiv.textContent = "Creating account...";
      errorDiv.style.color = "#00ff00"; // Green for info

      // Validate password length first
      if (passwordInput.value.length < 12) {
        errorDiv.textContent = "Password must be at least 12 characters long";
        errorDiv.style.color = "#ff0000"; // Red for error
        confirmBtn.textContent = originalText;
        confirmBtn.style.opacity = "1";
        confirmBtn.disabled = false;
        return;
      }

      // Validate passwords match
      if (passwordInput.value !== confirmPasswordInput.value) {
        errorDiv.textContent = "Passwords do not match";
        errorDiv.style.color = "#ff0000"; // Red for error
        confirmBtn.textContent = originalText;
        confirmBtn.style.opacity = "1";
        confirmBtn.disabled = false;
        return;
      }

      // Validate username
      if (!usernameInput.value.trim()) {
        errorDiv.textContent = "Please enter a username";
        errorDiv.style.color = "#ff0000"; // Red for error
        confirmBtn.textContent = originalText;
        confirmBtn.style.opacity = "1";
        confirmBtn.disabled = false;
        return;
      }

      if (usernameInput.value.length < 3) {
        errorDiv.textContent = "Username must be at least 3 characters long";
        errorDiv.style.color = "#ff0000"; // Red for error
        confirmBtn.textContent = originalText;
        confirmBtn.style.opacity = "1";
        confirmBtn.disabled = false;
        return;
      }

      if (!passwordInput.value.trim()) {
        errorDiv.textContent = "Please enter a password";
        errorDiv.style.color = "#ff0000"; // Red for error
        confirmBtn.textContent = originalText;
        confirmBtn.style.opacity = "1";
        confirmBtn.disabled = false;
        return;
      }

      const result = await shogun.signUp(
        usernameInput.value,
        passwordInput.value
      );
      if (result.success) {
        errorDiv.textContent = "Account created! Logging in...";
        errorDiv.style.color = "#00ff00"; // Green for success

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
          errorDiv.textContent = "Login successful! Starting application...";
          setTimeout(() => {
            overlay.remove();
            startApp(usernameInput.value);
          }, 1000);
        } else {
          errorDiv.textContent =
            "Signup successful but login failed. Please try logging in manually.";
          errorDiv.style.color = "#ffaa00"; // Orange for warning
          confirmBtn.textContent = originalText;
          confirmBtn.style.opacity = "1";
          confirmBtn.disabled = false;
        }
      } else {
        errorDiv.textContent = result.error || "Signup failed";
        errorDiv.style.color = "#ff0000"; // Red for error
        confirmBtn.textContent = originalText;
        confirmBtn.style.opacity = "1";
        confirmBtn.disabled = false;
      }
    } catch (error) {
      errorDiv.textContent = error.message || "Signup failed";
      errorDiv.style.color = "#ff0000"; // Red for error
      const confirmBtn = overlay.querySelector("#confirmBtn");
      confirmBtn.textContent = "CONFIRM";
      confirmBtn.style.opacity = "1";
      confirmBtn.disabled = false;
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
    const audio = buttonSounds[Math.floor(Math.random() * 7)];
    if (audio?.readyState >= 2) {
      audio.volume = 0.3;
      audio.currentTime = 0;
      audio
        .play()
        .catch((error) => console.warn("Failed to play button sound:", error));
    }
  } catch (error) {
    console.warn("Error in typeSound function:", error);
  }
}

// Click sound function with random selection between click1 and click2
function playClickSound() {
  try {
    // Randomly select between click1 and click2
    const clickSounds = [click1, click2];
    const randomClick =
      clickSounds[Math.floor(Math.random() * clickSounds.length)];

    if (randomClick?.readyState >= 2) {
      randomClick.volume = 0.4;
      randomClick.currentTime = 0;
      randomClick
        .play()
        .catch((error) => console.warn("Failed to play click sound:", error));
    }
  } catch (error) {
    console.warn("Error in playClickSound function:", error);
  }
}

// Function to update timer - now using timer module
function updateTimer(newValue, reason = "") {
  if (window.timer && window.timer.updateTimer) {
    window.timer.updateTimer(newValue, reason);
  } else {
    console.error("❌ Timer module not available");
    addLog("ERROR: Timer module not initialized", "error");
  }
}

// Setup main timer listener to react to any change - now using timer module
function setupTimerListener() {
  if (window.timer && window.timer.setupTimerListener) {
    window.timer.setupTimerListener();
  } else {
    console.error("❌ Timer module not available");
    addLog("ERROR: Timer module not initialized", "error");
  }
}

// Function to update input state based on timer value - now using timer module
function updateInputState(timerValue) {
  if (window.timer && window.timer.updateInputState) {
    window.timer.updateInputState(timerValue);
  } else {
    console.error("❌ Timer module not available");
    addLog("ERROR: Timer module not initialized", "error");
  }
}

// Input handler - now using timer module
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

    // Use timer module to process input
    if (window.timer && window.timer.processTimerInput) {
      const processed = window.timer.processTimerInput(input.value);

      if (processed && input.value === "4 8 15 16 23 42") {
        // Stop system failure display if active
        stopSystemFailureDisplay();

        // Use the timer module's reset function
        if (window.timer && window.timer.resetTimerWithStats) {
          window.timer.resetTimerWithStats();
        }

        // Increment successful resets stat
        statsRef.once((currentStats) => {
          if (currentStats) {
            const resetHistory = currentStats.resetHistory || [];
            resetHistory.push({
              timestamp: Date.now(),
              operator: currentUser?.alias || "Unknown",
            });

            // Keep only last 100 resets for performance
            if (resetHistory.length > 100) {
              resetHistory.splice(0, resetHistory.length - 100);
            }

            statsRef.put({
              resets: (currentStats.resets || 0) + 1,
              resetHistory: resetHistory,
            });
          }
        });

        // Update user's personal points and streak
        user.get("profile").once((profile) => {
          let pointsToAdd = pointRules.baseResetPoints; // Base points for successful reset
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

            if (reputationBonus > 0) {
              addLog(
                `Excellent calibration! +${reputationBonus} reputation.`,
                "success"
              );
            }

            // Calculate reputation bonus for good calibration
            let reputationBonus = 0;
            if (parameterBonus >= 3) {
              reputationBonus = reputationRules.calibrationBonus;
            }

            const newReputation = Math.min(
              reputationRules.maxReputation,
              (profile.reputation || reputationRules.startingReputation) +
                reputationBonus
            );

            const newProfile = {
              points: newPoints,
              level: newLevel,
              resetStreak: newStreak,
              resets: (profile.resets || 0) + 1,
              reputation: newReputation,
            };
            // Update user's private profile
            user.get("profile").put(newProfile);

            // Update the public leaderboard with public data
            gun.get("leaderboard").get(currentUser.alias).put({
              points: newPoints,
              level: newLevel,
              reputation: newReputation,
            });

            // Update local user data immediately
            currentUser.points = newPoints;
            currentUser.level = newLevel;
            currentUser.reputation = newReputation;

            // Update UI immediately
            if (stats) updateStatsUI(stats);

            // Force profile UI update if profile modal is open
            if (window.updateUserProfile) {
              window.updateUserProfile();
            }
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
    } else {
      // Fallback if timer module is not available
      addLog("Timer module not available, using fallback", "warning");
    }

    // Clear input after processing
    input.value = "";
  }
};

// Timer decrement function - now using timer module
function decrementTimer() {
  if (window.timer && window.timer.decrementTimer) {
    window.timer.decrementTimer();
  } else {
    console.error("❌ Timer module not available");
    addLog("ERROR: Timer module not initialized", "error");
  }
}

// Generate avatar from public key using Multiavatar
function generateAvatar(pubKey) {
  try {
    const avatarSvg = multiavatar(pubKey, false);
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

    const color1 = "#" + pubKey.slice(-6);
    const color2 = "#" + pubKey.slice(-12, -6);
    const color3 = "#" + pubKey.slice(-18, -12);

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);

    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 112, 112);

    const pattern = [];
    for (let i = 0; i < pubKey.length; i++) {
      pattern.push(parseInt(pubKey[i], 16));
    }

    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        const index = (i * 16 + j) % pattern.length;
        const value = pattern[index];
        ctx.fillStyle =
          value % 3 === 0 ? color1 : value % 3 === 1 ? color2 : color3;
        ctx.fillRect(i * 8, j * 8, 8, 8);
      }
    }

    ctx.fillStyle = "#00ff00";
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
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
                            <div class="stat-label">CALIBRATION SESSIONS</div>
                            <div class="stat-value" id="profileCalibrationSessions">0</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">TOTAL CALIBRATION SCORE</div>
                            <div class="stat-value" id="profileTotalCalibrationScore">0</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">BEST CALIBRATION SCORE</div>
                            <div class="stat-value" id="profileBestCalibrationScore">0</div>
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
                            <div class="stat-label">LEVEL</div>
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
                        <button id="refreshCalibration" class="terminal-button secondary-button">🔧 REFRESH CALIBRATION</button>
                    </div>
                </div>
                </div>
            </div>
            <div class="terminal-footer">CLOSE</div>
        </div>
    `;
  document.body.appendChild(overlay);

  // Aggiorna le informazioni del profilo
  window.updateProfile = () => {
    console.log("🔧 updateProfile() called");
    user.get("profile").once((profile) => {
      console.log("🔧 updateProfile() - Profile data:", profile);
      console.log("🔧 updateProfile() - currentUser data:", currentUser);
      if (profile) {
        const profileAlias = document.getElementById("profileAlias");
        const profileLevel = document.getElementById("profileLevel");
        const profilePoints = document.getElementById("profilePoints");
        const profileLocation = document.getElementById("profileLocation");
        const profileResets = document.getElementById("profileResets");
        const profileTasks = document.getElementById("profileTasks");
        const profileCalibrationSessions = document.getElementById(
          "profileCalibrationSessions"
        );
        const profileTotalCalibrationScore = document.getElementById(
          "profileTotalCalibrationScore"
        );
        const profileBestCalibrationScore = document.getElementById(
          "profileBestCalibrationScore"
        );
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
        if (profilePoints) {
          // Get the most up-to-date points from leaderboard to ensure consistency
          gun
            .get("leaderboard")
            .get(currentUser.alias)
            .once((leaderboardData) => {
              if (leaderboardData && leaderboardData.points !== undefined) {
                profilePoints.textContent = leaderboardData.points;
                // Update currentUser to match leaderboard
                currentUser.points = leaderboardData.points;
                currentUser.level =
                  leaderboardData.level ||
                  getLevelFromPoints(leaderboardData.points);
              } else {
                // Fallback to currentUser points if leaderboard data not available
                profilePoints.textContent = currentUser.points;
              }
            });
        }
        if (profileLocation)
          profileLocation.textContent = profile.location || "NOT SET";
        if (profileResets) profileResets.textContent = profile.resets || 0;
        if (profileTasks)
          profileTasks.textContent = profile.tasksCompleted || 0;
        if (profileCalibrationSessions)
          profileCalibrationSessions.textContent =
            profile.calibrationSessions || currentUser.calibrationSessions || 0;
        if (profileTotalCalibrationScore) {
          // Use profile data as primary source, fallback to currentUser
          const totalScore =
            profile.totalCalibrationScore ||
            profile.calibrationScore ||
            currentUser.totalCalibrationScore ||
            0;
          profileTotalCalibrationScore.textContent = totalScore;
          console.log(
            "🔧 updateProfile() - Updated profileTotalCalibrationScore to:",
            totalScore
          );
        }
        if (profileBestCalibrationScore) {
          const bestScore = Math.max(
            profile.lastCalibrationScore ||
              currentUser.lastCalibrationScore ||
              0,
            profile.bestCalibrationScore ||
              currentUser.bestCalibrationScore ||
              0
          );
          profileBestCalibrationScore.textContent = bestScore;
        }
        if (profileContribution) {
          // Calculate network contribution based on session duration and activity
          const sessionDuration =
            Date.now() - (currentUser.connectionTime || Date.now());
          const hoursConnected = Math.floor(sessionDuration / (1000 * 60 * 60));
          const baseContribution = Math.max(1, hoursConnected * 2); // Base contribution per hour
          const activityBonus = (profile.resets || 0) * 5; // Bonus for resets
          const taskBonus = (profile.tasksCompleted || 0) * 3; // Bonus for tasks
          const totalContribution =
            baseContribution + activityBonus + taskBonus;

          profileContribution.textContent = totalContribution;
        }
        if (profileUptime) {
          // Calculate actual uptime based on connection time
          const sessionDuration =
            Date.now() - (currentUser.connectionTime || Date.now());
          const hours = Math.floor(sessionDuration / (1000 * 60 * 60));
          const minutes = Math.floor(
            (sessionDuration % (1000 * 60 * 60)) / (1000 * 60)
          );
          profileUptime.textContent = `${hours}h ${minutes}m`;
        }
        if (profileRank) profileRank.textContent = currentUser.level || 1;
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
    // Sync with leaderboard data first
    gun
      .get("leaderboard")
      .get(currentUser.alias)
      .once((leaderboardData) => {
        if (leaderboardData && leaderboardData.points !== undefined) {
          console.log(
            "🔄 Syncing profile with leaderboard data:",
            leaderboardData
          );
          currentUser.points = leaderboardData.points;
          currentUser.level =
            leaderboardData.level || getLevelFromPoints(leaderboardData.points);

          // Update profile in GunDB to match leaderboard
          user.get("profile").once((profile) => {
            if (profile) {
              const updatedProfile = {
                ...profile,
                points: leaderboardData.points,
                level:
                  leaderboardData.level ||
                  getLevelFromPoints(leaderboardData.points),
              };
              user.get("profile").put(updatedProfile);
              console.log(
                "🔄 Profile updated to match leaderboard:",
                updatedProfile
              );
            }
          });
        }

        // Then update the UI
        updateProfile();
        if (window.updateUserProfile) {
          window.updateUserProfile();
        }
        addLog("Profile refreshed and synced with leaderboard", "info");
      });
  };

  // Refresh calibration handler
  document.getElementById("refreshCalibration").onclick = () => {
    // Force refresh of calibration data
    user.get("profile").once((profile) => {
      console.log("🔧 Refresh calibration - Profile data:", profile);
      if (profile) {
        // Update currentUser with profile calibration data
        currentUser.calibrationSessions = profile.calibrationSessions || 0;
        currentUser.totalCalibrationScore =
          profile.totalCalibrationScore || profile.calibrationScore || 0;
        currentUser.bestCalibrationScore = profile.bestCalibrationScore || 0;
        currentUser.lastCalibrationScore = profile.lastCalibrationScore || 0;

        console.log("🔧 Refresh calibration - Updated currentUser:", {
          calibrationSessions: currentUser.calibrationSessions,
          totalCalibrationScore: currentUser.totalCalibrationScore,
          bestCalibrationScore: currentUser.bestCalibrationScore,
          lastCalibrationScore: currentUser.lastCalibrationScore,
        });

        // Try multiple approaches to update the profile display
        // Approach 1: Direct DOM update
        const profileTotalCalibrationScore = document.getElementById(
          "profileTotalCalibrationScore"
        );
        const profileCalibrationSessions = document.getElementById(
          "profileCalibrationSessions"
        );
        const profileBestCalibrationScore = document.getElementById(
          "profileBestCalibrationScore"
        );

        console.log("🔧 Refresh calibration - DOM elements found:", {
          profileTotalCalibrationScore: !!profileTotalCalibrationScore,
          profileCalibrationSessions: !!profileCalibrationSessions,
          profileBestCalibrationScore: !!profileBestCalibrationScore,
        });

        if (profileTotalCalibrationScore) {
          profileTotalCalibrationScore.textContent =
            currentUser.totalCalibrationScore;
          console.log(
            "🔧 Updated profileTotalCalibrationScore to:",
            currentUser.totalCalibrationScore
          );
        }
        if (profileCalibrationSessions) {
          profileCalibrationSessions.textContent =
            currentUser.calibrationSessions;
          console.log(
            "🔧 Updated profileCalibrationSessions to:",
            currentUser.calibrationSessions
          );
        }
        if (profileBestCalibrationScore) {
          profileBestCalibrationScore.textContent =
            currentUser.bestCalibrationScore;
          console.log(
            "🔧 Updated profileBestCalibrationScore to:",
            currentUser.bestCalibrationScore
          );
        }

        // Approach 2: Force complete profile refresh
        if (window.updateProfile) {
          console.log("🔧 Calling window.updateProfile()");
          window.updateProfile();
        }

        // Approach 3: Force user profile update
        if (window.updateUserProfile) {
          console.log("🔧 Calling window.updateUserProfile()");
          window.updateUserProfile();
        }

        // Approach 4: Force calibration sync
        if (window.syncCalibrationFromProfile) {
          console.log("🔧 Calling window.syncCalibrationFromProfile()");
          window.syncCalibrationFromProfile();
        }

        // Approach 5: Force complete profile modal refresh
        setTimeout(() => {
          const profileModal = document.querySelector(".profile-modal");
          if (profileModal) {
            console.log("🔧 Force refreshing profile modal");
            profileModal.remove();
            showProfile();
          }
        }, 500);

        addLog("🔧 Calibration data refreshed", "info");
      } else {
        console.log("🔧 Refresh calibration - No profile data found");
        addLog("🔧 No profile data found for calibration refresh", "error");
      }
    });
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
  if (newStats) {
    stats = newStats;
  }
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
  const profileBtn = document.getElementById("profileBtn");
  const globalStatsBtn = document.getElementById("globalStatsBtn");
  const leaderboardBtn = document.getElementById("leaderboardBtn");
  const historyBtn = document.getElementById("historyBtn");
  const tasksBtn = document.getElementById("tasksBtn");
  const chatBtn = document.getElementById("chatBtn");
  const networkBtn = document.getElementById("networkBtn");
  const mapBtn = document.getElementById("mapBtn");
  const activeOperatorsBtn = document.getElementById("activeOperatorsBtn");
  const challengeEventsBtn = document.getElementById("challengeEventsBtn");
  const calibrationBtn = document.getElementById("calibrationBtn");

  if (profileBtn) profileBtn.onclick = showProfile;
  if (globalStatsBtn) globalStatsBtn.onclick = showGlobalStats;
  if (leaderboardBtn) leaderboardBtn.onclick = showLeaderboard;
  if (historyBtn) historyBtn.onclick = showHistory;
  if (tasksBtn) tasksBtn.onclick = showTaskSystem;
  if (chatBtn) chatBtn.onclick = showChat;
  if (networkBtn) networkBtn.onclick = showNetworkAnalytics;
  if (mapBtn) mapBtn.onclick = showOperatorsMap;
  if (activeOperatorsBtn) activeOperatorsBtn.onclick = showActiveOperators;
  if (challengeEventsBtn) challengeEventsBtn.onclick = showChallengeEvents;
  if (calibrationBtn) calibrationBtn.onclick = showCalibrationGame;

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
      activeOperatorsBtn: !!activeOperatorsBtn,
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
            
            <div class="chart-section">
                <h3>RESET & FAILURE HISTORY</h3>
                <div class="chart-container">
                    <canvas id="statsChart" width="600" height="300"></canvas>
                </div>
                <div class="chart-legend">
                    <div class="legend-item">
                        <span class="legend-color" style="background: #4CAF50;"></span>
                        <span>Resets</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background: #f44336;"></span>
                        <span>Failures</span>
                    </div>
                </div>
            </div>
            
            <div class="button" id="closeStats">CLOSE</div>
        </div>
    `;
  document.body.appendChild(overlay);

  // Create the chart
  createStatsChart();

  overlay.querySelector("#closeStats").onclick = () => overlay.remove();
}

function createStatsChart() {
  const canvas = document.getElementById("statsChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Get historical data from GunDB
  const resetHistory = stats.resetHistory || [];
  const failureHistory = stats.failureHistory || [];

  // Combine and sort all events by timestamp
  const allEvents = [
    ...resetHistory.map((event) => ({ ...event, type: "reset" })),
    ...failureHistory.map((event) => ({ ...event, type: "failure" })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  if (allEvents.length === 0) {
    // Show empty state
    ctx.fillStyle = "#666";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("No historical data available", width / 2, height / 2);
    return;
  }

  // Calculate time range
  const timeRange =
    allEvents[allEvents.length - 1].timestamp - allEvents[0].timestamp;
  const timeRangeHours = Math.max(1, timeRange / (1000 * 60 * 60)); // At least 1 hour

  // Draw grid
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;

  // Vertical grid lines (time)
  for (let i = 0; i <= 10; i++) {
    const x = (width * i) / 10;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height - 40);
    ctx.stroke();
  }

  // Horizontal grid lines (count)
  for (let i = 0; i <= 5; i++) {
    const y = ((height - 40) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw axes
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, height - 40);
  ctx.lineTo(width, height - 40);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, height - 40);
  ctx.stroke();

  // Draw axis labels
  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";

  // X-axis labels (time)
  for (let i = 0; i <= 10; i++) {
    const x = (width * i) / 10;
    const timeOffset = (timeRangeHours * i) / 10;
    const hoursAgo = Math.round(timeRangeHours - timeOffset);
    ctx.fillText(`${hoursAgo}h ago`, x, height - 10);
  }

  // Y-axis labels (count)
  ctx.textAlign = "right";
  const maxCount = Math.max(stats.resets || 0, stats.failures || 0, 1);
  for (let i = 0; i <= 5; i++) {
    const y = ((height - 40) * i) / 5;
    const count = Math.round((maxCount * (5 - i)) / 5);
    ctx.fillText(count.toString(), -5, y + 4);
  }

  // Draw reset line
  if (resetHistory.length > 0) {
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 3;
    ctx.beginPath();

    let resetCount = 0;
    for (let i = 0; i <= 10; i++) {
      const x = (width * i) / 10;
      const timeThreshold = allEvents[0].timestamp + (timeRange * i) / 10;

      const resetsInRange = resetHistory.filter(
        (event) => event.timestamp <= timeThreshold
      ).length;
      const y = height - 40 - ((height - 40) * resetsInRange) / maxCount;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  // Draw failure line
  if (failureHistory.length > 0) {
    ctx.strokeStyle = "#f44336";
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i <= 10; i++) {
      const x = (width * i) / 10;
      const timeThreshold = allEvents[0].timestamp + (timeRange * i) / 10;

      const failuresInRange = failureHistory.filter(
        (event) => event.timestamp <= timeThreshold
      ).length;
      const y = height - 40 - ((height - 40) * failuresInRange) / maxCount;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

function triggerSystemFailure() {
  addLog("CRITICAL: SYSTEM FAILURE DETECTED.", "error");

  // Start continuous SYSTEM FAILURE display
  startSystemFailureDisplay();

  statsRef.once((currentStats) => {
    if (currentStats) {
      const failureHistory = currentStats.failureHistory || [];
      failureHistory.push({
        timestamp: Date.now(),
      });

      // Keep only last 100 failures for performance
      if (failureHistory.length > 100) {
        failureHistory.splice(0, failureHistory.length - 100);
      }

      statsRef.put({
        failures: (currentStats.failures || 0) + 1,
        failureHistory: failureHistory,
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
  if (systemFailureActive) return;

  systemFailureActive = true;
  let failureDisplay = document.getElementById("systemFailureDisplay");
  if (!failureDisplay) {
    failureDisplay = document.createElement("div");
    failureDisplay.id = "systemFailureDisplay";
    failureDisplay.className = "system-failure-display";
    document.body.appendChild(failureDisplay);
  }

  systemFailureInterval = setInterval(() => {
    addLog("SYSTEM FAILURE", "error");
    failureDisplay.textContent = "SYSTEM FAILURE";
    failureDisplay.style.display = "block";
    failureDisplay.style.opacity =
      failureDisplay.style.opacity === "0.5" ? "1" : "0.5";
  }, 1000);
}

function stopSystemFailureDisplay() {
  if (systemFailureInterval) {
    clearInterval(systemFailureInterval);
    systemFailureInterval = null;
  }
  systemFailureActive = false;
  const failureDisplay = document.getElementById("systemFailureDisplay");
  if (failureDisplay) failureDisplay.style.display = "none";
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

// Show Active Operators Function
function showActiveOperators() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="active-operators-modal">
      <h2>&gt; ACTIVE OPERATORS</h2>
      
      <div class="operators-header">
        <div class="operators-info">
          <span id="activeOperatorsCount">Loading operators...</span>
        </div>
        <div class="operators-controls">
          <button id="refreshOperatorsBtn" class="terminal-button" style="font-size: 0.8em; padding: 5px 10px;">REFRESH</button>
          <button id="sortOperatorsBtn" class="terminal-button" style="font-size: 0.8em; padding: 5px 10px;">SORT BY STATUS</button>
        </div>
      </div>
      
      <div class="operators-container">
        <div class="operators-filters">
          <button class="filter-btn active" data-filter="all">ALL OPERATORS</button>
          <button class="filter-btn" data-filter="online">ONLINE ONLY</button>
          <button class="filter-btn" data-filter="offline">OFFLINE ONLY</button>
        </div>
        
        <div class="operators-list-container">
          <div id="activeOperatorsList" class="active-operators-list">
            Loading operators...
          </div>
        </div>
      </div>
      
      <div class="button" id="closeActiveOperators">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Initialize the operators list
  initializeActiveOperatorsList();

  // Add refresh button handler
  overlay.querySelector("#refreshOperatorsBtn").onclick = () => {
    initializeActiveOperatorsList();
    addLog("Active operators refreshed", "info");
  };

  // Set up periodic updates to ensure cooldown status is current
  const cooldownUpdateInterval = setInterval(() => {
    if (document.getElementById("activeOperatorsList")) {
      updateActiveOperatorsList(currentOperatorsData);
    } else {
      // Modal closed, stop the interval
      clearInterval(cooldownUpdateInterval);
    }
  }, 5000); // Update every 5 seconds

  // Add sort button handler
  overlay.querySelector("#sortOperatorsBtn").onclick = () => {
    toggleOperatorSort();
    addLog("Operator sort order changed", "info");
  };

  // Add filter handlers
  const filterBtns = overlay.querySelectorAll(".filter-btn");
  filterBtns.forEach((btn) => {
    btn.onclick = () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterOperators(btn.dataset.filter);
    };
  });

  overlay.querySelector("#closeActiveOperators").onclick = () =>
    overlay.remove();

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

      // Play task notification sound for forced task
      if (window.task && window.task.readyState >= 2) {
        window.task.volume = 0.4;
        window.task.currentTime = 0;
        window.task.play().catch((error) => {
          console.warn("Failed to play task notification sound:", error);
        });
      }

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

  // Play task notification sound
  if (window.task && window.task.readyState >= 2) {
    window.task.volume = 0.4;
    window.task.currentTime = 0;
    window.task.play().catch((error) => {
      console.warn("Failed to play task notification sound:", error);
    });
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
  const operatorCount = document.getElementById("mapOperatorCount");

  if (!mapContainer || !operatorCount) return;

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

            // Update map when we have processed all operators
            if (processedOperators >= totalOperators) {
              updateMapWithOperators(operators);
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

// Initialize Active Operators List
function initializeActiveOperatorsList() {
  const operatorsList = document.getElementById("activeOperatorsList");
  const operatorsCount = document.getElementById("activeOperatorsCount");

  if (!operatorsList || !operatorsCount) return;

  // Collect operators data
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

        // Get location from user profile
        gun
          .get("users")
          .get(data.pub)
          .get("profile")
          .once((userProfile) => {
            let location = "Unknown";

            if (userProfile && userProfile.location) {
              location = userProfile.location;
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

            // Update list when we have processed all operators
            if (processedOperators >= totalOperators) {
              currentOperatorsData = operators; // Store the data globally
              updateActiveOperatorsList(operators);
            }
          });
      }
    });
  }, 500);

  // Fallback: if no operators are found after 3 seconds, show empty state
  setTimeout(() => {
    if (operators.length === 0) {
      currentOperatorsData = []; // Store empty data
      updateActiveOperatorsList([]);
    }
  }, 3000);
}

// Update Active Operators List
function updateActiveOperatorsList(operators) {
  const operatorsList = document.getElementById("activeOperatorsList");
  if (!operatorsList) return;

  if (operators.length === 0) {
    operatorsList.innerHTML =
      '<div class="no-operators">No operators found</div>';
    return;
  }

  // Apply filter based on currentOperatorFilter
  let filteredOperators = operators;
  if (currentOperatorFilter === "online") {
    filteredOperators = operators.filter((operator) => operator.isOnline);
    console.log(
      `Filtered to online operators: ${filteredOperators.length}/${operators.length}`
    );
  } else if (currentOperatorFilter === "offline") {
    filteredOperators = operators.filter((operator) => !operator.isOnline);
    console.log(
      `Filtered to offline operators: ${filteredOperators.length}/${operators.length}`
    );
  } else {
    console.log(`Showing all operators: ${operators.length}`);
  }
  // "all" filter shows all operators

  if (filteredOperators.length === 0) {
    operatorsList.innerHTML =
      '<div class="no-operators">No operators match the current filter</div>';
    return;
  }

  // Sort operators based on current sort order
  let sortedOperators;
  if (operatorSortOrder === "name") {
    sortedOperators = filteredOperators.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  } else {
    // Default sort: online first, then by last seen
    sortedOperators = filteredOperators.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return b.lastSeen - a.lastSeen;
    });
  }

  const listHTML = sortedOperators
    .map((operator) => {
      const avatar = generateAvatar(operator.pub);
      const currentUserPub = user.is?.pub;
      const canChallenge = operator.pub !== currentUserPub; // Can challenge both online and offline operators
      const isOnCooldown = isOperatorOnCooldown(operator.pub);

      // Debug logging for cooldown status
      console.log(
        `🔍 Debug - Operator ${operator.name} (${operator.pub}): canChallenge=${canChallenge}, isOnCooldown=${isOnCooldown}, currentUserPub=${currentUserPub}`
      );
      if (isOnCooldown) {
        const cooldownEnd = operatorCooldowns.get(operator.pub);
        const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
        console.log(
          `🔍 Debug - Cooldown details: end=${new Date(
            cooldownEnd
          ).toLocaleString()}, remaining=${remaining}s`
        );
      }

      return `
    <div class="operator-list-item ${
      operator.isOnline ? "online" : "offline"
    }" data-operator-pub="${operator.pub}">
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
        <div class="operator-status">${
          operator.isOnline ? "ONLINE" : "OFFLINE"
        }</div>
      </div>
      <div class="operator-actions">
        ${
          canChallenge && !isOnCooldown && !challengeCooldownActive
            ? `
          <button class="challenge-btn point-steal" onclick="this.disabled=true; this.textContent='⚔️ STEALING...'; initiateChallenge('${
            operator.pub
          }', 'POINT_STEAL')" title="Steal points${
                !operator.isOnline ? " (EASY TARGET)" : ""
              }">
            ⚔️ STEAL${!operator.isOnline ? " (EASY)" : ""}
          </button>
          <button class="challenge-btn challenge" onclick="this.disabled=true; this.textContent='🏆 CHALLENGING...'; initiateChallenge('${
            operator.pub
          }', 'CHALLENGE')" title="Direct challenge${
                !operator.isOnline ? " (EASY TARGET)" : ""
              }">
            🏆 CHALLENGE${!operator.isOnline ? " (EASY)" : ""}
          </button>
        `
            : canChallenge && (isOnCooldown || challengeCooldownActive)
            ? `
          <span class="cooldown-text">⏳ COOLDOWN ${
            challengeCooldownActive
              ? "(GENERAL)"
              : `(${Math.ceil(
                  (operatorCooldowns.get(operator.pub) - Date.now()) / 1000
                )}s)`
          }</span>
        `
            : `
          <span class="self-text">YOU</span>
        `
        }
      </div>
    </div>
  `;
    })
    .join("");

  operatorsList.innerHTML = listHTML;

  // Debug: Show current state of operatorCooldowns Map
  console.log(
    "🔍 Debug - Current operatorCooldowns Map:",
    Array.from(operatorCooldowns.entries())
  );

  // Additional debug: Check if any operators should be on cooldown
  sortedOperators.forEach((operator) => {
    const cooldownEnd = operatorCooldowns.get(operator.pub);
    if (cooldownEnd) {
      const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
      console.log(
        `🔍 Debug - Operator ${operator.name} cooldown: end=${new Date(
          cooldownEnd
        ).toLocaleString()}, remaining=${remaining}s, valid=${remaining > 0}`
      );
    }
  });

  // Update the operators count to show filtered count
  const operatorsCount = document.getElementById("activeOperatorsCount");
  if (operatorsCount) {
    const totalCount = currentOperatorsData.length;
    const filteredCount = sortedOperators.length;
    if (currentOperatorFilter === "all") {
      operatorsCount.textContent = `${totalCount} OPERATORS FOUND`;
    } else {
      operatorsCount.textContent = `${filteredCount}/${totalCount} OPERATORS (${currentOperatorFilter.toUpperCase()})`;
    }
  }
}

// Global variables for operator filtering and sorting
let currentOperatorFilter = "all";
let operatorSortOrder = "status"; // "status" or "name"
let currentOperatorsData = []; // Store current operators data for filtering

// Challenge System
let activeChallenges = [];
let challengeHistory = [];
let challengeInvites = [];

// Cooldown system - now persistent in GunDB
let operatorCooldowns = new Map();

// Load cooldowns from GunDB on startup
function loadCooldownsFromGunDB() {
  if (!user || !user.is || !user.is.pub) return;

  console.log("🔄 Loading cooldowns from GunDB...");
  user.get("cooldowns").once((cooldowns) => {
    console.log("🔍 Debug - Raw cooldowns data from GunDB:", cooldowns);
    if (cooldowns) {
      const now = Date.now();
      Object.keys(cooldowns).forEach((operatorPub) => {
        const cooldownEnd = cooldowns[operatorPub];
        console.log(
          `🔍 Debug - Processing cooldown for ${operatorPub}: end=${cooldownEnd}, now=${now}, valid=${
            cooldownEnd > now
          }`
        );
        if (cooldownEnd > now) {
          operatorCooldowns.set(operatorPub, cooldownEnd);
          console.log(
            `⏳ Loaded cooldown for ${operatorPub}: ${new Date(
              cooldownEnd
            ).toLocaleString()}`
          );
        } else {
          console.log(
            `🔍 Debug - Skipping expired cooldown for ${operatorPub}`
          );
        }
      });
      console.log(
        `✅ Loaded ${operatorCooldowns.size} active cooldowns from GunDB`
      );
    } else {
      console.log("🔍 Debug - No cooldowns data found in GunDB");
    }
  });
}

// Save cooldowns to GunDB
function saveCooldownsToGunDB() {
  if (!user || !user.is || !user.is.pub) return;

  const cooldownsToSave = {};
  operatorCooldowns.forEach((endTime, operatorPub) => {
    cooldownsToSave[operatorPub] = endTime;
  });

  user.get("cooldowns").put(cooldownsToSave);
  console.log(
    `💾 Saved ${Object.keys(cooldownsToSave).length} cooldowns to GunDB`
  );
}

// ===== GAME RULES & BALANCING =====
// Updated rules to reflect all new features and mechanics
//
// NEW GAME MECHANICS:
// 1. Hash Brute-Force Mini-Game: Required before each challenge
// 2. Reputation System: Affects challenge success rates and costs
// 3. Enhanced Calibration: Station parameters affect challenge success
// 4. Improved Leveling: 30 levels with better progression
// 5. Cooldown System: General and per-operator cooldowns
// 6. Point System: Multiple ways to earn points with bonuses
//
// BALANCE CHANGES:
// - Reduced base success rates for more strategic gameplay
// - Added reputation costs to prevent spam
// - Calibration bonus encourages station maintenance
// - Hash game performance affects challenge success
// - Better point distribution across activities

// BALANCED GAME RULES - Updated for better gameplay experience
//
// BALANCE CHANGES SUMMARY:
// =======================
//
// CHALLENGE SYSTEM:
// - Increased success rates (55-65% vs 45-55%) for more rewarding gameplay
// - Reduced reputation costs (3-6 vs 5-10) for more accessible challenges
// - Reduced cooldowns (4-8 min vs 5-10 min) for more frequent activity
// - Increased point rewards (12-20 vs 8-15) for better risk/reward balance
//
// SUCCESS FACTORS:
// - Reduced level dominance (6% vs 8% per level) for fairer competition
// - Reduced random factor (12% vs 15%) for more predictable outcomes
// - Balanced bonuses for skill-based activities
//
// HASH GAME:
// - Reduced base difficulty (3 vs 4 chars) for accessibility
// - Increased attempts (120+20/level vs 100+15/level) for less frustration
// - Increased rewards (75-150 vs 50-100) for better compensation
// - Extended time bonus threshold (45s vs 30s) for achievable bonuses
//
// REPUTATION SYSTEM:
// - Increased starting reputation (150 vs 100) for better early game
// - Increased max reputation (1500 vs 1000) for longer progression
// - Reduced penalties (8 vs 15) for less punishing failures
// - Increased rewards (15 vs 10) for successful challenges
//
// COOLDOWNS:
// - Reduced general cooldown (3 min vs 5 min) for more activity
// - Reduced operator cooldown (2 min vs 3 min) for better targeting
// - Reduced hash game cooldown (45s vs 60s) for faster gameplay
//
// POINT SYSTEM:
// - Increased base points (2 vs 1) for better progression
// - Increased bonuses across all activities for more rewarding gameplay
// - Better balance between different point sources
//
// LEVELING:
// - More accessible early levels (0-90 vs 5-200) for better onboarding
// - Smoother progression curve throughout all levels
// - Reduced point requirements for faster advancement
//
// Challenge types with balanced mechanics
const challengeTypes = {
  POINT_STEAL: {
    name: "POINT STEAL",
    description:
      "Steal points from another operator (requires hash brute-force)",
    successRate: 0.65, // Increased to 65% for better success rate
    pointsAtRisk: 12, // Balanced risk/reward
    cooldown: 240000, // Reduced to 4 minutes for more activity
    hashGameRequired: true,
    reputationCost: 3, // Reduced cost for more accessible gameplay
  },

  CHALLENGE: {
    name: "CHALLENGE",
    description: "Direct challenge for points (requires hash brute-force)",
    successRate: 0.55, // Increased to 55% for better success rate
    pointsAtRisk: 20, // Higher risk, higher reward
    cooldown: 480000, // Reduced to 8 minutes
    hashGameRequired: true,
    reputationCost: 6, // Balanced cost
  },
};

// Balanced challenge success factors
const challengeSuccessFactors = {
  levelDifference: 0.06, // Reduced to 6% per level for less dominance
  onlineStatus: 0.08, // Reduced to 8% for more balanced targeting
  recentActivity: 0.06, // Reduced to 6% for fairer gameplay
  randomFactor: 0.12, // Reduced to 12% for more predictable outcomes
  calibrationBonus: 0.08, // Reduced to 8% for balanced station management
  reputationBonus: 0.03, // Reduced to 3% per 100 reputation for gradual progression
  hashGameBonus: 0.15, // Reduced to 15% for balanced skill reward
};

// Balanced hash brute-force game rules
const hashGameRules = {
  baseDifficulty: 3, // Reduced base difficulty for accessibility
  levelScaling: 0.3, // Reduced scaling for smoother progression
  minHiddenChars: 2, // Keep minimum
  maxHiddenChars: 6, // Reduced maximum for less frustration
  baseAttempts: 120, // Increased base attempts
  attemptsPerLevel: 20, // Increased attempts per level
  timeBonusThreshold: 45, // Increased time threshold for more achievable bonus
  difficultyBonus: 75, // Increased bonus for better rewards
  attemptsBonus: 75, // Increased bonus for skill
  timeBonus: 150, // Increased time bonus
};

// Balanced reputation system rules
const reputationRules = {
  startingReputation: 150, // Increased starting reputation
  maxReputation: 1500, // Increased maximum for longer progression
  challengeCost: 3, // Reduced cost for more accessible challenges
  successReward: 15, // Increased reward for successful challenges
  failurePenalty: 8, // Reduced penalty for less punishing failures
  dailyDecay: 3, // Reduced decay for less punishing inactivity
  calibrationBonus: 5, // Increased bonus for station management
};

// Balanced cooldown system rules
const cooldownRules = {
  generalCooldown: 180000, // Reduced to 3 minutes for more activity
  operatorCooldown: 120000, // Reduced to 2 minutes per operator
  hashGameCooldown: 45000, // Reduced to 45 seconds between hash games
  calibrationCooldown: 90000, // Reduced to 1.5 minutes between calibrations
};

// Balanced point earning rules
const pointRules = {
  baseResetPoints: 2, // Increased base points for better progression
  calibrationBonus: 5, // Increased bonus for station management
  firstResetBonus: 3, // Increased bonus for being first
  streakBonus: 2, // Increased streak bonus
  hashGamePoints: 150, // Increased hash game points
  challengePoints: 8, // Increased challenge points
  challengePenalty: 4, // Balanced penalty
};

// Filter operators
function filterOperators(filter) {
  currentOperatorFilter = filter;
  console.log(
    `Filtering operators: ${filter}, Total operators: ${currentOperatorsData.length}`
  );
  // Re-apply filter to existing data
  updateActiveOperatorsList(currentOperatorsData);
}

// Toggle operator sort order
function toggleOperatorSort() {
  operatorSortOrder = operatorSortOrder === "status" ? "name" : "status";
  const sortBtn = document.getElementById("sortOperatorsBtn");
  if (sortBtn) {
    sortBtn.textContent =
      operatorSortOrder === "status" ? "SORT BY NAME" : "SORT BY STATUS";
  }
  // Re-apply sort to existing data
  updateActiveOperatorsList(currentOperatorsData);
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
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
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

    // Calculate storage contribution based on actual user activity
    const sessionDuration =
      Date.now() - (currentUser.connectionTime || Date.now());
    const hoursConnected = Math.floor(sessionDuration / (1000 * 60 * 60));
    const baseContribution = Math.max(1, hoursConnected * 2); // Base contribution per hour
    const activityBonus = (currentUser.resets || 0) * 5; // Bonus for resets
    const taskBonus = (currentUser.tasksCompleted || 0) * 3; // Bonus for tasks
    const userContribution = baseContribution + activityBonus + taskBonus;
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

  // Monitor real-time metrics (using global chatMessageCount)
  if (chatRef) {
    // Use the global chatMessageCount instead of creating a separate listener
    // This prevents conflicts with the main chat listener
    const messagesElement = document.getElementById("messagesStored");
    if (messagesElement) {
      messagesElement.textContent = chatMessageCount;
    }
  }

  // Update message count display periodically
  safeSetInterval(() => {
    const messagesElement = document.getElementById("messagesStored");
    if (messagesElement) {
      messagesElement.textContent = chatMessageCount;
    }
  }, 5000); // Update every 5 seconds

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

  // Ensure current user's points are synced to leaderboard before reading
  if (currentUser && currentUser.alias) {
    gun.get("leaderboard").get(currentUser.alias).put({
      points: currentUser.points,
      level: currentUser.level,
    });
  }

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
                <button onclick="closeChat()">×</button>
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

// Function to properly close chat and reset state
function closeChat() {
  console.log("🔒 Closing chat and resetting state...");
  const overlay = document.querySelector(".overlay");
  if (overlay) {
    overlay.remove();
  }

  // Reset chat initialization flag to allow re-initialization
  chatInitialized = false;
  // Clear processed messages to allow reloading when reopening
  chatProcessedMessages.clear();
  console.log("✅ Chat state reset, ready for next initialization");
}

// Global chat state management
let chatInitialized = false;
let chatProcessedMessages = new Set();
let chatMessageCount = 0;

// Chat functionality - Simplified based on working GunDB example
function initializeChat() {
  console.log("🔧 Initializing chat system...");

  // Prevent multiple initializations
  if (chatInitialized) {
    console.log("⚠️ Chat already initialized, skipping...");
    return;
  }

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

    // Attempt to reinitialize chat reference
    if (gun && !chatRef) {
      chatRef = gun.get("chat");
      addLog("Attempting to reinitialize chat reference...", "info");
      // Retry initialization after a short delay
      setTimeout(() => {
        if (chatRef) {
          initializeChat();
        }
      }, 1000);
    }
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

  // Load existing messages first
  console.log("📚 Loading existing chat messages...");
  chatRef.map().once((msg, id) => {
    if (msg && msg.who && msg.what) {
      console.log("📨 Loading existing message:", { id, msg });
      displayMessage(msg, id);
      chatProcessedMessages.add(id);
      chatMessageCount++;
    }
  });

  // Simple function to add a message to the chat (based on working example)
  function displayMessage(msg, id) {
    console.log("📨 Displaying message:", { msg, id });

    if (!msg || !msg.who || !msg.what) {
      console.warn("⚠️ displayMessage: missing required fields", msg);
      return;
    }

    if (!chatMessages) {
      console.error("❌ displayMessage: chatMessages element not found");
      return;
    }

    // Check if message already exists
    const existingMessage = document.getElementById(`msg-${id}`);
    if (existingMessage) {
      console.log("⏭️ Message already displayed:", id);
      return;
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message";
    messageDiv.id = `msg-${id}`;

    const time = new Date(msg.when).toLocaleTimeString();
    messageDiv.innerHTML = `
      <span class="time">[${time}]</span> 
      <span class="author">${msg.who}:</span> 
      <span class="message">${msg.what}</span>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    console.log("✅ Message displayed successfully:", id);
  }

  // Listen for messages using the working GunDB pattern
  console.log("👂 Setting up chat listener using GunDB pattern...");
  chatRef.map().on((msg, id) => {
    console.log("📨 New chat message received:", { id, msg });

    if (!msg) {
      console.log("⏭️ Skipping null message");
      return;
    }

    // Skip if already processed
    if (chatProcessedMessages.has(id)) {
      console.log("⏭️ Skipping already processed message:", id);
      return;
    }

    chatProcessedMessages.add(id);
    chatMessageCount++;
    console.log("✅ Processing new message:", id);
    displayMessage(msg, id);
  });

  // Handle sending messages using the working GunDB pattern
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

      const messageText = chatInput.value.trim();
      chatInput.value = "";

      // Create message object using the working GunDB pattern
      const msg = {
        who: currentUser.alias || "Anonymous",
        what: messageText,
        when: Gun.state(), // Use Gun.state() for timestamp like the working example
      };

      console.log("📤 Sending message using GunDB pattern:", msg);

      // Send to GunDB using .set() like the working example
      chatRef.set(msg, (ack) => {
        if (ack.err) {
          console.error("❌ Failed to send message to GunDB:", ack.err);
          addLog("ERROR: Failed to send message", "error");
        } else {
          console.log("✅ Message sent successfully to GunDB");
          chatMessageCount++;
        }
      });

      // Focus back to input
      chatInput.focus();
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

  // Periodic operators list update
  setInterval(updateOperatorsList, 10000);

  // Mark as initialized
  chatInitialized = true;
  console.log("✅ Chat system initialized successfully");

  // Periodic message count update
  setInterval(() => {
    const messagesStored = document.getElementById("messagesStored");
    if (messagesStored) {
      messagesStored.textContent = chatMessageCount;
    }
  }, 5000);

  // Chat connection monitoring
  setInterval(() => {
    console.log("🔍 Testing chat connection...");
    chatRef.once((data) => {
      console.log("✅ Chat connection test completed");
    });
  }, 30000);
}

// Main system initializer - called after shogun-core initialization
function initializeSystem() {
  document.title = "AUTHENTICATING...";

  // Initialize timer module first
  if (window.timer && window.timer.initializeTimer) {
    window.timer.initializeTimer();
  } else {
    console.error("❌ Timer module not available for initialization");
  }

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
        stats = {
          ...stats,
          ...data,
          resetHistory: data.resetHistory || [],
          failureHistory: data.failureHistory || [],
        };
        updateStatsUI(stats); // Update global stats regardless of user
      }
    });
  }

  // Initialize timer immediately, regardless of auth status - now using timer module
  if (window.timer && window.timer.startTimer) {
    // Wait a bit for the timer module to be fully initialized
    setTimeout(() => {
      if (window.timer && window.timer.startTimer) {
        console.log("🚀 Starting timer from main script...");
        window.timer.startTimer();
      } else {
        console.error("❌ Timer module not available for timer start");
      }
    }, 2000);
  } else {
    console.error("❌ Timer module not available for timer start");
  }

  // Timer health monitoring - now using timer module
  if (window.timer && window.timer.checkTimerHealth) {
    // The timer module handles its own health monitoring
    console.log("✅ Timer health monitoring delegated to timer module");
  } else {
    console.error("❌ Timer module not available for health monitoring");
  }
}

// Station Rules Function
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
        <h3>MISSION OBJECTIVE</h3>
        <ul>
          <li>Prevent system failure by entering the correct sequence before timer reaches zero</li>
          <li>Maintain station stability through coordinated operator efforts</li>
          <li>Accumulate points and advance through operator levels</li>
          <li class="success">Contribute to the shogun-eco.xyz decentralized ecosystem</li>
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
          <li class="info">Power Level: Affects oxygen generation and cooling systems (Optimal: 80-100)</li>
          <li class="info">Oxygen Level: Critical for operator survival (Optimal: 85-100)</li>
          <li class="info">Temperature: Affects humidity and pressure systems (Optimal: 18-25°C)</li>
          <li class="info">Radiation Level: Damages power and oxygen systems (Optimal: ≤0.1)</li>
          <li class="info">Pressure: Affects oxygen distribution and humidity (Optimal: 980-1020)</li>
          <li class="info">Humidity: Influenced by temperature and pressure (Optimal: 40-60%)</li>
          <li class="success">Parameters are interconnected - changes affect multiple systems</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>TASK SYSTEM</h3>
        <ul>
          <li class="warning">Tasks appear randomly and must be completed</li>
          <li class="info">3 types: Maintenance (60%), Critical (30%), Emergency (10%)</li>
          <li class="warning">Tasks have execution time: 60-600 seconds based on task type and difficulty</li>
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
      
      <div class="rules-section">
        <h3>CHALLENGE & STEAL SYSTEM</h3>
        <ul>
          <li class="warning">Challenges require hash brute-force completion before execution</li>
          <li class="warning">Minimum 5 points and reputation required to initiate challenges</li>
          <li class="info">Two challenge types: <strong>POINT STEAL</strong> and <strong>CHALLENGE</strong></li>
          <li class="warning">Challenge cooldown: 4-8 minutes between challenges</li>
          <li class="warning">Operator cooldown: 2 minutes per target operator</li>
          <li class="success">Offline operators are easier targets (reduced success rate)</li>
          <li class="info">Station parameter balance affects challenge success rates</li>
          <li class="success">Higher reputation provides bonus to challenge success</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>CHALLENGE TYPES</h3>
        <ul>
          <li class="warning"><strong>POINT STEAL:</strong> Steal 12 points from target (65% success rate)</li>
          <li class="warning"><strong>CHALLENGE:</strong> Direct challenge for 20 points (55% success rate)</li>
          <li class="info">Reputation cost: 3 for Point Steal, 6 for Challenge</li>
          <li class="warning">Failed challenges result in reputation loss and cooldown</li>
          <li class="success">Successful challenges award 8 challenge points</li>
          <li class="error">Failed challenges penalize 4 points</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>HASH BRUTE-FORCE GAME</h3>
        <ul>
          <li class="warning">Required before each challenge execution</li>
          <li class="info">Guess hidden characters in a 32-character hash</li>
          <li class="warning">Hidden characters: 2-6 based on operator level</li>
          <li class="info">Max attempts: 120 + (20 × level) attempts</li>
          <li class="success">Fast completion provides challenge success bonus</li>
          <li class="success">Manual or automatic brute-force modes available</li>
          <li class="info">Hash game awards: 150 base + time/difficulty/attempts bonuses</li>
          <li class="warning">45-second cooldown between hash games</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>CHALLENGE SUCCESS FACTORS</h3>
        <ul>
          <li class="info">Level difference: ±6% per level advantage/disadvantage</li>
          <li class="info">Online status: +8% bonus for challenging online operators</li>
          <li class="info">Recent activity: +6% for active operators</li>
          <li class="info">Random factor: ±12% unpredictable variation</li>
          <li class="success">Calibration bonus: +8% for well-balanced station parameters</li>
          <li class="success">Reputation bonus: +3% per 100 reputation points</li>
          <li class="success">Hash game bonus: +15% for fast hash completion</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>REPUTATION SYSTEM</h3>
        <ul>
          <li class="info">Starting reputation: 150 points</li>
          <li class="info">Maximum reputation: 1500 points</li>
          <li class="success">Successful challenges: +15 reputation</li>
          <li class="error">Failed challenges: -8 reputation</li>
          <li class="warning">Daily decay: -3 reputation for inactivity</li>
          <li class="success">Calibration bonus: +5 reputation for station management</li>
          <li class="info">Higher reputation improves challenge success rates</li>
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
        <p><strong>Swan Station</strong> is an experimental decentralized application (dApp) developed by <strong>shogun-eco.xyz</strong>. It's a collaborative multiplayer game that simulates a critical system requiring constant operator attention. Inspired by the iconic Dharma Initiative station from Lost, players work together to prevent system failure by entering the correct sequence before the timer reaches zero.</p>
        <p class="success">This experiment demonstrates the potential of decentralized technology in creating engaging, real-time collaborative experiences without central control.</p>
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
        <p class="success"><strong>Swan Station is a flagship experiment of shogun-eco.xyz</strong>, designed to showcase the capabilities of decentralized technology in real-world applications.</p>
        <p class="success">
          <a href="https://shogun-eco.xyz" target="_blank" class="shogun-link">🌐 VISIT SHOGUN ECO ECOSYSTEM</a>
        </p>
        <ul>
          <li class="success">Part of the larger shogun-eco.xyz decentralized ecosystem</li>
          <li class="info">Demonstrates practical applications of decentralized technology</li>
          <li class="info">Showcases real-time collaborative applications without central control</li>
          <li class="info">Serves as a proof-of-concept for decentralized gaming</li>
          <li class="success">Contributes to the broader mission of Web3 decentralization</li>
          <li class="success">Validates the shogun-eco.xyz approach to building decentralized applications</li>
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
        <h3>JOIN THE EXPERIMENT</h3>
        <p>By participating in Swan Station, you're not just playing a game - you're contributing to a groundbreaking experiment in decentralized technology by <strong>shogun-eco.xyz</strong>. Every reset, every message, every connection helps strengthen the network and demonstrates the potential of peer-to-peer collaboration.</p>
        <p class="success">Welcome to the future of decentralized gaming and the shogun-eco.xyz ecosystem.</p>
      </div>
      
      <div class="rules-section">
        <h3>OPEN SOURCE & LINKS</h3>
        <p>This project is open source and available on GitHub. You can view the source code, contribute to development, or run your own instance of Swan Station.</p>
        <p class="success">
          <a href="https://github.com/scobru/the-swan-station" target="_blank" class="github-link">📁 VIEW ON GITHUB</a>
        </p>
        <p class="success">
          <a href="https://shogun-eco.xyz" target="_blank" class="shogun-link">🌐 VISIT SHOGUN ECO</a>
        </p>
        <p class="info">Explore the full shogun-eco.xyz ecosystem and discover more decentralized applications and experiments.</p>
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
    [siren, reset, tick, click1, click2, ...buttonSounds].forEach((audio) => {
      if (audio && typeof audio.pause === "function") {
        audio.pause();
      }
    });
  }
});

// Global click sound listener for all buttons
document.addEventListener("click", (event) => {
  // Check if the clicked element is a button or has a button-like role
  const target = event.target;
  const isButton =
    target.tagName === "BUTTON" ||
    target.classList.contains("button") ||
    target.classList.contains("task-btn") ||
    target.classList.contains("stats-button") ||
    target.classList.contains("terminal-button") ||
    target.getAttribute("role") === "button" ||
    target.onclick !== null ||
    target.onclick !== undefined;

  if (isButton) {
    playClickSound();
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  cleanup();
  console.log("🧹 Page unload cleanup completed");
});

// Make click sounds globally available for debugging
window.click1 = click1;
window.click2 = click2;
window.playClickSound = playClickSound;

// Start the application
initializeShogun();

// Timer health check function - now using timer module
function checkTimerHealth() {
  if (window.timer && window.timer.checkTimerHealth) {
    window.timer.checkTimerHealth();
  } else {
    console.error("❌ Timer module not available");
    addLog("ERROR: Timer module not initialized", "error");
  }
}

// Check timer health every 2 minutes
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

      // Sync to calibration bars if calibration game is not active
      // But avoid infinite loops by checking if values actually changed
      if (!calibrationGameActive && !window.isSyncing) {
        syncStationToCalibration();
      }
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

  // Start instability system
  startInstabilitySystem();
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

  // Track completion of GunDB operations
  let tasksProcessed = 0;
  let totalTasks = 0;
  let loadStartTime = Date.now();

  // Set a maximum timeout to prevent infinite waiting
  const maxLoadTime = 10000; // 10 seconds
  const loadTimeout = setTimeout(() => {
    console.warn(
      "⚠️ Task loading timeout reached, proceeding with available data"
    );
    completeTaskLoading();
  }, maxLoadTime);

  // Load tasks from GunDB with completion tracking
  const taskMap = taskRef.map();

  taskMap.once((task, id) => {
    if (task && typeof task === "object") {
      totalTasks++;
      console.log(`Processing task ${totalTasks}: ${task.name || "Unknown"}`);

      // Validate task data
      if (!task.name || !task.type || !task.expiresAt) {
        console.warn("Invalid task data loaded from GunDB:", task);
        tasksProcessed++;
        checkCompletion();
        return;
      }

      // Use actual creation time if available, otherwise estimate from expiresAt
      const taskCreationTime =
        task.createdAt || task.expiresAt - (task.timeLimit || 300000);
      const isRecentTask = taskCreationTime > connectionTime - 30000; // 30 second buffer
      const isAssignedToMe =
        currentUser && task.assignedTo === currentUser.alias;

      console.log(
        `Task ${task.name}: created=${new Date(
          taskCreationTime
        ).toLocaleTimeString()}, recent=${isRecentTask}, assignedToMe=${isAssignedToMe}, expired=${
          currentTime >= task.expiresAt
        }`
      );

      if (!task.completed && !task.failed) {
        // Load active tasks that haven't expired
        // IMPORTANT: Always load tasks assigned to current user, regardless of creation time
        // For unassigned tasks, only load recent ones to avoid stale data
        if (
          task.expiresAt &&
          currentTime < task.expiresAt &&
          (isAssignedToMe || isRecentTask)
        ) {
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
            `✅ Loaded active task: ${validTask.name} (assignedTo: ${
              validTask.assignedTo || "unassigned"
            }, created: ${new Date(validTask.createdAt).toLocaleTimeString()})`
          );
        } else if (task.expiresAt && currentTime >= task.expiresAt) {
          // Mark expired tasks as failed
          task.failed = true;
          taskRef.get(id).put(task);
          console.log(`❌ Marked expired task as failed: ${task.name}`);
        } else if (!isAssignedToMe && !isRecentTask) {
          console.log(
            `⏭️ Skipping old unassigned task: ${task.name} (created: ${new Date(
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

    tasksProcessed++;
    checkCompletion();
  });

  // Function to check if all tasks have been processed
  function checkCompletion() {
    console.log(`Progress: ${tasksProcessed} tasks processed`);

    // If we've processed all tasks or reached a reasonable timeout, complete
    if (tasksProcessed >= totalTasks || tasksProcessed > 0) {
      const elapsed = Date.now() - loadStartTime;
      console.log(
        `Task loading completed in ${elapsed}ms. Processed ${tasksProcessed} tasks.`
      );
      clearTimeout(loadTimeout);
      completeTaskLoading();
    }
  }

  // Function to complete the task loading process
  function completeTaskLoading() {
    console.log("Finalizing task loading...");

    // Remove any duplicates that might have been created
    removeDuplicateTasks();
    updateTaskDisplay();
    console.log(
      `📊 Final result: ${activeTasks.length} active tasks and ${taskHistory.length} historical tasks`
    );

    // Mark initial load as complete and clear timeouts
    window.initialTaskLoadComplete = true;
    if (window.appStartTimeout) {
      clearTimeout(window.appStartTimeout);
      window.appStartTimeout = null;
      console.log("✅ App initialization timeout cleared");
    }
    if (window.profileTimeout) {
      clearTimeout(window.profileTimeout);
      window.profileTimeout = null;
      console.log("✅ Profile timeout cleared");
    }
    if (window.profileListenerTimeout) {
      clearTimeout(window.profileListenerTimeout);
      window.profileListenerTimeout = null;
      console.log("✅ Profile listener timeout cleared");
    }
    console.log("✅ Initial task load complete - sync now active");
  }
}

function removeDuplicateTasks() {
  console.log("Checking for duplicate tasks...");
  console.log(`Starting with ${activeTasks.length} active tasks`);

  const seenIds = new Set();
  const uniqueTasks = [];
  let duplicatesRemoved = 0;
  let processedCount = 0;

  for (const task of activeTasks) {
    processedCount++;

    if (!task) {
      console.warn(
        `Skipping null/undefined task at index ${processedCount - 1}`
      );
      continue;
    }

    if (task.id && !seenIds.has(task.id)) {
      seenIds.add(task.id);
      uniqueTasks.push(task);
    } else {
      duplicatesRemoved++;
      console.warn(
        `Removed duplicate task: ${task.name || "Unknown"} (ID: ${
          task.id || "No ID"
        })`
      );
    }
  }

  if (duplicatesRemoved > 0) {
    activeTasks = uniqueTasks;
    console.log(
      `Removed ${duplicatesRemoved} duplicate tasks. Final count: ${activeTasks.length}`
    );
  } else {
    console.log("No duplicate tasks found");
  }

  console.log("Duplicate task check completed");
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

          // Play task notification sound for detected task
          if (window.task && window.task.readyState >= 2) {
            window.task.volume = 0.4;
            window.task.currentTime = 0;
            window.task.play().catch((error) => {
              console.warn("Failed to play task notification sound:", error);
            });
          }

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

          // Play task completion sound for task completed by another operator
          if (window.task && window.task.readyState >= 2) {
            window.task.volume = 0.4;
            window.task.currentTime = 0;
            window.task.play().catch((error) => {
              console.warn("Failed to play task completion sound:", error);
            });
          }

          // Show notification for task completion by others
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
  // Generate tasks every 5-10 minutes with instability system
  const generateTask = () => {
    // Check for instability events that increase task generation
    const instabilityLevel = getInstabilityLevel();
    let taskType = Math.random();

    // Instability increases emergency and critical task chances
    if (instabilityLevel > 0.7) {
      // High instability: 40% emergency, 40% critical, 20% maintenance
      if (taskType < 0.4) {
        taskType = Math.random() * 0.3; // Force emergency
      } else if (taskType < 0.8) {
        taskType = 0.3 + Math.random() * 0.3; // Force critical
      } else {
        taskType = 0.6 + Math.random() * 0.4; // Force maintenance
      }
    } else if (instabilityLevel > 0.4) {
      // Medium instability: 25% emergency, 45% critical, 30% maintenance
      if (taskType < 0.25) {
        taskType = Math.random() * 0.3; // Force emergency
      } else if (taskType < 0.7) {
        taskType = 0.3 + Math.random() * 0.3; // Force critical
      } else {
        taskType = 0.6 + Math.random() * 0.4; // Force maintenance
      }
    }

    let category, taskKey;

    if (taskType < 0.1) {
      // 10% chance for emergency task (base)
      category = "EMERGENCY";
      const emergencyTasks = Object.keys(taskTypes.EMERGENCY);
      taskKey =
        emergencyTasks[Math.floor(Math.random() * emergencyTasks.length)];
    } else if (taskType < 0.4) {
      // 30% chance for critical task (base)
      category = "CRITICAL";
      const criticalTasks = Object.keys(taskTypes.CRITICAL);
      taskKey = criticalTasks[Math.floor(Math.random() * criticalTasks.length)];
    } else {
      // 60% chance for maintenance task (base)
      category = "MAINTENANCE";
      const maintenanceTasks = Object.keys(taskTypes.MAINTENANCE);
      taskKey =
        maintenanceTasks[Math.floor(Math.random() * maintenanceTasks.length)];
    }

    const task = taskTypes[category][taskKey];

    // Validate task data
    if (!task || !task.name) {
      console.error("Invalid task data:", task);
      addLog("ERROR: Invalid task data generated", "error");
      return;
    }

    // Additional validation
    if (!task.difficulty || !task.timeLimit) {
      console.warn("Task missing required properties:", task);
      addLog("WARNING: Task missing required properties", "warning");
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

      // Play task notification sound for new task
      if (window.task && window.task.readyState >= 2) {
        window.task.volume = 0.4;
        window.task.currentTime = 0;
        window.task.play().catch((error) => {
          console.warn("Failed to play task notification sound:", error);
        });
      }
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

  // Generate tasks every 10-15 minutes with instability adjustments
  safeSetInterval(() => {
    const instabilityLevel = getInstabilityLevel();
    let maxTasks = 2; // Base max tasks

    // Instability increases max tasks
    if (instabilityLevel > 0.7) {
      maxTasks = 4; // High instability = more tasks
    } else if (instabilityLevel > 0.4) {
      maxTasks = 3; // Medium instability = more tasks
    }

    if (activeTasks.length < maxTasks) {
      generateTask();
    }
  }, Math.random() * 300000 + 600000); // 10-15 minutes
}

// Instability system
let instabilityLevel = 0.1; // Base instability (0-1)
let instabilityEvents = [];

function getInstabilityLevel() {
  return instabilityLevel;
}

function updateInstabilityLevel() {
  // Calculate instability based on station parameters
  let instability = 0.1; // Base instability

  // Add instability based on parameter deviations
  if (stationParameters) {
    // Power instability
    if (
      stationParameters.powerLevel < 30 ||
      stationParameters.powerLevel > 90
    ) {
      instability += 0.2;
    }

    // Oxygen instability
    if (
      stationParameters.oxygenLevel < 20 ||
      stationParameters.oxygenLevel > 90
    ) {
      instability += 0.2;
    }

    // Temperature instability
    if (
      stationParameters.temperature < 5 ||
      stationParameters.temperature > 35
    ) {
      instability += 0.15;
    }

    // Radiation instability
    if (stationParameters.radiationLevel > 0.3) {
      instability += 0.25;
    }

    // Pressure instability
    if (stationParameters.pressure < 950 || stationParameters.pressure > 1050) {
      instability += 0.15;
    }

    // Humidity instability
    if (stationParameters.humidity < 25 || stationParameters.humidity > 75) {
      instability += 0.1;
    }
  }

  // Add random instability events
  if (Math.random() < 0.1) {
    // 10% chance every update
    const randomInstability = Math.random() * 0.3;
    instability += randomInstability;

    // Add instability event
    instabilityEvents.push({
      timestamp: Date.now(),
      level: randomInstability,
      description: `Random instability spike: +${(
        randomInstability * 100
      ).toFixed(1)}%`,
    });

    // Keep only last 10 events
    if (instabilityEvents.length > 10) {
      instabilityEvents.shift();
    }
  }

  // Clamp between 0 and 1
  instabilityLevel = Math.max(0, Math.min(1, instability));

  // Save to GunDB (only basic instability level, not events array)
  if (stationParamsRef) {
    const cleanParams = {
      powerLevel: stationParameters.powerLevel,
      oxygenLevel: stationParameters.oxygenLevel,
      temperature: stationParameters.temperature,
      radiationLevel: stationParameters.radiationLevel,
      pressure: stationParameters.pressure,
      humidity: stationParameters.humidity,
      instabilityLevel: instabilityLevel,
      lastUpdate: Date.now(),
    };

    stationParamsRef.put(cleanParams);
  }

  return instabilityLevel;
}

// Start instability updates
function startInstabilitySystem() {
  // Update instability every 30 seconds
  safeSetInterval(() => {
    updateInstabilityLevel();
  }, 30000);
}

// Manual Calibration Game System
let calibrationBars = {
  power: { value: 50, target: 50, drift: 0.5, speed: 0.3 },
  oxygen: { value: 50, target: 50, drift: 0.3, speed: 0.4 },
  temperature: { value: 20, target: 20, drift: 0.2, speed: 0.5 },
  radiation: { value: 0.1, target: 0.1, drift: 0.05, speed: 0.6 },
  pressure: { value: 1000, target: 1000, drift: 2, speed: 0.4 },
  humidity: { value: 50, target: 50, drift: 0.4, speed: 0.3 },
};

let calibrationRanges = {
  power: { min: 40, max: 60 },
  oxygen: { min: 45, max: 55 },
  temperature: { min: 18, max: 22 },
  radiation: { min: 0.05, max: 0.15 },
  pressure: { min: 990, max: 1010 },
  humidity: { min: 45, max: 55 },
};

let calibrationGameActive = false;
let calibrationScore = 0;
let calibrationStartTime = 0;

// Challenge system variables
let challengeCooldownActive = false;
let challengeCooldownEndTime = 0;
let hashBruteForceGame = {
  active: false,
  targetHash: "",
  hiddenChars: 4,
  attempts: 0,
  maxAttempts: 100,
  startTime: 0,
  difficulty: 1,
};

// Load calibration data from GunDB
function loadCalibrationFromGunDB() {
  if (!user || !user.is || !user.is.pub) return;

  user.get("calibration").once((data) => {
    if (data) {
      calibrationBars = { ...calibrationBars, ...data.bars };
      calibrationRanges = { ...calibrationRanges, ...data.ranges };
      calibrationScore = data.score || 0;
      console.log("✅ Loaded calibration data from GunDB");
    }

    // Sync with current station parameters
    syncStationToCalibration();
  });
}

// Sync station parameters to calibration bars
function syncStationToCalibration() {
  if (!stationParameters || window.isSyncing || !calibrationBars) return;

  // Check if values actually changed to avoid unnecessary updates
  const newValues = {
    power: stationParameters.powerLevel || 50,
    oxygen: stationParameters.oxygenLevel || 50,
    temperature: stationParameters.temperature || 20,
    radiation: stationParameters.radiationLevel || 0.1,
    pressure: stationParameters.pressure || 1000,
    humidity: stationParameters.humidity || 50,
  };

  // Check if any values actually changed
  const hasChanged =
    Math.abs(calibrationBars.power.value - newValues.power) > 0.01 ||
    Math.abs(calibrationBars.oxygen.value - newValues.oxygen) > 0.01 ||
    Math.abs(calibrationBars.temperature.value - newValues.temperature) >
      0.01 ||
    Math.abs(calibrationBars.radiation.value - newValues.radiation) > 0.001 ||
    Math.abs(calibrationBars.pressure.value - newValues.pressure) > 0.1 ||
    Math.abs(calibrationBars.humidity.value - newValues.humidity) > 0.01;

  if (!hasChanged) return;

  // Map station parameters to calibration bars
  calibrationBars.power.value = newValues.power;
  calibrationBars.oxygen.value = newValues.oxygen;
  calibrationBars.temperature.value = newValues.temperature;
  calibrationBars.radiation.value = newValues.radiation;
  calibrationBars.pressure.value = newValues.pressure;
  calibrationBars.humidity.value = newValues.humidity;

  console.log("🔄 Synced station parameters to calibration bars");
}

// Sync calibration values to station parameters
function syncCalibrationToStation() {
  if (!stationParameters || window.isSyncing) return;

  // Check if values actually changed to avoid unnecessary updates
  const newValues = {
    powerLevel: calibrationBars.power.value,
    oxygenLevel: calibrationBars.oxygen.value,
    temperature: calibrationBars.temperature.value,
    radiationLevel: calibrationBars.radiation.value,
    pressure: calibrationBars.pressure.value,
    humidity: calibrationBars.humidity.value,
  };

  // Check if any values actually changed
  const hasChanged =
    Math.abs(stationParameters.powerLevel - newValues.powerLevel) > 0.01 ||
    Math.abs(stationParameters.oxygenLevel - newValues.oxygenLevel) > 0.01 ||
    Math.abs(stationParameters.temperature - newValues.temperature) > 0.01 ||
    Math.abs(stationParameters.radiationLevel - newValues.radiationLevel) >
      0.001 ||
    Math.abs(stationParameters.pressure - newValues.pressure) > 0.1 ||
    Math.abs(stationParameters.humidity - newValues.humidity) > 0.01;

  if (!hasChanged) return;

  // Prevent infinite loops
  window.isSyncing = true;

  // Map calibration bars to station parameters
  stationParameters.powerLevel = newValues.powerLevel;
  stationParameters.oxygenLevel = newValues.oxygenLevel;
  stationParameters.temperature = newValues.temperature;
  stationParameters.radiationLevel = newValues.radiationLevel;
  stationParameters.pressure = newValues.pressure;
  stationParameters.humidity = newValues.humidity;

  // Update station parameters in GunDB
  if (stationParamsRef) {
    // Clean the data to avoid GunDB errors
    const cleanStationParams = {
      powerLevel: stationParameters.powerLevel,
      oxygenLevel: stationParameters.oxygenLevel,
      temperature: stationParameters.temperature,
      radiationLevel: stationParameters.radiationLevel,
      pressure: stationParameters.pressure,
      humidity: stationParameters.humidity,
      lastUpdate: Date.now(),
    };

    // Only add instability data if it exists and is valid
    if (instabilityLevel !== undefined && !isNaN(instabilityLevel)) {
      cleanStationParams.instabilityLevel = instabilityLevel;
    }

    stationParamsRef.put(cleanStationParams);
  }

  // Update instability level based on new values
  updateInstabilityLevel();

  // Show sync feedback
  const syncStatus = document.getElementById("syncStatus");
  if (syncStatus) {
    syncStatus.textContent = "✅ Synced to Station";
    syncStatus.style.color = "#10B981";
    setTimeout(() => {
      syncStatus.textContent = "🔄 Synced with Station";
      syncStatus.style.color = "#10B981";
    }, 1000);
  }

  console.log("🔄 Synced calibration values to station parameters");

  // Allow syncing again after a short delay
  setTimeout(() => {
    window.isSyncing = false;
  }, 100);
}

// Save calibration data to GunDB
function saveCalibrationToGunDB() {
  if (!user || !user.is || !user.is.pub) return;

  user.get("calibration").put({
    bars: calibrationBars,
    ranges: calibrationRanges,
    score: calibrationScore,
    lastUpdate: Date.now(),
  });
}

// Update calibration bars with drift
function updateCalibrationBars() {
  if (!calibrationGameActive) return;

  Object.keys(calibrationBars).forEach((barKey) => {
    const bar = calibrationBars[barKey];

    // Apply drift
    bar.value += (Math.random() - 0.5) * bar.drift;

    // Apply target attraction (bars tend to drift toward target)
    const targetDiff = bar.target - bar.value;
    bar.value += targetDiff * bar.speed * 0.01;

    // Clamp values to reasonable ranges
    if (barKey === "power" || barKey === "oxygen" || barKey === "humidity") {
      bar.value = Math.max(0, Math.min(100, bar.value));
    } else if (barKey === "temperature") {
      bar.value = Math.max(-10, Math.min(50, bar.value));
    } else if (barKey === "radiation") {
      bar.value = Math.max(0, Math.min(1, bar.value));
    } else if (barKey === "pressure") {
      bar.value = Math.max(900, Math.min(1100, bar.value));
    }
  });

  // Sync calibration values to station parameters
  syncCalibrationToStation();

  // Update score based on how well bars are in range
  updateCalibrationScore();

  // Save to GunDB
  saveCalibrationToGunDB();
}

// Update calibration score
function updateCalibrationScore() {
  let inRangeCount = 0;
  const totalBars = Object.keys(calibrationBars).length;

  Object.keys(calibrationBars).forEach((barKey) => {
    const bar = calibrationBars[barKey];
    const range = calibrationRanges[barKey];

    if (bar.value >= range.min && bar.value <= range.max) {
      inRangeCount++;
    }
  });

  // Calculate score based on time and accuracy
  const timeBonus = Math.floor((Date.now() - calibrationStartTime) / 1000);
  calibrationScore = Math.max(calibrationScore, inRangeCount * 100 + timeBonus);
}

// Show calibration game interface
function showCalibrationGame() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="calibration-modal">
      <h2>&gt; MANUAL CALIBRATION SYSTEM</h2>
      
      <div class="calibration-info">
        <div class="score-display">
          <span>Score: <span id="calibrationScore">${calibrationScore}</span></span>
          <span>Time: <span id="calibrationTime">00:00</span></span>
        </div>
        <div class="instability-display">
          <span>Instability: <span id="instabilityLevel">${(
            instabilityLevel * 100
          ).toFixed(1)}%</span></span>
        </div>
        <div class="sync-status">
          <span id="syncStatus">🔄 Synced with Station</span>
        </div>
      </div>
      
      <div class="calibration-bars">
        <div class="calibration-bar" data-bar="power">
          <div class="bar-label">POWER</div>
          <div class="bar-container">
            <div class="bar-fill" id="powerBar"></div>
            <div class="bar-target" id="powerTarget"></div>
            <div class="bar-range" id="powerRange"></div>
          </div>
          <div class="bar-value" id="powerValue">50.0</div>
          <div class="bar-controls">
            <button onclick="adjustBar('power', -5)">-5</button>
            <button onclick="adjustBar('power', -1)">-1</button>
            <button onclick="adjustBar('power', 1)">+1</button>
            <button onclick="adjustBar('power', 5)">+5</button>
          </div>
        </div>
        
        <div class="calibration-bar" data-bar="oxygen">
          <div class="bar-label">OXYGEN</div>
          <div class="bar-container">
            <div class="bar-fill" id="oxygenBar"></div>
            <div class="bar-target" id="oxygenTarget"></div>
            <div class="bar-range" id="oxygenRange"></div>
          </div>
          <div class="bar-value" id="oxygenValue">50.0</div>
          <div class="bar-controls">
            <button onclick="adjustBar('oxygen', -5)">-5</button>
            <button onclick="adjustBar('oxygen', -1)">-1</button>
            <button onclick="adjustBar('oxygen', 1)">+1</button>
            <button onclick="adjustBar('oxygen', 5)">+5</button>
          </div>
        </div>
        
        <div class="calibration-bar" data-bar="temperature">
          <div class="bar-label">TEMPERATURE</div>
          <div class="bar-container">
            <div class="bar-fill" id="temperatureBar"></div>
            <div class="bar-target" id="temperatureTarget"></div>
            <div class="bar-range" id="temperatureRange"></div>
          </div>
          <div class="bar-value" id="temperatureValue">20.0</div>
          <div class="bar-controls">
            <button onclick="adjustBar('temperature', -2)">-2</button>
            <button onclick="adjustBar('temperature', -0.5)">-0.5</button>
            <button onclick="adjustBar('temperature', 0.5)">+0.5</button>
            <button onclick="adjustBar('temperature', 2)">+2</button>
          </div>
        </div>
        
        <div class="calibration-bar" data-bar="radiation">
          <div class="bar-label">RADIATION</div>
          <div class="bar-container">
            <div class="bar-fill" id="radiationBar"></div>
            <div class="bar-target" id="radiationTarget"></div>
            <div class="bar-range" id="radiationRange"></div>
          </div>
          <div class="bar-value" id="radiationValue">0.10</div>
          <div class="bar-controls">
            <button onclick="adjustBar('radiation', -0.02)">-0.02</button>
            <button onclick="adjustBar('radiation', -0.01)">-0.01</button>
            <button onclick="adjustBar('radiation', 0.01)">+0.01</button>
            <button onclick="adjustBar('radiation', 0.02)">+0.02</button>
          </div>
        </div>
        
        <div class="calibration-bar" data-bar="pressure">
          <div class="bar-label">PRESSURE</div>
          <div class="bar-container">
            <div class="bar-fill" id="pressureBar"></div>
            <div class="bar-target" id="pressureTarget"></div>
            <div class="bar-range" id="pressureRange"></div>
          </div>
          <div class="bar-value" id="pressureValue">1000</div>
          <div class="bar-controls">
            <button onclick="adjustBar('pressure', -10)">-10</button>
            <button onclick="adjustBar('pressure', -2)">-2</button>
            <button onclick="adjustBar('pressure', 2)">+2</button>
            <button onclick="adjustBar('pressure', 10)">+10</button>
          </div>
        </div>
        
        <div class="calibration-bar" data-bar="humidity">
          <div class="bar-label">HUMIDITY</div>
          <div class="bar-container">
            <div class="bar-fill" id="humidityBar"></div>
            <div class="bar-target" id="humidityTarget"></div>
            <div class="bar-range" id="humidityRange"></div>
          </div>
          <div class="bar-value" id="humidityValue">50.0</div>
          <div class="bar-controls">
            <button onclick="adjustBar('humidity', -5)">-5</button>
            <button onclick="adjustBar('humidity', -1)">-1</button>
            <button onclick="adjustBar('humidity', 1)">+1</button>
            <button onclick="adjustBar('humidity', 5)">+5</button>
          </div>
        </div>
      </div>
      
      <div class="calibration-controls">
        <button id="startCalibrationBtn" class="terminal-button">START CALIBRATION</button>
        <button id="resetCalibrationBtn" class="terminal-button">RESET</button>
        <button id="closeCalibrationBtn" class="terminal-button">CLOSE</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Initialize calibration display
  updateCalibrationDisplay();

  // Add button handlers
  const startBtn = overlay.querySelector("#startCalibrationBtn");
  const resetBtn = overlay.querySelector("#resetCalibrationBtn");
  const closeBtn = overlay.querySelector("#closeCalibrationBtn");

  startBtn.onclick = () => {
    if (!calibrationGameActive) {
      startCalibrationGame();
      startBtn.textContent = "STOP CALIBRATION";
      startBtn.classList.add("active");
    } else {
      stopCalibrationGame();
      startBtn.textContent = "START CALIBRATION";
      startBtn.classList.remove("active");
    }
  };

  resetBtn.onclick = () => {
    resetCalibrationGame();
  };

  closeBtn.onclick = () => {
    if (calibrationGameActive) {
      stopCalibrationGame();
    }
    overlay.remove();
  };

  // Start calibration updates
  const calibrationInterval = setInterval(() => {
    if (calibrationGameActive) {
      updateCalibrationBars();
      updateCalibrationDisplay();
    }
  }, 500); // Reduced from 100ms to 500ms to prevent excessive updates

  // Store interval for cleanup
  overlay.dataset.interval = calibrationInterval;

  // Cleanup on close
  overlay.addEventListener("remove", () => {
    clearInterval(calibrationInterval);
  });
}

// Adjust calibration bar value
function adjustBar(barKey, adjustment) {
  if (!calibrationGameActive) return;

  calibrationBars[barKey].value += adjustment;

  // Clamp values
  if (barKey === "power" || barKey === "oxygen" || barKey === "humidity") {
    calibrationBars[barKey].value = Math.max(
      0,
      Math.min(100, calibrationBars[barKey].value)
    );
  } else if (barKey === "temperature") {
    calibrationBars[barKey].value = Math.max(
      -10,
      Math.min(50, calibrationBars[barKey].value)
    );
  } else if (barKey === "radiation") {
    calibrationBars[barKey].value = Math.max(
      0,
      Math.min(1, calibrationBars[barKey].value)
    );
  } else if (barKey === "pressure") {
    calibrationBars[barKey].value = Math.max(
      900,
      Math.min(1100, calibrationBars[barKey].value)
    );
  }

  // Immediately sync to station parameters
  syncCalibrationToStation();

  updateCalibrationScore();
  saveCalibrationToGunDB();
}

// Start calibration game
function startCalibrationGame() {
  calibrationGameActive = true;
  calibrationStartTime = Date.now();

  // Sync current station parameters to calibration bars when starting
  syncStationToCalibration();

  addLog("🔧 Manual calibration system activated", "info");
}

// Calculate points to award based on calibration score
function calculateCalibrationPoints(score, profile = null) {
  // Base points: 1 point per 100 score
  let basePoints = Math.floor(score / 100);

  // Bonus points for high scores
  if (score >= 1000) basePoints += 5; // +5 bonus for 1000+ score
  if (score >= 500) basePoints += 2; // +2 bonus for 500+ score
  if (score >= 200) basePoints += 1; // +1 bonus for 200+ score

  // Bonus for consecutive sessions (if profile data available)
  if (profile && profile.lastCalibrationDate) {
    const timeSinceLastSession = Date.now() - profile.lastCalibrationDate;
    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Bonus for daily calibration (within 24 hours)
    if (timeSinceLastSession < oneDay) {
      basePoints += 1; // +1 bonus for daily calibration
    }
  }

  // Minimum 1 point for any calibration session
  return Math.max(1, basePoints);
}

// Stop calibration game
function stopCalibrationGame() {
  calibrationGameActive = false;

  // Calculate points to award based on calibration score
  const pointsToAward = calculateCalibrationPoints(calibrationScore, null);

  // Award points to the user
  if (pointsToAward > 0 && currentUser) {
    // Use unified points update function
    if (window.updateUserPoints) {
      window.updateUserPoints(pointsToAward, "calibration completion", {
        score: calibrationScore,
      });
    } else {
      // Fallback to old method
      const newPoints = currentUser.points + pointsToAward;
      const newLevel = getLevelFromPoints(newPoints);

      // Update user profile in GunDB
      user.get("profile").once((profile) => {
        const updatedProfile = {
          ...profile,
          points: newPoints,
          level: newLevel,
          calibrationSessions: (profile.calibrationSessions || 0) + 1,
          totalCalibrationScore:
            (profile.totalCalibrationScore || 0) + calibrationScore,
          lastCalibrationScore: calibrationScore,
          bestCalibrationScore: Math.max(
            profile.bestCalibrationScore || 0,
            calibrationScore
          ),
          lastCalibrationDate: Date.now(),
        };

        user.get("profile").put(updatedProfile);

        // Update leaderboard
        gun.get("leaderboard").get(currentUser.alias).put({
          points: newPoints,
          level: newLevel,
        });

        // Update local data
        currentUser.points = newPoints;
        currentUser.level = newLevel;
        currentUser.calibrationSessions = updatedProfile.calibrationSessions;
        currentUser.totalCalibrationScore =
          updatedProfile.totalCalibrationScore;
        currentUser.bestCalibrationScore = updatedProfile.bestCalibrationScore;
        currentUser.lastCalibrationScore = updatedProfile.lastCalibrationScore;

        // Force sync to leaderboard immediately
        if (window.syncPointsToLeaderboard) {
          window.syncPointsToLeaderboard();
        }

        console.log(
          "🔧 Calibration completion - Profile data saved:",
          updatedProfile
        );

        console.log("🔧 Calibration completion - currentUser updated:", {
          calibrationSessions: currentUser.calibrationSessions,
          totalCalibrationScore: currentUser.totalCalibrationScore,
          bestCalibrationScore: currentUser.bestCalibrationScore,
          lastCalibrationScore: currentUser.lastCalibrationScore,
        });

        console.log("🔧 Calibration completed - Updated currentUser:", {
          calibrationSessions: currentUser.calibrationSessions,
          totalCalibrationScore: currentUser.totalCalibrationScore,
          bestCalibrationScore: currentUser.bestCalibrationScore,
          lastCalibrationScore: currentUser.lastCalibrationScore,
        });

        // Update UI
        updateStatsUI();

        // Force profile UI update if profile modal is open
        if (window.updateUserProfile) {
          window.updateUserProfile();
        }

        // Force profile modal update if it's open
        const profileModal = document.querySelector(".profile-modal");
        if (profileModal) {
          // Trigger the profile update function to refresh the modal
          if (window.updateProfile) {
            console.log("🔧 Profile modal is open, calling updateProfile()");
            window.updateProfile();
          }
        }

        // Force calibration data sync to ensure consistency
        if (window.syncCalibrationFromProfile) {
          setTimeout(() => {
            console.log("🔧 Post-calibration sync initiated");
            // Set a flag to prevent profile listener from overwriting calibration data
            window.calibrationJustCompleted = true;
            window.syncCalibrationFromProfile();
            // Clear the flag after a delay
            setTimeout(() => {
              window.calibrationJustCompleted = false;
              console.log("🔧 Calibration completion flag cleared");
            }, 3000);
          }, 1000);
        }

        addLog(
          `🔧 Calibration session ended. Final score: ${calibrationScore} | +${pointsToAward} points awarded!`,
          "success"
        );

        // Debug: Log profile update
        console.log("🔧 Calibration completed, profile updated:", {
          calibrationSessions: updatedProfile.calibrationSessions,
          totalCalibrationScore: updatedProfile.totalCalibrationScore,
          bestCalibrationScore: updatedProfile.bestCalibrationScore,
          lastCalibrationScore: updatedProfile.lastCalibrationScore,
        });
      });
    }
  } else {
    addLog(
      `🔧 Calibration session ended. Final score: ${calibrationScore}`,
      "success"
    );
  }
}

// Reset calibration game
function resetCalibrationGame() {
  calibrationScore = 0;
  Object.keys(calibrationBars).forEach((barKey) => {
    calibrationBars[barKey].value = calibrationBars[barKey].target;
  });
  // Sync reset values to station parameters
  syncCalibrationToStation();

  saveCalibrationToGunDB();
  addLog("🔧 Calibration system reset", "info");
}

// Update calibration display
function updateCalibrationDisplay() {
  // Update score and time
  const scoreEl = document.getElementById("calibrationScore");
  const timeEl = document.getElementById("calibrationTime");
  const instabilityEl = document.getElementById("instabilityLevel");

  if (scoreEl) scoreEl.textContent = calibrationScore;
  if (instabilityEl)
    instabilityEl.textContent = `${(instabilityLevel * 100).toFixed(1)}%`;

  if (timeEl && calibrationGameActive) {
    const elapsed = Math.floor((Date.now() - calibrationStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timeEl.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  // Update each bar
  Object.keys(calibrationBars).forEach((barKey) => {
    const bar = calibrationBars[barKey];
    const range = calibrationRanges[barKey];

    // Update value display
    const valueEl = document.getElementById(`${barKey}Value`);
    if (valueEl) {
      if (barKey === "radiation") {
        valueEl.textContent = bar.value.toFixed(2);
      } else if (barKey === "temperature") {
        valueEl.textContent = bar.value.toFixed(1);
      } else if (barKey === "pressure") {
        valueEl.textContent = Math.round(bar.value);
      } else {
        valueEl.textContent = bar.value.toFixed(1);
      }
    }

    // Update bar fill
    const barEl = document.getElementById(`${barKey}Bar`);
    if (barEl) {
      let percentage;
      if (barKey === "power" || barKey === "oxygen" || barKey === "humidity") {
        percentage = bar.value;
      } else if (barKey === "temperature") {
        percentage = ((bar.value + 10) / 60) * 100;
      } else if (barKey === "radiation") {
        percentage = bar.value * 100;
      } else if (barKey === "pressure") {
        percentage = ((bar.value - 900) / 200) * 100;
      }

      barEl.style.width = `${Math.max(0, Math.min(100, percentage))}%`;

      // Color based on range
      if (bar.value >= range.min && bar.value <= range.max) {
        barEl.style.backgroundColor = "#10B981"; // Green
      } else if (
        Math.abs(bar.value - bar.target) <
        (range.max - range.min) * 0.5
      ) {
        barEl.style.backgroundColor = "#F59E0B"; // Yellow
      } else {
        barEl.style.backgroundColor = "#EF4444"; // Red
      }
    }

    // Update target indicator
    const targetEl = document.getElementById(`${barKey}Target`);
    if (targetEl) {
      let targetPercentage;
      if (barKey === "power" || barKey === "oxygen" || barKey === "humidity") {
        targetPercentage = bar.target;
      } else if (barKey === "temperature") {
        targetPercentage = ((bar.target + 10) / 60) * 100;
      } else if (barKey === "radiation") {
        targetPercentage = bar.target * 100;
      } else if (barKey === "pressure") {
        targetPercentage = ((bar.target - 900) / 200) * 100;
      }

      targetEl.style.left = `${Math.max(0, Math.min(100, targetPercentage))}%`;
    }

    // Update range indicator
    const rangeEl = document.getElementById(`${barKey}Range`);
    if (rangeEl) {
      let minPercentage, maxPercentage;
      if (barKey === "power" || barKey === "oxygen" || barKey === "humidity") {
        minPercentage = range.min;
        maxPercentage = range.max;
      } else if (barKey === "temperature") {
        minPercentage = ((range.min + 10) / 60) * 100;
        maxPercentage = ((range.max + 10) / 60) * 100;
      } else if (barKey === "radiation") {
        minPercentage = range.min * 100;
        maxPercentage = range.max * 100;
      } else if (barKey === "pressure") {
        minPercentage = ((range.min - 900) / 200) * 100;
        maxPercentage = ((range.max - 900) / 200) * 100;
      }

      rangeEl.style.left = `${Math.max(0, Math.min(100, minPercentage))}%`;
      rangeEl.style.width = `${Math.max(
        0,
        Math.min(100, maxPercentage - minPercentage)
      )}%`;
    }
  });
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

      // Play task notification sound for emergency task
      if (window.task && window.task.readyState >= 2) {
        window.task.volume = 0.4;
        window.task.currentTime = 0;
        window.task.play().catch((error) => {
          console.warn("Failed to play task notification sound:", error);
        });
      }

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
    // Show loading indicator if initial task load is not complete
    if (!window.initialTaskLoadComplete) {
      taskDisplay.innerHTML = `
        <div class="loading-tasks">
          <div class="loading-spinner">⏳</div>
          <div class="loading-text">Loading tasks from network...</div>
        </div>
      `;
      return;
    }

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

    // Play task completion sound
    if (window.task && window.task.readyState >= 2) {
      window.task.volume = 0.4;
      window.task.currentTime = 0;
      window.task.play().catch((error) => {
        console.warn("Failed to play task completion sound:", error);
      });
    }

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
  let successRate = 1 - task.difficulty * 0.1; // 90% for difficulty 1, 50% for difficulty 5
  successRate += (Math.random() - 0.5) * 0.2; // ±10% randomness

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
    gun
      .get("leaderboard")
      .get(currentUser.alias)
      .put({ points: newPoints, level: newLevel });
    addLog(`+${points} points for task completion!`, "success");

    // Update local user data immediately
    currentUser.points = newPoints;
    currentUser.level = newLevel;

    // Force sync to leaderboard immediately
    if (window.syncPointsToLeaderboard) {
      window.syncPointsToLeaderboard();
    }

    // Update UI immediately
    if (stats) updateStatsUI(stats);

    // Force profile UI update if profile modal is open
    if (window.updateUserProfile) {
      window.updateUserProfile();
    }
  });
}

function applyTaskEffects(task) {
  const effects = parameterEffects[task.name];
  if (effects?.success) {
    Object.keys(effects.success).forEach((param) => {
      stationParameters[param] += effects.success[param];
    });
    applyParameterInterdependencies();
    clampParameterValues();
    addLog(`Task "${task.name}" improved station parameters`, "success");
  }
  stationParamsRef.put({ ...stationParameters, lastUpdate: Date.now() });
}

function applyTaskFailureEffects(task) {
  const effects = parameterEffects[task.name];
  if (effects?.failure) {
    Object.keys(effects.failure).forEach((param) => {
      stationParameters[param] += effects.failure[param];
    });
    applyParameterInterdependencies();
    clampParameterValues();
    addLog(`Task "${task.name}" failure worsened station parameters`, "error");
  }
  stationParamsRef.put({ ...stationParameters, lastUpdate: Date.now() });
}

// Calculate bonus points based on station parameter balance
function calculateParameterBalanceBonus() {
  let bonusPoints = 0;
  let balancedParameters = 0;
  const totalParameters = 6;

  // Check each parameter for optimal balance
  if (
    stationParameters.powerLevel >= 80 &&
    stationParameters.powerLevel <= 100
  ) {
    bonusPoints += 1;
    balancedParameters++;
  }
  if (
    stationParameters.oxygenLevel >= 85 &&
    stationParameters.oxygenLevel <= 100
  ) {
    bonusPoints += 1;
    balancedParameters++;
  }
  if (
    stationParameters.temperature >= 18 &&
    stationParameters.temperature <= 25
  ) {
    bonusPoints += 1;
    balancedParameters++;
  }
  if (stationParameters.radiationLevel <= 0.1) {
    bonusPoints += 1;
    balancedParameters++;
  }
  if (stationParameters.pressure >= 980 && stationParameters.pressure <= 1020) {
    bonusPoints += 1;
    balancedParameters++;
  }
  if (stationParameters.humidity >= 40 && stationParameters.humidity <= 60) {
    bonusPoints += 1;
    balancedParameters++;
  }

  // Additional bonus for having all parameters balanced
  if (balancedParameters === totalParameters) {
    bonusPoints += 3;
    addLog("PERFECT BALANCE! All parameters optimal.", "success");
  } else if (balancedParameters >= 4) {
    bonusPoints += 1;
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
        const change = originalValues[param] * factor * 0.01;
        stationParameters[affectedParam] += change;
      });
    }
  });
}

// Clamp parameter values to realistic ranges
function clampParameterValues() {
  stationParameters.powerLevel = Math.max(
    0,
    Math.min(100, stationParameters.powerLevel)
  );
  stationParameters.oxygenLevel = Math.max(
    0,
    Math.min(100, stationParameters.oxygenLevel)
  );
  stationParameters.temperature = Math.max(
    -50,
    Math.min(100, stationParameters.temperature)
  );
  stationParameters.radiationLevel = Math.max(
    0,
    Math.min(1, stationParameters.radiationLevel)
  );
  stationParameters.pressure = Math.max(
    800,
    Math.min(1200, stationParameters.pressure)
  );
  stationParameters.humidity = Math.max(
    0,
    Math.min(100, stationParameters.humidity)
  );
}

function startParameterDisplayUpdates() {
  safeSetInterval(() => updateStationParametersDisplay(), 2000);
}

// Challenge System Functions
function initiateChallenge(targetPub, challengeType) {
  if (!currentUser) {
    addLog("ERROR: Must be logged in to initiate challenges", "error");
    return;
  }

  // Check if we have enough points
  if (currentUser.points < 5) {
    addLog("ERROR: Need at least 5 points to initiate a challenge", "error");
    return;
  }

  // Check if user has enough reputation
  const requiredReputation = challengeTypes[challengeType].reputationCost;
  const currentReputation =
    currentUser.reputation || reputationRules.startingReputation;

  if (currentReputation < requiredReputation) {
    addLog(
      `ERROR: Need at least ${requiredReputation} reputation to initiate a ${challengeType}`,
      "error"
    );
    return;
  }

  // Check challenge cooldown
  if (challengeCooldownActive) {
    const remaining = Math.ceil((challengeCooldownEndTime - Date.now()) / 1000);
    addLog(
      `ERROR: Challenge cooldown active. Wait ${remaining}s before next challenge.`,
      "error"
    );
    return;
  }

  // Check if hash game is already active
  if (hashBruteForceGame.active) {
    addLog(
      `ERROR: Hash brute-force game already in progress. Complete it first.`,
      "error"
    );
    showHashBruteForceGame();
    return;
  }

  // Check if there's already a pending challenge
  if (window.pendingChallenge) {
    addLog(
      `ERROR: Challenge already in progress. Complete the current challenge first.`,
      "error"
    );
    return;
  }

  // Check cooldown
  if (isOperatorOnCooldown(targetPub)) {
    addLog("ERROR: Target operator is on cooldown", "error");
    return;
  }

  // Get target operator info from multiple sources
  let targetOperator = currentOperatorsData.find((op) => op.pub === targetPub);

  // Check if target is offline and inform user
  if (targetOperator && !targetOperator.isOnline) {
    addLog(
      `INFO: Challenging offline operator ${targetOperator.name} - easier target!`,
      "info"
    );
  }

  console.log("🔍 Debug - targetPub:", targetPub);
  console.log("🔍 Debug - currentOperatorsData:", currentOperatorsData);
  console.log("🔍 Debug - found targetOperator:", targetOperator);

  // If not found in current data, try to get from GunDB
  if (!targetOperator) {
    console.log(
      "🔍 Debug - Target not found in currentOperatorsData, trying GunDB..."
    );
    // Try to get from operators reference first
    operatorsRef.get(targetPub).once((opData) => {
      console.log("🔍 Debug - operatorsRef data:", opData);
      if (opData && opData.name) {
        // Also try to get profile data for level
        gun
          .get("users")
          .get(targetPub)
          .get("profile")
          .once((profileData) => {
            console.log("🔍 Debug - profile data:", profileData);
            targetOperator = {
              pub: targetPub,
              name: opData.name,
              level: profileData?.level || opData.level || 1,
              isOnline:
                opData.lastSeen && Date.now() - opData.lastSeen < 120000,
              lastSeen: opData.lastSeen || Date.now(),
            };
            console.log(
              "🔍 Debug - created targetOperator from operatorsRef:",
              targetOperator
            );
            continueWithChallenge(targetOperator, challengeType);
          });
      } else {
        console.log(
          "🔍 Debug - No operatorsRef data, trying users collection..."
        );
        // Try to get from users collection as fallback
        gun
          .get("users")
          .get(targetPub)
          .once((userData) => {
            console.log("🔍 Debug - users collection data:", userData);
            if (userData && userData.alias) {
              targetOperator = {
                pub: targetPub,
                name: userData.alias,
                level: 1, // Default level
                isOnline: false, // Assume offline if we can't determine
                lastSeen: Date.now(),
              };
              console.log(
                "🔍 Debug - created targetOperator from users collection:",
                targetOperator
              );
              continueWithChallenge(targetOperator, challengeType);
            } else {
              console.log(
                "🔍 Debug - No user data found, creating fallback targetOperator"
              );
              // Create a fallback targetOperator with minimal data
              targetOperator = {
                pub: targetPub,
                name: "Unknown Target",
                level: 1,
                isOnline: false,
                lastSeen: Date.now(),
              };
              continueWithChallenge(targetOperator, challengeType);
            }
          });
      }
    });
    return;
  }

  continueWithChallenge(targetOperator, challengeType);
}

function continueWithChallenge(targetOperator, challengeType) {
  // Calculate success probability
  const successRate = calculateChallengeSuccess(targetOperator, challengeType);

  // Debug: Check what data we have before creating challenge
  console.log("🔍 Debug - currentUser:", currentUser);
  console.log("🔍 Debug - targetOperator:", targetOperator);
  console.log("🔍 Debug - user.is.pub:", user.is.pub);

  // Create challenge with proper data and explicit fallbacks
  const challenge = {
    id: crypto.randomUUID(),
    challenger: {
      pub: user.is.pub,
      alias: currentUser?.alias || "Unknown Challenger",
      level: currentUser?.level || 1,
    },
    target: {
      pub: targetOperator.pub,
      alias: targetOperator?.name || targetOperator?.alias || "Unknown Target",
      level: targetOperator?.level || 1,
    },
    type: challengeType,
    successRate: successRate,
    pointsAtRisk: challengeTypes[challengeType].pointsAtRisk,
    timestamp: Date.now(),
    status: "pending",
    result: null,
  };

  // Debug log to verify challenge data
  console.log("🎯 Challenge created:", {
    challenger: challenge.challenger,
    target: challenge.target,
    type: challenge.type,
  });

  // Save challenge for later execution
  window.pendingChallenge = challenge;

  // Start challenge cooldown and hash game instead of immediate execution
  startChallengeCooldown();
  generateHashBruteForceGame();

  addLog(
    `🔐 Challenge initiated! Complete the hash brute-force to proceed.`,
    "info"
  );
  showHashBruteForceGame();
}

function calculateChallengeSuccess(targetOperator, challengeType) {
  let baseRate = challengeTypes[challengeType].successRate;

  // Level difference factor (reduced impact)
  const levelDiff = currentUser.level - (targetOperator.level || 1);
  baseRate += levelDiff * challengeSuccessFactors.levelDifference;

  // Calibration bonus - check if station parameters are well balanced
  if (stationParameters) {
    const powerBalanced = Math.abs(stationParameters.powerLevel - 50) < 10;
    const oxygenBalanced = Math.abs(stationParameters.oxygenLevel - 50) < 10;
    const tempBalanced = Math.abs(stationParameters.temperature - 20) < 5;
    const radiationBalanced = stationParameters.radiationLevel < 0.5;
    const pressureBalanced = Math.abs(stationParameters.pressure - 1000) < 50;
    const humidityBalanced = Math.abs(stationParameters.humidity - 50) < 10;

    const balancedParams = [
      powerBalanced,
      oxygenBalanced,
      tempBalanced,
      radiationBalanced,
      pressureBalanced,
      humidityBalanced,
    ].filter(Boolean).length;

    if (balancedParams >= 4) {
      baseRate += challengeSuccessFactors.calibrationBonus;
    }
  }

  // Reputation bonus
  const userReputation =
    currentUser.reputation || reputationRules.startingReputation;
  const reputationBonus =
    Math.floor(userReputation / 100) * challengeSuccessFactors.reputationBonus;
  baseRate += Math.min(0.2, reputationBonus); // Max +20% from reputation

  // Hash game performance bonus
  if (
    hashBruteForceGame.completionTime &&
    hashBruteForceGame.completionTime < hashGameRules.timeBonusThreshold * 1000
  ) {
    baseRate += challengeSuccessFactors.hashGameBonus;
  }

  // Online status factor (reduced impact)
  if (targetOperator.isOnline) {
    baseRate += challengeSuccessFactors.onlineStatus;
  } else {
    baseRate -= challengeSuccessFactors.onlineStatus;
  }

  // Recent activity factor (reduced impact)
  const timeSinceLastSeen = Date.now() - targetOperator.lastSeen;
  if (timeSinceLastSeen < 60000) {
    baseRate += challengeSuccessFactors.recentActivity;
  }

  // Random factor (reduced impact)
  const randomFactor =
    (Math.random() - 0.5) * 2 * challengeSuccessFactors.randomFactor;
  baseRate += randomFactor;

  // Clamp between 0.05 and 0.95 (wider range for more dynamic gameplay)
  return Math.max(0.05, Math.min(0.95, baseRate));
}

function executeChallenge(challenge) {
  const success = Math.random() < challenge.successRate;
  challenge.result = success;
  challenge.status = "completed";

  if (success) {
    // Challenge successful - award points based on challenge type
    const pointsStolen = challenge.pointsAtRisk || pointRules.challengePoints;

    // Update challenger points and reputation
    user.get("profile").once((profile) => {
      const newPoints = (profile.points || 0) + pointsStolen;
      const newLevel = getLevelFromPoints(newPoints);
      const newReputation = Math.min(
        reputationRules.maxReputation,
        (profile.reputation || reputationRules.startingReputation) +
          reputationRules.successReward
      );

      const newProfile = {
        ...profile,
        points: newPoints,
        level: newLevel,
        reputation: newReputation,
        challengesWon: (profile.challengesWon || 0) + 1,
        totalPointsStolen: (profile.totalPointsStolen || 0) + pointsStolen,
      };
      user.get("profile").put(newProfile);

      // Update leaderboard
      gun.get("leaderboard").get(currentUser.alias).put({
        points: newPoints,
        level: newLevel,
        reputation: newReputation,
      });

      // Update local data
      currentUser.points = newPoints;
      currentUser.level = newLevel;
      currentUser.reputation = newReputation;

      // Force sync to leaderboard immediately
      if (window.syncPointsToLeaderboard) {
        window.syncPointsToLeaderboard();
      }

      addLog(
        `CHALLENGE SUCCESS! Stole ${pointsStolen} points from ${
          challenge.target?.alias || "Unknown"
        } (+${reputationRules.successReward} reputation)`,
        "success"
      );
    });

    // Try to steal points from target (they might be offline)
    gun
      .get("users")
      .get(challenge.target.pub)
      .get("profile")
      .once((targetProfile) => {
        if (targetProfile) {
          const newTargetPoints = Math.max(
            0,
            (targetProfile.points || 0) - pointsStolen
          );
          const newTargetLevel = getLevelFromPoints(newTargetPoints);
          const newTargetProfile = {
            ...targetProfile,
            points: newTargetPoints,
            level: newTargetLevel,
            challengesLost: (targetProfile.challengesLost || 0) + 1,
          };
          gun
            .get("users")
            .get(challenge.target.pub)
            .get("profile")
            .put(newTargetProfile);

          // Update target's leaderboard entry
          gun.get("leaderboard").get(challenge.target.alias).put({
            points: newTargetPoints,
            level: newTargetLevel,
          });
        }
      });
  } else {
    // Challenge failed - lose points and reputation
    const pointsLost = Math.floor(challenge.pointsAtRisk / 2);

    // Lose points and reputation for failed challenge
    user.get("profile").once((profile) => {
      const newPoints = Math.max(0, (profile.points || 0) - pointsLost);
      const newLevel = getLevelFromPoints(newPoints);
      const newReputation = Math.max(
        0,
        (profile.reputation || reputationRules.startingReputation) -
          reputationRules.failurePenalty
      );

      const newProfile = {
        ...profile,
        points: newPoints,
        level: newLevel,
        reputation: newReputation,
        challengesLost: (profile.challengesLost || 0) + 1,
        totalPointsLost: (profile.totalPointsLost || 0) + pointsLost,
      };
      user.get("profile").put(newProfile);

      // Update leaderboard
      gun.get("leaderboard").get(currentUser.alias).put({
        points: newPoints,
        level: newLevel,
        reputation: newReputation,
      });

      // Update local data
      currentUser.points = newPoints;
      currentUser.level = newLevel;
      currentUser.reputation = newReputation;

      // Force sync to leaderboard immediately
      if (window.syncPointsToLeaderboard) {
        window.syncPointsToLeaderboard();
      }

      addLog(
        `CHALLENGE FAILED! Lost ${pointsLost} points to ${
          challenge.target?.alias || "Unknown"
        } (-${reputationRules.failurePenalty} reputation)`,
        "error"
      );
    });
  }

  // Add to challenge history
  challengeHistory.push(challenge);

  // Store in GunDB
  gun.get("challenges").get(challenge.id).put(challenge);

  // Debug log to verify challenge was saved
  console.log("💾 Challenge saved to GunDB:", {
    id: challenge.id,
    challenger: challenge.challenger,
    target: challenge.target,
    result: challenge.result,
  });

  // Additional debug: Check what's actually stored
  setTimeout(() => {
    gun
      .get("challenges")
      .get(challenge.id)
      .once((storedChallenge) => {
        console.log("🔍 Debug - Stored challenge retrieved:", storedChallenge);
      });
  }, 1000);

  // Update UI
  if (stats) updateStatsUI(stats);

  // Show challenge result notification
  showChallengeResult(challenge);

  // Set cooldown
  setOperatorCooldown(
    challenge.target.pub,
    challengeTypes[challenge.type].cooldown
  );

  // Update the active operators list immediately to show cooldown
  updateActiveOperatorsList(currentOperatorsData);

  // Also update the list periodically to ensure cooldown status is current
  setTimeout(() => {
    updateActiveOperatorsList(currentOperatorsData);
  }, 1000);
}

function showChallengeResult(challenge) {
  const resultText = challenge.result ? "SUCCESS" : "FAILED";
  const resultClass = challenge.result ? "success" : "error";

  // Calculate points properly with safe fallbacks
  let pointsText = "0 points";
  if (challenge.result) {
    const pointsStolen = challenge.pointsAtRisk || pointRules.challengePoints;
    pointsText = `+${pointsStolen} points`;
  } else {
    const pointsLost = Math.floor(
      (challenge.pointsAtRisk || pointRules.challengePoints) / 2
    );
    pointsText = `-${pointsLost} points`;
  }

  // Get target name safely
  const targetName = challenge.target?.alias || "Unknown";

  addLog(
    `CHALLENGE ${resultText}: ${
      challenge.type || "CHALLENGE"
    } vs ${targetName} - ${pointsText}`,
    resultClass
  );

  // Create visual notification
  const notification = document.createElement("div");
  notification.className = `challenge-notification ${resultClass}`;
  notification.innerHTML = `
    <div class="notification-header">
      <strong>${challenge.type || "CHALLENGE"} CHALLENGE ${resultText}</strong>
    </div>
    <div class="notification-details">
      Target: ${targetName} | ${pointsText} | Success Rate: ${(
    (challenge.successRate || 0.5) * 100
  ).toFixed(1)}%
    </div>
  `;

  document.body.appendChild(notification);

  // Remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

function setOperatorCooldown(operatorPub, duration) {
  const cooldownEnd = Date.now() + duration;
  operatorCooldowns.set(operatorPub, cooldownEnd);
  console.log(
    `🔍 Debug - Set cooldown for ${operatorPub}: duration=${duration}ms, end=${new Date(
      cooldownEnd
    ).toLocaleString()}`
  );
  // Save to GunDB immediately
  saveCooldownsToGunDB();
}

function isOperatorOnCooldown(operatorPub) {
  const cooldownEnd = operatorCooldowns.get(operatorPub);
  console.log(
    `🔍 Debug - isOperatorOnCooldown(${operatorPub}): cooldownEnd=${cooldownEnd}, now=${Date.now()}`
  );

  if (!cooldownEnd) {
    console.log(`🔍 Debug - No cooldown found for ${operatorPub}`);
    return false;
  }

  if (Date.now() > cooldownEnd) {
    console.log(
      `🔍 Debug - Cooldown expired for ${operatorPub}, removing from map`
    );
    operatorCooldowns.delete(operatorPub);
    // Save to GunDB when cooldown expires
    saveCooldownsToGunDB();
    return false;
  }

  console.log(
    `🔍 Debug - Operator ${operatorPub} is on cooldown until ${new Date(
      cooldownEnd
    ).toLocaleString()}`
  );
  return true;
}

// Debug function to manually check and refresh cooldown status
function debugCooldownStatus() {
  console.log("🔍 Debug - Manual cooldown status check:");
  console.log("🔍 Debug - Current time:", new Date().toLocaleString());
  console.log("🔍 Debug - operatorCooldowns Map size:", operatorCooldowns.size);
  console.log(
    "🔍 Debug - operatorCooldowns entries:",
    Array.from(operatorCooldowns.entries())
  );

  // Check each operator in currentOperatorsData
  if (currentOperatorsData && currentOperatorsData.length > 0) {
    console.log("🔍 Debug - Checking cooldown status for all operators:");
    currentOperatorsData.forEach((operator) => {
      const isOnCooldown = isOperatorOnCooldown(operator.pub);
      console.log(
        `🔍 Debug - ${operator.name} (${operator.pub}): isOnCooldown=${isOnCooldown}`
      );
    });
  }

  // Force update the UI
  updateActiveOperatorsList(currentOperatorsData);
}

// Challenge Events Panel
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

  // Update operators list to ensure cooldown status is current
  updateActiveOperatorsList(currentOperatorsData);

  // Add tab handlers
  const tabBtns = overlay.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    if (btn) {
      // Check if button exists
      btn.onclick = () => {
        // Remove active class from all tab buttons
        tabBtns.forEach((b) => {
          if (b && b.classList) {
            b.classList.remove("active");
          }
        });

        // Add active class to clicked button
        if (btn && btn.classList) {
          btn.classList.add("active");
        }

        // Remove active class from all tab contents
        const tabContents = overlay.querySelectorAll(".tab-content");
        tabContents.forEach((content) => {
          if (content && content.classList) {
            content.classList.remove("active");
          }
        });

        // Add active class to target tab content
        const targetTab = btn.dataset.tab;
        if (targetTab) {
          const targetContent = overlay.querySelector(`#${targetTab}`);
          if (targetContent && targetContent.classList) {
            targetContent.classList.add("active");
          }

          // Update operators list when switching tabs to ensure cooldown status is current
          updateActiveOperatorsList(currentOperatorsData);
        }
      };
    }
  });

  // Add button handlers with safety checks
  const refreshBtn = overlay.querySelector("#refreshEventsBtn");
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      loadChallengeEvents();
      loadChallengeHistory();
      loadChallengeStats();
      updateActiveOperatorsList(currentOperatorsData); // Update operators list too
      addLog("Challenge events refreshed", "info");
    };
  }

  const clearBtn = overlay.querySelector("#clearHistoryBtn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm("Clear all challenge history? This cannot be undone.")) {
        challengeHistory = [];
        gun.get("challenges").map().put(null);
        loadChallengeHistory();
        addLog("Challenge history cleared", "warning");
      }
    };
  }

  const fixBtn = overlay.querySelector("#fixCorruptedBtn");
  if (fixBtn) {
    fixBtn.onclick = () => {
      fixCorruptedChallenges();
      addLog("Attempting to fix corrupted challenges...", "info");
    };
  }

  const closeBtn = overlay.querySelector("#closeChallengeEvents");
  if (closeBtn) {
    closeBtn.onclick = () => overlay.remove();
  }
}

function loadChallengeEvents() {
  const eventsList = document.getElementById("recentEventsList");
  if (!eventsList) return;

  // Load recent challenges from GunDB
  const recentChallenges = [];
  gun
    .get("challenges")
    .map()
    .once((challenge, id) => {
      console.log("🔍 Debug - Retrieved challenge from GunDB:", {
        id,
        challenge,
      });

      // Ensure challenge has proper structure
      if (challenge && typeof challenge === "object") {
        // Check if challenger and target are GunDB references that need to be resolved
        const resolveChallenger = (callback) => {
          if (challenge.challenger && challenge.challenger["#"]) {
            // This is a GunDB reference, resolve it
            gun
              .get("challenges")
              .get(id)
              .get("challenger")
              .once((challengerData) => {
                callback(
                  challengerData || {
                    alias: "Unknown",
                    pub: "unknown",
                    level: 1,
                  }
                );
              });
          } else {
            // This is already resolved data
            callback(
              challenge.challenger || {
                alias: "Unknown",
                pub: "unknown",
                level: 1,
              }
            );
          }
        };

        const resolveTarget = (callback) => {
          if (challenge.target && challenge.target["#"]) {
            // This is a GunDB reference, resolve it
            gun
              .get("challenges")
              .get(id)
              .get("target")
              .once((targetData) => {
                callback(
                  targetData || { alias: "Unknown", pub: "unknown", level: 1 }
                );
              });
          } else {
            // This is already resolved data
            callback(
              challenge.target || { alias: "Unknown", pub: "unknown", level: 1 }
            );
          }
        };

        // Resolve both challenger and target, then create the safe challenge
        resolveChallenger((challengerData) => {
          resolveTarget((targetData) => {
            const safeChallenge = {
              id: challenge.id || id,
              challenger: {
                pub: challengerData.pub || "unknown",
                alias: challengerData.alias || "Unknown",
                level: challengerData.level || 1,
              },
              target: {
                pub: targetData.pub || "unknown",
                alias: targetData.alias || "Unknown",
                level: targetData.level || 1,
              },
              type: challenge.type || "CHALLENGE",
              successRate: challenge.successRate || 0.5,
              pointsAtRisk: challenge.pointsAtRisk || 5,
              timestamp: challenge.timestamp || Date.now(),
              status: challenge.status || "completed",
              result: challenge.result || false,
            };

            console.log("🔍 Debug - Safe challenge object:", safeChallenge);

            if (safeChallenge.status === "completed") {
              const timeDiff = Date.now() - safeChallenge.timestamp;
              if (timeDiff < 3600000) {
                // Last hour
                recentChallenges.push(safeChallenge);
                console.log(
                  "🔍 Debug - Added to recentChallenges:",
                  safeChallenge
                );
              }
            }
          });
        });
      }
    });

  // Clean up corrupted challenges
  gun
    .get("challenges")
    .map()
    .once((challenge, id) => {
      if (
        challenge &&
        (challenge.challenger?.alias === "undefined" ||
          challenge.target?.alias === "undefined")
      ) {
        console.log("🧹 Cleaning up corrupted challenge:", id);
        gun.get("challenges").get(id).put(null);
      }
    });

  setTimeout(() => {
    if (recentChallenges.length === 0) {
      eventsList.innerHTML =
        '<div class="no-events">No recent challenge events</div>';
      return;
    }

    // Sort by timestamp, newest first
    recentChallenges.sort((a, b) => b.timestamp - a.timestamp);

    // Try to fix corrupted challenge data
    const fixedChallenges = recentChallenges.map((challenge) => {
      // If challenge has undefined aliases, try to fix them
      if (
        challenge.challenger?.alias === "undefined" ||
        challenge.target?.alias === "undefined"
      ) {
        console.log("🔧 Attempting to fix corrupted challenge:", challenge.id);

        // Try to get operator names from pub keys
        if (challenge.challenger?.pub) {
          gun
            .get("users")
            .get(challenge.challenger.pub)
            .once((userData) => {
              if (userData && userData.alias) {
                challenge.challenger.alias = userData.alias;
                // Update the challenge in GunDB
                gun.get("challenges").get(challenge.id).put(challenge);
              }
            });
        }

        if (challenge.target?.pub) {
          gun
            .get("users")
            .get(challenge.target.pub)
            .once((userData) => {
              if (userData && userData.alias) {
                challenge.target.alias = userData.alias;
                // Update the challenge in GunDB
                gun.get("challenges").get(challenge.id).put(challenge);
              }
            });
        }
      }

      return challenge;
    });

    console.log(
      "🔍 Debug - fixedChallenges before rendering:",
      fixedChallenges
    );

    const eventsHTML = fixedChallenges
      .slice(0, 10)
      .map((challenge) => {
        console.log("🔍 Debug - Rendering challenge:", challenge);
        const time = new Date(challenge.timestamp).toLocaleTimeString();
        const resultClass = challenge.result ? "success" : "failed";
        const resultText = challenge.result ? "SUCCESS" : "FAILED";
        // Calculate points properly with safe fallbacks
        let pointsText = "0";
        if (challenge.result) {
          const pointsStolen = Math.min(
            challenge.pointsAtRisk || 5,
            (challenge.target?.level || 1) * 2
          );
          pointsText = `+${pointsStolen}`;
        } else {
          const pointsLost = Math.floor((challenge.pointsAtRisk || 5) / 2);
          pointsText = `-${pointsLost}`;
        }

        // Get operator names safely
        const challengerName = challenge.challenger?.alias || "Unknown";
        const targetName = challenge.target?.alias || "Unknown";

        console.log("🔍 Debug - Names for rendering:", {
          challengerName,
          targetName,
        });

        return `
        <div class="event-item ${resultClass}">
          <div class="event-time">${time}</div>
          <div class="event-details">
            <div class="event-challengers">
              <span class="challenger">${challengerName}</span>
              <span class="vs">⚔️</span>
              <span class="target">${targetName}</span>
            </div>
            <div class="event-type">${challenge.type || "CHALLENGE"}</div>
            <div class="event-result">${resultText} (${pointsText} points)</div>
          </div>
        </div>
      `;
      })
      .join("");

    eventsList.innerHTML = eventsHTML;
  }, 1000);
}

function loadChallengeHistory() {
  const historyList = document.getElementById("challengeHistoryList");
  if (!historyList) return;

  // Load all challenges from GunDB
  const allChallenges = [];
  gun
    .get("challenges")
    .map()
    .once((challenge, id) => {
      if (challenge && challenge.status === "completed") {
        allChallenges.push(challenge);
      }
    });

  setTimeout(() => {
    if (allChallenges.length === 0) {
      historyList.innerHTML =
        '<div class="no-events">No challenge history found</div>';
      return;
    }

    // Sort by timestamp, newest first
    allChallenges.sort((a, b) => b.timestamp - a.timestamp);

    const historyHTML = allChallenges
      .slice(0, 20)
      .map((challenge) => {
        const date = new Date(challenge.timestamp).toLocaleString();
        const resultClass = challenge.result ? "success" : "failed";
        const resultText = challenge.result ? "SUCCESS" : "FAILED";
        // Calculate points properly with safe fallbacks
        let pointsText = "0";
        if (challenge.result) {
          const pointsStolen = Math.min(
            challenge.pointsAtRisk || 5,
            (challenge.target?.level || 1) * 2
          );
          pointsText = `+${pointsStolen}`;
        } else {
          const pointsLost = Math.floor((challenge.pointsAtRisk || 5) / 2);
          pointsText = `-${pointsLost}`;
        }

        // Get operator names safely
        const challengerName = challenge.challenger?.alias || "Unknown";
        const targetName = challenge.target?.alias || "Unknown";

        return `
        <div class="event-item ${resultClass}">
          <div class="event-time">${date}</div>
          <div class="event-details">
            <div class="event-challengers">
              <span class="challenger">${challengerName}</span>
              <span class="vs">⚔️</span>
              <span class="target">${targetName}</span>
            </div>
            <div class="event-type">${challenge.type || "CHALLENGE"}</div>
            <div class="event-result">${resultText} (${pointsText} points)</div>
          </div>
        </div>
      `;
      })
      .join("");

    historyList.innerHTML = historyHTML;
  }, 1000);
}

function loadChallengeStats() {
  const statsGrid = document.getElementById("challengeStatsGrid");
  if (!statsGrid) return;

  // Calculate stats from challenge history
  user.get("profile").once((profile) => {
    const challengesWon = profile.challengesWon || 0;
    const challengesLost = profile.challengesLost || 0;
    const totalChallenges = challengesWon + challengesLost;
    const winRate =
      totalChallenges > 0
        ? ((challengesWon / totalChallenges) * 100).toFixed(1)
        : 0;

    statsGrid.innerHTML = `
      <div class="stat-item">
        <div class="stat-label">TOTAL CHALLENGES</div>
        <div class="stat-value">${totalChallenges}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">CHALLENGES WON</div>
        <div class="stat-value success">${challengesWon}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">CHALLENGES LOST</div>
        <div class="stat-value error">${challengesLost}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">WIN RATE</div>
        <div class="stat-value">${winRate}%</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">FAVORITE TARGET</div>
        <div class="stat-value" id="favoriteTarget">Calculating...</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">MOST CHALLENGED BY</div>
        <div class="stat-value" id="mostChallengedBy">Calculating...</div>
      </div>
    `;

    // Calculate favorite target and most challenged by
    calculateAdvancedStats();
  });
}

function calculateAdvancedStats() {
  // This would analyze challenge history to find patterns
  // For now, we'll show placeholder data
  const favoriteTarget = document.getElementById("favoriteTarget");
  const mostChallengedBy = document.getElementById("mostChallengedBy");

  if (favoriteTarget) favoriteTarget.textContent = "None yet";
  if (mostChallengedBy) mostChallengedBy.textContent = "None yet";
}

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function fixCorruptedChallenges() {
  console.log("🔧 Starting corrupted challenge fix...");

  gun
    .get("challenges")
    .map()
    .once((challenge, id) => {
      if (challenge && challenge.status === "completed") {
        let needsUpdate = false;

        // Check if challenger alias is corrupted
        if (
          challenge.challenger?.alias === "undefined" ||
          !challenge.challenger?.alias
        ) {
          console.log("🔧 Fixing challenger alias for challenge:", id);
          if (challenge.challenger?.pub) {
            gun
              .get("users")
              .get(challenge.challenger.pub)
              .once((userData) => {
                if (userData && userData.alias) {
                  challenge.challenger.alias = userData.alias;
                  needsUpdate = true;
                  gun.get("challenges").get(id).put(challenge);
                  console.log("✅ Fixed challenger alias:", userData.alias);
                }
              });
          }
        }

        // Check if target alias is corrupted
        if (
          challenge.target?.alias === "undefined" ||
          !challenge.target?.alias
        ) {
          console.log("🔧 Fixing target alias for challenge:", id);
          if (challenge.target?.pub) {
            gun
              .get("users")
              .get(challenge.target.pub)
              .once((userData) => {
                if (userData && userData.alias) {
                  challenge.target.alias = userData.alias;
                  needsUpdate = true;
                  gun.get("challenges").get(id).put(challenge);
                  console.log("✅ Fixed target alias:", userData.alias);
                }
              });
          }
        }

        if (needsUpdate) {
          addLog(`Fixed corrupted challenge: ${id}`, "success");
        }
      }
    });

  // Reload the display after a short delay
  setTimeout(() => {
    loadChallengeEvents();
    loadChallengeHistory();
  }, 2000);
}

// Hash Brute-Force Mini-Game Functions
function generateHashBruteForceGame() {
  const targetHash = generateRandomHash();

  // Calculate hidden characters based on new rules
  const hiddenChars = Math.max(
    hashGameRules.minHiddenChars,
    Math.min(
      hashGameRules.maxHiddenChars,
      hashGameRules.baseDifficulty -
        (currentUser.level - 1) * hashGameRules.levelScaling
    )
  );

  // Calculate max attempts based on new rules
  const maxAttempts =
    hashGameRules.baseAttempts +
    (currentUser.level - 1) * hashGameRules.attemptsPerLevel;

  hashBruteForceGame = {
    active: true,
    targetHash: targetHash,
    hiddenChars: hiddenChars,
    attempts: 0,
    maxAttempts: maxAttempts,
    startTime: Date.now(),
    difficulty: currentUser.level,
    completionTime: null, // Track completion time for bonus calculation
  };

  console.log(
    `🔐 Hash game started - Level ${currentUser.level}, ${hiddenChars} hidden chars, ${maxAttempts} max attempts`
  );
  return hashBruteForceGame;
}

function generateRandomHash() {
  const chars = "0123456789abcdef";
  let hash = "";
  for (let i = 0; i < 32; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return hash;
}

function attemptHashBruteForce(guess) {
  if (!hashBruteForceGame.active) return false;

  hashBruteForceGame.attempts++;

  // Check if guess matches the hidden part
  const visiblePart = hashBruteForceGame.targetHash.slice(
    0,
    -hashBruteForceGame.hiddenChars
  );
  const hiddenPart = hashBruteForceGame.targetHash.slice(
    -hashBruteForceGame.hiddenChars
  );

  if (guess === hiddenPart) {
    // Success! Calculate points using new rules
    const completionTime = Date.now() - hashBruteForceGame.startTime;
    hashBruteForceGame.completionTime = completionTime;

    const timeBonus = Math.max(
      0,
      hashGameRules.timeBonus - Math.floor(completionTime / 1000)
    );
    const difficultyBonus =
      hashBruteForceGame.hiddenChars * hashGameRules.difficultyBonus;
    const attemptsBonus = Math.max(
      0,
      hashGameRules.attemptsBonus - hashBruteForceGame.attempts
    );

    const totalPoints =
      hashGameRules.hashGamePoints +
      timeBonus +
      difficultyBonus +
      attemptsBonus;

    addLog(
      `🔐 Hash cracked! +${totalPoints} points (${
        hashBruteForceGame.attempts
      } attempts, ${Math.floor(completionTime / 1000)}s)`,
      "success"
    );

    // Award points
    user.get("profile").once((profile) => {
      const newPoints = (profile.points || 0) + totalPoints;
      const newLevel = getLevelFromPoints(newPoints);
      const newProfile = {
        ...profile,
        points: newPoints,
        level: newLevel,
        hashGamesWon: (profile.hashGamesWon || 0) + 1,
        totalHashPoints: (profile.totalHashPoints || 0) + totalPoints,
      };
      user.get("profile").put(newProfile);

      // Update leaderboard
      gun.get("leaderboard").get(currentUser.alias).put({
        points: newPoints,
        level: newLevel,
      });

      // Update local data
      currentUser.points = newPoints;
      currentUser.level = newLevel;
      updateStatsUI();
    });

    // Execute the pending challenge after successful hash game
    setTimeout(() => {
      if (window.pendingChallenge) {
        addLog(
          `⚔️ Executing challenge against ${
            window.pendingChallenge.target?.alias || "Unknown"
          }...`,
          "info"
        );
        executeChallenge(window.pendingChallenge);
        window.pendingChallenge = null;
      }
    }, 1000);

    hashBruteForceGame.active = false;
    return true;
  }

  // Check if max attempts reached
  if (hashBruteForceGame.attempts >= hashBruteForceGame.maxAttempts) {
    addLog(
      `🔐 Hash game failed - Max attempts reached (${hashBruteForceGame.maxAttempts})`,
      "error"
    );
    hashBruteForceGame.active = false;
    return false;
  }

  return false;
}

function showHashBruteForceGame() {
  if (hashBruteForceGame.active) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="hash-game-modal">
        <h2>&gt; HASH BRUTE-FORCE CHALLENGE</h2>
        
        <div class="hash-info">
          <div class="hash-target">
            <span class="label">TARGET HASH:</span>
            <span class="hash-value">${hashBruteForceGame.targetHash.slice(
              0,
              -hashBruteForceGame.hiddenChars
            )}<span class="hidden-chars">${"█".repeat(
      hashBruteForceGame.hiddenChars
    )}</span></span>
          </div>
          <div class="hash-stats">
            <div class="stat">Level: ${hashBruteForceGame.difficulty}</div>
            <div class="stat">Hidden: ${
              hashBruteForceGame.hiddenChars
            } chars</div>
            <div class="stat">Attempts: ${hashBruteForceGame.attempts}/${
      hashBruteForceGame.maxAttempts
    }</div>
            <div class="stat">Time: ${Math.floor(
              (Date.now() - hashBruteForceGame.startTime) / 1000
            )}s</div>
          </div>
        </div>
        
        <div class="hash-controls">
          <div class="control-section">
            <h3>Manual Brute-Force:</h3>
            <div class="hash-input">
              <label for="hashGuess">Guess the hidden characters:</label>
              <input type="text" id="hashGuess" placeholder="Enter ${
                hashBruteForceGame.hiddenChars
              } characters" maxlength="${hashBruteForceGame.hiddenChars}">
              <button id="submitHashGuess">SUBMIT GUESS</button>
            </div>
          </div>
          
          <div class="control-section">
            <h3>Automatic Brute-Force:</h3>
            <div class="auto-controls">
              <label for="autoSpeed">Speed (ms delay):</label>
              <input type="number" id="autoSpeed" value="100" min="10" max="1000" step="10">
              <button id="startAutoBruteForce">START AUTO BRUTE-FORCE</button>
              <button id="stopAutoBruteForce" disabled>STOP AUTO BRUTE-FORCE</button>
            </div>
            <div class="auto-status" id="autoStatus"></div>
          </div>
        </div>
        
        <div class="hash-history" id="hashHistory">
          <h3>Recent Attempts:</h3>
          <div class="attempts-list"></div>
        </div>
        
        <div class="button" id="closeHashGame">CLOSE</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const guessInput = overlay.querySelector("#hashGuess");
    const submitBtn = overlay.querySelector("#submitHashGuess");
    const closeBtn = overlay.querySelector("#closeHashGame");
    const attemptsList = overlay.querySelector(".attempts-list");
    const startAutoBtn = overlay.querySelector("#startAutoBruteForce");
    const stopAutoBtn = overlay.querySelector("#stopAutoBruteForce");
    const autoSpeedInput = overlay.querySelector("#autoSpeed");
    const autoStatus = overlay.querySelector("#autoStatus");

    // Auto brute-force variables
    let autoBruteForceActive = false;
    let autoBruteForceInterval = null;
    let currentGuess = "";

    // Generate all possible combinations for systematic brute-force
    function generateAllCombinations(length) {
      const chars = "0123456789abcdef";
      let combinations = [""];

      for (let i = 0; i < length; i++) {
        let newCombinations = [];
        for (let combo of combinations) {
          for (let char of chars) {
            newCombinations.push(combo + char);
          }
        }
        combinations = newCombinations;
      }
      return combinations;
    }

    // Start automatic brute-force
    function startAutoBruteForce() {
      if (autoBruteForceActive) return;

      const speed = parseInt(autoSpeedInput.value) || 100;
      const combinations = generateAllCombinations(
        hashBruteForceGame.hiddenChars
      );
      let currentIndex = 0;

      autoBruteForceActive = true;
      startAutoBtn.disabled = true;
      stopAutoBtn.disabled = false;
      autoStatus.textContent = `Auto brute-force started. Testing ${combinations.length} combinations...`;

      autoBruteForceInterval = setInterval(() => {
        if (!hashBruteForceGame.active || currentIndex >= combinations.length) {
          stopAutoBruteForce();
          return;
        }

        const guess = combinations[currentIndex];
        currentIndex++;

        // Add to history
        const attemptDiv = document.createElement("div");
        attemptDiv.className = "attempt-item auto";
        attemptDiv.innerHTML = `
          <span class="attempt-number">#${
            hashBruteForceGame.attempts + 1
          }</span>
          <span class="attempt-guess">${guess}</span>
          <span class="attempt-result">Auto testing...</span>
        `;
        attemptsList.appendChild(attemptDiv);

        // Keep only last 10 attempts visible
        while (attemptsList.children.length > 10) {
          attemptsList.removeChild(attemptsList.firstChild);
        }

        // Process guess
        const success = attemptHashBruteForce(guess);
        if (success) {
          attemptDiv.querySelector(".attempt-result").textContent = "SUCCESS!";
          attemptDiv.className = "attempt-item success";
          stopAutoBruteForce();
          setTimeout(() => overlay.remove(), 2000);
        } else if (
          hashBruteForceGame.attempts >= hashBruteForceGame.maxAttempts
        ) {
          attemptDiv.querySelector(".attempt-result").textContent = "FAILED";
          attemptDiv.className = "attempt-item failed";
          stopAutoBruteForce();
          setTimeout(() => overlay.remove(), 2000);
        } else {
          attemptDiv.querySelector(".attempt-result").textContent = "Wrong";
          attemptDiv.className = "attempt-item wrong";
        }

        // Update status
        autoStatus.textContent = `Progress: ${currentIndex}/${
          combinations.length
        } (${Math.round((currentIndex / combinations.length) * 100)}%)`;
      }, speed);
    }

    // Stop automatic brute-force
    function stopAutoBruteForce() {
      if (autoBruteForceInterval) {
        clearInterval(autoBruteForceInterval);
        autoBruteForceInterval = null;
      }
      autoBruteForceActive = false;
      startAutoBtn.disabled = false;
      stopAutoBtn.disabled = true;
      autoStatus.textContent = "Auto brute-force stopped.";
    }

    // Manual guess submission
    submitBtn.onclick = () => {
      const guess = guessInput.value.toLowerCase();
      if (guess.length !== hashBruteForceGame.hiddenChars) {
        addLog("Invalid guess length!", "error");
        return;
      }

      // Add to history
      const attemptDiv = document.createElement("div");
      attemptDiv.className = "attempt-item";
      attemptDiv.innerHTML = `
        <span class="attempt-number">#${hashBruteForceGame.attempts + 1}</span>
        <span class="attempt-guess">${guess}</span>
        <span class="attempt-result">Checking...</span>
      `;
      attemptsList.appendChild(attemptDiv);

      // Process guess
      const success = attemptHashBruteForce(guess);
      if (success) {
        attemptDiv.querySelector(".attempt-result").textContent = "SUCCESS!";
        attemptDiv.className = "attempt-item success";
        stopAutoBruteForce();
        setTimeout(() => overlay.remove(), 2000);
      } else if (
        hashBruteForceGame.attempts >= hashBruteForceGame.maxAttempts
      ) {
        attemptDiv.querySelector(".attempt-result").textContent = "FAILED";
        attemptDiv.className = "attempt-item failed";
        stopAutoBruteForce();
        setTimeout(() => overlay.remove(), 2000);
      } else {
        attemptDiv.querySelector(".attempt-result").textContent = "Wrong";
        attemptDiv.className = "attempt-item wrong";
      }

      guessInput.value = "";
      guessInput.focus();
    };

    // Event listeners
    guessInput.onkeypress = (e) => {
      if (e.key === "Enter") {
        submitBtn.click();
      }
    };

    startAutoBtn.onclick = startAutoBruteForce;
    stopAutoBtn.onclick = stopAutoBruteForce;
    closeBtn.onclick = () => {
      stopAutoBruteForce();
      overlay.remove();
    };

    guessInput.focus();
  }
}

// Challenge Cooldown System
function startChallengeCooldown() {
  challengeCooldownActive = true;
  challengeCooldownEndTime = Date.now() + 300000; // 5 minutes

  // Save to GunDB
  user.get("challengeCooldown").put({
    active: true,
    endTime: challengeCooldownEndTime,
  });

  console.log("⏰ Challenge cooldown started - 5 minutes");
  updateChallengeCooldownUI();
}

function updateChallengeCooldownUI() {
  const cooldownBar = document.getElementById("challengeCooldownBar");
  if (!cooldownBar) return;

  if (challengeCooldownActive) {
    const remaining = Math.max(0, challengeCooldownEndTime - Date.now());
    const progress = Math.max(0, Math.min(100, (remaining / 300000) * 100));

    cooldownBar.style.display = "block";
    cooldownBar.querySelector(".cooldown-progress").style.width = `${
      100 - progress
    }%`;
    cooldownBar.querySelector(
      ".cooldown-text"
    ).textContent = `Challenge Cooldown: ${Math.ceil(
      remaining / 1000
    )}s remaining`;

    if (remaining <= 0) {
      challengeCooldownActive = false;
      cooldownBar.style.display = "none";
      console.log("⏰ Challenge cooldown ended");
    }
  } else {
    cooldownBar.style.display = "none";
  }
}

function loadChallengeCooldownFromGunDB() {
  if (!user || !user.is || !user.is.pub) return;

  user.get("challengeCooldown").once((data) => {
    if (data && data.active) {
      challengeCooldownActive = data.active;
      challengeCooldownEndTime = data.endTime || 0;

      // Check if cooldown is still active
      if (Date.now() < challengeCooldownEndTime) {
        console.log("⏰ Loaded active challenge cooldown from GunDB");
        updateChallengeCooldownUI();
      } else {
        // Cooldown expired
        challengeCooldownActive = false;
        user.get("challengeCooldown").put(null);
      }
    }
  });
}
