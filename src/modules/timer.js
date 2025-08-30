// Timer module - Timer system, countdown, and timer-related functionality

// Timer state
let currentTimerValue = 108;
let timerInterval = null;
let timerSystemFailureActive = false;

// Audio elements for timer sounds
let timerTickSound, timerSirenSound;

// Wait for dependencies to be available
function waitForDependencies() {
  return new Promise((resolve) => {
    const checkDependencies = () => {
      if (
        window.core &&
        window.ui &&
        window.core.gun &&
        window.core.safeSetInterval &&
        window.core.setTimerRef
      ) {
        resolve();
      } else {
        setTimeout(checkDependencies, 100);
      }
    };
    checkDependencies();
  });
}

// Initialize timer system
async function initializeTimer() {
  console.log("⏰ Initializing timer system...");

  try {
    // Wait for dependencies to be available
    await waitForDependencies();

    // Initialize timer reference if not already set
    if (window.core?.gun && !window.core.timerRef) {
      console.log("🔧 Setting up timer reference...");
      window.core.setTimerRef(window.core.gun.get("swan").get("timer"));
    }

    // Wait a bit for timerRef to be properly set
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Setup timer listener
    setupTimerListener();

    // Start timer health monitoring
    if (window.core?.safeSetInterval) {
      window.core.safeSetInterval(checkTimerHealth, 120000);
    }

    // Initialize audio elements
    initializeTimerAudio();

    console.log("✅ Timer system initialized");
  } catch (error) {
    console.error("❌ Error initializing timer system:", error);
  }
}

// Initialize timer audio
function initializeTimerAudio() {
  try {
    timerTickSound = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
    );
    timerSirenSound = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
    );

    timerTickSound.volume = 0.2;
    timerSirenSound.volume = 0.5;

    if (window.core?.cleanupRegistry?.audioElements) {
      window.core.cleanupRegistry.audioElements.add(timerTickSound);
      window.core.cleanupRegistry.audioElements.add(timerSirenSound);
    }
  } catch (error) {
    console.warn("Failed to initialize timer audio:", error);
  }
}

// Update timer value
function updateTimer(newValue, reason = "") {
  console.log("⏰ updateTimer called:", {
    newValue,
    reason,
    timerRef: !!window.core?.timerRef,
  });

  const waitForTimerRef = () => {
    if (!window.core?.timerRef) {
      console.log("⏳ Waiting for timerRef...");
      setTimeout(waitForTimerRef, 1000);
      return;
    }

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
  };

  waitForTimerRef();
}

// Setup timer listener
function setupTimerListener() {
  console.log("🔧 Setting up main timer listener...");

  // Wait for core dependencies to be available
  const waitForDependencies = () => {
    if (!window.core) {
      console.log("⏳ Waiting for core dependencies...");
      setTimeout(waitForDependencies, 1000);
      return;
    }

    // Try to get timerRef if not available
    if (!window.core.timerRef && window.core.gun && window.core.setTimerRef) {
      console.log("🔄 Attempting to get timer reference...");
      try {
        window.core.setTimerRef(window.core.gun.get("swan").get("timer"));
      } catch (error) {
        console.error("❌ Error setting timer reference:", error);
      }
    }

    // Wait a bit and check again
    setTimeout(() => {
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
            if (window.core?.addLog) {
              window.core.addLog(updateMessage);
            }

            updateInputState(data.value);

            if (data.value <= 4) {
              if (timerSirenSound?.readyState >= 2) {
                timerSirenSound.volume = 0.5;
                timerSirenSound
                  .play()
                  .catch((error) => console.warn("Failed to play siren:", error));
              }
              if (window.core?.addLog) {
                window.core.addLog("WARNING: System failure imminent!", "warning");
              }
            }

            if (data.value > 4) {
              if (timerSirenSound) {
                timerSirenSound.pause();
                timerSirenSound.currentTime = 0;
              }
              if (timerSystemFailureActive) stopSystemFailureDisplay();
            }
          } else {
            console.warn("⚠️ Invalid timer data received:", data);
          }
        });
        console.log("✅ Timer listener setup complete");
      } else {
        console.error("❌ timerRef is still null - cannot setup timer listener");
        // Retry after a longer delay
        setTimeout(() => {
          if (window.core?.gun && window.core?.setTimerRef) {
            console.log("🔄 Retrying timer listener setup...");
            setupTimerListener();
          }
        }, 5000);
      }
    }, 1000);
  };

  waitForDependencies();
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
  if (!window.core?.timerRef) {
    console.log("Timer reference lost, reinitializing...");
    if (window.core?.gun) {
      window.core.setTimerRef(window.core.gun.get("swan").get("timer"));
    }
  }

  if (window.core?.timerRef) {
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
        if (timerTickSound?.readyState >= 2) {
          timerTickSound.volume = 0.2;
          timerTickSound
            .play()
            .catch((error) =>
              console.warn("Failed to play tick sound:", error)
            );
        }
      } else if (data.value <= 1 && data.value > 0) {
        triggerSystemFailure();
        if (timerTickSound?.readyState >= 2) {
          timerTickSound.volume = 0.2;
          timerTickSound
            .play()
            .catch((error) =>
              console.warn(
                "Failed to play tick sound for system failure:",
                error
              )
            );
        }
      }
    });
  }
}

// Start timer countdown
function startTimer() {
  const waitForSafeSetInterval = () => {
    if (!window.core?.safeSetInterval) {
      console.log("⏳ Waiting for safeSetInterval...");
      setTimeout(waitForSafeSetInterval, 1000);
      return;
    }

    if (timerInterval) {
      clearInterval(timerInterval);
    }

    timerInterval = window.core.safeSetInterval(decrementTimer, 60000); // Every minute
    console.log("⏰ Timer countdown started");
  };

  waitForSafeSetInterval();
}

// Stop timer countdown
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    console.log("⏰ Timer countdown stopped");
  }
}

// Reset timer to default value
function resetTimer() {
  updateTimer(108, "manual_reset");
  if (window.core?.addLog) {
    window.core.addLog("Timer reset to 108 minutes", "info");
  }
}

// Reset timer with full statistics handling
function resetTimerWithStats() {
  updateTimer(108, "code_correct");
  if (window.core?.addLog) {
    window.core.addLog("Timer reset to 108 minutes", "info");
  }

  // This function will be called from the main script to handle statistics
  // The main script will handle the stats updates after calling this
}

// Check timer health
function checkTimerHealth() {
  const waitForTimerRef = () => {
    if (!window.core?.timerRef) {
      console.log("⏳ Waiting for timerRef...");
      setTimeout(waitForTimerRef, 1000);
      return;
    }

    window.core.timerRef.once((data) => {
      const now = Date.now();
      if (
        !data ||
        typeof data.value !== "number" ||
        !data.lastUpdate ||
        now - data.lastUpdate > 120000
      ) {
        console.log("Timer health check failed - timer may be corrupted");
        if (window.core?.addLog) {
          window.core.addLog(
            "WARNING: Timer system may be corrupted. Manual reset required.",
            "warning"
          );
        }
      }
    });
  };

  waitForTimerRef();
}

// System failure functions
function triggerSystemFailure() {
  if (!timerSystemFailureActive) {
    timerSystemFailureActive = true;
    startSystemFailureDisplay();
    if (window.core?.addLog) {
      window.core.addLog("SYSTEM FAILURE TRIGGERED!", "error");
    }
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
  timerSystemFailureActive = false;
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
    if (!window.core?.user) {
          if (window.core?.addLog) {
      window.core.addLog("ERROR: Operator registration required", "error");
    }
      if (!document.querySelector(".overlay")) {
        if (window.auth?.showAuthPrompt) {
          window.auth.showAuthPrompt();
        }
      }
      return;
    }

          // Note: typeSound function is not available in core, skipping

    if (event.key === "Enter") {
      input.value = input.value.trim();

      // Check if input is allowed (only in last 4 minutes)
      if (window.core?.timerRef) {
        window.core.timerRef.once((timerData) => {
          if (timerData && timerData.value <= 4) {
            // Process input in last 4 minutes
            processTimerInput(input.value);
          } else {
                    if (window.core?.addLog) {
          window.core.addLog(
            "Code input locked until last 4 minutes",
            "warning"
          );
        }
          }
        });
      }
    }
  };
}

// Process timer input
function processTimerInput(input) {
  // Add your input processing logic here
  if (window.core?.addLog) {
    window.core.addLog(`Processing input: ${input}`, "info");
  }

  // Check for the correct code sequence
  if (input === "4 8 15 16 23 42") {
    console.log("🔢 CORRECT CODE SEQUENCE ENTERED - RESETTING TIMER");
    resetTimer();
    return true; // Indicate successful processing
  } else if (input.toLowerCase() === "reset") {
    resetTimer();
    return true;
  } else if (input.toLowerCase() === "status") {
    if (window.core?.addLog) {
      window.core.addLog(`Current timer: ${currentTimerValue} minutes`, "info");
    }
    return true;
  } else {
    if (window.core?.addLog) {
      window.core.addLog(`Unknown command: ${input}`, "warning");
    }
    return false;
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
  resetTimerWithStats,
  checkTimerHealth,
  triggerSystemFailure,
  startSystemFailureDisplay,
  stopSystemFailureDisplay,
  setupInputHandler,
  processTimerInput,
  getCurrentTimerValue,
};

// Add a status function to check if timer is ready
window.timer.isReady = function () {
  return !!(window.core && window.core.timerRef && window.core.safeSetInterval);
};

// Auto-initialize when dependencies are ready
(function autoInitialize() {
  if (
    window.core &&
    window.core.gun &&
    window.core.safeSetInterval &&
    window.core.setTimerRef &&
    window.core.addLog
  ) {
    console.log("🚀 Auto-initializing timer module...");
    initializeTimer();
  } else {
    setTimeout(autoInitialize, 1000);
  }
})();
