// Module loader - Handles loading and initialization of all modules

// Module loading order (dependencies first)
const MODULE_ORDER = [
  "core", // Core utilities and state
  "ui", // UI functions
  "auth", // Authentication
  "timer", // Timer functionality
  "test", // Module testing
  "stats", // Statistics and analytics
  "operators", // Operator management
  "tasks", // Task system
  "chat", // Chat functionality
  "challenges", // Challenge system
  "main", // Main application logic
];

// Module loading status
const moduleStatus = {
  loaded: new Set(),
  failed: new Set(),
  loading: new Set(),
};

// Global namespace for modules to prevent conflicts
window.swanModules = window.swanModules || {};

// Load a single module with isolation
async function loadModule(moduleName) {
  if (
    moduleStatus.loaded.has(moduleName) ||
    moduleStatus.loading.has(moduleName)
  ) {
    return;
  }

  moduleStatus.loading.add(moduleName);

  try {
    const script = document.createElement("script");
    script.src = `src/modules/${moduleName}.js`;
    script.async = false; // Load in order

    // Add module isolation wrapper
    script.setAttribute("data-module", moduleName);

    await new Promise((resolve, reject) => {
      script.onload = () => {
        // Give modules more time to initialize and be more lenient
        setTimeout(() => {
          if (window[moduleName] || window.swanModules[moduleName]) {
            resolve();
          } else {
            console.warn(
              `Module ${moduleName} not found in global scope, but continuing...`
            );
            resolve(); // Continue anyway to prevent blocking
          }
        }, 1000); // Increased timeout
      };
      script.onerror = () => {
        console.error(`Failed to load module: ${moduleName}`);
        reject(new Error(`Failed to load module: ${moduleName}`));
      };
      document.head.appendChild(script);
    });

    moduleStatus.loaded.add(moduleName);
    moduleStatus.loading.delete(moduleName);

    console.log(`✅ Module loaded: ${moduleName}`);
  } catch (error) {
    moduleStatus.failed.add(moduleName);
    moduleStatus.loading.delete(moduleName);
    console.error(`❌ Failed to load module ${moduleName}:`, error);
    // Don't throw error, just log it and continue
  }
}

// Load all modules in order
async function loadAllModules() {
  console.log("🚀 Starting module loading...");

  for (const moduleName of MODULE_ORDER) {
    try {
      await loadModule(moduleName);
      // Add small delay between modules to prevent conflicts
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Critical error loading module ${moduleName}:`, error);
      // Continue loading other modules even if one fails
    }
  }

  console.log("📦 Module loading completed");
  console.log("✅ Loaded modules:", Array.from(moduleStatus.loaded));

  if (moduleStatus.failed.size > 0) {
    console.warn("⚠️ Failed modules:", Array.from(moduleStatus.failed));
  }

  // Initialize the application after all modules are loaded
  if (window.main && window.main.initializeShogun) {
    try {
      window.main.initializeShogun();
    } catch (error) {
      console.error("❌ Failed to initialize main application:", error);

      // Retry initialization after a delay
      setTimeout(() => {
        if (window.main && window.main.initializeShogun) {
          console.log("🔄 Retrying main application initialization...");
          try {
            window.main.initializeShogun();
          } catch (retryError) {
            console.error("❌ Retry failed:", retryError);
          }
        }
      }, 2000);
    }
  } else {
    console.warn("⚠️ Main module initialization function not found");
  }
}

// Check if all required modules are loaded
function areModulesReady() {
  return MODULE_ORDER.every((module) => moduleStatus.loaded.has(module));
}

// Get module loading status
function getModuleStatus() {
  return {
    loaded: Array.from(moduleStatus.loaded),
    failed: Array.from(moduleStatus.failed),
    loading: Array.from(moduleStatus.loading),
    total: MODULE_ORDER.length,
  };
}

// Export loader functions
window.moduleLoader = {
  loadAllModules,
  loadModule,
  areModulesReady,
  getModuleStatus,
  MODULE_ORDER,
};

// Auto-start loading when this script is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadAllModules);
} else {
  loadAllModules();
}
