<<<<<<< HEAD
// Initialize GunDB
const peers = ['https://gun-manhattan.herokuapp.com/gun'];
const gun = new Gun({ peers: peers });
const timerRef = gun.get('swan').get('timer');
const operatorsRef = gun.get('swan').get('operators');
const historyRef = gun.get('swan').get('history');
const statsRef = gun.get('swan').get('stats');
const chatRef = gun.get('swan').get('chat');
const user = gun.user();

// Audio setup - preload sounds
const siren = new Audio('assets/siren.mp3');
const reset = new Audio('assets/reset.mp3');
const tick = new Audio('assets/tick.mp3');
const buttonSounds = Array.from({length: 8}, (_, i) => {
    const audio = new Audio(`assets/typing_sounds/button${i+1}.mp3`);
    audio.preload = 'auto';
    return audio;
});

// DOM elements
const container = document.querySelector('.container');
const input = document.querySelector('input');
const logContainer = document.getElementById('logContainer');
const statsContainer = document.getElementById('statsContainer');
const bigTimer = document.getElementById('bigTimer');

// App state
let focusInterval = null;
let decrementInterval = null;
let currentUser = null; // Will hold alias, points, level, etc.
let stats = { failures: 0, resets: 0 };
let timer = 108; // Timer value in seconds
document.title = 'SYNCING...';

// Leveling System
const levels = {
    1: 5, 2: 30, 3: 80, 4: 130, 5: 250, 6: 350, 7: 500, 8: 700,
    9: 900, 10: 1125, 11: 1375, 12: 1650, 13: 1950, 14: 2275,
    15: 2625, 16: 3000, 17: 3400, 18: 3825, 19: 4275, 20: 4750,
    21: 5250, 22: 5775, 23: 6325, 24: 6900, 25: 7500
};

// Vintage Terminal Functions
function createVintageTerminal() {
    const vintageTerminal = document.createElement('div');
    vintageTerminal.className = 'vintage-terminal';
    vintageTerminal.id = 'vintageTerminal';
    
    vintageTerminal.innerHTML = `
        <div class="flip-clock" id="flipClock">
            <div class="flip-number">
                <div class="flip-digit" id="minutes-tens">1</div>
            </div>
            <div class="flip-number">
                <div class="flip-digit" id="minutes-ones">0</div>
            </div>
            <div class="flip-separator">
                <div class="flip-dot"></div>
                <div class="flip-dot"></div>
            </div>
            <div class="flip-number">
                <div class="flip-digit" id="seconds-tens">8</div>
            </div>
            <div class="flip-number">
                <div class="flip-digit" id="seconds-ones">0</div>
            </div>
        </div>
        
        <div class="crt-screen">
            <div class="crt-content" id="crtContent">
                <div>> DHARMA INITIATIVE STATION 3 - THE SWAN</div>
                <div>> SYSTEM STATUS: OPERATIONAL</div>
                <div>> ELECTROMAGNETIC ANOMALY DETECTED</div>
                <div>> </div>
                <div>> PROTOCOL: ENTER CODE EVERY 108 MINUTES</div>
                <div>> FAILURE TO COMPLY WILL RESULT IN SYSTEM FAILURE</div>
                <div>> </div>
                <div>> CURRENT OPERATOR: <span id="crtOperator">UNKNOWN</span></div>
                <div>> LEVEL: <span id="crtLevel">--</span> | POINTS: <span id="crtPoints">--</span></div>
                <div>> </div>
                <div id="crtInputLine">> ENTER CODE: <span id="crtInput"></span><span class="crt-cursor"></span></div>
            </div>
        </div>
        
        <div class="vintage-overlay"></div>
    `;
    
    return vintageTerminal;
}

function updateFlipClock(totalMinutes) {
    const minutes = Math.floor(totalMinutes);
    const seconds = 0; // Per semplicità, mostriamo solo i minuti
    
    const minutesTens = Math.floor(minutes / 10);
    const minutesOnes = minutes % 10;
    const secondsTens = Math.floor(seconds / 10);
    const secondsOnes = seconds % 10;
    
    // Aggiorna i flip numbers con animazione
    updateFlipDigit('minutes-tens', minutesTens);
    updateFlipDigit('minutes-ones', minutesOnes);
    updateFlipDigit('seconds-tens', secondsTens);
    updateFlipDigit('seconds-ones', secondsOnes);
    
    // Aggiorna anche il display dell'input per riflettere lo stato corrente
    updateCRTInputDisplay();
}

function updateFlipDigit(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (element && element.textContent !== newValue.toString()) {
        // Animazione flip
        element.style.transform = 'rotateX(90deg)';
        setTimeout(() => {
            element.textContent = newValue;
            element.style.transform = 'rotateX(0deg)';
        }, 150);
=======
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
var randomSec = Math.floor(Math.random() * 60);
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
    auth: document.getElementById("auth-container"),
    game: document.getElementById("game-container"),
    about: document.getElementById("about-screen"),
    faq: document.getElementById("faq-screen"),
    profile: document.getElementById("profile-screen"),
    history: document.getElementById("history-screen"),
    systemFailure: document.getElementById("system-failure"),
    lockdown: document.getElementById("lockdown"),
  },
  nav: {
    items: Array.from(document.querySelectorAll(".nav-item")),
    soundToggle: document.getElementById("sound-toggle"),
  },
  auth: {
    username: document.getElementById("username"),
    password: document.getElementById("password"),
    loginBtn: document.getElementById("login-button"),
    registerBtn: document.getElementById("register-button"),
  },
  game: {
    timer: document.getElementById("timer-display"),
    codeInput: document.getElementById("code-input"),
    userDisplay: document.getElementById("user-display"),
    userPoints: document.getElementById("user-points"),
    levelInfo: document.getElementById("level-info"),
    onlineCounter: document.getElementById("online-counter"),
    currentRecord: document.getElementById("current-record"),
    lastResetBy: document.getElementById("last-reset-by"),
    systemFailures: document.getElementById("system-failures"),
    totalResets: document.getElementById("total-resets"),
    consecutiveResets: document.getElementById("consecutive-resets"),
    chatInput: document.getElementById("chat-input"),
    chatSend: document.getElementById("chat-send"),
  },
  chat: {
    container: document.getElementById("chat-messages"),
    input: document.getElementById("chat-input"),
    sendBtn: document.getElementById("chat-send"),
  },
  profile: {
    pic: document.getElementById("profile-pic"),
    username: document.getElementById("profile-username"),
    level: document.getElementById("profile-level"),
    points: document.getElementById("profile-points"),
    resets: document.getElementById("profile-resets"),
    time: document.getElementById("profile-time"),
  },
  history: {
    container: document.getElementById("station-log-messages"),
  },
};

// Modify preload function to handle missing assets and callbacks gracefully
function preload(images, callback) {
  if (!Array.isArray(images)) {
    console.warn("Preload: images parameter must be an array");
    if (typeof callback === "function") callback();
    return;
  }

  var loaded = 0;
  var total = images.length;

  if (total === 0) {
    if (typeof callback === "function") callback();
    return;
  }

  function onLoadOrError() {
    loaded++;
    if (loaded === total && typeof callback === "function") {
      callback();
    }
  }

  for (var i = 0; i < total; i++) {
    var img = new Image();
    img.onload = onLoadOrError;
    img.onerror = function (e) {
      console.warn("Failed to load image:", e.target.src);
      onLoadOrError();
    };
    img.src = images[i];
  }
}

// Modify showScreen function to use proper screen IDs
function showScreen(screenName) {
  const validScreens = [
    "auth",
    "game",
    "about",
    "faq",
    "profile",
    "history",
    "systemFailure",
    "lockdown",
  ];

  if (!validScreens.includes(screenName)) {
    console.warn(`Invalid screen name: "${screenName}"`);
    screenName = "auth"; // Default to auth screen
  }

  // Hide all screens first
  Object.entries(elements.screens).forEach(([key, screen]) => {
    if (screen) {
      screen.style.display = "none";
    }
  });

  // Show the requested screen if it exists
  const targetScreen = elements.screens[screenName];
  if (targetScreen) {
    targetScreen.style.display = "flex";
    currentScreen = screenName;

    // Load history if showing history screen
    if (screenName === "history") {
      loadHistory();
    }
  } else {
    console.warn(`Screen "${screenName}" not found`);
    // Show auth screen as fallback
    if (elements.screens.auth) {
      elements.screens.auth.style.display = "flex";
      currentScreen = "auth";
    }
  }

  // Update navigation items
  elements.nav.items.forEach((item) => {
    if (item && item.dataset && item.dataset.screen === screenName) {
      item.classList.add("active");
    } else if (item) {
      item.classList.remove("active");
    }
  });
}

// Modify updateGameStats function to handle the game state properly
function updateGameStats(stats) {
  console.log("Updating game stats:", stats);
  if (!stats) return;

  // Update timer end time
  if (stats.endTime) {
    const remaining = stats.endTime - Date.now();
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    if (elements.game.timer) {
      elements.game.timer.textContent = `${minutes
        .toString()
        .padStart(3, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
  }

  // Update last reset information
  if (stats.lastResetBy) {
    const lastResetByElement = document.getElementById("last-reset-by");
    if (lastResetByElement) {
      lastResetByElement.textContent = stats.lastResetBy;
    }
  }

  // Handle system failure state
  if (stats.failed) {
    showScreen("systemFailure");
  }

  // Update points if available
  if (typeof stats.points === "number") {
    if (elements.game.userPoints) {
      elements.game.userPoints.textContent = stats.points;
>>>>>>> 30a2a65b7013669e6e4f7c20522b0e6e253c82ba
    }
}

<<<<<<< HEAD
function updateCRTContent() {
    if (!currentUser) return;
    
    const crtOperator = document.getElementById('crtOperator');
    const crtLevel = document.getElementById('crtLevel');
    const crtPoints = document.getElementById('crtPoints');
    
    if (crtOperator) crtOperator.textContent = currentUser.alias || 'UNKNOWN';
    if (crtLevel) crtLevel.textContent = currentUser.level || '--';
    if (crtPoints) crtPoints.textContent = currentUser.points || '--';
}

let crtInputValue = '';

function toggleVintageMode() {
    // Disattiva modalità vintage
    const container = document.querySelector('.container');
    const body = document.body;
    const inputElement = document.querySelector('.input');
    const promptElement = document.querySelector('.prompt');
    
    container.classList.remove('vintage-mode');
    
    // Mostra il timer normale e l'input box
    const bigTimer = document.getElementById('bigTimer');
    if (bigTimer) bigTimer.style.display = 'block';
    if (inputElement) inputElement.style.display = 'block';
    if (promptElement) promptElement.style.display = 'block';
    
    // Rimuovi i listener dell'input virtuale
    document.removeEventListener('keydown', handleCRTInput);
    crtInputValue = '';
    
    addLog('Standard terminal mode activated', 'info');
}

function initializeCRTInput() {
    crtInputValue = '';
    
    // Aspetta un momento per assicurarsi che il DOM sia aggiornato
    setTimeout(() => {
        updateCRTInputDisplay();
        
        // Rimuovi eventuali listener precedenti
        document.removeEventListener('keydown', handleCRTInput);
        // Aggiungi il nuovo listener
        document.addEventListener('keydown', handleCRTInput);
    }, 100);
}

function updateCRTInputDisplay() {
    const crtInputLine = document.getElementById('crtInputLine');
    if (crtInputLine) {
        if (timer > 240) {
            // Input bloccato - mostra messaggio
            crtInputLine.innerHTML = `> INPUT LOCKED - AVAILABLE IN LAST 4 MINUTES ONLY`;
        } else {
            // Input disponibile - mostra il cursore
            const displayValue = crtInputValue || '';
            crtInputLine.innerHTML = `> ENTER CODE: <span id="crtInput">${displayValue}</span><span class="crt-cursor"></span>`;
        }
    }
}

function handleCRTInput(event) {
    // Verifica se siamo in modalità vintage
    if (!currentUser) return;
    
    // Se c'è un overlay aperto, non gestire l'input
    if (document.querySelector('.overlay')) return;

    // Gestisci i tasti specifici
    if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        processCRTInput();
        return;
    }
    
    if (event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        if (crtInputValue.length > 0) {
            crtInputValue = crtInputValue.slice(0, -1);
            updateCRTInputDisplay();
            typeSound();
        }
        return;
    }
    
    // Accetta numeri e spazi
    if (event.key.length === 1 && /[0-9\s]/.test(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        
        // Max 15 caratteri (per "4 8 15 16 23 42")
        if (crtInputValue.length < 15) {
            crtInputValue += event.key;
            updateCRTInputDisplay();
            typeSound();
            // Debug temporaneo per vedere la lunghezza
            console.log(`Caratteri: ${crtInputValue.length}/15 - "${crtInputValue}"`);
        } else {
            console.log(`Limite raggiunto! Lunghezza: ${crtInputValue.length}`);
        }
        return;
    }
}

function processCRTInput() {
    const inputValue = crtInputValue.trim();
    
    if (inputValue === '4 8 15 16 23 42') {
        updateTimer(108, 'code_correct');
        
        // Increment successful resets stat
        statsRef.once(currentStats => {
            if (currentStats) {
                statsRef.put({ resets: (currentStats.resets || 0) + 1 });
            }
        });

        // Update user's personal points and streak
        user.get('profile').once(profile => {
            let pointsToAdd = 1;
            const newStreak = (profile.resetStreak || 0) + 1;

            // Check if user was first to reset
            timerRef.once(timerData => {
                if (timerData.updatedBy !== currentUser.alias) {
                    pointsToAdd += 2; // +2 for being first
                    addLog('First to reset! +2 bonus points.', 'success');
                }

                if (newStreak % 4 === 0 && newStreak > 0) {
                    pointsToAdd += 1; // +1 bonus for 4-in-a-row streak
                    addLog('Reset streak x4! +1 bonus point.', 'success');
                }
                
                const newPoints = (profile.points || 0) + pointsToAdd;
                const newLevel = getLevelFromPoints(newPoints);

                if (newLevel > profile.level) {
                    addLog(`LEVEL UP! You are now Level ${newLevel}.`, 'success');
                }

                const newProfile = {
                    points: newPoints,
                    level: newLevel,
                    resetStreak: newStreak
                };
                // Update user's private profile
                user.get('profile').put(newProfile);

                // Update the public leaderboard with public data
                gun.get('leaderboard').get(currentUser.alias).put({
                    points: newPoints,
                    level: newLevel
                });
            });
        });

        crtInputValue = '';
        updateCRTInputDisplay();
        siren.pause();
        siren.currentTime = 0;
        reset.play().catch(() => {});
        addLog('Numbers entered correctly. Timer reset.', 'success');
    } else if (inputValue !== '') {
        addLog('Incorrect code sequence. Protocol penalty initiated.', 'warning');
        updateTimer(4, 'code_incorrect'); // Set timer to 4 as penalty
        
        // Reset the user's streak on incorrect code
        user.get('profile').put({ resetStreak: 0 });
        
        crtInputValue = '';
        updateCRTInputDisplay();
        siren.play().catch(() => {});
    }
}

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

function stopApp() {
    if (focusInterval) clearInterval(focusInterval);
    focusInterval = null;
    console.log('App UI focus paused.');
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
            lastSeen: Date.now()
        });
    }, 30000);

    // Fetch or initialize user profile
    user.get('profile').once(profile => {
        if (!profile) {
            const initialProfile = { points: 5, level: 1, resetStreak: 0 };
            user.get('profile').put(initialProfile);
            // Also add the new user to the public leaderboard
            gun.get('leaderboard').get(alias).put({ points: 5, level: 1 });
        } else {
            currentUser.points = profile.points;
            currentUser.level = getLevelFromPoints(profile.points);
        }
    });

    // Listen for profile updates
    user.get('profile').on(profile => {
        if (profile) {
            currentUser.points = profile.points;
            currentUser.level = getLevelFromPoints(profile.points);
            if (stats) updateStatsUI(stats);
            // Aggiorna il contenuto CRT se in modalità vintage
            updateCRTContent();
        }
    });
    
    // Show the main container
    document.querySelector('.container').style.display = 'flex';

    focusInterval = setInterval(() => {
        // Non fare focus se siamo in modalità vintage o se c'è un overlay aperto
        if (document.querySelector('.overlay')) return;
        
        if (document.activeElement.tagName !== 'INPUT' || document.activeElement === input) {
            input.focus();
        }
    }, 100);
}

// Authentication UI and Logic
function showAuthPrompt() {
    stopApp();
    if (document.querySelector('.overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
        <div class="auth-prompt">
            <h2>> DHARMA INITIATIVE TERMINAL</h2>
            <input type="text" id="username" placeholder="OPERATOR ALIAS" autocomplete="username" />
            <input type="password" id="password" placeholder="PASSWORD" autocomplete="current-password" />
            <div class="auth-error" id="authError"></div>
            <div class="auth-buttons">
                <div class="button" id="loginBtn">LOGIN</div>
                <div class="button" id="signupBtn">SIGN UP</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const usernameInput = overlay.querySelector('#username');
    const passwordInput = overlay.querySelector('#password');
    const errorDiv = overlay.querySelector('#authError');
    
    overlay.querySelector('#loginBtn').onclick = () => {
        user.auth(usernameInput.value, passwordInput.value, (ack) => {
            if (ack.err) {
                errorDiv.textContent = ack.err;
            } else {
                overlay.remove();
                // startApp is called by the 'auth' event listener
            }
        });
    };

    overlay.querySelector('#signupBtn').onclick = () => {
        user.create(usernameInput.value, passwordInput.value, (ack) => {
            if (ack.err) {
                errorDiv.textContent = ack.err;
            } else {
                // New user created, log them in automatically
                overlay.querySelector('#loginBtn').click();
            }
        });
    };
}

// Show history overlay
function showHistory() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
        <div class="history-view">
            <h2>&gt; SWAN STATION HISTORY</h2>
            <div class="history-content">Loading...</div>
            <div class="button" id="closeHistory">CLOSE</div>
        </div>
    `;
    document.body.appendChild(overlay);

    const historyContent = overlay.querySelector('.history-content');
    const closeBtn = overlay.querySelector('#closeHistory');

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

        historyContent.innerHTML = ''; // Clear loading message

        if (historyItems.length === 0) {
            historyContent.textContent = 'No history recorded.';
        } else {
            historyItems.forEach(data => {
                if (data) {
                    const entry = document.createElement('div');
                    entry.className = 'history-entry';
                    const date = new Date(data.timestamp).toLocaleString();
                    const operator = data.operator || 'UNKNOWN';
                    const action = data.action || 'No action recorded';
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
        lastSeen: Date.now()
    };
    operatorsRef.get(user.is.pub).put(operatorData);
    addLog(`Operator ${name} registered`, 'info');
    
    // Update operator status periodically
    setInterval(() => {
        operatorsRef.get(user.is.pub).put({
            name: name,
            pub: user.is.pub,
            lastSeen: Date.now()
        });
    }, 10000); // Update every 10 seconds
}

// Logging function
function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    
    // Use alias if available, otherwise use the first 10 chars of the public key
    let operatorInfo = '';
    if (currentUser && currentUser.alias) {
        operatorInfo = ` [${currentUser.alias}]`;
    } else if (user && user.is && user.is.pub) {
        const shortPub = user.is.pub.substring(0, 10) + '...';
        operatorInfo = ` [${shortPub}]`;
    }
    
    logEntry.textContent = `[${timestamp}]${operatorInfo} ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    console.log(`Log: ${message}`);

    // Add to history if it's an important event
    if (type === 'success' || type === 'error' || type === 'warning') {
        historyRef.get(crypto.randomUUID()).put({
            timestamp: Date.now(),
            operator: currentUser ? currentUser.alias : (user.is ? user.is.pub.substring(0, 10) + '...' : 'UNKNOWN'),
            action: message
        });
    }
}

// Typing sound function
function typeSound() {
    const randomNumber = Math.floor(Math.random() * 7);
    buttonSounds[randomNumber].play().catch(() => {});
}

// Modifica la funzione updateTimer per supportare il flip clock
function updateTimer(newValue, reason = '') {
    const oldValue = timerRef.get('value');
    timerRef.put({ value: newValue, lastUpdate: Date.now() });
    
    // Log dell'aggiornamento del timer
    if (reason) {
        addLog(`Timer updated to ${newValue} (${reason})`, 'info');
    }
    
    // Aggiorna la history se è un evento importante
    if (reason === 'button_press' || reason === 'system_failure') {
        historyRef.get(Date.now().toString()).put({
            timestamp: Date.now(),
            operator: currentUser ? currentUser.alias : 'SYSTEM',
            action: reason === 'button_press' ? 
                `Reset timer to ${newValue}` : 
                `System failure - timer set to ${newValue}`
        });
    }
}

// Input handler
input.onkeydown = (event) => {
    if (!currentUser) {
        addLog('ERROR: Operator registration required', 'error');
        // Do not create a new prompt if one is already open
        if (!document.querySelector('.overlay')) {
            showAuthPrompt();
        }
        return;
    }

    // Controlla se siamo negli ultimi 4 minuti prima di permettere qualsiasi input
    if (timer > 240) {
        const minutesLeft = Math.floor((timer - 240) / 60);
        const secondsLeft = (timer - 240) % 60;
        addLog(`WARNING: Code input is locked. Wait ${minutesLeft}m ${secondsLeft}s before entering the code.`, 'warning');
        event.preventDefault();
        return;
    }

    typeSound();
    if (event.key === 'Enter') {
        input.value = input.value.trim();
        if (input.value === '4 8 15 16 23 42') {
            updateTimer(108, 'code_correct');
            
            // Increment successful resets stat
            statsRef.once(currentStats => {
                if (currentStats) {
                    statsRef.put({ resets: (currentStats.resets || 0) + 1 });
                }
            });

            // Update user's personal points and streak
            user.get('profile').once(profile => {
                let pointsToAdd = 1;
                const newStreak = (profile.resetStreak || 0) + 1;

                // Check if user was first to reset
                timerRef.once(timerData => {
                    if (timerData.updatedBy !== currentUser.alias) {
                        pointsToAdd += 2; // +2 for being first
                        addLog('First to reset! +2 bonus points.', 'success');
                    }

                    if (newStreak % 4 === 0 && newStreak > 0) {
                        pointsToAdd += 1; // +1 bonus for 4-in-a-row streak
                        addLog('Reset streak x4! +1 bonus point.', 'success');
                    }
                    
                    const newPoints = (profile.points || 0) + pointsToAdd;
                    const newLevel = getLevelFromPoints(newPoints);

                    if (newLevel > profile.level) {
                        addLog(`LEVEL UP! You are now Level ${newLevel}.`, 'success');
                    }

                    const newProfile = {
                        points: newPoints,
                        level: newLevel,
                        resetStreak: newStreak
                    };
                    // Update user's private profile
                    user.get('profile').put(newProfile);

                    // Update the public leaderboard with public data
                    gun.get('leaderboard').get(currentUser.alias).put({
                        points: newPoints,
                        level: newLevel
                    });
                });
            });

            input.value = '';
            siren.pause();
            siren.currentTime = 0;
            reset.play().catch(() => {});
            addLog('Numbers entered correctly. Timer reset.', 'success');
        } else if (input.value !== '') {
            addLog('Incorrect code sequence. Protocol penalty initiated.', 'warning');
            updateTimer(4, 'code_incorrect'); // Set timer to 4 as penalty
            
            // Reset the user's streak on incorrect code
            user.get('profile').put({ resetStreak: 0 });
            
            input.value = '';
            siren.play().catch(() => {});
        }
    }
}

// Timer decrement function
function decrementTimer() {
    if (!timerRef) {
        console.log('Timer reference lost, reinitializing...');
        timerRef = gun.get('swan').get('timer');
    }
    
    timerRef.once((data) => {
        if (!data || typeof data.value !== 'number') {
            console.log('Invalid timer data, resetting...');
            updateTimer(108, 'timer_reset');
            return;
        }

        // Sync with server time
        const now = Date.now();
        if (data.lastUpdate) {
            const minutesPassed = Math.floor((now - data.lastUpdate) / 60000);
            if (minutesPassed > 1) {
                const newValue = Math.max(1, data.value - minutesPassed);
                updateTimer(newValue, 'time_sync');
                return;
            }
        }

        // Normal decrement
        if (data.value > 1) {
            updateTimer(data.value - 1, 'timer_tick');
            tick.play().catch(() => {});
        } else if (data.value <= 1 && data.value > 0) {
            triggerSystemFailure();
            tick.play().catch(() => {});
        }
    });
}

function generateAvatar(pubKey) {
    // Usiamo gli ultimi 6 caratteri della pubkey per il colore di base
    const color = '#' + pubKey.slice(-6);
    // Creiamo un canvas per disegnare l'avatar
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Sfondo nero
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 32, 32);
    
    // Bordo verde DHARMA
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 32, 32);
    
    // Usiamo la pubkey per generare un pattern unico
    for(let i = 0; i < 16; i++) {
        const x = (i % 4) * 8;
        const y = Math.floor(i / 4) * 8;
        if(parseInt(pubKey[i], 16) % 2 === 0) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 8, 8);
        }
    }
    
    return canvas.toDataURL();
}

function showProfile() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
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
                        <div class="stat-item">
                            <div class="stat-label">SYSTEM FAILURES</div>
                            <div class="stat-value" id="profileFailures">0</div>
                        </div>
                    </div>
                </div>
                <div class="profile-actions">
                    <input type="text" id="locationInput" placeholder="Enter your location..." />
                    <button id="updateLocation" class="terminal-button">UPDATE LOCATION</button>
                    <button id="exportPair" class="terminal-button">EXPORT PAIR</button>
                </div>
            </div>
            <div class="terminal-footer">CLOSE</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Aggiorna le informazioni del profilo
    const updateProfile = () => {
        user.get('profile').once(profile => {
            if (profile) {
                document.getElementById('profileAlias').textContent = currentUser.alias;
                document.getElementById('profileLevel').textContent = currentUser.level;
                document.getElementById('profilePoints').textContent = currentUser.points;
                document.getElementById('profileLocation').textContent = profile.location || 'NOT SET';
                document.getElementById('profileResets').textContent = profile.resets || 0;
                document.getElementById('profileFailures').textContent = profile.failures || 0;
                
                // Genera e imposta l'avatar
                const avatar = generateAvatar(user.is.pub);
                document.getElementById('operatorAvatar').src = avatar;
            }
        });
    };

    // Gestisci l'aggiornamento della location
    document.getElementById('updateLocation').onclick = () => {
        const location = document.getElementById('locationInput').value.trim();
        if (location) {
            user.get('profile').get('location').put(location);
            document.getElementById('profileLocation').textContent = location;
            document.getElementById('locationInput').value = '';
        }
    };

    // Export pair handler
    document.getElementById('exportPair').onclick = () => {
        if (user.is) {
            const pair = user._.sea;
            const pairString = JSON.stringify(pair);
            
            // Create a temporary textarea to copy the pair data
            const textarea = document.createElement('textarea');
            textarea.value = pairString;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            addLog('Pair data copied to clipboard', 'success');
        }
    };

    // Chiudi il profilo
    overlay.querySelector('.terminal-footer').onclick = () => overlay.remove();

    // Aggiorna il profilo inizialmente
    updateProfile();
}

// Aggiorna updateStatsUI per includere il pulsante del profilo
function updateStatsUI(newStats) {
    stats = newStats;
    const pointsToNextLevel = currentUser ? levels[currentUser.level + 1] - currentUser.points : 0;
    
    statsContainer.innerHTML = `
        <div class="stats-bar">
            <div class="operator-stats">
                <span class="level">LEVEL ${currentUser ? currentUser.level : '--'}</span>
                <span class="points">${currentUser ? currentUser.points : '--'} POINTS</span>
                ${currentUser && currentUser.level < 25 ? 
                    `<span class="next-level">(${pointsToNextLevel} TO LVL ${currentUser.level + 1})</span>` : 
                    ''}
            </div>
            <div class="stats-buttons">
                <button id="profileBtn" class="stats-button">[ PROFILE ]</button>
                <button id="globalStatsBtn" class="stats-button">[ GLOBAL STATS ]</button>
                <button id="leaderboardBtn" class="stats-button">[ LEADERBOARD ]</button>
                <button id="historyBtn" class="stats-button">[ STATION HISTORY ]</button>
                <button id="chatBtn" class="stats-button">[ OPERATOR CHAT ]</button>
            </div>
        </div>
    `;

    // Add click handlers for all buttons
    document.getElementById('profileBtn').onclick = showProfile;
    document.getElementById('globalStatsBtn').onclick = showGlobalStats;
    document.getElementById('leaderboardBtn').onclick = showLeaderboard;
    document.getElementById('historyBtn').onclick = showHistory;
    document.getElementById('chatBtn').onclick = showChat;
}

function showGlobalStats() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
        <div class="global-stats-modal">
            <h2>&gt; GLOBAL STATISTICS</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-label">SYSTEM FAILURES</div>
                    <div class="stat-value">${stats.failures}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">SUCCESSFUL RESETS</div>
                    <div class="stat-value">${stats.resets}</div>
                </div>
            </div>
            <div class="button" id="closeStats">CLOSE</div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#closeStats').onclick = () => overlay.remove();
}

function triggerSystemFailure() {
    addLog('CRITICAL: SYSTEM FAILURE DETECTED.', 'error');
    statsRef.once(currentStats => {
        if (currentStats) {
            statsRef.put({
                failures: (currentStats.failures || 0) + 1,
            });
        }
    });
    updateTimer(4, 'system_failure');

    // Reset the user's streak on system failure
    user.get('profile').put({ resetStreak: 0 });
}

function showLeaderboard() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
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

    const leaderboardContent = overlay.querySelector('#leaderboardContent');
    overlay.querySelector('#closeLeaderboard').onclick = () => overlay.remove();

    const leaderboard = [];
    // Read from the new public leaderboard node
    gun.get('leaderboard').map().once((playerProfile, playerAlias) => {
        if (playerProfile && playerProfile.points > 0) {
            leaderboard.push({
                alias: playerAlias,
                points: playerProfile.points,
                level: playerProfile.level
            });
        }
    });

    // Wait for the asynchronous data to arrive
    setTimeout(() => {
        leaderboard.sort((a, b) => b.points - a.points);
        leaderboardContent.innerHTML = '';

        if (leaderboard.length === 0) {
            leaderboardContent.innerHTML = '<div class="history-entry">No operator data found. Be the first!</div>';
            return;
        }

        // Display top 20 players
        leaderboard.slice(0, 20).forEach((player, index) => {
            const entry = document.createElement('div');
            entry.className = 'leaderboard-entry';
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
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
        <div class="chat-container">
            <div class="chat-header">
                <h2>DHARMA INITIATIVE - OPERATOR CHAT</h2>
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
    overlay.querySelector('#chatInput').focus();
}

// Chat functionality
function initializeChat() {
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const operatorsList = document.getElementById('operatorsList');

    // Ensure all required elements exist
    if (!chatInput || !chatMessages || !operatorsList) {
        console.error('Chat elements not found. Chat initialization aborted.');
        return;
    }

    // Clear existing messages
    chatMessages.innerHTML = '';

    // Keep track of processed messages
    const processedMessages = new Set();

    // Simple function to add a message to the chat
    function displayMessage(data) {
        if (!data || !data.message || !data.author || !data.timestamp) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
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
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() && currentUser) {
            const message = chatInput.value.trim();
            chatInput.value = '';
            
            const messageId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const messageData = {
                author: currentUser.alias,
                message: message,
                timestamp: Date.now()
            };
            
            chatRef.get(messageId).put(messageData);
        }
    });

    // Update operators list
    function updateOperatorsList() {
        console.log('Updating operators list...');
        operatorsList.innerHTML = '';
        const seenOperators = new Set();
        const now = Date.now();
        
        operatorsRef.map().once((data, key) => {
            console.log('Operator data:', data);
            if (data && data.name && data.lastSeen) {
                const timeSinceLastSeen = now - data.lastSeen;
                console.log(`Operator ${data.name} last seen ${timeSinceLastSeen}ms ago`);
                
                if (timeSinceLastSeen < 120000) { // 2 minutes timeout
                    if (seenOperators.has(data.name)) return;
                    seenOperators.add(data.name);
                    
                    const li = document.createElement('li');
                    li.textContent = data.name;
                    if (data.pub === user.is.pub) {
                        li.className = 'current-user';
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

// Main system initializer
function initializeSystem() {
    document.title = 'AUTHENTICATING...';

    // Setup listeners that don't depend on a logged-in user
    statsRef.on(data => {
        if (data) {
            stats = { ...stats, ...data };
            updateStatsUI(stats); // Update global stats regardless of user
        }
    });

    // Initialize timer immediately, regardless of auth status
    timerRef.once(data => {
        if (!data || typeof data.value !== 'number') {
            console.log('Global timer not found. Initializing on GunDB...');
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
                updateTimer(newValue, 'time_sync');
            }
        }
    });

    // Main Gun event listener for authentication
    gun.on('auth', () => {
        if (user.is) {
            console.log('Authentication successful for:', user.is.alias);
            const overlay = document.querySelector('.overlay');
            if (overlay) overlay.remove();
            
            // Now that auth is confirmed, start the app logic
            startApp(user.is.alias);
        }
    });

    // Check if a user is already logged in
    user.recall({ sessionStorage: true }, (ack) => {
        if (ack.err || !user.is) {
            showAuthPrompt();
        }
    });

    // Timer display listener
    timerRef.on((data) => {
        if (data && typeof data.value === 'number') {
            document.title = data.value;
            bigTimer.textContent = data.value;
            
            // Aggiorna il flip clock se in modalità vintage
            updateFlipClock(data.value);
            
            if (data.value <= 4) {
                siren.play().catch(() => {});
            } else {
                siren.pause();
                siren.currentTime = 0;
            }
        }
    });

    // Aggiungi un controllo periodico del timer
    setInterval(() => {
        if (!decrementInterval) {
            console.log('Timer interval lost, restarting...');
            decrementInterval = setInterval(decrementTimer, 60000);
        }
    }, 30000);
}

// Start the application
initializeSystem();

function handleScore(success) {
    if (!currentUser) return;

    const points = success ? 108 : -108;
    user.get('points').once(currentPoints => {
        const newPoints = (currentPoints || 0) + points;
        user.get('points').put(newPoints);
        
        // Aggiorna le statistiche del profilo
        user.get('profile').once(profile => {
            const updatedProfile = {
                ...(profile || {}),
                resets: (profile?.resets || 0) + (success ? 1 : 0),
                failures: (profile?.failures || 0) + (success ? 0 : 1),
            };
            user.get('profile').put(updatedProfile);
        });

        // Aggiorna il livello
        const newLevel = calculateLevel(newPoints);
        if (newLevel !== currentUser.level) {
            user.get('level').put(newLevel);
        }
    });
}

// Aggiungi questa funzione per monitorare lo stato del timer
function checkTimerHealth() {
    timerRef.once((data) => {
        const now = Date.now();
        if (!data || typeof data.value !== 'number' || !data.lastUpdate || (now - data.lastUpdate) > 120000) {
            console.log('Timer health check failed, reinitializing...');
            updateTimer(108, 'health_check');
        }
    });
}

// Chiama il controllo di salute ogni 2 minuti
setInterval(checkTimerHealth, 120000);
=======
// Initialize the application
$(function () {
  // Start with auth screen
  showScreen("auth");

  // Add event listeners for auth buttons
  if (elements.auth.registerBtn) {
    elements.auth.registerBtn.addEventListener("click", register);
  }

  if (elements.auth.loginBtn) {
    elements.auth.loginBtn.addEventListener("click", login);
  }

  // Add event listener for code input Enter key
  if (elements.game.codeInput) {
    elements.game.codeInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        submitCode();
      }
    });
  }

  // Initialize GUN.js
  gun.on("auth", function () {
    if (user.is) {
      initializeGame();
    }
  });
});

// Modify submitCode to sync across all users
function submitCode() {
  const codeInput = elements.game.codeInput;
  if (!codeInput) return;

  const code = codeInput.value.trim();
  const expectedCode = "4 8 15 16 23 42";

  // Get current timer state to check if we're in the valid window
  gameState.once((state) => {
    if (!state || !state.endTime) return;

    const timeRemaining = state.endTime - Date.now();

    // Log attempt for all users
    addSystemLog(`Code attempt by ${user.is.alias}: ${code}`, LOG_TYPES.INFO);
    addStationHistory(`Code attempt: ${code}`, HISTORY_TYPES.BUTTON);

    // Check if we're in the 4-minute window
    if (timeRemaining > 240000) {
      addSystemLog(`${user.is.alias}: ${SYSTEM_MESSAGES.EARLY_CODE}`, LOG_TYPES.WARNING);
      addStationHistory("Early code attempt rejected", HISTORY_TYPES.BUTTON);
      codeInput.classList.add("shake");
      setTimeout(() => codeInput.classList.remove("shake"), 500);
      codeInput.value = "";
      return;
    }

    if (code === expectedCode) {
      // Prevent multiple submissions while processing
      codeInput.disabled = true;

      // Reset timer and clear input
      const newEndTime = Date.now() + 108 * 60 * 1000;
      
      // Update shared game state for all users
      gameState.put({
        endTime: newEndTime,
        lastResetBy: user.is.alias,
        failed: false
      });

      codeInput.value = "";

      // Log successful reset for all users
      addSystemLog(`${user.is.alias}: ${SYSTEM_MESSAGES.VALID_CODE}`, LOG_TYPES.SUCCESS);
      addStationHistory("Timer successfully reset", HISTORY_TYPES.RESET);

      if (soundEnabled) {
        sounds.reset.play();
        sounds.siren.pause();
        sounds.siren.currentTime = 0;
      }

      elements.game.timer.classList.remove("blink");

      // Update user stats
      gun
        .get("profiles")
        .get(user.is.alias)
        .once((profile) => {
          const updates = {
            points: (profile.points || 5) + 10,
            totalResets: (profile.totalResets || 0) + 1,
            consecutiveResets: (profile.consecutiveResets || 0) + 1,
            lastSeen: Date.now(),
          };

          if (updates.consecutiveResets >= 4) {
            updates.points += 10;
            updates.consecutiveResets = 0;
            addSystemLog(`${user.is.alias}: ${SYSTEM_MESSAGES.CONSECUTIVE_RESET}`, LOG_TYPES.SUCCESS);
          }

          gun.get("profiles").get(user.is.alias).put(updates);
          updateUserStats(updates);
        });

      addSystemLog(SYSTEM_MESSAGES.SYSTEM_SYNC, LOG_TYPES.INFO);

      // Re-enable input after a short delay
      setTimeout(() => {
        codeInput.disabled = false;
      }, 1000);
    } else {
      // Log failed attempt for all users
      addSystemLog(`${user.is.alias}: ${SYSTEM_MESSAGES.INVALID_CODE}`, LOG_TYPES.ERROR);
      addStationHistory("Invalid code entered", HISTORY_TYPES.BUTTON);
      codeInput.classList.add("shake");
      setTimeout(() => codeInput.classList.remove("shake"), 500);
    }
  });
}

// Constants
const LEVELS = {
  1: { points: 5, features: ["Base game access"] },
  2: { points: 30, features: ["Profile customization"] },
  3: { points: 80, features: ["Private messaging"] },
  4: { points: 130, features: ["Custom status"] },
  5: { points: 250, features: ["Profile badges"] },
  6: { points: 350, features: ["Extended chat history"] },
  7: { points: 500, features: ["Custom chat colors"] },
  8: { points: 700, features: ["View station logs"] },
  9: { points: 900, features: ["Custom sound effects"] },
  10: { points: 1125, features: ["Blast door map access"] },
  // ... altri livelli ...
  25: { points: 7500, features: ["All features unlocked"] },
};

const FAQ_ITEMS = [
  {
    question: "What is the purpose of this website?",
    answer:
      "This website is a simulator of the Swan Station (a.k.a. \"the Hatch\") from ABC's Lost TV series (2004-2010). It's a game made for Lost fans!",
  },
  {
    question: "What is the code to enter?",
    answer:
      "The code you have to enter to reset the timer is 4 8 15 16 23 42 (including spaces).",
  },
  // ... altri FAQ items ...
];

// GunDB Setup
const gun = Gun(["https://gun-manhattan.herokuapp.com/gun"]);
let user = gun.user().recall({ sessionStorage: true });
const chat = gun.get("swan-chat");
const gameState = gun.get("swan-game");
const profiles = gun.get("swan-profiles");
const chatMessages = gun.get("swan-chat-messages");

// Add global stats node
const globalStats = gun.get("swan-global-stats");

// Add shared system logs
const systemLogs = gun.get("swan-system-logs");

// Audio Setup
const sounds = {
  siren: new Audio("assets/siren.mp3"),
  type: new Audio("assets/type.mp3"),
  reset: new Audio("assets/reset.mp3"),
  tick: new Audio("assets/tick.mp3"),
};

let soundEnabled = true;
let currentScreen = "home";
let currentUserPoints = 0;
let consecutiveResets = 0;
let lastLockdown = 0;

// Sistema di Log
const LOG_TYPES = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  SUCCESS: "success",
};

const SYSTEM_MESSAGES = {
  EARLY_CODE:
    "WARNING: Code input detected outside of critical window. Please wait for 4-minute warning.",
  INVALID_CODE: "ERROR: Invalid code sequence. Please verify and try again.",
  VALID_CODE: "Code accepted. Resetting electromagnetic buildup...",
  TIMER_WARNING: "WARNING: 4 minutes remaining. Code input required.",
  TIMER_CRITICAL:
    "CRITICAL: 1 minute remaining. Electromagnetic buildup reaching critical levels.",
  SYSTEM_FAILURE:
    "SYSTEM FAILURE: Electromagnetic containment breach detected.",
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
  RESET: "reset",
  FAILURE: "failure",
  LOCKDOWN: "lockdown",
  BUTTON: "button",
  SYSTEM: "system",
  TEST: "test"  // Add explicit test type
};

// Add function to generate unique IDs
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Add function to validate history entry
function isValidHistoryEntry(entry) {
  return entry && 
         typeof entry === 'object' && 
         entry.message && 
         entry.type && 
         entry.timestamp && 
         entry.id;
}

// Modify addStationHistory function
function addStationHistory(message, type = HISTORY_TYPES.SYSTEM) {
  // Don't log test mode events unless explicitly authorized
  if (type === HISTORY_TYPES.TEST && !window.testModeAuthorized) return;

  const entry = {
    message,
    type,
    timestamp: Date.now(),
    id: generateUniqueId(),
    user: elements.game.userDisplay ? elements.game.userDisplay.textContent : null
  };

  // Save to GUN with the unique ID as the key to prevent duplicates
  gun.get('station-history').get(entry.id).put(entry);

  // Only update DOM if we're on the history screen
  if (currentScreen === "history") {
    loadHistory();
  }
}

// Authentication
async function register() {
  const username = elements.auth.username.value;
  const password = elements.auth.password.value;

  if (!username || !password) {
    alert("Please enter both username and password.");
    return;
  }

  if (password.length < 8) {
    alert("Password must be at least 8 characters long.");
    return;
  }

  try {
    // Check if user already exists
    const checkUser = await new Promise((resolve) => {
      gun
        .get("profiles")
        .get(username)
        .once((data) => {
          resolve(data);
        });
    });

    if (checkUser) {
      alert("Username already taken. Please choose another one.");
      return;
    }

    // Create new user
    await user.create(username, password);

    // Initialize user profile
    gun.get("profiles").get(username).put({
      points: 5,
      totalResets: 0,
      consecutiveResets: 0,
      joinDate: Date.now(),
      lastSeen: Date.now(),
    });

    // Log in the newly created user
    await login();
  } catch (error) {
    console.error("Registration failed:", error);
    alert("Registration failed. Please try again.");
  }
}

async function login() {
  const username = elements.auth.username.value;
  const password = elements.auth.password.value;

  if (!username || !password) {
    alert("Please enter both username and password.");
    return;
  }

  try {
    await user.auth(username, password);

    if (!user.is) {
      throw new Error("Authentication failed");
    }

    // Update last seen timestamp
    gun.get("profiles").get(username).get("lastSeen").put(Date.now());

    // Add system log
    addSystemLog(SYSTEM_MESSAGES.LOGIN_SUCCESS, LOG_TYPES.SUCCESS);

    // Initialize game after successful login
    initializeGame();
  } catch (error) {
    console.error("Login failed:", error);
    alert("Login failed. Please check your credentials.");
  }
}

function logout() {
  user.leave();
  showScreen("auth");
  clearInterval(timerInterval);
}

// Game Logic
function initializeGame() {
  if (!user.is) return;

  showScreen("game");
  addSystemLog(SYSTEM_MESSAGES.LOGIN_SUCCESS, LOG_TYPES.SUCCESS);
  elements.game.userDisplay.textContent = user.is.alias;

  // Add test button
  addTestButton();

  // Load station history
  gun
    .get("station-history")
    .map()
    .once((data, id) => {
      if (data && data.message) {
        addStationHistory(data.message, data.type);
      }
    });

  // Load user profile
  gun
    .get("profiles")
    .get(user.is.alias)
    .once((profile) => {
      if (profile) {
        currentUserPoints = profile.points || 5;
        consecutiveResets = profile.consecutiveResets || 0;
        updateUserStats(profile);
      }
    });

  // Load global system failures count
  globalStats.get("systemFailures").once((failures) => {
    if (failures) {
      elements.game.systemFailures.textContent = failures;
    } else {
      globalStats.get("systemFailures").put(0);
      elements.game.systemFailures.textContent = "0";
    }
  });

  // Initialize shared system logs
  initializeSystemLogs();

  // Initialize timer with synchronization
  initializeSharedTimer();

  // Initialize chat
  initializeChat();

  // Start random lockdowns
  setInterval(checkLockdown, 300000); // Check every 5 minutes
}

// Add function to initialize shared timer
function initializeSharedTimer() {
  // Listen for timer updates from other users
  gameState.on((state) => {
    if (!state) return;

    if (state.failed) {
      showSystemFailure();
    } else if (state.endTime) {
      updateTimer(state.endTime);
      updateGameStats(state);
    }
  });

  // Initialize timer if it doesn't exist
  gameState.once((state) => {
    if (!state || !state.endTime) {
      const initialEndTime = Date.now() + 108 * 60 * 1000;
      gameState.put({
        endTime: initialEndTime,
        lastResetBy: "System",
        failed: false
      });
    }
  });
}

// Add function to initialize shared system logs
function initializeSystemLogs() {
  // Listen for new system log messages
  systemLogs.map().on((logEntry, id) => {
    if (!logEntry || !logEntry.message) return;
    
    // Add to local display without re-saving to GUN
    displaySystemLog(logEntry.message, logEntry.type, logEntry.timestamp);
  });
}

// Modify addSystemLog to broadcast to all users
function addSystemLog(message, type = LOG_TYPES.INFO) {
  const logEntry = {
    message,
    type,
    timestamp: Date.now(),
    id: generateUniqueId(),
    user: user.is ? user.is.alias : "System"
  };

  // Save to shared system logs for all users
  systemLogs.get(logEntry.id).put(logEntry);
}

// Add function to display system log locally
function displaySystemLog(message, type = LOG_TYPES.INFO, timestamp = Date.now()) {
  const logContainer = document.getElementById("log-messages");
  if (!logContainer) return;

  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;

  const time = new Date(timestamp).toLocaleTimeString();
  entry.innerHTML = `<span class="timestamp">[${time}]</span> ${message}`;

  logContainer.insertBefore(entry, logContainer.firstChild);

  // Mantieni solo gli ultimi 50 messaggi
  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// Modify updateTimer to sync across all users
function updateTimer(endTime) {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    window.document.title = `${minutes.toString().padStart(3, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    elements.game.timer.textContent = `${minutes
      .toString()
      .padStart(3, "0")}:${seconds.toString().padStart(2, "0")}`;

    // Avvisi basati sul tempo rimanente
    if (
      remaining <= 240000 &&
      remaining > 180000 &&
      !elements.game.timer.classList.contains("blink")
    ) {
      // Prima volta che entriamo nella finestra dei 4 minuti
      addSystemLog(SYSTEM_MESSAGES.TIMER_WARNING, LOG_TYPES.WARNING);
      if (soundEnabled && !sounds.siren.playing) {
        sounds.siren.play();
      }
      elements.game.timer.classList.add("blink");
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

// Modify systemFailure to sync across all users
function systemFailure() {
  addSystemLog(SYSTEM_MESSAGES.SYSTEM_FAILURE, LOG_TYPES.ERROR);
  addStationHistory(
    "SYSTEM FAILURE: Electromagnetic containment breach",
    HISTORY_TYPES.FAILURE
  );

  // Update shared game state for all users
  gameState.put({
    failed: true,
  });

  // Update global system failures counter
  globalStats.get("systemFailures").once((failures) => {
    const newCount = (failures || 0) + 1;
    globalStats.get("systemFailures").put(newCount);
  });

  showSystemFailure();
}

// Modify showSystemFailure to sync across all users
function showSystemFailure() {
  showScreen("systemFailure");

  // Update display from global counter
  globalStats.get("systemFailures").once((failures) => {
    elements.game.systemFailures.textContent = failures || 0;
  });

  setTimeout(() => {
    const newEndTime = Date.now() + 108 * 60 * 1000;
    
    // Update shared game state for all users
    gameState.put({
      endTime: newEndTime,
      failed: false,
      lastResetBy: "System Auto-Recovery"
    });
    
    addSystemLog("System auto-recovery initiated", LOG_TYPES.SUCCESS);
    showScreen("game");
  }, 10000);
}

// Chat System
const MAX_MESSAGES = 50;

function initializeChat() {
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatContainer = document.getElementById("chat-messages");

  // Gestione invio messaggio
  function sendMessage() {
    if (!user.is) return;
    const message = chatInput.value.trim();
    if (!message) return;

    const messageData = {
      text: message,
      sender: user.is.alias,
      timestamp: Date.now(),
      id: Math.random().toString(36).substring(2),
    };

    chatMessages.set(messageData);
    chatInput.value = "";
    addSystemLog(`Message sent by ${user.is.alias}`, LOG_TYPES.INFO);
  }

  // Event listeners per l'invio
  chatSend.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Ascolta i nuovi messaggi
  chatMessages.map().once((message, id) => {
    if (!message || !message.text || !message.sender) return;

    const messageElement = document.createElement("div");
    messageElement.className = "chat-message";
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

  if (currentScreen === "profile") {
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

  const timeOnStation = Math.floor(
    (Date.now() - profile.joinDate) / (1000 * 60 * 60 * 24)
  );
  elements.profile.time.textContent = `${timeOnStation} days`;

  if (nextLevel) {
    const pointsNeeded = nextLevel.points - profile.points;
    elements.profile.points.setAttribute(
      "data-tooltip",
      `${pointsNeeded} points needed for Level ${level + 1}`
    );
  }
}

// Lockdown System
function checkLockdown() {
  const now = Date.now();
  if (now - lastLockdown < 12 * 60 * 60 * 1000) return; // 12 hours cooldown

  if (Math.random() < 0.1) {
    // 10% chance
    triggerLockdown();
  }
}

function triggerLockdown() {
  lastLockdown = Date.now();
  addSystemLog(SYSTEM_MESSAGES.LOCKDOWN_START, LOG_TYPES.WARNING);
  addStationHistory("Station lockdown initiated", HISTORY_TYPES.LOCKDOWN);
  showScreen("lockdown");

  setTimeout(() => {
    addSystemLog(SYSTEM_MESSAGES.LOCKDOWN_END);
    addStationHistory("Station lockdown completed", HISTORY_TYPES.LOCKDOWN);
    showScreen(currentScreen);
  }, 60000); // 1 minute lockdown
}

// Funzione helper per calcolare il tempo rimanente
function getTimeRemaining() {
  const timerText = elements.game.timer.textContent;
  const [minutes, seconds] = timerText.split(":").map(Number);
  return (minutes * 60 + seconds) * 1000;
}

// Event Listeners
$(document).ready(function () {
  // Initialize DOM elements
  const elements = {
    auth: {
      container: document.getElementById("auth-container"),
      username: document.getElementById("username"),
      password: document.getElementById("password"),
      registerBtn: document.getElementById("register-button"),
      loginBtn: document.getElementById("login-button"),
    },
    nav: {
      menu: document.getElementById("nav-menu"),
      items: Array.from(document.querySelectorAll(".nav-item")),
      soundToggle: document.getElementById("sound-toggle"),
    },
    game: {
      container: document.getElementById("game-container"),
      timer: document.getElementById("timer-display"),
      codeInput: document.getElementById("code-input"),
      logMessages: document.getElementById("log-messages"),
      chatInput: document.getElementById("chat-input"),
      chatSend: document.getElementById("chat-send"),
    },
  };

  // Add keyboard support for login form
  if (elements.auth.password) {
    elements.auth.password.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        login();
      }
    });
  }

  // Add event listeners only if elements exist
  if (elements.nav.soundToggle) {
    elements.nav.soundToggle.addEventListener("click", toggleSound);
  }

  if (elements.auth.registerBtn) {
    elements.auth.registerBtn.addEventListener("click", register);
  }

  if (elements.auth.loginBtn) {
    elements.auth.loginBtn.addEventListener("click", login);
  }

  if (elements.game.chatInput && elements.game.chatSend) {
    elements.game.chatInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        sendChatMessage();
      }
    });
    elements.game.chatSend.addEventListener("click", sendChatMessage);
  }

  // Navigation event listeners
  elements.nav.items.forEach((item) => {
    if (item) {
      item.addEventListener("click", function () {
        const screenName = this.dataset.screen;
        if (screenName) {
          showScreen(screenName);
        }
      });
    }
  });

  // Initialize with auth screen
  showScreen("auth");
});

// Helper functions
function toggleSound() {
  if (!elements.nav.soundToggle) return;
  const soundEnabled = elements.nav.soundToggle.src.includes("sound-on.png");
  elements.nav.soundToggle.src = soundEnabled
    ? "assets/sound-off.png"
    : "assets/sound-on.png";
  // Additional sound toggle logic here
}

function sendChatMessage() {
  if (!elements.game.chatInput) return;
  const message = elements.game.chatInput.value.trim();
  if (message) {
    // Send message logic here
    elements.game.chatInput.value = "";
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

// Modify loadHistory function
function loadHistory() {
  if (currentScreen !== "history") return;

  const historyContainer = document.getElementById("station-log-messages");
  if (!historyContainer) return;

  // Clear existing history
  historyContainer.innerHTML = "";

  // Add loading indicator
  const loading = document.createElement("div");
  loading.className = "loading-indicator";
  loading.textContent = "Loading history...";
  historyContainer.appendChild(loading);

  let count = 0;
  const limit = 50; // Limit to 50 entries at a time
  const entries = new Map(); // Use Map to prevent duplicates

  // Load history from GUN with limit
  gun.get('station-history').map().once((entry, id) => {
    if (!entry || count >= limit) return;
    if (!isValidHistoryEntry(entry)) return;

    // Use Map to prevent duplicates based on ID
    if (!entries.has(entry.id)) {
      entries.set(entry.id, {
        ...entry,
        timestamp: entry.timestamp || Date.now()
      });
      count++;
    }

    // Once we have enough entries, display them
    if (count === limit || entries.size > 0) {
      displayEntries();
    }
  });

  function displayEntries() {
    // Remove loading indicator
    loading.remove();

    // Sort entries by timestamp, newest first
    const sortedEntries = Array.from(entries.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    // Display entries
    sortedEntries.forEach(entry => {
      const div = document.createElement("div");
      div.className = `history-entry ${entry.type || ""}`;
      div.innerHTML = `
        <span class="timestamp">${new Date(entry.timestamp).toLocaleString()}</span>
        <span class="message">${entry.message}</span>
        ${entry.user ? `<span class="user">${entry.user}</span>` : ""}
      `;
      historyContainer.appendChild(div);
    });

    // If no entries found, show message
    if (entries.size === 0) {
      const noEntries = document.createElement("div");
      noEntries.className = "no-entries";
      noEntries.textContent = "No history entries found.";
      historyContainer.appendChild(noEntries);
    }
  }

  // Add error handling timeout
  setTimeout(() => {
    if (historyContainer.querySelector(".loading-indicator")) {
      loading.textContent = "No history entries found.";
      setTimeout(() => loading.remove(), 2000);
    }
  }, 5000);
}

// Modify test button to sync across all users
function addTestButton() {
  const button = document.createElement("button");
  button.id = "test-timer-button";
  button.textContent = "Test: Set 4 Minutes";
  button.onclick = function() {
    // Require explicit user confirmation for test mode
    if (!window.testModeAuthorized) {
      const authorize = confirm("Authorize test mode? This will be logged in station history and affect all users.");
      if (!authorize) return;
      window.testModeAuthorized = true;
    }

    const newEndTime = Date.now() + 4 * 60 * 1000; // 4 minutes
    
    // Update shared game state for all users
    gameState.put({
      endTime: newEndTime,
      lastResetBy: user.is?.alias || "System",
      failed: false,
      isTestMode: true
    });
    
    addSystemLog(`${user.is?.alias}: ${SYSTEM_MESSAGES.TIMER_TEST}`, LOG_TYPES.WARNING);
    addStationHistory("Test mode activated: Timer set to 4 minutes", HISTORY_TYPES.TEST);
  };
  document.body.appendChild(button);
}
>>>>>>> 30a2a65b7013669e6e4f7c20522b0e6e253c82ba
