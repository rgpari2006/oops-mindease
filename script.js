window.app = null; 

// --- API Configuration (NOW BYPASSED FOR RELIABILITY) ---
// IMPORTANT: This URL is kept for context, but all data calls now use local storage.
const API_BASE_URL = 'http://localhost:8080/api';
// --- END API Configuration ---\

class MindWellApp {
    constructor() {
        this.currentSection = 'dashboard';
        this.meditationTimer = null;
        this.meditationDuration = 5 * 60; // 5 minutes in seconds
        this.remainingTime = this.meditationDuration;
        this.isPlaying = false;
        this.selectedMood = null;
        
        // Data is now loaded directly from local storage in init()
        this.moodData = []; 
        this.meditationStats = { totalSessions: 0, totalMinutes: 0 };
        this.meditationHistory = []; // Array to store individual meditation sessions
        
        this.safetyPlan = this.loadSafetyPlan();
        
        // Ambient Sound Properties using Tone.js
        this.soundPlayers = {};
        // FIX: Default active sound changed to 'silence' to prevent auto-selection of 'stream'.
        this.activeSound = 'silence'; 
        this.ambientVolume = 0.5;
        this.isSoundPlaying = false; 

        // Gemini Chat History (to maintain conversation context)
        this.chatHistory = [];
        this.isBotTyping = false;

        // --- NEW: Properties for Automatic Music Selection ---
        this.userMeditationMood = 'calm'; // Default mood for meditation
        this.userMeditationType = 'breathing'; // Default type
        this.musicLibrary = this.createMusicLibrary(); // Holds the mapping logic
        // --- END NEW ---
        
        // Set the global reference
        window.app = this;
        
        this.init();
    }

    async init() {
        this.setupToneJs(); // Initialize Tone.js and sounds
        this.setupNavigation();
        this.setupMeditation(); // This will now set up the new mood selector as well
        this.setupMoodTracking();
        this.setupChat();
        this.setupCrisisSupport();
        this.setupDashboard();
        this.setupResources();
        
        // Data Fetching: NOW RELIES ON LOCAL STORAGE ONLY
        this.loadAllLocalData();
        
        this.displayMoodChart();
        this.displayDashboardStats();
        this.displayMeditationHistory(); 
        this.setDailyTip();

        // NEW: Recommend a sound on initial load
        this.recommendSound();
    }
    
    // --- LOCAL DATA HANDLING (RELIABLE FRONTEND ONLY) ---
    loadAllLocalData() {
        this.moodData = this.loadLocalMoodDataFallback();
        this.meditationStats = this.loadLocalMeditationStatsFallback();
        this.meditationHistory = this.loadLocalMeditationHistoryFallback();
        console.log('Data loaded from local storage.');
    }

    // UPDATED: All saving is now direct to local storage
    saveMoodEntry() {
        if (!this.selectedMood) {
            this.showNotification('Please select a mood first', 'warning');
            return;
        }

        const note = document.getElementById('moodNote').value;
        const entry = {
            mood: this.selectedMood,
            note: note,
            date: new Date().toISOString(),
            timestamp: Date.now()
        };
        
        // Save to local storage
        this.moodData.push(entry);
        this.saveLocalMoodDataFallback();
        
        // Update UI
        this.displayMoodChart();
        this.displayMoodEntries();
        this.displayDashboardStats();

        // Reset form
        document.querySelectorAll('.mood-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        document.getElementById('moodNote').value = '';
        this.selectedMood = null;

        this.showNotification('Mood entry saved locally!', 'success');
    }

    // UPDATED: All saving is now direct to local storage
    saveMeditationStats() {
        // Save total stats to local storage
        this.saveLocalMeditationStatsFallback();
        this.displayDashboardStats();
        this.showNotification('Meditation progress saved locally!', 'info');
    }
    
    // UPDATED: Function to save a new meditation history entry to local storage
    saveMeditationEntry(entry) {
        this.meditationHistory.push(entry);
        this.saveLocalMeditationHistoryFallback();
        this.displayMeditationHistory();
        this.showNotification('Meditation session saved locally!', 'success');
    }
    
    // Fallback functions using localStorage (Now primary data source)
    loadLocalMoodDataFallback() {
        const saved = localStorage.getItem('mindwell_mood_data');
        return saved ? JSON.parse(saved) : [];
    }

    saveLocalMoodDataFallback() {
        localStorage.setItem('mindwell_mood_data', JSON.stringify(this.moodData));
    }

    loadLocalMeditationStatsFallback() {
        const saved = localStorage.getItem('mindwell_meditation_stats');
        return saved ? JSON.parse(saved) : { totalSessions: 0, totalMinutes: 0 };
    }

    saveLocalMeditationStatsFallback() {
        localStorage.setItem('mindwell_meditation_stats', JSON.stringify(this.meditationStats));
    }

    // Local storage for meditation history
    loadLocalMeditationHistoryFallback() {
        const saved = localStorage.getItem('mindwell_meditation_history');
        return saved ? JSON.parse(saved) : [];
    }

    saveLocalMeditationHistoryFallback() {
        localStorage.setItem('mindwell_meditation_history', JSON.stringify(this.meditationHistory));
    }
    
    loadSafetyPlan() {
        // Crisis plan is kept local as it is private and high-frequency editing might be needed
        const saved = localStorage.getItem('mindwell_safety_plan');
        return saved ? JSON.parse(saved) : {};
    }
    // --- END LOCAL DATA HANDLING ---


    // --- TONE.JS / SOUND IMPLEMENTATION ---
    setupToneJs() {
        if (typeof Tone === 'undefined') {
            console.error('Tone.js is not loaded. Meditation sound features disabled.');
            document.querySelectorAll('.sound-btn').forEach(btn => btn.disabled = true);
            return;
        }
        
        // Using LOCAL FILE PATHS for the uploaded audio files
        // This list represents our "music library" for this implementation
        const soundMap = {
            // Ensure these paths are correct relative to index.html and that the files exist
            rain: './audio/rain.mp3', 
            ocean: './audio/ocean.mp3', 
            forest: './audio/forest.mp3', 
            stream: './audio/stream.mp3', 
            silence: null
        };
        
        for (const sound in soundMap) {
            if (soundMap[sound]) {
                const player = new Tone.Player(soundMap[sound]).toDestination();
                player.loop = true;
                player.volume.value = Tone.gainToDb(this.ambientVolume); 
                player.autostart = false; 
                this.soundPlayers[sound] = player;
            }
        }

        const volumeSlider = document.getElementById('soundVolume');
        if (volumeSlider) {
            volumeSlider.value = this.ambientVolume * 100;
            volumeSlider.addEventListener('input', (e) => {
                this.updateAmbientVolume(parseFloat(e.target.value) / 100);
            });
        }
        
        // We will handle the default button activation inside setupMeditation()
    }

    // MODIFIED: This function now also updates the UI to reflect the active sound
    playAmbientSound(soundName) {
        if (typeof Tone === 'undefined') {
            this.showNotification('Meditation audio is disabled because Tone.js failed to load.', 'warning');
            return;
        }
        
        // Prevent re-starting the same sound if already active and playing
        if (this.activeSound === soundName && this.isSoundPlaying) {
             return; 
        }

        // 1. Stop any currently playing sound
        for (const name in this.soundPlayers) {
            const player = this.soundPlayers[name];
            if (player && player.state === 'started') {
                player.stop();
            }
        }

        this.activeSound = soundName;

        // NEW: Update the UI to show which button is active
        const soundBtns = document.querySelectorAll('#soundOptionsButtons .sound-btn');
        const activeBtn = document.querySelector(`#soundOptionsButtons .sound-btn[data-sound="${soundName}"]`);
        // FIX: Ensure buttons/activeBtn are valid before calling update
        if (soundBtns && activeBtn) {
            this.updateActiveButton(soundBtns, activeBtn);
        }
        
        if (soundName !== 'silence') {
            const player = this.soundPlayers[soundName];
            if (player) {
                
                // --- MODIFIED FIX ---
                // Create a promise that resolves when Tone is ready.
                // This ensures we only call Tone.start() if the audio context
                // is not already 'running'.
                const startTone = () => {
                    if (typeof Tone === 'undefined') {
                        return Promise.reject(new Error("Tone.js not loaded"));
                    }
                    if (Tone.context.state === 'running') {
                        return Promise.resolve(); // Already running, no action needed
                    }
                    // Not running, so try to start it.
                    // This must be called from a user gesture (which this function is)
                    return Tone.start();
                };

                startTone().then(() => {
                // --- END MODIFIED FIX ---
                    // Start the new sound player
                    player.start();
                    this.isSoundPlaying = true;
                    // Only show notification if meditation isn't currently running, to avoid spam
                    if (!this.isPlaying) { 
                       this.showNotification(`Playing ${soundName} sound.`, 'info');
                    }
                }).catch(e => {
                    console.error("Tone.js failed to start or play:", e);
                    this.showNotification(`Could not start ${soundName} sound. Please ensure your browser grants audio permissions.`, 'error');
                });
            } else {
                 this.isSoundPlaying = false;
                 console.error(`Sound player for "${soundName}" not found. Check if the audio file exists: ./audio/${soundName}.mp3`);
                 this.showNotification(`Ambient sound "${soundName}" file not loaded.`, 'error');
            }
        } else {
            this.isSoundPlaying = false;
             if (!this.isPlaying) {
                 this.showNotification(`Ambient sound stopped (Silence).`, 'info');
             }
        }
    }

    updateAmbientVolume(volume) {
        if (typeof Tone === 'undefined') return;
        
        this.ambientVolume = volume;
        // Convert linear volume (0-1) to decibel scale (dB) for Tone.js
        const volumeDb = Tone.gainToDb(volume); 
        for (const sound in this.soundPlayers) {
            const player = this.soundPlayers[sound];
            if (player) {
                player.volume.value = volumeDb;
            }
        }
    }
    // --- END TONE.JS / SOUND IMPLEMENTATION ---


    // Navigation
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const quickActionBtns = document.querySelectorAll('[data-action]');
        
        // 1. Navigation Menu Links
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.showSection(section);
                this.updateActiveNav(link);
            });
        });

        // 2. Quick Action Buttons
        quickActionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.getAttribute('data-action');
                if (action) {
                    this.showSection(action);
                    const correspondingNavLink = document.querySelector(`.nav-link[data-section="${action}"]`);
                    this.updateActiveNav(correspondingNavLink);
                }
            });
        });
    }
    
    // MODIFIED: Setup Meditation now includes listeners for the new mood selector
    setupMeditation() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const soundOptionsContainer = document.getElementById('soundOptionsButtons'); // Corrected ID
        const meditationTypesContainer = document.getElementById('meditationTypeSelector');
        const meditationMoodContainer = document.getElementById('meditationMoodSelector');
        
        const timeBtns = document.querySelectorAll('.time-btn[data-time]');
        const soundBtns = soundOptionsContainer ? soundOptionsContainer.querySelectorAll('.sound-btn') : [];
        const typeBtns = meditationTypesContainer ? meditationTypesContainer.querySelectorAll('.type-item') : [];
        const moodBtns = meditationMoodContainer ? meditationMoodContainer.querySelectorAll('.time-btn[data-mood]') : []; // Re-using .time-btn style
        
        // 1. Play/Pause Button
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.toggleMeditation();
            });
        }

        // 2. Time Buttons
        timeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMeditationDuration(parseInt(btn.getAttribute('data-time')));
                this.updateActiveButton(timeBtns, btn);
            });
        });

        // 3. Sound Buttons (Override)
        // MODIFIED: Click listener now just calls playAmbientSound. 
        // playAmbientSound handles updating the active button.
        soundBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const sound = btn.getAttribute('data-sound');
                this.playAmbientSound(sound);
            });
        });

        // 4. Meditation Type Buttons
        // MODIFIED: Now calls recommendSound (does not play)
        typeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMeditationType(btn.getAttribute('data-meditation'));
                this.updateActiveButton(typeBtns, btn);
                this.recommendSound(); // Recommend, don't play
            });
        });
        
        // 5. NEW: Meditation Mood Buttons
        // MODIFIED: Now calls recommendSound (does not play)
        moodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMeditationMood(btn.getAttribute('data-mood'));
                this.updateActiveButton(moodBtns, btn);
                this.recommendSound(); // Recommend, don't play
            });
        });

        // Manually set the default 'silence' button to active on load
        const defaultSoundBtn = document.querySelector(`.sound-btn[data-sound="${this.activeSound}"]`);
        if (defaultSoundBtn) {
            defaultSoundBtn.classList.add('active');
        }

        this.updateTimerDisplay();
    }


    showSection(sectionName) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionName;
        }
    }

    updateActiveNav(activeLink) {
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    toggleMeditation() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const circle = document.getElementById('meditationCircle');
        
        // --- ADDED FIX ---
        // Try to start/resume the AudioContext on the user's click
        // This "primes" the audio context for when startMeditation calls playAmbientSound.
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            Tone.start().catch(e => {
                // This is just a priming attempt, the real error will be
                // caught in playAmbientSound if it fails again.
                console.warn("AudioContext failed to start on toggle: ", e);
            });
        }
        // --- END ADDED FIX ---
        
        if (this.isPlaying) {
            this.pauseMeditation();
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            circle.classList.remove('playing');
        } else {
            this.startMeditation();
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            circle.classList.add('playing');
        }
    }

    // MODIFIED: startMeditation now calls selectAutomaticMusic
    // RESTORED: This is the original, working startMeditation logic
    startMeditation() {
        this.isPlaying = true;
        
        // Play the currently active sound (which is either the default, the recommendation, or the user's override)
        if (this.activeSound !== 'silence' && !this.isSoundPlaying) {
            this.playAmbientSound(this.activeSound); 
        }

        this.meditationTimer = setInterval(() => {
            this.remainingTime--;
            this.updateTimerDisplay();
            
            if (this.remainingTime <= 0) {
                this.completeMeditation();
            }
        }, 1000);
    }

    pauseMeditation() {
        this.isPlaying = false;
        clearInterval(this.meditationTimer);
        
        // Stop all sounds when meditation is paused
        for (const name in this.soundPlayers) {
            const player = this.soundPlayers[name];
            if (player && player.state === 'started') {
                player.stop();
            }
        }
        this.isSoundPlaying = false;
    }

    completeMeditation() {
        this.pauseMeditation(); // This now stops the sound too
        const originalDuration = this.meditationDuration;
        const completedMinutes = Math.ceil(originalDuration / 60);
        
        // Update statistics and save locally
        this.meditationStats.totalSessions++;
        this.meditationStats.totalMinutes += completedMinutes;
        this.saveMeditationStats();
        
        // Create and save a new history entry locally
        // MODIFIED: Use the stored userMeditationType property
        const newEntry = {
            type: this.userMeditationType,
            minutes: completedMinutes,
            date: new Date().toISOString(),
            mood: this.userMeditationMood, // NEW: Log the mood
            sound: this.activeSound // NEW: Log the sound
        };
        this.saveMeditationEntry(newEntry);
        
        // Reset timer
        this.remainingTime = this.meditationDuration;
        this.updateTimerDisplay();
        
        this.showNotification('Meditation completed! Well done.', 'success');
        
        document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-play"></i>';
        document.getElementById('meditationCircle').classList.remove('playing');
    }

    setMeditationDuration(minutes) {
        this.meditationDuration = minutes * 60;
        this.remainingTime = this.meditationDuration;
        this.updateTimerDisplay();
    }

    // MODIFIED: Also updates the internal state property
    setMeditationType(type) {
        this.userMeditationType = type; // Store the type
        
        const titles = {
            'breathing': { title: 'Mindful Breathing', description: 'Focus on your breath and find inner calm' },
            'body-scan': { title: 'Body Scan', description: 'Progressive relaxation from head to toe' },
            'loving-kindness': { title: 'Loving Kindness', description: 'Cultivate compassion and love' },
            'anxiety-relief': { title: 'Anxiety Relief', description: 'Calm your worried mind' }
        };
        
        const info = titles[type] || titles.breathing;
        document.getElementById('meditationTitle').textContent = info.title;
        document.getElementById('meditationDescription').textContent = info.description;
    }

    // NEW: Function to set the meditation mood state
    setMeditationMood(mood) {
        this.userMeditationMood = mood;
        console.log(`Meditation mood set to: ${mood}`);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = this.remainingTime % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timerDisplay').textContent = display;
    }

    updateActiveButton(buttons, activeButton) {
        if (!buttons || !activeButton) return;
        buttons.forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
    }

    // --- NEW: Automatic Music Selection Logic ---

    // Defines the mapping table as requested in the prompt
    createMusicLibrary() {
        // We use the existing sound keys ('rain', 'ocean', 'forest', 'stream', 'silence')
        // as the target "music" tracks for this implementation.
        return {
            // Session Type: 'breathing'
            'breathing': {
                'calm': 'stream',     // Calm + Breathing -> Gentle Stream
                'anxious': 'ocean',     // Anxious + Breathing -> Rhythmic Ocean
                'tired': 'silence',   // Tired + Breathing -> Silence
                'restless': 'rain',     // Restless + Breathing -> Steady Rain
                'default': 'stream'
            },
            // Session Type: 'body-scan'
            'body-scan': {
                'calm': 'forest',     // Calm + Body Scan -> Gentle Forest
                'anxious': 'rain',      // Anxious + Body Scan -> Calming Rain
                'tired': 'stream',    // Tired + Body Scan -> Stream
                'restless': 'ocean',    // Restless + Body Scan -> Ocean waves
                'default': 'forest'
            },
            // Session Type: 'loving-kindness'
            'loving-kindness': {
                'calm': 'stream',
                'anxious': 'forest',
                'tired': 'silence',
                'restless': 'stream',
                'default': 'stream'
            },
            // Session Type: 'anxiety-relief'
            'anxiety-relief': {
                'calm': 'ocean',      // Rhythmic waves are good for anxiety
                'anxious': 'ocean',     // Double down on ocean
                'tired': 'rain',      // Gentle rain
                'restless': 'rain',     // Steady rain
                'default': 'ocean'
            },
            // Default mapping if session type is unknown
            'default': {
                'calm': 'stream',
                'anxious': 'ocean',
                'tired': 'silence',
                'restless': 'rain',
                'default': 'silence' // Default to silence if all else fails
            }
        };
    }

    // Implements the selection logic from the prompt
    // MODIFIED: This function is renamed and now ONLY recommends, it does not play.
    recommendSound() {
        console.log(`Recommending music for type: ${this.userMeditationType}, mood: ${this.userMeditationMood}`);
        
        // 1. Find the mapping for the session type, or use default
        let typeMapping = this.musicLibrary[this.userMeditationType] || this.musicLibrary['default'];
        
        // 2. Find the music for the user's mood, or use the type's default
        let selectedSound = typeMapping[this.userMeditationMood] || typeMapping['default'];
        
        // 3. Fallback to global default if something is still wrong
        if (!selectedSound) {
            selectedSound = this.musicLibrary['default']['default'];
        }

        console.log(`Recommended sound: ${selectedSound}`);
        
        // 4. Set the active sound, but DO NOT PLAY IT.
        this.activeSound = selectedSound;

        // 5. Update the UI to show the recommendation
        const soundBtns = document.querySelectorAll('#soundOptionsButtons .sound-btn');
        const activeBtn = document.querySelector(`#soundOptionsButtons .sound-btn[data-sound="${selectedSound}"]`);
        if (soundBtns && activeBtn) {
            this.updateActiveButton(soundBtns, activeBtn);
        }
    }
    // --- END NEW MUSIC LOGIC ---


    // Mood Tracking
    setupMoodTracking() {
        const moodOptions = document.querySelectorAll('.mood-option');
        const saveMoodBtn = document.getElementById('saveMood');
        
        moodOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.selectMood(option);
            });
        });

        saveMoodBtn.addEventListener('click', () => {
            this.saveMoodEntry();
        });

        this.displayMoodEntries();
    }

    selectMood(option) {
        document.querySelectorAll('.mood-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        this.selectedMood = parseInt(option.getAttribute('data-mood'));
    }

    displayMoodChart() {
        const canvas = document.getElementById('moodChart');
        const miniCanvas = document.getElementById('moodChartMini');
        
        if (canvas) {
            this.drawMoodChart(canvas, false);
        }
        if (miniCanvas) {
            this.drawMoodChart(miniCanvas, true);
        }
    }

    drawMoodChart(canvas, isMini = false) {
        if (!canvas) return; // Guard against missing canvas
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Get last 7 days of data
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        // Ensure data is sorted by timestamp before filtering/grouping
        const sortedData = [...this.moodData].sort((a, b) => a.timestamp - b.timestamp);

        const recentData = sortedData.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= sevenDaysAgo;
        });

        if (recentData.length === 0) {
            ctx.fillStyle = '#94A3B8';
            ctx.font = isMini ? '12px Inter' : '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No mood data yet', width / 2, height / 2);
            return;
        }

        // Group by day and calculate average
        const dailyAverages = {};
        const days = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            const dateStr = date.toISOString().split('T')[0];
            days.push(dateStr);
            dailyAverages[dateStr] = [];
        }

        recentData.forEach(entry => {
            const dateStr = entry.date.split('T')[0];
            if (dailyAverages[dateStr]) {
                dailyAverages[dateStr].push(entry.mood);
            }
        });

        // Calculate averages
        const averages = days.map(day => {
            const dayMoods = dailyAverages[day];
            if (dayMoods.length === 0) return null;
            return dayMoods.reduce((sum, mood) => sum + mood, 0) / dayMoods.length;
        });

        // Draw chart (Canvas drawing logic remains the same)
        const padding = isMini ? 20 : 40;
        const chartWidth = width - (padding * 2);
        const chartHeight = height - (padding * 2);
        const stepX = chartWidth / (days.length - 1);
        
        // Draw grid lines
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        
        for (let i = 1; i <= 5; i++) {
            const y = padding + (chartHeight * (5 - i) / 5);
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // Draw mood line
        ctx.strokeStyle = '#4F46E5';
        ctx.lineWidth = isMini ? 2 : 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        let hasStarted = false;

        averages.forEach((avg, index) => {
            if (avg !== null) {
                const x = padding + (index * stepX);
                const y = padding + (chartHeight * (5 - avg) / 5);
                
                if (!hasStarted) {
                    ctx.moveTo(x, y);
                    hasStarted = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });

        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#4F46E5';
        averages.forEach((avg, index) => {
            if (avg !== null) {
                const x = padding + (index * stepX);
                const y = padding + (chartHeight * (5 - avg) / 5);
                
                ctx.beginPath();
                ctx.arc(x, y, isMini ? 3 : 4, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Draw labels (only for main chart)
        if (!isMini) {
            ctx.fillStyle = '#64748B';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            
            days.forEach((day, index) => {
                const x = padding + (index * stepX);
                const date = new Date(day);
                const label = date.toLocaleDateString('en-US', { weekday: 'short' });
                ctx.fillText(label, x, height - 5);
            });
            
            // Y-axis labels
            ctx.textAlign = 'right';
            const moodLabels = ['poor', 'Low', 'Okay', 'Good', 'Great'];
            moodLabels.forEach((label, index) => {
                const y = padding + (chartHeight * (4 - index) / 5) + 4;
                ctx.fillText(label, padding - 10, y);
            });
        }

        // Update stats
        this.updateMoodStats(averages.filter(avg => avg !== null));
    }

    updateMoodStats(averages) {
        const avgElement = document.getElementById('averageMood');
        const countElement = document.getElementById('entriesCount');
        
        if (avgElement && averages.length > 0) {
            const average = averages.reduce((sum, avg) => sum + avg, 0) / averages.length;
            avgElement.textContent = average.toFixed(1);
        }
        
        if (countElement) {
            countElement.textContent = this.moodData.length;
        }
    }

    displayMoodEntries() {
        const entriesContainer = document.getElementById('moodEntries');
        if (!entriesContainer) return;

        // Sort data newest first for history display
        const sortedEntries = [...this.moodData].sort((a, b) => b.timestamp - a.timestamp);
        const recentEntries = sortedEntries.slice(0, 10);
        
        if (recentEntries.length === 0) {
            entriesContainer.innerHTML = '<p class="text-center">No mood entries yet. Start tracking your mood above!</p>';
            return;
        }

        const moodEmojis = {
            5: { emoji: '😊', label: 'Great', color: '#10B981' },
            4: { emoji: '🙂', label: 'Good', color: '#22C55E' },
            3: { emoji: '😐', label: 'Okay', color: '#F59E0B' },
            2: { emoji: '😞', label: 'Low', color: '#F97316' },
            1: { emoji: '😢', label: 'poor', color: '#EF4444' }
        };

        entriesContainer.innerHTML = recentEntries.map(entry => {
            const moodInfo = moodEmojis[entry.mood];
            const date = new Date(entry.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit' 
            });
            
            return `
                <div class="mood-entry">
                    <div class="mood-entry-icon" style="color: ${moodInfo.color}">
                        ${moodInfo.emoji}
                    </div>
                    <div class="mood-entry-content">
                        <div><strong>${moodInfo.label}</strong></div>
                        ${entry.note ? `<div>${entry.note}</div>` : ''}
                        <div class="mood-entry-date">${date}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Function to display meditation history
    displayMeditationHistory() {
        const historyContainer = document.getElementById('meditationHistoryList');
        if (!historyContainer) return;
        
        // Sort sessions by date, newest first
        const sortedHistory = [...this.meditationHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentSessions = sortedHistory.slice(0, 5); // Show up to 5 recent sessions
        
        if (recentSessions.length === 0) {
            historyContainer.innerHTML = '<p class="text-center">No meditation history yet. Complete a session to see it here!</p>';
            return;
        }

        const typeLabels = {
            'breathing': 'Mindful Breathing',
            'body-scan': 'Body Scan',
            'loving-kindness': 'Loving Kindness',
            'anxiety-relief': 'Anxiety Relief'
        };
        
        historyContainer.innerHTML = recentSessions.map(session => {
            const date = new Date(session.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit' 
            });
            const type = typeLabels[session.type] || 'Meditation';
            
            return `
                <div class="history-item">
                    <div class="history-item-icon">
                        <i class="fas fa-leaf"></i>
                    </div>
                    <div class="history-item-content">
                        <div><strong>${type}</strong></div>
                        <div class="history-item-details">${session.minutes} min | ${date}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    setupResources() {
        // Links are external, so no custom JS is needed.
    }

    // Chat Support
    setupChat() {
        const sendBtn = document.getElementById('sendMessage');
        const chatInput = document.getElementById('chatInput');
        
        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Initialize chat history with the welcome message
        this.chatHistory = [{
            role: "model",
            parts: [{
                text: "Hello! I'm your wellness assistant. I'm here to provide emotional support and guidance. How are you feeling today?"
            }]
        }];
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendMessage');
        const message = input.value.trim();
        
        if (!message || this.isBotTyping) return;

        // 1. Add user message and clear input
        this.addMessage(message, 'user');
        this.chatHistory.push({ role: "user", parts: [{ text: message }] });
        input.value = '';
        
        // 2. Add loading indicator (simple text instead of spinner) and disable input
        const loadingMessage = this.addMessage('...', 'bot', true); 
        sendBtn.disabled = true;
        input.disabled = true;
        this.isBotTyping = true;
        
        try {
            // 3. Call Gemini API
            const responseText = await this.callGeminiAPI(message);

            // 4. Update the loading message with the actual response
            const responsePart = { text: responseText };
            this.chatHistory.push({ role: "model", parts: [responsePart] });
            this.updateMessage(loadingMessage, responseText);
            
        } catch (error) {
            console.error('Gemini API Error:', error);
            this.updateMessage(loadingMessage, 'Sorry, I ran into an issue getting a response. Please try again.');
        } finally {
            // 5. Re-enable input and reset state
            sendBtn.disabled = false;
            input.disabled = false;
            this.isBotTyping = false;
            input.focus();
        }
    }

    async callGeminiAPI(userQuery) {
        const systemPrompt = `You are MindEase, a supportive and empathetic mental wellness assistant. Your purpose is to provide emotional support, relaxation techniques, and guidance on mental health topics. Always be compassionate, non-judgemental, and encourage self-care. Keep responses concise and focused on wellness.`;
        // >>>>> PASTE YOUR GEMINI API KEY HERE <<<<<
        const apiKey = "AIzaSyDfZxWxhLNMXeziX561D2kWoP2ntW7FE8o";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        // Use the accumulated history for context
        const contents = this.chatHistory;

        const payload = {
            contents: contents,
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            // Enable search grounding for up-to-date or factual information
            tools: [{ "google_search": {} }], 
            
        };
        
        // Simple fetch with basic exponential backoff (for robustness)
        let response = null;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
            try {
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json();
                    return result.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a meaningful response.";
                } else {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
            } catch (error) {
                retries++;
                if (retries >= maxRetries) {
                    throw error; // Throw after max retries
                }
                const delay = Math.pow(2, retries) * 1000; // 2s, 4s, 8s
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    addMessage(content, sender, isSpinner = false) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-${sender === 'bot' ? 'robot' : 'user'}"></i>
            </div>
            <div class="message-content">
                <p>${content}</p>
                <span class="message-time">${isSpinner ? '...' : time}</span>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Return the P element for easy updating if it's a spinner
        return messageDiv.querySelector('p');
    }

    updateMessage(element, newContent) {
        if (element) {
            element.innerHTML = newContent;
            
            // Update time on the bot message from spinner to actual time
            const timeSpan = element.parentElement.querySelector('.message-time');
            if (timeSpan && timeSpan.textContent === '...') {
                timeSpan.textContent = new Date().toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                });
            }
        }
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Removed the old generateAIResponse as it is replaced by callGeminiAPI
    // generateAIResponse(userMessage) { ... }


    // Crisis Support
    setupCrisisSupport() {
        const savePlanBtn = document.getElementById('saveSafetyPlan');
        
        if (savePlanBtn) {
            savePlanBtn.addEventListener('click', () => {
                this.saveSafetyPlan();
            });
        }

        this.loadSafetyPlanData();
    }

    saveSafetyPlan() {
        const steps = document.querySelectorAll('.safety-step textarea');
        const plan = {
            warningSigns: steps[0]?.value || '',
            copingStrategies: steps[1]?.value || '',
            supportContacts: steps[2]?.value || '',
            lastUpdated: new Date().toISOString()
        };

        localStorage.setItem('mindwell_safety_plan', JSON.stringify(plan));
        this.showNotification('Safety plan saved!', 'success');
    }

    loadSafetyPlanData() {
        const saved = localStorage.getItem('mindwell_safety_plan');
        if (saved) {
            const plan = JSON.parse(saved);
            const steps = document.querySelectorAll('.safety-step textarea');
            if (steps[0]) steps[0].value = plan.warningSigns || '';
            if (steps[1]) steps[1].value = plan.copingStrategies || '';
            if (steps[2]) steps[2].value = plan.supportContacts || '';
        }
    }

    // Dashboard
    setupDashboard() {
        this.displayDashboardStats();
        this.setDailyTip();
    }

    displayDashboardStats() {
        const totalSessionsEl = document.getElementById('totalSessions');
        const totalMinutesEl = document.getElementById('totalMinutes');
        
        if (totalSessionsEl) {
            totalSessionsEl.textContent = this.meditationStats.totalSessions;
        }
        if (totalMinutesEl) {
            totalMinutesEl.textContent = this.meditationStats.totalMinutes;
        }
    }

    setDailyTip() {
        const tips = [
            "Take three deep breaths and remind yourself that you are doing your best today.",
            "Practice gratitude by writing down three things you're thankful for.",
            "Take a 5-minute walk outside to connect with nature and clear your mind.",
            "Reach out to someone you care about and let them know you're thinking of them.",
            "Set boundaries today - it's okay to say no to protect your mental health.",
            "Practice self-compassion by speaking to yourself as you would to a good friend.",
            "Take breaks throughout your day, even if they're just a few minutes long.",
            "Stay hydrated and nourish your body with foods that make you feel good.",
            "Listen to music that uplifts your mood or brings you peace.",
            "Remember: progress, not perfection. Every small step forward matters."
        ];
        
        const today = new Date().toDateString();
        const savedTip = localStorage.getItem('mindwell_daily_tip_date');
        
        if (savedTip !== today) {
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            localStorage.setItem('mindwell_daily_tip', randomTip);
            localStorage.setItem('mindwell_daily_tip_date', today);
        }
        
        const tipElement = document.getElementById('dailyTip');
        if (tipElement) {
            tipElement.textContent = localStorage.getItem('mindwell_daily_tip') || tips[0];
        }
    }

    // Notifications - This function is now used globally by auth.js
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#10B981' : type === 'warning' ? '#F59E0B' : type === 'error' ? '#EF4444' : '#4F46E5'};
            color: white;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            transform: translateX(400px);
            transition: transform 0.3s ease-out;
            max-width: 300px;
            font-family: var(--font-family);
            font-weight: 500;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MindWellApp();
});

// Service Worker Registration (for offline functionality)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault();
});