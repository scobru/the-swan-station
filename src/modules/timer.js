// Timer module - Timer system, countdown, and timer-related functionality

// Timer state
let currentTimerValue = 108;
let timerInterval = null;
let systemFailureActive = false;

// Audio elements for timer sounds
let timerTick, timerSiren;

// Initialize timer system
function initializeTimer() {
  console.log("⏰ Initializing timer system...");

  // Initialize timer reference
  if (window.core.gun && !window.core.timerRef) {
    window.core.setTimerRef(window.core.gun.get("swan").get("timer"));
  }

  // Setup timer listener
  setupTimerListener();

  // Start timer health monitoring
  window.core.safeSetInterval(checkTimerHealth, 120000);

  // Initialize audio elements
  initializeTimerAudio();

  console.log("✅ Timer system initialized");
}

// Initialize timer audio
function initializeTimerAudio() {
  try {
    timerTick = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
    );
    timerSiren = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
    );

    timerTick.volume = 0.2;
    timerSiren.volume = 0.5;

    window.core.cleanupRegistry.audioElements.add(timerTick);
    window.core.cleanupRegistry.audioElements.add(timerSiren);
  } catch (error) {
    console.warn("Failed to initialize timer audio:", error);
  }
}

// Update timer value
function updateTimer(newValue, reason = "") {
  console.log("⏰ updateTimer called:", {
    newValue,
    reason,
    timerRef: !!window.core.timerRef,
  });

  if (window.core.timerRef) {
    const timerData = {
      value: newValue,
      lastUpdate: Date.now(),
      updatedBy: window.core.user?.alias || "UNKNOWN",
      reason: reason,
    };

    console.log("📤 Sending timer data to GunDB:", timerData);
    window.core.timerRef.put(timerData, (ack) => {
      if (ack.err) {
        console.error("❌ Failed to update timer:", ack.err);
      } else {
        console.log("✅ Timer updated successfully to:", newValue);
      }
    });
  } else {
    console.error("❌ timerRef is null - cannot update timer");
    window.ui.addLog("ERROR: Timer system not initialized", "error");

    // Attempt to reinitialize timer reference
    if (window.core.gun && !window.core.timerRef) {
      window.core.setTimerRef(window.core.gun.get("timer"));
      window.ui.addLog("Attempting to reinitialize timer reference...", "info");
    }
  }
}

// Setup timer listener
function setupTimerListener() {
  console.log("🔧 Setting up main timer listener...");

  if (window.core.timerRef) {
    window.core.timerRef.on((data) => {
      console.log("📨 Main timer listener received data:", data);

      if (data && typeof data.value === "number") {
        console.log("✅ Updating timer display to:", data.value);
        currentTimerValue = data.value;

        document.title = data.value;
        const bigTimer = document.getElementById("bigTimer");
        if (bigTimer) bigTimer.textContent = data.value;

        let updateMessage = `Timer updated to: ${data.value}`;
        if (data.updatedBy) updateMessage += ` by ${data.updatedBy}`;
        if (data.reason) updateMessage += ` (${data.reason})`;
        window.ui.addLog(updateMessage);

        updateInputState(data.value);

        if (data.value <= 4) {
          if (timerSiren?.readyState >= 2) {
            timerSiren.volume = 0.5;
            timerSiren
              .play()
              .catch((error) => console.warn("Failed to play siren:", error));
          }
          window.ui.addLog("WARNING: System failure imminent!", "warning");
        }

        if (data.value > 4) {
          if (timerSiren) {
            timerSiren.pause();
            timerSiren.currentTime = 0;
          }
          if (systemFailureActive) stopSystemFailureDisplay();
        }
      } else {
        console.warn("⚠️ Invalid timer data received:", data);
      }
    });
  } else {
    console.error("❌ timerRef is null - cannot setup timer listener");
  }
}

// Update input state based on timer value
function updateInputState(timerValue) {
  const input = document.querySelector(".input");
  const prompt = document.querySelector(".prompt");

  if (timerValue <= 4) {
    // Enable input in last 4 minutes
    if (input) {
      input.disabled = false;
      input.placeholder = "Enter code sequence...";
      input.style.opacity = "1";
      input.style.color = "#00ff00";
      input.style.borderColor = "#00ff00";
      input.style.display = "block";
    }
    if (prompt) {
      prompt.style.opacity = "1";
      prompt.style.color = "#00ff00";
      prompt.style.display = "block";
    }
  } else {
    // Disable input when timer > 4
    if (input) {
      input.disabled = true;
      input.placeholder = "Code input locked until last 4 minutes";
      input.style.opacity = "0.5";
      input.style.color = "#666";
      input.style.borderColor = "#666";
      input.style.display = "none";
    }
    if (prompt) {
      prompt.style.opacity = "0.5";
      prompt.style.color = "#666";
      prompt.style.display = "none";
    }
  }
}

// Timer decrement function
function decrementTimer() {
  if (!window.core.timerRef) {
    console.log("Timer reference lost, reinitializing...");
    window.core.setTimerRef(window.core.gun.get("swan").get("timer"));
  }

  window.core.timerRef.once((data) => {
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
      if (timerTick?.readyState >= 2) {
        timerTick.volume = 0.2;
        timerTick
          .play()
          .catch((error) => console.warn("Failed to play tick sound:", error));
      }
    } else if (data.value <= 1 && data.value > 0) {
      triggerSystemFailure();
      if (timerTick?.readyState >= 2) {
        timerTick.volume = 0.2;
        timerTick
          .play()
          .catch((error) =>
            console.warn("Failed to play tick sound for system failure:", error)
          );
      }
    }
  });
}

// Start timer countdown
function startTimer() {
  if (timerInterval) {
    window.core.safeSetInterval.clearInterval(timerInterval);
  }

  timerInterval = window.core.safeSetInterval(decrementTimer, 60000); // Every minute
  console.log("⏰ Timer countdown started");
}

// Stop timer countdown
function stopTimer() {
  if (timerInterval) {
    window.core.safeSetInterval.clearInterval(timerInterval);
    timerInterval = null;
    console.log("⏰ Timer countdown stopped");
  }
}

// Reset timer to default value
function resetTimer() {
  updateTimer(108, "manual_reset");
  window.ui.addLog("Timer reset to 108 minutes", "info");
}

// Check timer health
function checkTimerHealth() {
  if (window.core.timerRef) {
    window.core.timerRef.once((data) => {
      const now = Date.now();
      if (
        !data ||
        typeof data.value !== "number" ||
        !data.lastUpdate ||
        now - data.lastUpdate > 120000
      ) {
        console.log("Timer health check failed - timer may be corrupted");
        window.ui.addLog(
          "WARNING: Timer system may be corrupted. Manual reset required.",
          "warning"
        );
      }
    });
  }
}

// System failure functions
function triggerSystemFailure() {
  if (!systemFailureActive) {
    systemFailureActive = true;
    startSystemFailureDisplay();
    window.ui.addLog("SYSTEM FAILURE TRIGGERED!", "error");
  }
}

function startSystemFailureDisplay() {
  const bigTimer = document.getElementById("bigTimer");
  if (bigTimer) {
    bigTimer.style.color = "#ff0000";
    bigTimer.style.animation = "blink 1s infinite";
  }
}

function stopSystemFailureDisplay() {
  systemFailureActive = false;
  const bigTimer = document.getElementById("bigTimer");
  if (bigTimer) {
    bigTimer.style.color = "#00ff00";
    bigTimer.style.animation = "none";
  }
}

// Setup input handler
function setupInputHandler() {
  const input = document.querySelector(".input");
  if (!input) return;

  input.onkeydown = (event) => {
    if (!window.core.user) {
      window.ui.addLog("ERROR: Operator registration required", "error");
      if (!document.querySelector(".overlay")) {
        window.auth.showAuthPrompt();
      }
      return;
    }

    window.ui.typeSound();

    if (event.key === "Enter") {
      input.value = input.value.trim();

      // Check if input is allowed (only in last 4 minutes)
      window.core.timerRef.once((timerData) => {
        if (timerData && timerData.value <= 4) {
          // Process input in last 4 minutes
          processTimerInput(input.value);
        } else {
          window.ui.addLog("Code input locked until last 4 minutes", "warning");
        }
      });
    }
  };
}

// Process timer input
function processTimerInput(input) {
  // Add your input processing logic here
  window.ui.addLog(`Processing input: ${input}`, "info");

  // Example: Check for specific codes
  if (input.toLowerCase() === "reset") {
    resetTimer();
  } else if (input.toLowerCase() === "status") {
    window.ui.addLog(`Current timer: ${currentTimerValue} minutes`, "info");
  } else {
    window.ui.addLog(`Unknown command: ${input}`, "warning");
  }

  // Clear input
  const inputElement = document.querySelector(".input");
  if (inputElement) inputElement.value = "";
}

// Get current timer value
function getCurrentTimerValue() {
  return currentTimerValue;
}

// Export timer functions
window.timer = {
  initializeTimer,
  updateTimer,
  setupTimerListener,
  updateInputState,
  decrementTimer,
  startTimer,
  stopTimer,
  resetTimer,
  checkTimerHealth,
  triggerSystemFailure,
  startSystemFailureDisplay,
  stopSystemFailureDisplay,
  setupInputHandler,
  processTimerInput,
  getCurrentTimerValue,
};
