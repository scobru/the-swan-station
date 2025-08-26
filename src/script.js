// Initialize shogun core
let shogun, gun, user, timerRef, operatorsRef, historyRef, statsRef, chatRef;

async function initializeShogun() {
  try {
    // Show loading state
    document.title = "INITIALIZING SWAN STATION...";

    // Initialize Shogun Core
    shogun = await window.initShogun({
      peers: [
        "https://relay.shogun-eco.xyz/gun",
        "https://peer.wallie.io/gun",
        "https://gun-manhattan.herokuapp.com/gun",
      ],
      localStorage: true,
      scope: "swan-station",
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

// Audio setup - preload sounds
const siren = new Audio("assets/siren.mp3");
const reset = new Audio("assets/reset.mp3");
const tick = new Audio("assets/tick.mp3");
const buttonSounds = Array.from({ length: 8 }, (_, i) => {
  const audio = new Audio(`assets/typing_sounds/button${i + 1}.mp3`);
  audio.preload = "auto";
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
  if (focusInterval) clearInterval(focusInterval);
  focusInterval = null;
  console.log("App UI focus paused.");
}

function startApp(alias) {
  stopApp(); // Prevent duplicate intervals
  console.log(`Operator ${alias} is active. App resumed.`);
  currentUser = { alias: alias, points: 0, level: 1 };

  // Register the operator immediately
  registerOperator(alias);

  // Keep operator status updated
  setInterval(() => {
    operatorsRef.get(user.is.pub).put({
      name: alias,
      pub: user.is.pub,
      lastSeen: Date.now(),
    });
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

  // Show the main container
  document.querySelector(".container").style.display = "flex";

  focusInterval = setInterval(() => {
    if (
      document.activeElement.tagName !== "INPUT" ||
      document.activeElement === input
    ) {
      input.focus();
    }
  }, 100);
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
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
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

// Typing sound function
function typeSound() {
  const randomNumber = Math.floor(Math.random() * 7);
  buttonSounds[randomNumber].play().catch(() => {});
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
  if (timerRef) {
    timerRef.on((data) => {
      if (data && typeof data.value === "number") {
        document.title = data.value;
        bigTimer.textContent = data.value; // Update the big timer display

        let updateMessage = `Timer updated to: ${data.value}`;
        if (data.updatedBy) {
          updateMessage += ` by ${data.updatedBy}`;
        }
        addLog(updateMessage);

        if (data.value <= 4) {
          siren.play().catch(() => {});
          addLog("WARNING: System failure imminent!", "warning");
        }

        if (data.value > 4) {
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
        let pointsToAdd = 1;
        const newStreak = (profile.resetStreak || 0) + 1;

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
      siren.pause();
      siren.currentTime = 0;
      reset.play().catch(() => {});
      addLog("Numbers entered correctly. Timer reset.", "success");
    } else if (input.value !== "") {
      addLog("Incorrect code sequence. Protocol penalty initiated.", "warning");
      updateTimer(4, "code_incorrect"); // Set timer to 4 as penalty

      // Reset the user's streak on incorrect code
      user.get("profile").put({ resetStreak: 0 });

      input.value = "";
      siren.play().catch(() => {});
    }
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
      tick.play().catch(() => {});
    } else if (data.value <= 1 && data.value > 0) {
      // Timer has reached 0, trigger system failure
      triggerSystemFailure();
      tick.play().catch(() => {});
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
        <div class="chat-modal">
            <div class="terminal-header">> OPERATOR PROFILE</div>
            <div class="terminal-content profile-content">
                <div class="profile-section">
                    <div class="profile-avatar">
                        <img id="operatorAvatar" src="" alt="Operator Avatar" />
                    </div>
                    <div class="profile-info">
                        <div class="info-row">ALIAS: <span id="profileAlias"></span></div>
                        <div class="info-row">LEVEL: <span id="profileLevel"></span></div>
                        <div class="info-row">POINTS: <span id="profilePoints"></span></div>
                        <div class="info-row">LOCATION: <span id="profileLocation"></span></div>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="section-header">OPERATOR STATISTICS</div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">SUCCESSFUL RESETS</div>
                            <div class="stat-value" id="profileResets">0</div>
                        </div>
                    </div>
                </div>
                <div class="profile-actions">
                    <input type="text" id="locationInput" placeholder="Enter your location..." />
                    <button id="updateLocation" class="terminal-button">UPDATE LOCATION</button>
                    <button id="getGPSLocation" class="terminal-button gps-button">📍 GET GPS LOCATION</button>
                    <button id="selectLocation" class="terminal-button location-button">🌍 SELECT LOCATION</button>
                    <button id="exportPair" class="terminal-button">EXPORT PAIR</button>
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
        const operatorAvatar = document.getElementById("operatorAvatar");

        if (profileAlias) profileAlias.textContent = currentUser.alias;
        if (profileLevel) profileLevel.textContent = currentUser.level;
        if (profilePoints) profilePoints.textContent = currentUser.points;
        if (profileLocation)
          profileLocation.textContent = profile.location || "NOT SET";
        if (profileResets) profileResets.textContent = profile.resets || 0;

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

  // Chiudi il profilo
  overlay.querySelector(".terminal-footer").onclick = () => overlay.remove();

  // Aggiorna il profilo inizialmente
  updateProfile();
}

// Aggiorna updateStatsUI per includere il pulsante del profilo
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
                <button id="profileBtn" class="stats-button mobile-visible">[ PROFILE ]</button>
                <button id="globalStatsBtn" class="stats-button mobile-visible">[ GLOBAL STATS ]</button>
                <button id="leaderboardBtn" class="stats-button mobile-visible">[ LEADERBOARD ]</button>
                <button id="historyBtn" class="stats-button mobile-visible">[ HISTORY ]</button>
                <button id="chatBtn" class="stats-button">[ CHAT ]</button>
                <button id="networkBtn" class="stats-button">[ NETWORK ]</button>
                <button id="mapBtn" class="stats-button">[ MAP ]</button>
                <button id="moreBtn" class="stats-button mobile-more">[ MORE ]</button>
            </div>
        </div>
    `;

  // Add click handlers for all buttons
  document.getElementById("profileBtn").onclick = showProfile;
  document.getElementById("globalStatsBtn").onclick = showGlobalStats;
  document.getElementById("leaderboardBtn").onclick = showLeaderboard;
  document.getElementById("historyBtn").onclick = showHistory;
  document.getElementById("chatBtn").onclick = showChat;
  document.getElementById("networkBtn").onclick = showNetworkAnalytics;
  document.getElementById("mapBtn").onclick = showOperatorsMap;
  document.getElementById("moreBtn").onclick = toggleMoreMenu;
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
  updateTimer(4, "system_failure");

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

// Toggle more menu for mobile
function toggleMoreMenu() {
  const chatBtn = document.getElementById("chatBtn");
  const networkBtn = document.getElementById("networkBtn");
  const moreBtn = document.getElementById("moreBtn");

  if (chatBtn && networkBtn && moreBtn) {
    const isExpanded = chatBtn.classList.contains("mobile-visible");

    if (isExpanded) {
      // Collapse menu
      chatBtn.classList.remove("mobile-visible");
      networkBtn.classList.remove("mobile-visible");
      moreBtn.textContent = "[ MORE ]";

      // Reset visual feedback
      moreBtn.style.background = "#00aa00";
      moreBtn.style.boxShadow = "none";

      // Add smooth transition
      setTimeout(() => {
        chatBtn.style.display = "none";
        networkBtn.style.display = "none";
      }, 200);
    } else {
      // Expand menu
      chatBtn.style.display = "inline-block";
      networkBtn.style.display = "inline-block";
      chatBtn.classList.add("mobile-visible");
      networkBtn.classList.add("mobile-visible");
      moreBtn.textContent = "[ LESS ]";

      // Add visual feedback
      moreBtn.style.background = "#008800";
      moreBtn.style.boxShadow = "0 0 15px rgba(0, 255, 0, 0.5)";
    }
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
  const sessionInterval = setInterval(() => {
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
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");
  const operatorsList = document.getElementById("operatorsList");

  // Ensure all required elements exist
  if (!chatInput || !chatMessages || !operatorsList) {
    console.error("Chat elements not found. Chat initialization aborted.");
    return;
  }

  // Clear existing messages
  chatMessages.innerHTML = "";

  // Keep track of processed messages
  const processedMessages = new Set();

  // Simple function to add a message to the chat
  function displayMessage(data) {
    if (!data || !data.message || !data.author || !data.timestamp) return;

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
  }

  // Load chat history
  chatRef.map().once((data, key) => {
    if (!processedMessages.has(key)) {
      processedMessages.add(key);
      displayMessage(data);
    }
  });

  // Listen for new messages
  chatRef.map().on((data, key) => {
    if (!processedMessages.has(key)) {
      processedMessages.add(key);
      displayMessage(data);
    }
  });

  // Handle sending messages
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && chatInput.value.trim() && currentUser) {
      const message = chatInput.value.trim();
      chatInput.value = "";

      const messageId =
        Date.now().toString(36) + Math.random().toString(36).substr(2);
      const messageData = {
        author: currentUser.alias,
        message: message,
        timestamp: Date.now(),
      };

      chatRef.get(messageId).put(messageData);
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
  setInterval(updateOperatorsList, 5000); // Update every 5 seconds
}

// Main system initializer - called after shogun-core initialization
function initializeSystem() {
  document.title = "AUTHENTICATING...";

  // Add event listener for rules button
  document.addEventListener("DOMContentLoaded", () => {
    const rulesBtn = document.getElementById("rulesBtn");
    if (rulesBtn) {
      rulesBtn.addEventListener("click", showStationRules);
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
      }

      // Start the global countdown immediately
      if (decrementInterval) {
        clearInterval(decrementInterval);
        decrementInterval = null;
      }
      decrementInterval = setInterval(decrementTimer, 60000);

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
  setInterval(() => {
    if (!decrementInterval) {
      console.log("Timer interval lost, restarting...");
      decrementInterval = setInterval(decrementTimer, 60000);
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
          <li class="warning">Incorrect sequences result in immediate penalty (timer set to 4)</li>
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>OPERATOR REWARDS</h3>
        <ul>
          <li class="success">+1 point for successful reset</li>
          <li class="success">+2 bonus points for being first to reset</li>
          <li class="success">+1 bonus point for 4-in-a-row reset streak</li>
          <li class="info">Level up based on total points accumulated</li>
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
        </ul>
      </div>
      
      <div class="rules-section">
        <h3>EMERGENCY PROCEDURES</h3>
        <ul>
          <li class="warning">System failure triggers continuous red alert</li>
          <li class="warning">All operators must coordinate to prevent failure</li>
          <li class="info">Station automatically resets after successful code entry</li>
        </ul>
      </div>
      
      <div class="button" id="closeRules">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#closeRules").onclick = () => overlay.remove();
}

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
setInterval(checkTimerHealth, 120000);
