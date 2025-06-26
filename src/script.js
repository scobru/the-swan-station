/*

JavaScript for The Swan Station website.

Copyright 2013-2014 The Swan Station.
Created and maintained by Nathan Johnson.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

Not affiliated with ABC, Touchstone Television, or Bad Robot Productions.
All trademarks and copyrights are retained by their respective owners.

A huge thanks to Scott Schiller for his excellent cross-browser audio plugin SoundManager2
http://www.schillmania.com/projects/soundmanager2/

*/

var Swan = {};

// Define global variables

var pageLoaded = false;
var activeStatusMsg = false;
var activeLockdown = false;
var currentPage = "home";
var currentPageType = "computer";
var lastPage = [];
var randomSec = Math.floor(Math.random()*60);
var firstLoad = true;
var idleSecs = 0;
var pageRequests = [];
var currentLevel;
var originalTitle = window.document.title;
var titleChangerInterval;
var titleChangerTimeout;
var oneMinuteAlert = false;

var timerInterval;
var timerSyncInterval;
var timerResetWaiting;
var statusMsgTypingTimeout;
var screenDurTimeout;
var chatInterval;
var chatNotOnPageInterval;
var chatPlayedSound = false;
var newMessages = 0;
var activeLockdown = false;

var hundred = 0;
var ten = 0;
var one = 0;
var tenth = 0;
var hundredth = 0;
var minutes;

var windowWidth = $(window).width();
var windowHeight = $(window).height();

var onlineListVisible = true;
var currentLevel = 0;
var timerSeconds = false;

// Make functions globally accessible
var sendMessage;
var updateGameStats;

// Define DOM elements
const elements = {
    screens: {
        auth: document.getElementById('auth-container'),
        game: document.getElementById('game-container'),
        about: document.getElementById('about-screen'),
        faq: document.getElementById('faq-screen'),
        profile: document.getElementById('profile-screen'),
        systemFailure: document.getElementById('system-failure'),
        lockdown: document.getElementById('lockdown')
    },
    nav: {
        items: Array.from(document.querySelectorAll('.nav-item')),
        soundToggle: document.getElementById('sound-toggle')
    },
    auth: {
        username: document.getElementById('username'),
        password: document.getElementById('password'),
        loginBtn: document.getElementById('login-button'),
        registerBtn: document.getElementById('register-button')
    },
    game: {
        timer: document.getElementById('timer-display'),
        codeInput: document.getElementById('code-input'),
        userDisplay: document.getElementById('user-display'),
        userPoints: document.getElementById('user-points'),
        levelInfo: document.getElementById('level-info'),
        onlineCounter: document.getElementById('online-counter'),
        currentRecord: document.getElementById('current-record'),
        lastResetBy: document.getElementById('last-reset-by'),
        systemFailures: document.getElementById('system-failures'),
        totalResets: document.getElementById('total-resets'),
        consecutiveResets: document.getElementById('consecutive-resets'),
        chatInput: document.getElementById('chat-input'),
        chatSend: document.getElementById('chat-send')
    },
    chat: {
        container: document.getElementById('chat-messages'),
        input: document.getElementById('chat-input'),
        sendBtn: document.getElementById('chat-send')
    },
    profile: {
        pic: document.getElementById('profile-pic'),
        username: document.getElementById('profile-username'),
        level: document.getElementById('profile-level'),
        points: document.getElementById('profile-points'),
        resets: document.getElementById('profile-resets'),
        time: document.getElementById('profile-time')
    }
};

// Modify preload function to handle missing assets and callbacks gracefully
function preload(images, callback) {
    if (!Array.isArray(images)) {
        console.warn('Preload: images parameter must be an array');
        if (typeof callback === 'function') callback();
        return;
    }
    
    var loaded = 0;
    var total = images.length;
    
    if (total === 0) {
        if (typeof callback === 'function') callback();
        return;
    }
    
    function onLoadOrError() {
        loaded++;
        if (loaded === total && typeof callback === 'function') {
            callback();
        }
    }
    
    for (var i = 0; i < total; i++) {
        var img = new Image();
        img.onload = onLoadOrError;
        img.onerror = function(e) {
            console.warn('Failed to load image:', e.target.src);
            onLoadOrError();
        };
        img.src = images[i];
    }
}

// Modify showScreen function to use proper screen IDs
function showScreen(screenName) {
    const validScreens = ['auth', 'game', 'about', 'faq', 'profile', 'systemFailure', 'lockdown'];
    
    if (!validScreens.includes(screenName)) {
        console.warn(`Invalid screen name: "${screenName}"`);
        screenName = 'auth'; // Default to auth screen
    }
    
    // Hide all screens first
    Object.entries(elements.screens).forEach(([key, screen]) => {
        if (screen) {
            screen.style.display = 'none';
        }
    });
    
    // Show the requested screen if it exists
    const targetScreen = elements.screens[screenName];
    if (targetScreen) {
        targetScreen.style.display = 'flex';
        currentScreen = screenName;
    } else {
        console.warn(`Screen "${screenName}" not found`);
        // Show auth screen as fallback
        if (elements.screens.auth) {
            elements.screens.auth.style.display = 'flex';
            currentScreen = 'auth';
        }
    }
    
    // Update navigation items
    elements.nav.items.forEach(item => {
        if (item && item.dataset && item.dataset.screen === screenName) {
            item.classList.add('active');
        } else if (item) {
            item.classList.remove('active');
        }
    });
}

// Modify updateGameStats function to handle the game state properly
function updateGameStats(stats) {
    console.log('Updating game stats:', stats);
    if (!stats) return;
    
    // Update timer end time
    if (stats.endTime) {
        const remaining = stats.endTime - Date.now();
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        if (elements.game.timer) {
            elements.game.timer.textContent = `${minutes.toString().padStart(3, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // Update last reset information
    if (stats.lastResetBy) {
        const lastResetByElement = document.getElementById('last-reset-by');
        if (lastResetByElement) {
            lastResetByElement.textContent = stats.lastResetBy;
        }
    }
    
    // Handle system failure state
    if (stats.failed) {
        showScreen('systemFailure');
    }
    
    // Update points if available
    if (typeof stats.points === 'number') {
        if (elements.game.userPoints) {
            elements.game.userPoints.textContent = stats.points;
        }
    }
}

// Initialize the application
$(function() {
    // Start with auth screen
    showScreen('auth');
    
    // Add event listeners for auth buttons
    if (elements.auth.registerBtn) {
        elements.auth.registerBtn.addEventListener('click', register);
    }
    
    if (elements.auth.loginBtn) {
        elements.auth.loginBtn.addEventListener('click', login);
    }
    
    // Add event listener for code input Enter key
    if (elements.game.codeInput) {
        elements.game.codeInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitCode();
            }
        });
    }
    
    // Initialize GUN.js
    gun.on('auth', function() {
        if (user.is) {
            initializeGame();
        }
    });
});

// Add submitCode function
function submitCode() {
    const codeInput = elements.game.codeInput;
    if (!codeInput) return;
    
    const code = codeInput.value.trim();
    const expectedCode = "4 8 15 16 23 42";
    
    if (code === expectedCode) {
        // Reset timer and clear input
        resetTimer();
        codeInput.value = '';
        
        // Log successful reset
        addSystemLog('Code accepted. Timer reset.', LOG_TYPES.SUCCESS);
        addStationHistory('Code accepted and timer reset successfully.', HISTORY_TYPES.RESET);
    } else {
        // Log failed attempt
        addSystemLog('Invalid code. Please try again.', LOG_TYPES.ERROR);
        addStationHistory('Invalid code attempt.', HISTORY_TYPES.ERROR);
    }
}

// Constants
const LEVELS = {
  1: { points: 5, features: ['Base game access'] },
  2: { points: 30, features: ['Profile customization'] },
  3: { points: 80, features: ['Private messaging'] },
  4: { points: 130, features: ['Custom status'] },
  5: { points: 250, features: ['Profile badges'] },
  6: { points: 350, features: ['Extended chat history'] },
  7: { points: 500, features: ['Custom chat colors'] },
  8: { points: 700, features: ['View station logs'] },
  9: { points: 900, features: ['Custom sound effects'] },
  10: { points: 1125, features: ['Blast door map access'] },
  // ... altri livelli ...
  25: { points: 7500, features: ['All features unlocked'] }
};

const FAQ_ITEMS = [
  {
    question: 'What is the purpose of this website?',
    answer: 'This website is a simulator of the Swan Station (a.k.a. "the Hatch") from ABC\'s Lost TV series (2004-2010). It\'s a game made for Lost fans!'
  },
  {
    question: 'What is the code to enter?',
    answer: 'The code you have to enter to reset the timer is 4 8 15 16 23 42 (including spaces).'
  },
  // ... altri FAQ items ...
];

// GunDB Setup
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
const user = gun.user();
const chat = gun.get('swan-chat');
const gameState = gun.get('swan-game');
const profiles = gun.get('swan-profiles');
const chatMessages = gun.get('swan-chat-messages');

// Audio Setup
const sounds = {
  siren: new Audio('assets/siren.mp3'),
  type: new Audio('assets/type.mp3'),
  reset: new Audio('assets/reset.mp3'),
  tick: new Audio('assets/tick.mp3')
};

let soundEnabled = true;
let currentScreen = 'home';
let currentUserPoints = 0;
let consecutiveResets = 0;
let lastLockdown = 0;

// Sistema di Log
const LOG_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success'
};

const SYSTEM_MESSAGES = {
  EARLY_CODE: "WARNING: Code input detected outside of critical window. Please wait for 4-minute warning.",
  INVALID_CODE: "ERROR: Invalid code sequence. Please verify and try again.",
  VALID_CODE: "Code accepted. Resetting electromagnetic buildup...",
  TIMER_WARNING: "WARNING: 4 minutes remaining. Code input required.",
  TIMER_CRITICAL: "CRITICAL: 1 minute remaining. Electromagnetic buildup reaching critical levels.",
  SYSTEM_FAILURE: "SYSTEM FAILURE: Electromagnetic containment breach detected.",
  LOCKDOWN_START: "ALERT: Station lockdown initiated. Blast doors engaging.",
  LOCKDOWN_END: "Station lockdown complete. Resuming normal operations.",
  LOGIN_SUCCESS: "User authentication successful. Welcome back.",
  CONSECUTIVE_RESET: "Multiple resets detected. Maintaining system stability.",
  SYSTEM_SYNC: "Synchronizing with other stations...",
  BUTTON_PRESS: "Code button pressed: {0}",
  TIMER_TEST: "TEST MODE: Timer set to 4 minutes",
  STATION_HISTORY: "Station history loaded",
  BUTTON_PRESS: "Code button pressed: {0}",
  TIMER_TEST: "TEST MODE: Timer set to 4 minutes",
  STATION_HISTORY: "Station history loaded",
};

// Add station history types
const HISTORY_TYPES = {
  RESET: 'reset',
  FAILURE: 'failure',
  LOCKDOWN: 'lockdown',
  BUTTON: 'button',
  SYSTEM: 'system'
};

// Add function to log station history
function addStationHistory(message, type = HISTORY_TYPES.SYSTEM) {
  const logContainer = document.getElementById('station-log-messages');
  if (!logContainer) return;

  const entry = document.createElement('div');
  entry.className = `station-log-entry ${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
  
  logContainer.insertBefore(entry, logContainer.firstChild);
  
  // Store in GUN.js for persistence
  gun.get('station-history').set({
    timestamp: Date.now(),
    message: message,
    type: type,
    user: user.is?.alias || 'System'
  });
  
  // Keep only last 100 entries in DOM
  while (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// Authentication
async function register() {
  const username = elements.auth.username.value;
  const password = elements.auth.password.value;
  
  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }
  
  if (password.length < 8) {
    alert('Password must be at least 8 characters long.');
    return;
  }
  
  try {
    // Check if user already exists
    const checkUser = await new Promise((resolve) => {
      gun.get('profiles').get(username).once((data) => {
        resolve(data);
      });
    });
    
    if (checkUser) {
      alert('Username already taken. Please choose another one.');
      return;
    }
    
    // Create new user
    await user.create(username, password);
    
    // Initialize user profile
    gun.get('profiles').get(username).put({
      points: 5,
      totalResets: 0,
      consecutiveResets: 0,
      joinDate: Date.now(),
      lastSeen: Date.now()
    });
    
    // Log in the newly created user
    await login();
  } catch (error) {
    console.error('Registration failed:', error);
    alert('Registration failed. Please try again.');
  }
}

async function login() {
  const username = elements.auth.username.value;
  const password = elements.auth.password.value;
  
  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }
  
  try {
    await user.auth(username, password);
    
    if (!user.is) {
      throw new Error('Authentication failed');
    }
    
    // Update last seen timestamp
    gun.get('profiles').get(username).get('lastSeen').put(Date.now());
    
    // Add system log
    addSystemLog(SYSTEM_MESSAGES.LOGIN_SUCCESS, LOG_TYPES.SUCCESS);
    
    // Initialize game after successful login
    initializeGame();
  } catch (error) {
    console.error('Login failed:', error);
    alert('Login failed. Please check your credentials.');
  }
}

function logout() {
  user.leave();
  showScreen('auth');
  clearInterval(timerInterval);
}

// Game Logic
function initializeGame() {
  if (!user.is) return;
  
  showScreen('game');
  addSystemLog(SYSTEM_MESSAGES.LOGIN_SUCCESS, LOG_TYPES.SUCCESS);
  elements.game.userDisplay.textContent = user.is.alias;
  
  // Add test button
  addTestButton();
  
  // Load station history
  gun.get('station-history').map().once((data, id) => {
    if (data && data.message) {
      addStationHistory(data.message, data.type);
    }
  });
  
  // Load user profile
  gun.get('profiles').get(user.is.alias).once(profile => {
    if (profile) {
      currentUserPoints = profile.points || 5;
      consecutiveResets = profile.consecutiveResets || 0;
      updateUserStats(profile);
    }
  });
  
  // Initialize timer
  gameState.on(state => {
    if (!state) return;
    
    if (state.failed) {
      showSystemFailure();
    } else {
      updateTimer(state.endTime);
      updateGameStats(state);
    }
  });
  
  // Initialize chat
  initializeChat();
  
  // Start random lockdowns
  setInterval(checkLockdown, 300000); // Check every 5 minutes
}

function updateTimer(endTime) {
  clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    window.document.title = `${minutes.toString().padStart(3, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    elements.game.timer.textContent = `${minutes.toString().padStart(3, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Avvisi basati sul tempo rimanente
    if (remaining <= 240000 && remaining > 180000 && !elements.game.timer.classList.contains('blink')) {
      // Prima volta che entriamo nella finestra dei 4 minuti
      addSystemLog(SYSTEM_MESSAGES.TIMER_WARNING, LOG_TYPES.WARNING);
      if (soundEnabled && !sounds.siren.playing) {
        sounds.siren.play();
      }
      elements.game.timer.classList.add('blink');
    }
    
    if (remaining <= 60000 && remaining > 55000) {
      // Avviso al minuto finale
      addSystemLog(SYSTEM_MESSAGES.TIMER_CRITICAL, LOG_TYPES.ERROR);
    }
    
    if (remaining === 0) {
      systemFailure();
    }
  }, 1000);
}

function resetTimer() {
  if (!user.is) return;
  
  const code = elements.game.codeInput.value.trim();
  const timeRemaining = getTimeRemaining();
  
  // Log button press attempt
  addStationHistory(`Code attempt: ${code}`, HISTORY_TYPES.BUTTON);
  
  // Controlla se siamo nella finestra dei 4 minuti
  if (timeRemaining > 240000) { // Più di 4 minuti
    addSystemLog(SYSTEM_MESSAGES.EARLY_CODE, LOG_TYPES.WARNING);
    addStationHistory('Early code attempt rejected', HISTORY_TYPES.BUTTON);
    elements.game.codeInput.classList.add('shake');
    setTimeout(() => elements.game.codeInput.classList.remove('shake'), 500);
    elements.game.codeInput.value = '';
    return;
  }
  
  // Valida il codice
  if (code !== '4 8 15 16 23 42') {
    addSystemLog(SYSTEM_MESSAGES.INVALID_CODE, LOG_TYPES.ERROR);
    addStationHistory('Invalid code entered', HISTORY_TYPES.BUTTON);
    elements.game.codeInput.classList.add('shake');
    setTimeout(() => elements.game.codeInput.classList.remove('shake'), 500);
    return;
  }
  
  // Codice corretto
  addSystemLog(SYSTEM_MESSAGES.VALID_CODE, LOG_TYPES.SUCCESS);
  addStationHistory('Timer successfully reset', HISTORY_TYPES.RESET);
  
  if (soundEnabled) {
    sounds.reset.play();
    sounds.siren.pause();
    sounds.siren.currentTime = 0;
  }
  
  elements.game.timer.classList.remove('blink');
  elements.game.codeInput.value = '';
  
  const newEndTime = Date.now() + (108 * 60 * 1000);
  gameState.put({
    endTime: newEndTime,
    lastResetBy: user.is.alias,
    failed: false
  });
  
  // Aggiorna statistiche utente
  gun.get('profiles').get(user.is.alias).once(profile => {
    const updates = {
      points: (profile.points || 5) + 1,
      totalResets: (profile.totalResets || 0) + 1,
      consecutiveResets: (profile.consecutiveResets || 0) + 1,
      lastSeen: Date.now()
    };
    
    if (updates.consecutiveResets >= 4) {
      updates.points += 1;
      updates.consecutiveResets = 0;
      addSystemLog(SYSTEM_MESSAGES.CONSECUTIVE_RESET, LOG_TYPES.SUCCESS);
    }
    
    gun.get('profiles').get(user.is.alias).put(updates);
    updateUserStats(updates);
  });
  
  addSystemLog(SYSTEM_MESSAGES.SYSTEM_SYNC);
}

function systemFailure() {
  addSystemLog(SYSTEM_MESSAGES.SYSTEM_FAILURE, LOG_TYPES.ERROR);
  addStationHistory('SYSTEM FAILURE: Electromagnetic containment breach', HISTORY_TYPES.FAILURE);
  
  gameState.put({
    failed: true,
    failures: (gameState.failures || 0) + 1
  });
  
  showSystemFailure();
}

function showSystemFailure() {
  showScreen('systemFailure');
  elements.game.systemFailures.textContent = (parseInt(elements.game.systemFailures.textContent) || 0) + 1;
  
  setTimeout(() => {
    const newEndTime = Date.now() + (108 * 60 * 1000);
    gameState.put({
      endTime: newEndTime,
      failed: false
    });
    showScreen('game');
  }, 10000);
}

// Chat System
const MAX_MESSAGES = 50;

function initializeChat() {
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const chatContainer = document.getElementById('chat-messages');

  // Gestione invio messaggio
  function sendMessage() {
    if (!user.is) return;
    const message = chatInput.value.trim();
    if (!message) return;

    const messageData = {
      text: message,
      sender: user.is.alias,
      timestamp: Date.now(),
      id: Math.random().toString(36).substring(2)
    };

    chatMessages.set(messageData);
    chatInput.value = '';
    addSystemLog(`Message sent by ${user.is.alias}`, LOG_TYPES.INFO);
  }

  // Event listeners per l'invio
  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Ascolta i nuovi messaggi
  chatMessages.map().once((message, id) => {
    if (!message || !message.text || !message.sender) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    const time = new Date(message.timestamp).toLocaleTimeString();
    
    messageElement.innerHTML = `
      <span class="chat-timestamp">[${time}]</span>
      <span class="chat-sender">${message.sender}:</span>
      <span class="chat-text">${escapeHtml(message.text)}</span>
    `;
    
    chatContainer.insertBefore(messageElement, chatContainer.firstChild);
    
    // Mantieni solo gli ultimi MAX_MESSAGES messaggi nel DOM
    while (chatContainer.children.length > MAX_MESSAGES) {
      chatContainer.removeChild(chatContainer.lastChild);
    }
  });
}

// Helper per evitare XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Profile System
function updateUserStats(profile) {
  elements.game.userPoints.textContent = profile.points;
  elements.game.totalResets.textContent = profile.totalResets;
  elements.game.consecutiveResets.textContent = profile.consecutiveResets;
  
  const level = calculateLevel(profile.points);
  elements.game.levelInfo.textContent = `Level ${level}`;
  
  if (currentScreen === 'profile') {
    updateProfileScreen(profile);
  }
}

function calculateLevel(points) {
  return Object.entries(LEVELS).reduce((currentLevel, [level, data]) => {
    return points >= data.points ? parseInt(level) : currentLevel;
  }, 1);
}

function updateProfileScreen(profile) {
  const level = calculateLevel(profile.points);
  const nextLevel = level < 25 ? LEVELS[level + 1] : null;
  
  elements.profile.username.textContent = user.is.alias;
  elements.profile.level.textContent = level;
  elements.profile.points.textContent = profile.points;
  elements.profile.resets.textContent = profile.totalResets;
  
  const timeOnStation = Math.floor((Date.now() - profile.joinDate) / (1000 * 60 * 60 * 24));
  elements.profile.time.textContent = `${timeOnStation} days`;
  
  if (nextLevel) {
    const pointsNeeded = nextLevel.points - profile.points;
    elements.profile.points.setAttribute('data-tooltip', `${pointsNeeded} points needed for Level ${level + 1}`);
  }
}

// Lockdown System
function checkLockdown() {
  const now = Date.now();
  if (now - lastLockdown < 12 * 60 * 60 * 1000) return; // 12 hours cooldown
  
  if (Math.random() < 0.1) { // 10% chance
    triggerLockdown();
  }
}

function triggerLockdown() {
  lastLockdown = Date.now();
  addSystemLog(SYSTEM_MESSAGES.LOCKDOWN_START, LOG_TYPES.WARNING);
  addStationHistory('Station lockdown initiated', HISTORY_TYPES.LOCKDOWN);
  showScreen('lockdown');
  
  setTimeout(() => {
    addSystemLog(SYSTEM_MESSAGES.LOCKDOWN_END);
    addStationHistory('Station lockdown completed', HISTORY_TYPES.LOCKDOWN);
    showScreen(currentScreen);
  }, 60000); // 1 minute lockdown
}

// Funzione helper per calcolare il tempo rimanente
function getTimeRemaining() {
  const timerText = elements.game.timer.textContent;
  const [minutes, seconds] = timerText.split(':').map(Number);
  return (minutes * 60 + seconds) * 1000;
}

// Event Listeners
$(document).ready(function() {
    // Initialize DOM elements
    const elements = {
        auth: {
            container: document.getElementById('auth-container'),
            username: document.getElementById('username'),
            password: document.getElementById('password'),
            registerBtn: document.getElementById('register-button'),
            loginBtn: document.getElementById('login-button')
        },
        nav: {
            menu: document.getElementById('nav-menu'),
            items: Array.from(document.querySelectorAll('.nav-item')),
            soundToggle: document.getElementById('sound-toggle')
        },
        game: {
            container: document.getElementById('game-container'),
            timer: document.getElementById('timer-display'),
            codeInput: document.getElementById('code-input'),
            logMessages: document.getElementById('log-messages'),
            chatInput: document.getElementById('chat-input'),
            chatSend: document.getElementById('chat-send')
        }
    };

    // Add keyboard support for login form
    if (elements.auth.password) {
        elements.auth.password.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }

    // Add event listeners only if elements exist
    if (elements.nav.soundToggle) {
        elements.nav.soundToggle.addEventListener('click', toggleSound);
    }

    if (elements.auth.registerBtn) {
  elements.auth.registerBtn.addEventListener('click', register);
    }

    if (elements.auth.loginBtn) {
  elements.auth.loginBtn.addEventListener('click', login);
    }

    if (elements.game.chatInput && elements.game.chatSend) {
        elements.game.chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
        elements.game.chatSend.addEventListener('click', sendChatMessage);
    }

    // Navigation event listeners
    elements.nav.items.forEach(item => {
        if (item) {
            item.addEventListener('click', function() {
                const screenName = this.dataset.screen;
                if (screenName) {
                    showScreen(screenName);
                }
            });
        }
    });

    // Initialize with auth screen
    showScreen('auth');
});

// Helper functions
function toggleSound() {
    if (!elements.nav.soundToggle) return;
    const soundEnabled = elements.nav.soundToggle.src.includes('sound-on.png');
    elements.nav.soundToggle.src = soundEnabled ? 'assets/sound-off.png' : 'assets/sound-on.png';
    // Additional sound toggle logic here
}

function sendChatMessage() {
    if (!elements.game.chatInput) return;
    const message = elements.game.chatInput.value.trim();
    if (message) {
        // Send message logic here
        elements.game.chatInput.value = '';
    }
}

function handleRegister() {
    if (!elements.auth.username || !elements.auth.password) return;
    const username = elements.auth.username.value.trim();
    const password = elements.auth.password.value;
    register();
}

function handleLogin() {
    if (!elements.auth.username || !elements.auth.password) return;
    const username = elements.auth.username.value.trim();
    const password = elements.auth.password.value;
    login();
}

function addSystemLog(message, type = LOG_TYPES.INFO) {
  const logContainer = document.getElementById('log-messages');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
  
  logContainer.insertBefore(entry, logContainer.firstChild);
  
  // Mantieni solo gli ultimi 50 messaggi
  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild);
  }
}



// Add test button to game screen
function addTestButton() {
  const button = document.createElement('button');
  button.id = 'test-timer-button';
  button.textContent = 'Test: Set 4 Minutes';
  button.onclick = function() {
    const newEndTime = Date.now() + (4 * 60 * 1000); // 4 minutes
    gameState.put({
      endTime: newEndTime,
      lastResetBy: user.is?.alias || 'System',
      failed: false
    });
    addSystemLog(SYSTEM_MESSAGES.TIMER_TEST, LOG_TYPES.WARNING);
    addStationHistory('Test mode activated: Timer set to 4 minutes', HISTORY_TYPES.SYSTEM);
  };
  document.body.appendChild(button);
}
