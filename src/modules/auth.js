// Auth module - User authentication, profile management, and user-related functions

// Get user alias from public key
async function getUserAlias(userPub) {
  if (!userPub || !window.core.gun) return null;

  try {
    return new Promise((resolve) => {
      window.core.gun
        .user(userPub)
        .get("alias")
        .once((alias) => {
          resolve(alias || null);
        });
    });
  } catch (error) {
    console.warn("Failed to get user alias:", error);
    return null;
  }
}

// Show authentication prompt
function showAuthPrompt() {
  const container = document.querySelector(".container");
  if (!container) return;

  // Clear existing content
  container.innerHTML = "";

  const authDiv = document.createElement("div");
  authDiv.className = "auth-prompt";
  authDiv.innerHTML = `
    <h2>SWAN STATION ACCESS</h2>
    <p>Enter your operator name to continue:</p>
    <input type="text" id="authInput" placeholder="Operator Name" class="auth-input">
    <button id="authSubmit" class="auth-button">[ ENTER STATION ]</button>
    <button id="authSignup" class="auth-button">[ NEW OPERATOR ]</button>
  `;

  container.appendChild(authDiv);

  const input = document.getElementById("authInput");
  const submitBtn = document.getElementById("authSubmit");
  const signupBtn = document.getElementById("authSignup");

  if (input) input.focus();

  const performLogin = async () => {
    const alias = input.value.trim();
    if (!alias) {
      window.ui.addLog("Please enter an operator name", "error");
      return;
    }

    try {
      window.ui.addLog(`Authenticating operator: ${alias}`, "info");

      // Try to find existing user
      const existingUser = await findUserByAlias(alias);

      if (existingUser) {
        window.ui.addLog(`Welcome back, ${alias}!`, "success");
        window.core.setUser(existingUser);
        startApp(alias);
      } else {
        window.ui.addLog(
          `Operator ${alias} not found. Please sign up.`,
          "error"
        );
      }
    } catch (error) {
      window.ui.addLog(`Authentication failed: ${error.message}`, "error");
    }
  };

  const performSignup = async () => {
    const alias = input.value.trim();
    if (!alias) {
      window.ui.addLog("Please enter an operator name", "error");
      return;
    }

    if (alias.length < 3) {
      window.ui.addLog("Operator name must be at least 3 characters", "error");
      return;
    }

    try {
      window.ui.addLog(`Creating new operator: ${alias}`, "info");

      // Check if alias already exists
      const existingUser = await findUserByAlias(alias);
      if (existingUser) {
        window.ui.addLog(
          `Operator ${alias} already exists. Please choose another name.`,
          "error"
        );
        return;
      }

      // Create new user
      const newUser = await createNewUser(alias);
      if (newUser) {
        window.ui.addLog(`Operator ${alias} created successfully!`, "success");
        window.core.setUser(newUser);
        startApp(alias);
      } else {
        window.ui.addLog("Failed to create operator", "error");
      }
    } catch (error) {
      window.ui.addLog(`Signup failed: ${error.message}`, "error");
    }
  };

  if (submitBtn) {
    window.core.safeAddEventListener(submitBtn, "click", performLogin);
    window.core.safeAddEventListener(input, "keypress", (e) => {
      if (e.key === "Enter") performLogin();
    });
  }

  if (signupBtn) {
    window.core.safeAddEventListener(signupBtn, "click", performSignup);
  }
}

// Find user by alias
async function findUserByAlias(alias) {
  if (!window.core.gun || !alias) return null;

  return new Promise((resolve) => {
    window.core.gun
      .get("users")
      .map()
      .once((user, pub) => {
        if (user && user.alias === alias) {
          resolve({ ...user, pub });
        }
      });

    // Timeout after 5 seconds
    setTimeout(() => resolve(null), 5000);
  });
}

// Create new user
async function createNewUser(alias) {
  if (!window.core.gun || !alias) return null;

  try {
    const user = window.core.gun.user();
    const pub = user.is.pub;

    // Set user data
    user.get("alias").put(alias);
    user.get("created").put(Date.now());
    user.get("lastSeen").put(Date.now());
    user.get("points").put(0);
    user.get("level").put(1);

    // Store in users collection
    window.core.gun.get("users").get(pub).put({
      alias,
      created: Date.now(),
      lastSeen: Date.now(),
      points: 0,
      level: 1,
    });

    return {
      alias,
      pub,
      created: Date.now(),
      lastSeen: Date.now(),
      points: 0,
      level: 1,
    };
  } catch (error) {
    console.error("Failed to create user:", error);
    return null;
  }
}

// Register operator (legacy function)
function registerOperator(name) {
  if (!name || !window.core.gun) return;

  try {
    const user = window.core.gun.user();
    const pub = user.is.pub;

    user.get("alias").put(name);
    user.get("created").put(Date.now());
    user.get("lastSeen").put(Date.now());
    user.get("points").put(0);
    user.get("level").put(1);

    window.core.gun.get("users").get(pub).put({
      alias: name,
      created: Date.now(),
      lastSeen: Date.now(),
      points: 0,
      level: 1,
    });

    window.ui.addLog(`Operator ${name} registered successfully!`, "success");
  } catch (error) {
    window.ui.addLog(`Failed to register operator: ${error.message}`, "error");
  }
}

// Show user profile
function showProfile() {
  if (!window.core.user) {
    window.ui.addLog("No user logged in", "error");
    return;
  }

  const container = document.querySelector(".container");
  if (!container) return;

  container.innerHTML = `
    <div class="profile-section">
      <h2>OPERATOR PROFILE</h2>
      <div class="profile-info">
        <p><strong>Name:</strong> ${window.core.user.alias || "Unknown"}</p>
        <p><strong>Level:</strong> ${window.core.user.level || 1}</p>
        <p><strong>Points:</strong> ${window.core.user.points || 0}</p>
        <p><strong>Created:</strong> ${new Date(
          window.core.user.created || Date.now()
        ).toLocaleDateString()}</p>
        <p><strong>Last Seen:</strong> ${new Date(
          window.core.user.lastSeen || Date.now()
        ).toLocaleString()}</p>
      </div>
      <button id="backToMain" class="profile-button">[ BACK TO STATION ]</button>
    </div>
  `;

  const backBtn = document.getElementById("backToMain");
  if (backBtn) {
    window.core.safeAddEventListener(backBtn, "click", () => {
      startApp(window.core.user.alias);
    });
  }
}

// Get level from points
function getLevelFromPoints(points) {
  let level = 1;
  for (const lvl in window.stats.levels) {
    if (points >= window.stats.levels[lvl]) {
      level = parseInt(lvl, 10);
    } else {
      break;
    }
  }
  return level;
}

// Export auth functions
window.auth = {
  getUserAlias,
  showAuthPrompt,
  findUserByAlias,
  createNewUser,
  registerOperator,
  showProfile,
  getLevelFromPoints,
};
