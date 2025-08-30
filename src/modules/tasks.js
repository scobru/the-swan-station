// Tasks module - Task management, generation, and system functionality

// Task system state
let activeTasks = [];
let taskTypes = {
  EMERGENCY: {
    REACTOR_CRITICAL: {
      name: "REACTOR CRITICAL",
      difficulty: 10,
      timeLimit: 300000, // 5 minutes
      description:
        "Reactor core temperature critical. Immediate action required.",
    },
    COOLANT_LEAK: {
      name: "COOLANT LEAK",
      difficulty: 8,
      timeLimit: 240000, // 4 minutes
      description: "Coolant system breach detected. Containment required.",
    },
    POWER_GRID_FAILURE: {
      name: "POWER GRID FAILURE",
      difficulty: 9,
      timeLimit: 180000, // 3 minutes
      description: "Primary power grid offline. Emergency systems activated.",
    },
  },
  CRITICAL: {
    PRESSURE_REGULATION: {
      name: "PRESSURE REGULATION",
      difficulty: 6,
      timeLimit: 300000, // 5 minutes
      description: "Chamber pressure unstable. Manual regulation needed.",
    },
    TEMPERATURE_CONTROL: {
      name: "TEMPERATURE CONTROL",
      difficulty: 5,
      timeLimit: 240000, // 4 minutes
      description: "Temperature fluctuations detected. Stabilization required.",
    },
    FLOW_RATE_ADJUSTMENT: {
      name: "FLOW RATE ADJUSTMENT",
      difficulty: 4,
      timeLimit: 180000, // 3 minutes
      description: "Flow rate outside parameters. Adjustment needed.",
    },
  },
  MAINTENANCE: {
    SYSTEM_CALIBRATION: {
      name: "SYSTEM CALIBRATION",
      difficulty: 3,
      timeLimit: 300000, // 5 minutes
      description: "System calibration required. Precision adjustment needed.",
    },
    FILTER_REPLACEMENT: {
      name: "FILTER REPLACEMENT",
      difficulty: 2,
      timeLimit: 240000, // 4 minutes
      description: "Filter efficiency degraded. Replacement required.",
    },
    ROUTINE_CHECK: {
      name: "ROUTINE CHECK",
      difficulty: 1,
      timeLimit: 180000, // 3 minutes
      description: "Routine system check. Verification required.",
    },
  },
};

// Show task system
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
  const refreshBtn = overlay.querySelector("#refreshTasksBtn");
  const forceBtn = overlay.querySelector("#forceTaskBtn");
  const historyBtn = overlay.querySelector("#taskHistoryBtn");
  const closeBtn = overlay.querySelector("#closeTaskSystem");

  if (refreshBtn) {
    window.core.safeAddEventListener(refreshBtn, "click", () => {
      updateTaskDisplay();
      updateTaskSystemInfo();
      window.ui.addLog("Task system refreshed", "info");
    });
  }

  if (forceBtn) {
    window.core.safeAddEventListener(forceBtn, "click", () => {
      forceNewTask();
    });
  }

  if (historyBtn) {
    window.core.safeAddEventListener(historyBtn, "click", () => {
      showTaskHistory();
    });
  }

  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }
}

// Initialize task system
function initializeTaskSystem() {
  console.log("Initializing task system...");

  if (!window.core.taskRef) {
    console.error("Task reference not available");
    return;
  }

  // Initialize station parameters in GunDB
  if (window.core.stationParamsRef) {
    window.core.stationParamsRef.once((params) => {
      if (!params) {
        window.core.stationParamsRef.put({
          lastUpdate: Date.now(),
          lastEvent: null,
        });
      }
    });

    // Listen for station parameter changes
    window.core.stationParamsRef.on((params) => {
      if (params) {
        updateStationParametersDisplay();
        checkParameterAlerts();
      }
    });
  }

  // Start real-time task synchronization
  startTaskSynchronization();

  // Start task generation
  startTaskGeneration();

  // Start task cleanup
  startTaskCleanup();

  console.log("✅ Task system initialized");
}

// Load tasks from GunDB
function loadTasksFromGunDB() {
  console.log("Loading tasks from GunDB...");

  if (!window.core.taskRef) {
    console.warn("⚠️ Task reference not available - using local tasks only");
    if (window.ui && window.ui.addLog) {
      window.ui.addLog("Loading local tasks only (offline mode)", "info");
    }
    // Load any locally stored tasks or generate new ones
    completeTaskLoading();
    return;
  }

  // Clear existing active tasks
  activeTasks = [];

  // Get current timestamp for filtering
  const currentTime = Date.now();
  const currentUser = window.core.user;
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
  const loadTimeout = window.core.safeSetTimeout(() => {
    console.warn(
      "⚠️ Task loading timeout reached, proceeding with available data"
    );
    completeTaskLoading();
  }, maxLoadTime);

  // Load tasks from GunDB with completion tracking
  const taskMap = window.core.taskRef.map();

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

      if (!task.completed && !task.failed) {
        // Load active tasks that haven't expired
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
            createdAt: task.createdAt || taskCreationTime,
            expiresAt: task.expiresAt,
            assignedTo: task.assignedTo || null,
            completed: task.completed || false,
            failed: task.failed || false,
            parameters: task.parameters || {},
            forced: task.forced || false,
          };

          activeTasks.push(validTask);
          console.log(`✅ Loaded active task: ${validTask.name}`);
        }
      }

      tasksProcessed++;
      checkCompletion();
    }
  });

  function checkCompletion() {
    if (
      tasksProcessed >= totalTasks ||
      Date.now() - loadStartTime > maxLoadTime
    ) {
      clearTimeout(loadTimeout);
      completeTaskLoading();
    }
  }
}

// Complete task loading process
function completeTaskLoading() {
  console.log(
    `✅ Task loading completed. Loaded ${activeTasks.length} active tasks`
  );

  // Remove duplicate tasks
  removeDuplicateTasks();

  // Cleanup corrupted tasks
  cleanupCorruptedTasks();

  // Update displays
  updateTaskDisplay();
  updateTaskSystemInfo();

  // Start task monitoring
  startTaskMonitoring();
}

// Remove duplicate tasks
function removeDuplicateTasks() {
  const seen = new Set();
  activeTasks = activeTasks.filter((task) => {
    const key = `${task.name}-${task.type}-${task.createdAt}`;
    if (seen.has(key)) {
      console.log(`Removing duplicate task: ${task.name}`);
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Cleanup corrupted tasks
function cleanupCorruptedTasks() {
  const currentTime = Date.now();
  activeTasks = activeTasks.filter((task) => {
    if (!task.name || !task.type || !task.expiresAt) {
      console.log(`Removing corrupted task: ${task.id}`);
      return false;
    }
    if (currentTime >= task.expiresAt) {
      console.log(`Removing expired task: ${task.name}`);
      return false;
    }
    return true;
  });
}

// Start task synchronization
function startTaskSynchronization() {
  if (!window.core.taskRef) return;

  // Listen for new tasks
  window.core.taskRef.map().on((task, id) => {
    if (task && !task.completed && !task.failed) {
      const existingTask = activeTasks.find((t) => t.id === id);
      if (!existingTask) {
        const newTask = {
          ...task,
          id,
          name: task.name || "Unknown Task",
          type: task.type || "MAINTENANCE",
          difficulty: task.difficulty || 1,
          timeLimit: task.timeLimit || 300000,
          createdAt: task.createdAt || Date.now(),
          expiresAt: task.expiresAt || Date.now() + 300000,
          assignedTo: task.assignedTo || null,
          completed: task.completed || false,
          failed: task.failed || false,
          parameters: task.parameters || {},
          forced: task.forced || false,
        };

        activeTasks.push(newTask);
        updateTaskDisplay();
        showTaskNotification(newTask);
        console.log(`🆕 New task received: ${newTask.name}`);
      }
    }
  });
}

// Start task generation
function startTaskGeneration() {
  // Generate tasks periodically
  window.core.safeSetInterval(() => {
    if (activeTasks.length < 3) {
      generateRandomTask();
    }
  }, 30000); // Every 30 seconds
}

// Generate random task
function generateRandomTask() {
  const taskType = Math.random();
  let category, taskKey;

  if (taskType < 0.2) {
    category = "EMERGENCY";
    const emergencyTasks = Object.keys(taskTypes.EMERGENCY);
    taskKey = emergencyTasks[Math.floor(Math.random() * emergencyTasks.length)];
  } else if (taskType < 0.6) {
    category = "CRITICAL";
    const criticalTasks = Object.keys(taskTypes.CRITICAL);
    taskKey = criticalTasks[Math.floor(Math.random() * criticalTasks.length)];
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
    forced: false,
  };

  if (window.core.taskRef) {
    window.core.taskRef.get(taskId).put(newTask);
  }

  activeTasks.push(newTask);
  updateTaskDisplay();
  showTaskNotification(newTask);

  console.log(`🎯 Generated new task: ${newTask.name}`);
}

// Force new task
function forceNewTask() {
  if (activeTasks.length < 3) {
    generateRandomTask();
    window.ui.addLog("Forced new task generation", "info");
  } else {
    window.ui.addLog("Maximum active tasks reached", "warning");
  }
}

// Generate task parameters
function generateTaskParameters(category, taskKey) {
  const baseParams = {
    temperature: Math.random() * 100,
    pressure: Math.random() * 50,
    flowRate: Math.random() * 200,
    efficiency: Math.random() * 100,
  };

  // Add category-specific parameters
  switch (category) {
    case "EMERGENCY":
      baseParams.criticalLevel = Math.random() * 10;
      baseParams.containmentRequired = Math.random() > 0.5;
      break;
    case "CRITICAL":
      baseParams.stabilityIndex = Math.random() * 100;
      baseParams.tolerance = Math.random() * 20;
      break;
    case "MAINTENANCE":
      baseParams.wearLevel = Math.random() * 100;
      baseParams.optimizationTarget = Math.random() * 100;
      break;
  }

  return baseParams;
}

// Update task display
function updateTaskDisplay() {
  const taskDisplay = document.getElementById("taskDisplay");
  if (!taskDisplay) return;

  if (activeTasks.length === 0) {
    taskDisplay.innerHTML = '<div class="no-tasks">No active tasks</div>';
    return;
  }

  taskDisplay.innerHTML = "";

  activeTasks.forEach((task) => {
    const taskElement = document.createElement("div");
    taskElement.className = `task-item ${task.type.toLowerCase()}`;

    const timeRemaining = Math.max(0, task.expiresAt - Date.now());
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);

    taskElement.innerHTML = `
      <div class="task-header">
        <span class="task-name">${task.name}</span>
        <span class="task-type">${task.type}</span>
      </div>
      <div class="task-details">
        <span class="task-difficulty">Difficulty: ${task.difficulty}/10</span>
        <span class="task-time">Time: ${minutes}:${seconds
      .toString()
      .padStart(2, "0")}</span>
      </div>
      <div class="task-description">${
        taskTypes[task.type][task.name]?.description ||
        "Task description not available"
      }</div>
      <div class="task-actions">
        ${
          task.assignedTo
            ? `<button class="task-btn complete" data-task-id="${task.id}">COMPLETE</button>`
            : `<button class="task-btn accept" data-task-id="${task.id}">ACCEPT</button>`
        }
      </div>
    `;

    // Add event listeners
    const acceptBtn = taskElement.querySelector(".task-btn.accept");
    const completeBtn = taskElement.querySelector(".task-btn.complete");

    if (acceptBtn) {
      window.core.safeAddEventListener(acceptBtn, "click", () => {
        acceptTask(task.id);
      });
    }

    if (completeBtn) {
      window.core.safeAddEventListener(completeBtn, "click", () => {
        completeTask(task.id);
      });
    }

    taskDisplay.appendChild(taskElement);
  });
}

// Update task system info
function updateTaskSystemInfo() {
  const activeTaskCount = document.getElementById("activeTaskCount");
  const completedToday = document.getElementById("completedToday");
  const successRate = document.getElementById("successRate");
  const lastEvent = document.getElementById("lastEvent");

  if (activeTaskCount) activeTaskCount.textContent = activeTasks.length;
  if (completedToday) completedToday.textContent = "0"; // TODO: Implement tracking
  if (successRate) successRate.textContent = "0%"; // TODO: Implement tracking
  if (lastEvent) lastEvent.textContent = "None"; // TODO: Implement tracking
}

// Update station parameters display
function updateStationParametersDisplay() {
  const paramsDisplay = document.getElementById("stationParamsDisplay");
  if (!paramsDisplay) return;

  // Mock station parameters for now
  const params = {
    temperature: Math.floor(Math.random() * 100),
    pressure: Math.floor(Math.random() * 50),
    flowRate: Math.floor(Math.random() * 200),
    efficiency: Math.floor(Math.random() * 100),
  };

  paramsDisplay.innerHTML = `
    <div class="param-item">
      <span class="param-label">Temperature:</span>
      <span class="param-value">${params.temperature}°C</span>
    </div>
    <div class="param-item">
      <span class="param-label">Pressure:</span>
      <span class="param-value">${params.pressure} kPa</span>
    </div>
    <div class="param-item">
      <span class="param-label">Flow Rate:</span>
      <span class="param-value">${params.flowRate} L/min</span>
    </div>
    <div class="param-item">
      <span class="param-label">Efficiency:</span>
      <span class="param-value">${params.efficiency}%</span>
    </div>
  `;
}

// Accept task
function acceptTask(taskId) {
  const task = activeTasks.find((t) => t.id === taskId);
  if (!task) return;

  const currentUser = window.core.user;
  if (!currentUser) {
    window.ui.addLog("Must be logged in to accept tasks", "error");
    return;
  }

  task.assignedTo = currentUser.alias;

  if (window.core.taskRef) {
    window.core.taskRef.get(taskId).put(task);
  }

  updateTaskDisplay();
  window.ui.addLog(`Task "${task.name}" accepted`, "success");
}

// Complete task
function completeTask(taskId) {
  const task = activeTasks.find((t) => t.id === taskId);
  if (!task) return;

  const currentUser = window.core.user;
  if (!currentUser || task.assignedTo !== currentUser.alias) {
    window.ui.addLog("You can only complete tasks assigned to you", "error");
    return;
  }

  const success = calculateTaskSuccess(task);

  if (success) {
    task.completed = true;
    awardTaskPoints(task.difficulty * 10);
    applyTaskEffects(task);
    window.ui.addLog(`Task "${task.name}" completed successfully!`, "success");
  } else {
    task.failed = true;
    applyTaskFailureEffects(task);
    window.ui.addLog(`Task "${task.name}" failed!`, "error");
  }

  if (window.core.taskRef) {
    window.core.taskRef.get(taskId).put(task);
  }

  // Remove from active tasks
  activeTasks = activeTasks.filter((t) => t.id !== taskId);
  updateTaskDisplay();
  updateTaskSystemInfo();
}

// Calculate task success
function calculateTaskSuccess(task) {
  const timeRemaining = task.expiresAt - Date.now();
  const timeFactor = Math.max(0, timeRemaining / task.timeLimit);
  const difficultyFactor = (11 - task.difficulty) / 10;
  const randomFactor = Math.random();

  const successChance =
    timeFactor * 0.4 + difficultyFactor * 0.3 + randomFactor * 0.3;
  return successChance > 0.5;
}

// Award task points
function awardTaskPoints(points) {
  const currentUser = window.core.user;
  if (!currentUser) return;

  // Use unified points update function if available
  if (window.updateUserPoints) {
    window.updateUserPoints(points, "task completion");
  } else {
    // Fallback to old method
    currentUser.points = (currentUser.points || 0) + points;

    if (window.core.gun) {
      window.core.gun.user().get("points").put(currentUser.points);
      window.core.gun
        .get("leaderboard")
        .get(currentUser.alias)
        .put({
          points: currentUser.points,
          level: currentUser.level || 1,
        });
    }
  }

  window.ui.addLog(`Awarded ${points} points!`, "success");
}

// Apply task effects
function applyTaskEffects(task) {
  // Apply positive effects based on task type
  switch (task.type) {
    case "EMERGENCY":
      window.ui.addLog(
        "Emergency resolved. Station stability improved.",
        "success"
      );
      break;
    case "CRITICAL":
      window.ui.addLog(
        "Critical system stabilized. Performance optimized.",
        "success"
      );
      break;
    case "MAINTENANCE":
      window.ui.addLog(
        "Maintenance completed. System efficiency increased.",
        "success"
      );
      break;
  }
}

// Apply task failure effects
function applyTaskFailureEffects(task) {
  // Apply negative effects based on task type
  switch (task.type) {
    case "EMERGENCY":
      window.ui.addLog(
        "Emergency failed! Station stability compromised.",
        "error"
      );
      break;
    case "CRITICAL":
      window.ui.addLog(
        "Critical failure! System performance degraded.",
        "error"
      );
      break;
    case "MAINTENANCE":
      window.ui.addLog(
        "Maintenance failed! System efficiency decreased.",
        "error"
      );
      break;
  }
}

// Show task notification
function showTaskNotification(task) {
  const notification = document.createElement("div");
  notification.className = `task-notification ${task.type.toLowerCase()}`;
  notification.innerHTML = `
    <div class="notification-content">
      <h4>NEW TASK: ${task.name}</h4>
      <p>${
        taskTypes[task.type][task.name]?.description ||
        "Task description not available"
      }</p>
      <button class="notification-btn" onclick="this.parentElement.parentElement.remove()">DISMISS</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-remove after 10 seconds
  window.core.safeSetTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}

// Show task history
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
      </div>
      <div class="task-history-list" id="taskHistoryList">
        Loading history...
      </div>
      <div class="button" id="closeTaskHistory">CLOSE</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Load task history
  loadTaskHistory();

  // Setup event listeners
  const closeBtn = overlay.querySelector("#closeTaskHistory");
  const filterBtns = overlay.querySelectorAll(".filter-btn");

  if (closeBtn) {
    window.core.safeAddEventListener(closeBtn, "click", () => overlay.remove());
  }

  filterBtns.forEach((btn) => {
    window.core.safeAddEventListener(btn, "click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.getAttribute("data-filter");
      displayTaskHistory([], filter); // TODO: Implement actual history
    });
  });
}

// Load task history
function loadTaskHistory() {
  const historyList = document.getElementById("taskHistoryList");
  if (!historyList) return;

  // TODO: Implement actual history loading from GunDB
  historyList.innerHTML =
    '<div class="no-history">No task history available</div>';
}

// Display task history
function displayTaskHistory(tasks, filter) {
  const historyList = document.getElementById("taskHistoryList");
  if (!historyList) return;

  // TODO: Implement actual history display
  historyList.innerHTML =
    '<div class="no-history">No task history available</div>';
}

// Start task monitoring
function startTaskMonitoring() {
  // Monitor task expiration
  window.core.safeSetInterval(() => {
    const currentTime = Date.now();
    activeTasks = activeTasks.filter((task) => {
      if (currentTime >= task.expiresAt && !task.completed && !task.failed) {
        task.failed = true;
        if (window.core.taskRef) {
          window.core.taskRef.get(task.id).put(task);
        }
        window.ui.addLog(`Task "${task.name}" expired!`, "error");
        return false;
      }
      return true;
    });

    if (activeTasks.length < 3) {
      updateTaskDisplay();
    }
  }, 5000); // Check every 5 seconds
}

// Start task cleanup
function startTaskCleanup() {
  // Cleanup expired tasks periodically
  window.core.safeSetInterval(() => {
    const currentTime = Date.now();
    activeTasks = activeTasks.filter((task) => {
      return currentTime < task.expiresAt || task.completed || task.failed;
    });
    updateTaskDisplay();
  }, 60000); // Every minute
}

// Check parameter alerts
function checkParameterAlerts() {
  // TODO: Implement parameter alert checking
  console.log("Checking parameter alerts...");
}

// Export tasks functions
window.tasks = {
  showTaskSystem,
  initializeTaskSystem,
  loadTasksFromGunDB,
  completeTaskLoading,
  removeDuplicateTasks,
  cleanupCorruptedTasks,
  startTaskSynchronization,
  startTaskGeneration,
  generateRandomTask,
  forceNewTask,
  generateTaskParameters,
  updateTaskDisplay,
  updateTaskSystemInfo,
  updateStationParametersDisplay,
  acceptTask,
  completeTask,
  calculateTaskSuccess,
  awardTaskPoints,
  applyTaskEffects,
  applyTaskFailureEffects,
  showTaskNotification,
  showTaskHistory,
  loadTaskHistory,
  displayTaskHistory,
  startTaskMonitoring,
  startTaskCleanup,
  checkParameterAlerts,
  taskTypes,
  activeTasks,
};
