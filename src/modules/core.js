// Core module - Core utilities, state management, and initialization

// Core state
let gun = null;
let user = null;
let shogun = null;
let chatRef = null;
let operatorsRef = null;
let tasksRef = null;
let challengesRef = null;
let statsRef = null;
let timerRef = null;
let historyRef = null;
let stationParamsRef = null;

// Cleanup registry for intervals and listeners
const cleanupRegistry = {
  intervals: new Set(),
  listeners: new Set(),
  timeouts: new Set(),
  audioElements: new Set(),
  profileListeners: new Set(),
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

  cleanupRegistry.intervals.clear();
  cleanupRegistry.timeouts.clear();
  cleanupRegistry.listeners.clear();
  cleanupRegistry.audioElements.clear();
  cleanupRegistry.profileListeners.clear();

  console.log("🧹 Cleanup completed");
}

// Performance monitoring
const performanceMonitor = {
  startTime: Date.now(),
  errors: [],
  warnings: [],

  logError: function (error) {
    this.errors.push({
      timestamp: Date.now(),
      error: error.message || error,
      stack: error.stack,
    });
    console.error("❌ Error logged:", error);
  },

  logWarning: function (warning) {
    this.warnings.push({
      timestamp: Date.now(),
      warning: warning,
    });
    console.warn("⚠️ Warning logged:", warning);
  },

  getStats: function () {
    return {
      uptime: Date.now() - this.startTime,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      recentErrors: this.errors.slice(-5),
      recentWarnings: this.warnings.slice(-5),
    };
  },
};

// Initialize Gun.js with fallback servers
function initializeGun() {
  try {
    // Primary servers
    const primaryServers = [
      "https://gun-manhattan.herokuapp.com/gun",
      "https://relay.shogun-eco.xyz/gun",
    ];

    // Fallback servers
    const fallbackServers = [
      "https://gun-us.herokuapp.com/gun",
      "https://gun-eu.herokuapp.com/gun",
      "https://gunjs.herokuapp.com/gun",
      "https://gunmeetingserver.herokuapp.com/gun",
      "https://gun-us.herokuapp.com/gun",
    ];

    // Combine all servers
    const allServers = [...primaryServers, ...fallbackServers];

    // Try to initialize Gun.js
    gun = Gun(allServers);

    // Test connection with timeout
    const connectionTest = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 5000);

      gun.get("test").once((data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    connectionTest
      .then(() => {
        console.log("✅ Gun.js connection established");
      })
      .catch((error) => {
        console.warn("⚠️ Gun.js connection test failed:", error.message);
        console.log(
          "🔄 Continuing with offline mode - data will sync when connection is available"
        );
      });

    // Handle connection errors
    gun.on("error", (error) => {
      console.warn("⚠️ Gun.js connection error:", error);
      performanceMonitor.logWarning(`Gun.js connection error: ${error}`);
    });

    console.log("🔧 Gun.js initialized with fallback servers");
    return gun;
  } catch (error) {
    console.error("❌ Failed to initialize Gun.js:", error);
    performanceMonitor.logError(error);
    return null;
  }
}

// Safe interval creation
function safeSetInterval(callback, delay) {
  return setInterval(callback, delay);
}

// Safe timeout creation
function safeSetTimeout(callback, delay) {
  return setTimeout(callback, delay);
}

// Safe event listener
function safeAddEventListener(element, event, handler) {
  if (element && element.addEventListener) {
    element.addEventListener(event, handler);
  }
}

// Set chat reference
function setChatRef(ref) {
  chatRef = ref;
}

// Set operators reference
function setOperatorsRef(ref) {
  operatorsRef = ref;
}

// Set tasks reference
function setTasksRef(ref) {
  tasksRef = ref;
}

// Set challenges reference
function setChallengesRef(ref) {
  challengesRef = ref;
}

// Set stats reference
function setStatsRef(ref) {
  statsRef = ref;
}

// Set timer reference
function setTimerRef(ref) {
  timerRef = ref;
}

// Set history reference
function setHistoryRef(ref) {
  historyRef = ref;
}

// Set station params reference
function setStationParamsRef(ref) {
  stationParamsRef = ref;
}

// Set task reference
function setTaskRef(ref) {
  tasksRef = ref;
}

// Export core functions and state
window.core = {
  // State
  get gun() {
    return gun;
  },
  get user() {
    return user;
  },
  get shogun() {
    return shogun;
  },
  get chatRef() {
    return chatRef;
  },
  get operatorsRef() {
    return operatorsRef;
  },
  get tasksRef() {
    return tasksRef;
  },
  get challengesRef() {
    return challengesRef;
  },
  get statsRef() {
    return statsRef;
  },
  get timerRef() {
    return timerRef;
  },
  get historyRef() {
    return historyRef;
  },
  get stationParamsRef() {
    return stationParamsRef;
  },

  // Registry
  cleanupRegistry,
  performanceMonitor,

  // Functions
  initializeGun,
  cleanup,
  safeSetInterval,
  safeSetTimeout,
  safeAddEventListener,
  setChatRef,
  setOperatorsRef,
  setTasksRef,
  setChallengesRef,
  setStatsRef,
  setTimerRef,
  setHistoryRef,
  setStationParamsRef,
  setTaskRef,
  setShogun: (s) => {
    shogun = s;
  },

  // Setters for state
  setUser: (u) => {
    user = u;
  },
  setGun: (g) => {
    gun = g;
  },
};
