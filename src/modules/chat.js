// Chat module - Chat functionality, message handling, and operator communication
(function() {
  'use strict';

  // Chat state management
  let chatInitialized = false;
  let chatProcessedMessages = new Set();
  let chatMessageCount = 0;

  // Show chat interface
  function showChat() {
    // Check if chat is already open
    const existingOverlay = document.querySelector(".overlay");
    if (existingOverlay) {
      console.log("⚠️ Chat already open, focusing existing window");
      const chatInput = existingOverlay.querySelector("#chatInput");
      if (chatInput) {
        chatInput.focus();
      }
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          <h2>SHOGUN ECO - OPERATOR CHAT</h2>
          <button onclick="window.chat.closeChat()">×</button>
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
    const chatInput = overlay.querySelector("#chatInput");
    if (chatInput) {
      chatInput.focus();
    }
  }

  // Close chat and reset state
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

  // Initialize chat system
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
    if (!window.core.chatRef) {
      console.error("❌ chatRef not initialized. Chat system cannot function.");
      window.ui.addLog("ERROR: Chat system not initialized", "error");

      // Attempt to reinitialize chat reference
      if (window.core.gun && !window.core.chatRef) {
        window.core.setChatRef(window.core.gun.get("chat"));
        window.ui.addLog("Attempting to reinitialize chat reference...", "info");
        // Retry initialization after a short delay
        window.core.safeSetTimeout(() => {
          if (window.core.chatRef) {
            initializeChat();
          }
        }, 1000);
      }
      return;
    }

    console.log("✅ chatRef is initialized:", window.core.chatRef);

    // Check if user is logged in
    const currentUser = window.core.user;
    if (!currentUser) {
      console.warn("⚠️ currentUser not defined during chat initialization");
    } else {
      console.log("✅ User logged in:", currentUser.alias);
    }

    // Clear existing messages
    chatMessages.innerHTML = "";

    // Load existing messages first
    console.log("📚 Loading existing chat messages...");
    window.core.chatRef.map().once((msg, id) => {
      if (msg && msg.who && msg.what) {
        console.log("📨 Loading existing message:", { id, msg });
        displayMessage(msg, id);
        chatProcessedMessages.add(id);
        chatMessageCount++;
      }
    });

    // Listen for messages using the working GunDB pattern
    console.log("👂 Setting up chat listener using GunDB pattern...");
    window.core.chatRef.map().on((msg, id) => {
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
    window.core.safeAddEventListener(chatInput, "keypress", (e) => {
      if (e.key === "Enter" && chatInput.value.trim()) {
        console.log("📝 Chat input detected:", chatInput.value.trim());

        if (!currentUser) {
          console.error("❌ Cannot send message: currentUser not defined");
          window.ui.addLog("ERROR: Must be logged in to send messages", "error");
          return;
        }

        if (!window.core.chatRef) {
          console.error("❌ Cannot send message: chatRef not initialized");
          window.ui.addLog("ERROR: Chat system not initialized", "error");
          return;
        }

        const messageText = chatInput.value.trim();
        chatInput.value = "";

        // Create message object using the working GunDB pattern
        const msg = {
          who: currentUser.alias || "Anonymous",
          what: messageText,
          when: window.core.gun ? window.core.gun.state() : Date.now(), // Use Gun.state() for timestamp like the working example
        };

        console.log("📤 Sending message using GunDB pattern:", msg);

        // Send to GunDB using .set() like the working example
        window.core.chatRef.set(msg, (ack) => {
          if (ack && ack.err) {
            console.error("❌ Failed to send message to GunDB:", ack.err);
            window.ui.addLog("ERROR: Failed to send message", "error");
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

      if (window.core.operatorsRef) {
        window.core.operatorsRef.map().once((data, key) => {
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
              if (currentUser && data.pub === currentUser.pub) {
                li.className = "current-user";
              }
              operatorsList.appendChild(li);
              console.log(`Added operator ${data.name} to list`);
            }
          }
        });
      }
    }

    // Initial operators list update
    updateOperatorsList();

    // Periodic operators list update
    window.core.safeSetInterval(updateOperatorsList, 10000);

    // Mark as initialized
    chatInitialized = true;
    console.log("✅ Chat system initialized successfully");

    // Periodic message count update
    window.core.safeSetInterval(() => {
      const messagesStored = document.getElementById("messagesStored");
      if (messagesStored) {
        messagesStored.textContent = chatMessageCount;
      }
    }, 5000);

    // Chat connection monitoring
    window.core.safeSetInterval(() => {
      console.log("🔍 Testing chat connection...");
      if (window.core.chatRef) {
        window.core.chatRef.once((data) => {
          console.log("✅ Chat connection test completed");
        });
      }
    }, 30000);
  }

  // Display message in chat
  function displayMessage(msg, id) {
    console.log("📨 Displaying message:", { msg, id });

    if (!msg || !msg.who || !msg.what) {
      console.warn("⚠️ displayMessage: missing required fields", msg);
      return;
    }

    const chatMessages = document.getElementById("chatMessages");
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

  // Send message programmatically
  function sendMessage(messageText) {
    const currentUser = window.core.user;
    if (!currentUser) {
      console.error("❌ Cannot send message: currentUser not defined");
      window.ui.addLog("ERROR: Must be logged in to send messages", "error");
      return false;
    }

    if (!window.core.chatRef) {
      console.error("❌ Cannot send message: chatRef not initialized");
      window.ui.addLog("ERROR: Chat system not initialized", "error");
      return false;
    }

    // Create message object using the working GunDB pattern
    const msg = {
      who: currentUser.alias || "Anonymous",
      what: messageText,
      when: window.core.gun ? window.core.gun.state() : Date.now(),
    };

    console.log("📤 Sending message programmatically:", msg);

    // Send to GunDB using .set() like the working example
    window.core.chatRef.set(msg, (ack) => {
      if (ack && ack.err) {
        console.error("❌ Failed to send message to GunDB:", ack.err);
        window.ui.addLog("ERROR: Failed to send message", "error");
        return false;
      } else {
        console.log("✅ Message sent successfully to GunDB");
        chatMessageCount++;
        return true;
      }
    });

    return true;
  }

  // Get chat statistics
  function getChatStats() {
    return {
      messageCount: chatMessageCount,
      processedMessages: chatProcessedMessages.size,
      isInitialized: chatInitialized
    };
  }

  // Clear chat messages
  function clearChatMessages() {
    const chatMessages = document.getElementById("chatMessages");
    if (chatMessages) {
      chatMessages.innerHTML = "";
    }
    chatProcessedMessages.clear();
    chatMessageCount = 0;
    console.log("✅ Chat messages cleared");
  }

  // Update operators list manually
  function updateOperatorsList() {
    const operatorsList = document.getElementById("operatorsList");
    if (!operatorsList) return;

    console.log("Updating operators list...");
    operatorsList.innerHTML = "";
    const seenOperators = new Set();
    const now = Date.now();

    if (window.core.operatorsRef) {
      window.core.operatorsRef.map().once((data, key) => {
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
            const currentUser = window.core.user;
            if (currentUser && data.pub === currentUser.pub) {
              li.className = "current-user";
            }
            operatorsList.appendChild(li);
            console.log(`Added operator ${data.name} to list`);
          }
        }
      });
    }
  }

  // Check if chat is initialized
  function isChatInitialized() {
    return chatInitialized;
  }

  // Reset chat state
  function resetChatState() {
    chatInitialized = false;
    chatProcessedMessages.clear();
    chatMessageCount = 0;
    console.log("✅ Chat state reset");
  }

  // Get active operators
  function getActiveOperators() {
    return new Promise((resolve) => {
      const activeOperators = [];
      const now = Date.now();

      if (window.core.operatorsRef) {
        window.core.operatorsRef.map().once((data, key) => {
          if (data && data.name && data.lastSeen) {
            const timeSinceLastSeen = now - data.lastSeen;
            if (timeSinceLastSeen < 120000) { // 2 minutes timeout
              activeOperators.push({
                name: data.name,
                pub: key,
                lastSeen: data.lastSeen,
                timeSinceLastSeen: timeSinceLastSeen
              });
            }
          }
        });

        // Resolve after a short delay to allow GunDB to process
        window.core.safeSetTimeout(() => {
          resolve(activeOperators);
        }, 1000);
      } else {
        resolve([]);
      }
    });
  }

  // Export chat functions
  window.chat = {
    showChat,
    closeChat,
    initializeChat,
    displayMessage,
    sendMessage,
    getChatStats,
    clearChatMessages,
    updateOperatorsList,
    isChatInitialized,
    resetChatState,
    getActiveOperators
  };
})();
