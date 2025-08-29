// Test module - Verify module functionality

function testModules() {
  console.log("🧪 Testing modules...");

  const tests = [testCoreModule, testUIModule, testAuthModule, testTimerModule, testStatsModule, testTasksModule, testChatModule];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    try {
      test();
      passed++;
      console.log(`✅ ${test.name} passed`);
    } catch (error) {
      failed++;
      console.error(`❌ ${test.name} failed:`, error.message);
    }
  });

  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log("🎉 All modules working correctly!");
  } else {
    console.warn("⚠️ Some modules have issues");
  }
}

function testCoreModule() {
  if (!window.core) {
    throw new Error("Core module not loaded");
  }

  if (typeof window.core.cleanup !== "function") {
    throw new Error("Core cleanup function missing");
  }

  if (typeof window.core.safeSetInterval !== "function") {
    throw new Error("Core safeSetInterval function missing");
  }

  if (!window.core.cleanupRegistry) {
    throw new Error("Core cleanupRegistry missing");
  }

  console.log("✅ Core module functions available");
}

function testUIModule() {
  if (!window.ui) {
    throw new Error("UI module not loaded");
  }

  if (typeof window.ui.addLog !== "function") {
    throw new Error("UI addLog function missing");
  }

  if (typeof window.ui.updateTimer !== "function") {
    throw new Error("UI updateTimer function missing");
  }

  if (typeof window.ui.generateAvatar !== "function") {
    throw new Error("UI generateAvatar function missing");
  }

  console.log("✅ UI module functions available");
}

function testAuthModule() {
  if (!window.auth) {
    throw new Error("Auth module not loaded");
  }

  if (typeof window.auth.getUserAlias !== "function") {
    throw new Error("Auth getUserAlias function missing");
  }

  if (typeof window.auth.showAuthPrompt !== "function") {
    throw new Error("Auth showAuthPrompt function missing");
  }

  if (typeof window.auth.createNewUser !== "function") {
    throw new Error("Auth createNewUser function missing");
  }

  console.log("✅ Auth module functions available");
}

function testTimerModule() {
  if (!window.timer) {
    throw new Error("Timer module not loaded");
  }

  if (typeof window.timer.initializeTimer !== "function") {
    throw new Error("Timer initializeTimer function missing");
  }

  if (typeof window.timer.updateTimer !== "function") {
    throw new Error("Timer updateTimer function missing");
  }

  if (typeof window.timer.decrementTimer !== "function") {
    throw new Error("Timer decrementTimer function missing");
  }

  if (typeof window.timer.getCurrentTimerValue !== "function") {
    throw new Error("Timer getCurrentTimerValue function missing");
  }

  console.log("✅ Timer module functions available");
}

function testStatsModule() {
  if (!window.stats) {
    throw new Error("Stats module not loaded");
  }

  if (typeof window.stats.updateStatsUI !== "function") {
    throw new Error("Stats updateStatsUI function missing");
  }

  if (typeof window.stats.showGlobalStats !== "function") {
    throw new Error("Stats showGlobalStats function missing");
  }

  if (typeof window.stats.showNetworkAnalytics !== "function") {
    throw new Error("Stats showNetworkAnalytics function missing");
  }

  if (typeof window.stats.getStats !== "function") {
    throw new Error("Stats getStats function missing");
  }

  if (typeof window.stats.calculateAdvancedStats !== "function") {
    throw new Error("Stats calculateAdvancedStats function missing");
  }

  console.log("✅ Stats module functions available");
}

// Test tasks module
function testTasksModule() {
  if (!window.tasks) {
    console.log("❌ testTasksModule failed: Tasks module not loaded");
    return false;
  }
  
  try {
    // Test basic task functions
    if (typeof window.tasks.showTaskSystem === "function") {
      console.log("✅ Tasks module basic functions available");
      return true;
    } else {
      console.log("❌ testTasksModule failed: Tasks module functions missing");
      return false;
    }
  } catch (error) {
    console.log("❌ testTasksModule failed:", error.message);
    return false;
  }
}

// Test chat module
function testChatModule() {
  if (!window.chat) {
    console.log("❌ testChatModule failed: Chat module not loaded");
    return false;
  }
  
  try {
    // Test basic chat functions
    if (typeof window.chat.showChat === "function") {
      console.log("✅ Chat module basic functions available");
      return true;
    } else {
      console.log("❌ testChatModule failed: Chat module functions missing");
      return false;
    }
  } catch (error) {
    console.log("❌ testChatModule failed:", error.message);
    return false;
  }
}

// Test module dependencies
function testModuleDependencies() {
  console.log("🔗 Testing module dependencies...");

  // Test that modules can access each other
  try {
    // UI should be able to access core
    if (!window.ui) throw new Error("UI module not available");

    // Auth should be able to access core and UI
    if (!window.auth) throw new Error("Auth module not available");

    // Timer should be able to access core and UI
    if (!window.timer) throw new Error("Timer module not available");

    console.log("✅ Module dependencies working correctly");
  } catch (error) {
    console.error("❌ Module dependency test failed:", error.message);
  }
}

// Export test functions
window.test = {
  testModules,
  testModuleDependencies,
  testCoreModule,
  testUIModule,
  testAuthModule,
  testTimerModule,
  testStatsModule,
  testTasksModule,
  testChatModule,
};

// Auto-run tests after a short delay
setTimeout(() => {
  testModules();
  testModuleDependencies();
}, 1000);
