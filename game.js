import Phaser from 'phaser';

// Game configuration with responsive scaling
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 450,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Initialize the game
let game;

// Wait for DOM to be fully loaded before starting the game
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded, initializing game');
    game = new Phaser.Game(config);
});

// Game variables
let player;
let enemy;
let platforms;
let cursors;
let gameActive = true;
let questionBox;
let answerInput;
let submitBtn;
let playerHealth = 100;
let enemyHealth = 100;
let currentQuestion = { question: "What is the opposite of 'big'?", answer: "small" };
let playerHealthBar;
let enemyHealthBar;
let playerHealthText;
let enemyHealthText;
let levelText;
let background;
let allQuestions = null; // Will store all loaded questions
let currentLevelQuestions = []; // Direct initialization with empty array instead of hardcoded questions
let currentLevel = 1; // Track the current level

// Question tracking system to prevent repeats
const questionTracker = {
    // Keep track of questions used in each level/difficulty
    usedQuestions: {
        beginner: new Set(),
        intermediate: new Set(),
        advanced: new Set()
    },
    
    // Get difficulty name based on level
    getDifficultyForLevel: function(level) {
        if (level === 1) return 'beginner';
        if (level === 2) return 'intermediate';
        return 'advanced';
    },
    
    // Reset tracking for a specific difficulty
    resetTracking: function(difficulty) {
        this.usedQuestions[difficulty] = new Set();
        console.log(`Reset tracking for ${difficulty} questions`);
    },
    
    // Mark a question as used
    markAsUsed: function(level, questionText) {
        const difficulty = this.getDifficultyForLevel(level);
        this.usedQuestions[difficulty].add(questionText);
        console.log(`Marked as used: [${difficulty}] "${questionText}"`);
    },
    
    // Check if a question has been used
    hasBeenUsed: function(level, questionText) {
        const difficulty = this.getDifficultyForLevel(level);
        return this.usedQuestions[difficulty].has(questionText);
    },
    
    // Select fresh questions for a level
    selectFreshQuestions: function(level, count = 5) {
        if (!allQuestions) {
            console.error("Questions not loaded yet!");
            return [];
        }
        
        const difficulty = this.getDifficultyForLevel(level);
        const allPoolQuestions = allQuestions[difficulty] || [];
        
        // If we've used all or nearly all questions, reset tracking for this difficulty
        if (this.usedQuestions[difficulty].size >= allPoolQuestions.length - count) {
            this.resetTracking(difficulty);
        }
        
        // Filter out questions that have been used
        const availableQuestions = allPoolQuestions.filter(q => 
            !this.usedQuestions[difficulty].has(q.question)
        );
        
        // If we somehow have fewer available questions than needed, reset and try again
        if (availableQuestions.length < count) {
            this.resetTracking(difficulty);
            return this.selectFreshQuestions(level, count);
        }
        
        // Shuffle and select count random questions
        const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);
        
        // Mark these questions as used
        selected.forEach(q => this.markAsUsed(level, q.question));
        
        console.log(`Selected ${selected.length} fresh ${difficulty} questions for level ${level}`);
        return selected;
    }
};

// Function to select 5 random questions for the current level
function selectQuestionsForLevel(level) {
    // Use our new question tracker system to get fresh questions for each level
    return questionTracker.selectFreshQuestions(level);
}

function preload() {
    // Load images
    this.load.image('background', 'countryside.png');
    this.load.image('ground', 'platform.png');
    this.load.image('player', 'player-sprite.png');
    this.load.image('enemy', 'enemy-sprite.png');
    this.load.image('enemy-sprite2', 'enemy-sprite2.png');
    
    // Immediately load questions file during preload phase
    this.load.text('questions', 'english_game_questions.txt');
}

function create() {
    // Calculate some values for responsive positioning
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Add background - positioned to fill the scene nicely
    background = this.add.image(centerX, centerY, 'background');
    background.setDisplaySize(width, height);
    
    // IMMEDIATELY PROCESS QUESTIONS FROM THE FILE that was loaded in preload
    // This ensures we use questions from the file before any game interaction
    const questionsText = this.cache.text.get('questions');
    if (questionsText) {
        console.log("FOUND QUESTIONS FILE IN CACHE, LENGTH:", questionsText.length);
        parseQuestionsDirectly(questionsText);
    } else {
        console.error("ERROR: Could not find questions file in cache!");
    }
    
    // Create platforms group with static physics - only for ground, removing floating platforms
    platforms = this.physics.add.staticGroup();
    
    // Create ground - positioned at bottom of screen
    platforms.create(centerX, height - 10, 'ground').setScale(width / 192, 1).refreshBody();
    
    // Create player - scaled down to 70% of previous size (0.35 instead of 0.5)
    player = this.physics.add.sprite(width * 0.25, height * 0.75, 'player');
    player.setScale(0.35);
    player.setBounce(0.2);
    player.setCollideWorldBounds(true);
    player.flipX = true; // Mirror the player sprite horizontally
    
    // Create enemy - scaled down to 70% of previous size (0.35 instead of 0.5)
    enemy = this.physics.add.sprite(width * 0.75, height * 0.75, 'enemy');
    enemy.setScale(0.35);
    enemy.setCollideWorldBounds(true);
    
    // Add breathing animation to player and enemy - more subtle and smoother
    this.breathingAnimationPlayer = this.tweens.add({
        targets: player,
        y: player.y - 2, // Reduced movement from 5 to 2 pixels for subtlety
        duration: 1500, // Longer duration for smoother movement
        ease: 'Sine.easeInOut',
        yoyo: true, 
        repeat: -1,
        onStart: function() {
            // Ensure physics don't interfere with the animation
            player.body.allowGravity = false;
        },
        onComplete: function() {
            player.body.allowGravity = true;
        }
    });
    
    this.breathingAnimationEnemy = this.tweens.add({
        targets: enemy,
        y: enemy.y - 2, // Reduced movement from 5 to 2 pixels for subtlety
        duration: 1600, // Slightly different timing for variation
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: 800, // More offset for less synchronization
        onStart: function() {
            // Ensure physics don't interfere with the animation
            enemy.body.allowGravity = false;
        },
        onComplete: function() {
            enemy.body.allowGravity = true;
        }
    });
    
    // Set up collisions
    this.physics.add.collider(player, platforms);
    this.physics.add.collider(enemy, platforms);
    
    // Set up collision between player and enemy
    this.physics.add.overlap(player, enemy, encounterEnemy, null, this);
    
    // Set up controls
    cursors = this.input.keyboard.createCursorKeys();
    
    // Create UI elements - positioned relative to screen dimensions
    // Player health bar (background)
    const playerHealthBg = this.add.rectangle(width * 0.15, 30, width * 0.25, 20, 0x000000);
    playerHealthBg.setOrigin(0, 0.5);
    playerHealthBg.setStrokeStyle(2, 0xFFFFFF);
    
    // Player health bar (fill)
    playerHealthBar = this.add.rectangle(width * 0.15, 30, width * 0.25, 16, 0x00FF00);
    playerHealthBar.setOrigin(0, 0.5);
    
    // Player health text
    playerHealthText = this.add.text(width * 0.15, 50, 'PLAYER: 100HP', {
        fontSize: '14px',
        fontFamily: '"Press Start 2P"',
        fill: '#FFFFFF'
    }).setOrigin(0, 0.5);
    
    // Enemy health bar (background)
    const enemyHealthBg = this.add.rectangle(width * 0.85, 30, width * 0.25, 20, 0x000000);
    enemyHealthBg.setOrigin(1, 0.5);
    enemyHealthBg.setStrokeStyle(2, 0xFFFFFF);
    
    // Enemy health bar (fill)
    enemyHealthBar = this.add.rectangle(width * 0.85, 30, width * 0.25, 16, 0x00FF00);
    enemyHealthBar.setOrigin(1, 0.5);
    
    // Enemy health text
    enemyHealthText = this.add.text(width * 0.85, 50, 'ENEMY: 100HP', {
        fontSize: '14px',
        fontFamily: '"Press Start 2P"',
        fill: '#FFFFFF'
    }).setOrigin(1, 0.5);
    
    // Level text
    levelText = this.add.text(centerX, 30, 'LEVEL 1', {
        fontSize: '18px',
        fontFamily: '"Press Start 2P"',
        fill: '#FFFFFF'
    }).setOrigin(0.5, 0.5);
    
    // Get reference to the HTML question box and input elements
    questionBox = document.getElementById('question-box');
    answerInput = document.getElementById('answer-input');
    submitBtn = document.getElementById('submit-btn');
    
    // Debug - log if elements were found
    console.log('Question box found:', questionBox ? 'YES' : 'NO');
    console.log('Answer input found:', answerInput ? 'YES' : 'NO');
    console.log('Submit button found:', submitBtn ? 'YES' : 'NO');
    
    // Set up event listeners for the question box
    setupQuestionBoxEvents();
    
    // Make sure the game responds to window resize events
    this.scale.on('resize', this.handleResize, this);
    
    // Initial default question - will be replaced when questions load
    currentQuestion = { 
        question: "What is the opposite of 'big'?", 
        answer: "small" 
    };
    
    // Set up initial questions for level 1
    if (allQuestions && allQuestions.beginner && allQuestions.beginner.length > 0) {
        console.log("Using questions from file for the game start!");
        currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
        if (currentLevelQuestions.length > 0) {
            currentQuestion = currentLevelQuestions[0];
            console.log("Set initial question to:", currentQuestion.question);
        }
    } else {
        console.error("ERROR: Questions not loaded correctly at game start!");
        
        // Fallback to a single default question if loading failed
        currentLevelQuestions = [
            { question: "What is the opposite of 'big'?", answer: "small" }
        ];
        currentQuestion = currentLevelQuestions[0];
    }
}

// Parse questions directly from text content
function parseQuestionsDirectly(questionsText) {
    console.log("*** DIRECTLY PARSING QUESTIONS FROM TEXT ***");
    console.log("Text length:", questionsText.length);
    
    // Parse the questions file
    const lines = questionsText.split('\n');
    console.log(`File contains ${lines.length} lines`);
    
    // Initialize our questions object
    allQuestions = {
        beginner: [],
        intermediate: [],
        advanced: []
    };
    
    let currentDifficulty = '';
    
    // Process each line
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') continue;
        
        // Check if this is a difficulty header
        if (trimmedLine === 'BEGINNER') {
            currentDifficulty = 'beginner'; 
            console.log("Found BEGINNER section");
            continue;
        } else if (trimmedLine === 'INTERMEDIATE') {
            currentDifficulty = 'intermediate';
            console.log("Found INTERMEDIATE section");
            continue;
        } else if (trimmedLine === 'ADVANCED') {
            currentDifficulty = 'advanced';
            console.log("Found ADVANCED section");
            continue;
        }
        
        // Parse question and answer
        const parts = line.split('|');
        if (parts.length >= 2) {
            const question = parts[0].trim();
            const answer = parts[1].trim();
            
            if (currentDifficulty && question && answer) {
                allQuestions[currentDifficulty].push({ question, answer });
            }
        }
    }
    
    // Log the results
    console.log(`Loaded ${allQuestions.beginner.length} beginner questions`);
    console.log(`Loaded ${allQuestions.intermediate.length} intermediate questions`);
    console.log(`Loaded ${allQuestions.advanced.length} advanced questions`);
    
    // Dump a few sample questions to console to verify loading
    if (allQuestions.beginner.length > 0) {
        console.log("SAMPLE BEGINNER QUESTIONS:");
        for (let i = 0; i < Math.min(3, allQuestions.beginner.length); i++) {
            console.log(`- Q: "${allQuestions.beginner[i].question}" A: "${allQuestions.beginner[i].answer}"`);
        }
    }
    
    // Select fresh questions for the current level immediately
    if (allQuestions.beginner.length > 0) {
        // Reset the question tracker first
        questionTracker.resetTracking('beginner');
        questionTracker.resetTracking('intermediate');
        questionTracker.resetTracking('advanced');
        
        // Select fresh questions for the current level
        currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
        console.log("SELECTED QUESTIONS FOR LEVEL:", currentLevel);
        currentLevelQuestions.forEach((q, i) => {
            console.log(`${i+1}. "${q.question}" (Answer: "${q.answer}")`);
        });
        
        // Update the current question
        if (currentLevelQuestions.length > 0) {
            currentQuestion = currentLevelQuestions[0];
            console.log("SET CURRENT QUESTION TO:", currentQuestion.question);
        }
    }
    
    return allQuestions;
}

// Set up event listeners for the question box
function setupQuestionBoxEvents() {
    // Make sure question box is visible by default when debugging
    if (questionBox) {
        // Set the current question text immediately
        const questionElement = document.getElementById('current-question');
        if (questionElement) {
            questionElement.textContent = currentQuestion.question;
            console.log('Set initial question text:', currentQuestion.question);
        }
        
        // Show the question box
        questionBox.style.display = 'flex';
        console.log('Forced question box to display:flex');
    } else {
        console.log('WARNING: Could not find question-box element in the DOM');
    }
    
    // Add event listener for the submit button
    if (submitBtn) {
        // Remove any existing listeners to avoid duplicates
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        submitBtn = newSubmitBtn;
        
        // Add the click event listener
        submitBtn.addEventListener('click', function() {
            console.log('Submit button clicked!');
            checkAnswer();
        });
    }
    
    // Also check for Enter key press in the input field
    if (answerInput) {
        // Remove any existing listeners to avoid duplicates
        const newAnswerInput = answerInput.cloneNode(true);
        answerInput.parentNode.replaceChild(newAnswerInput, answerInput);
        answerInput = newAnswerInput;
        
        // Add keypress event listener
        answerInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                console.log('Enter key pressed in input!');
                checkAnswer();
            }
        });
    }
    
    // Force an encounter after a short delay to test question box
    setTimeout(function() {
        if (player && enemy) {
            encounterEnemy(player, enemy);
        }
    }, 1000);
}

// Load questions asynchronously
async function loadQuestionsAsync(scene) {
    try {
        console.log("LOADING QUESTIONS FROM FILE...");
        allQuestions = await loadQuestionsFromFile();
        
        // IMPORTANT: Once questions are loaded, immediately replace the default questions
        // with random questions from the file
        if (allQuestions) {
            // Log the number of questions in each category
            console.log("QUESTIONS LOADED:");
            console.log(`- Beginner: ${allQuestions.beginner.length} questions`);
            console.log(`- Intermediate: ${allQuestions.intermediate.length} questions`);
            console.log(`- Advanced: ${allQuestions.advanced.length} questions`);
            
            // Select 5 random questions for the current level using the question tracker
            currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
            console.log("Selected questions for current level:", 
                currentLevelQuestions.map(q => q.question).join(", "));
            
            // Set the current question to the first of the selected questions
            if (currentLevelQuestions.length > 0) {
                currentQuestion = currentLevelQuestions[0];
                console.log("CURRENT QUESTION SET TO:", currentQuestion.question);
            }
            
            // Update the question display immediately
            const questionElement = document.getElementById('current-question');
            if (questionElement) {
                questionElement.textContent = currentQuestion.question;
                console.log('Updated question display to:', currentQuestion.question);
            }
        } else {
            console.error("Failed to load questions from file!");
        }
    } catch (error) {
        console.error("Error loading questions:", error);
        alert("Error loading questions! Using default questions instead.");
    }
}

// Load questions from file
async function loadQuestionsFromFile() {
    try {
        console.log("Starting to load questions from file...");
        
        // Use fetch to load the questions file with an absolute path
        const response = await fetch('english_game_questions.txt');
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        console.log("Raw file content length:", text.length);
        
        // Parse the questions file
        const lines = text.split('\n');
        console.log(`File contains ${lines.length} lines`);
        
        const questions = {
            beginner: [],
            intermediate: [],
            advanced: []
        };
        
        let currentDifficulty = '';
        
        // Process each line
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '') continue;
            
            // Check if this is a difficulty header
            if (trimmedLine === 'BEGINNER') {
                currentDifficulty = 'beginner';
                console.log("Found BEGINNER section");
                continue;
            } else if (trimmedLine === 'INTERMEDIATE') {
                currentDifficulty = 'intermediate';
                console.log("Found INTERMEDIATE section");
                continue;
            } else if (trimmedLine === 'ADVANCED') {
                currentDifficulty = 'advanced';
                console.log("Found ADVANCED section");
                continue;
            }
            
            // Parse question and answer
            const parts = line.split('|');
            if (parts.length >= 2) {
                const question = parts[0].trim();
                const answer = parts[1].trim();
                
                if (currentDifficulty && question && answer) {
                    questions[currentDifficulty].push({ question, answer });
                }
            }
        }
        
        // Log the results
        console.log(`Loaded ${questions.beginner.length} beginner questions`);
        console.log(`Loaded ${questions.intermediate.length} intermediate questions`);
        console.log(`Loaded ${questions.advanced.length} advanced questions`);
        
        // Log the first few questions from each category to verify
        if (questions.beginner.length > 0) {
            console.log("First beginner question:", questions.beginner[0]);
        }
        if (questions.intermediate.length > 0) {
            console.log("First intermediate question:", questions.intermediate[0]);
        }
        if (questions.advanced.length > 0) {
            console.log("First advanced question:", questions.advanced[0]);
        }
        
        return questions;
    } catch (error) {
        console.error('Error loading questions file:', error);
        alert('Failed to load questions file! Using default questions instead.');
        
        // Return default questions as fallback
        return {
            beginner: [
                { question: "What is the opposite of 'big'?", answer: "small" },
                { question: "What color is the sky?", answer: "blue" },
                { question: "You use it to write.", answer: "pen" },
                { question: "What is 2 + 2?", answer: "4" },
                { question: "What color is grass?", answer: "green" },
                { question: "You sleep on it.", answer: "bed" },
                { question: "Not day, but...", answer: "night" },
                { question: "This animal says 'meow'.", answer: "cat" }
            ],
            intermediate: [
                { question: "What's the opposite of 'early'?", answer: "late" },
                { question: "Something you type on.", answer: "keyboard" },
                { question: "It comes after Tuesday.", answer: "wednesday" },
                { question: "A place full of books.", answer: "library" },
                { question: "You carry things in it on your back.", answer: "backpack" },
                { question: "A vehicle with two wheels.", answer: "bicycle" },
                { question: "Opposite of 'clean'.", answer: "dirty" },
                { question: "You keep your money in it.", answer: "wallet" }
            ],
            advanced: [
                { question: "A fancy word for 'fake smile'.", answer: "smirk" },
                { question: "Opposite of 'chaos'.", answer: "order" },
                { question: "A person who avoids people.", answer: "introvert" },
                { question: "Extremely boring task.", answer: "tedious" },
                { question: "A word for excessive pride.", answer: "arrogance" },
                { question: "Opposite of 'permanent'.", answer: "temporary" },
                { question: "A person who solves crimes.", answer: "detective" },
                { question: "Something poisonous.", answer: "toxic" }
            ]
        };
    }
}

// Handle resize events to reposition elements
function handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    
    if (background) {
        background.setPosition(width / 2, height / 2);
        background.setDisplaySize(width, height);
    }
    
    // Reposition other elements as needed...
}

function update() {
    if (!gameActive) return;

    // Handle player movement
    if (cursors.left.isDown) {
        player.setVelocityX(-160);
    } else if (cursors.right.isDown) {
        player.setVelocityX(160);
    } else {
        player.setVelocityX(0);
    }

    // Handle jumping
    if (cursors.up.isDown && player.body.touching.down) {
        player.setVelocityY(-330);
    }
}

function encounterEnemy(player, enemy) {
    // Pause the game
    gameActive = false;
    player.setVelocity(0, 0);
    enemy.setVelocity(0, 0);
    
    // Set a default question if none exists
    if (!currentQuestion || !currentQuestion.question) {
        currentQuestion = { 
            question: "What is the opposite of 'big'?", 
            answer: "small" 
        };
    }
    
    // Show question and question box
    if (questionBox) {
        // Set the current question text
        const questionElement = document.getElementById('current-question');
        if (questionElement) {
            // Set question text with a default fallback
            questionElement.textContent = currentQuestion.question || "What is the opposite of 'big'?";
            console.log("Set question text:", questionElement.textContent);
        } else {
            console.log("ERROR: Could not find question element");
        }
        
        // Show the question box
        questionBox.style.display = 'flex';
        
        // Focus on the answer input
        if (answerInput) {
            answerInput.value = '';
            setTimeout(() => answerInput.focus(), 100); // Delay focus to ensure the box is visible
        }
    } else {
        console.log("ERROR: Question box not found");
    }
}

// Function to check player's answer and handle game logic
function checkAnswer() {
    console.log("checkAnswer called, gameActive:", gameActive);
    
    // Get the user's answer and the correct answer
    const userAnswer = answerInput ? answerInput.value.trim().toLowerCase() : '';
    const correctAnswer = currentQuestion.answer.toLowerCase();
    
    console.log("User answer:", userAnswer);
    console.log("Correct answer:", correctAnswer);
    
    if (userAnswer === correctAnswer) {
        console.log("Correct!");
        // Prevent enemy health from going below 0
        enemyHealth = Math.max(0, enemyHealth - 20);
        console.log(`Enemy health: ${enemyHealth}`);
        
        // Update enemy health bar and text
        updateEnemyHealthDisplay();
        
        // Play attack animation in a requestAnimationFrame to ensure it's visible
        requestAnimationFrame(() => {
            playAttackAnimation();
        });
        
        // Check if enemy is defeated
        if (enemyHealth <= 0) {
            console.log("Enemy defeated!");
            
            // Instead of changing to enemy-sprite3, make the enemy invisible immediately
            if (enemy) {
                enemy.setVisible(false);
            }
            
            // Hide question box after a delay
            setTimeout(() => {
                if (questionBox) {
                    questionBox.style.display = 'none';
                }
                
                // Display victory message
                const scene = player.scene;
                scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height / 2, 'VICTORY!', {
                    fontSize: '32px',
                    fontFamily: '"Press Start 2P"',
                    fill: '#FFFFFF'
                }).setOrigin(0.5, 0.5);
                
                // Spawn new enemy after a delay with fresh questions for the next level
                setTimeout(() => {
                    currentLevel++; // Increment level first
                    resetForNextEnemy(scene); // Use the updated resetForNextEnemy function
                }, 2000);
            }, 1500);
            return; // Exit the function early
        }
    } else {
        console.log("Wrong!");
        playerHealth = Math.max(0, playerHealth - 20); // Prevent negative health
        console.log(`Player health: ${playerHealth}`);
        
        // Update player health bar and text
        updatePlayerHealthDisplay();
        
        // Play enemy attack animation
        requestAnimationFrame(() => {
            playEnemyAttackAnimation();
        });
        
        // Check if player lost
        if (playerHealth <= 0) {
            console.log("Game over!");
            
            // Hide question box for game over after a short delay
            setTimeout(() => {
                if (questionBox) {
                    questionBox.style.display = 'none';
                }
                
                // Display game over message
                const scene = player.scene;
                const gameOverText = scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height / 2 - 40, 'GAME OVER', {
                    fontSize: '32px',
                    fontFamily: '"Press Start 2P"',
                    fill: '#FF0000'
                }).setOrigin(0.5, 0.5);
                
                // Add "Try Again" button
                const tryAgainButton = scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height / 2 + 40, 'TRY AGAIN', {
                    fontSize: '20px',
                    fontFamily: '"Press Start 2P"',
                    fill: '#FFFFFF',
                    backgroundColor: '#333333',
                    padding: { left: 16, right: 16, top: 8, bottom: 8 }
                }).setOrigin(0.5, 0.5)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', () => tryAgainButton.setStyle({ fill: '#FFFF00' }))
                .on('pointerout', () => tryAgainButton.setStyle({ fill: '#FFFFFF' }))
                .on('pointerdown', () => restartGame(scene));
                
                // Add a border around the button
                const buttonBounds = tryAgainButton.getBounds();
                const buttonBorder = scene.add.rectangle(
                    buttonBounds.centerX, 
                    buttonBounds.centerY,
                    buttonBounds.width + 10, 
                    buttonBounds.height + 10,
                    0x000000, 0
                ).setStrokeStyle(2, 0xFFFFFF);
            }, 1000);
            
            // Reset game or show game over message
            gameActive = false;
            return; // Exit the function early
        }
    }
    
    // Get next question index (circular)
    let nextQuestionIndex = 0;
    for (let i = 0; i < currentLevelQuestions.length; i++) {
        if (currentLevelQuestions[i].question === currentQuestion.question) {
            nextQuestionIndex = (i + 1) % currentLevelQuestions.length;
            break;
        }
    }
    
    // Set the next question
    currentQuestion = currentLevelQuestions[nextQuestionIndex];
    
    // Set the new question text immediately on the DOM element
    const questionElement = document.getElementById('current-question');
    if (questionElement) {
        questionElement.textContent = currentQuestion.question;
        console.log("Set new question:", currentQuestion.question);
    }
    
    // Reset input field but keep question box visible
    if (answerInput) {
        answerInput.value = '';
        answerInput.focus(); // Focus back on input for next question
    }
}

// Function to update the player health display
function updatePlayerHealthDisplay() {
    const healthPercent = playerHealth / 100;
    playerHealthBar.width = 200 * healthPercent;
    playerHealthText.setText(`PLAYER: ${playerHealth}HP`);
    
    // Change color based on health
    if (healthPercent > 0.5) {
        playerHealthBar.fillColor = 0x00FF00; // Green
    } else if (healthPercent > 0.25) {
        playerHealthBar.fillColor = 0xFFFF00; // Yellow
    } else {
        playerHealthBar.fillColor = 0xFF0000; // Red
    }
}

// Function to update the enemy health display
function updateEnemyHealthDisplay() {
    const healthPercent = enemyHealth / 100;
    enemyHealthBar.width = 200 * healthPercent;
    enemyHealthText.setText(`ENEMY: ${enemyHealth}HP`);
    
    // Change color based on health
    if (healthPercent > 0.5) {
        enemyHealthBar.fillColor = 0x00FF00; // Green
    } else if (healthPercent > 0.25) {
        enemyHealthBar.fillColor = 0xFFFF00; // Yellow
    } else {
        enemyHealthBar.fillColor = 0xFF0000; // Red
    }
}

// Function to play the attack animation when player answers correctly
function playAttackAnimation() {
    console.log("Playing attack animation...");
    
    // Make sure we have valid player and enemy objects
    if (!player || !player.scene || !enemy) {
        console.error("Cannot play animation - player or enemy not available");
        return;
    }
    
    const scene = player.scene;
    
    // Store the original positions
    const originalPlayerX = player.x;
    const originalEnemyX = enemy.x;
    
    // Calculate distances based on screen width
    const width = scene.scale.width;
    const moveDistance = width * 0.25; // Even more dramatic movement (25% of screen width)
    
    console.log("Animation starting with player at:", originalPlayerX, "moving distance:", moveDistance);
    
    // Disable physics during animation to prevent collision interference
    player.body.enable = false;
    enemy.body.enable = false;
    
    // Ensure game doesn't resume during animation
    gameActive = false;
    
    // Make player visually distinct during attack
    player.setTint(0x00ffff); // Cyan tint for player during attack
    
    // Using direct position updates instead of tweens for reliability
    // 1. Move player toward enemy
    player.x += moveDistance;
    
    // 2. After a delay, move player back and trigger enemy effects
    setTimeout(() => {
        // Move player back
        player.x = originalPlayerX;
        
        // Add a yellow flash at enemy position
        const flashCircle = scene.add.circle(
            enemy.x, 
            enemy.y, 
            60, // Large radius for visibility
            0xffff00, // Yellow color
            0.8 // High alpha for visibility
        );
        
        // Scale and fade the flash
        let scale = 1;
        let alpha = 0.8;
        const expandFlash = () => {
            scale += 0.1;
            alpha -= 0.05;
            flashCircle.setScale(scale);
            flashCircle.setAlpha(alpha);
            
            if (alpha > 0) {
                setTimeout(expandFlash, 30);
            } else {
                flashCircle.destroy();
            }
        };
        expandFlash();
        
        // Make enemy flash red
        enemy.setTint(0xff0000);
        
        // Make enemy shake back and forth
        let shakeCount = 0;
        const maxShakes = 5;
        const shakeDistance = 20; // Larger for visibility
        
        const shakeEnemy = () => {
            if (shakeCount < maxShakes) {
                // Move enemy left/right based on even/odd count
                enemy.x = originalEnemyX + (shakeCount % 2 === 0 ? -shakeDistance : shakeDistance);
                shakeCount++;
                setTimeout(shakeEnemy, 80);
            } else {
                // Reset enemy position when done
                enemy.x = originalEnemyX;
                
                // Reset tints and enable physics after animation completes
                setTimeout(() => {
                    enemy.clearTint();
                    player.clearTint();
                    
                    // Re-enable physics
                    player.body.enable = true;
                    enemy.body.enable = true;
                    
                    console.log("Animation sequence completed");
                }, 100);
            }
        };
        
        // Start enemy shaking
        shakeEnemy();
        
    }, 250); // Wait before moving back
    
    console.log("Animation sequence started with direct position updates");
}

// Function to play the attack animation when player answers incorrectly
function playEnemyAttackAnimation() {
    console.log("Playing enemy attack animation...");
    
    // Make sure we have valid player and enemy objects
    if (!player || !player.scene || !enemy) {
        console.error("Cannot play animation - player or enemy not available");
        return;
    }
    
    const scene = player.scene;
    
    // Store the original positions
    const originalPlayerX = player.x;
    const originalEnemyX = enemy.x;
    
    // Calculate distances based on screen width
    const width = scene.scale.width;
    const moveDistance = width * 0.25; // Even more dramatic movement (25% of screen width)
    
    console.log("Animation starting with enemy at:", originalEnemyX, "moving distance:", moveDistance);
    
    // Disable physics during animation to prevent collision interference
    player.body.enable = false;
    enemy.body.enable = false;
    
    // Ensure game doesn't resume during animation
    gameActive = false;
    
    // Make enemy visually distinct during attack
    enemy.setTint(0xff0000); // Red tint for enemy during attack
    
    // Using direct position updates instead of tweens for reliability
    // 1. Move enemy toward player
    enemy.x -= moveDistance;
    
    // 2. After a delay, move enemy back and trigger player effects
    setTimeout(() => {
        // Move enemy back
        enemy.x = originalEnemyX;
        
        // Add a red flash at player position
        const flashCircle = scene.add.circle(
            player.x, 
            player.y, 
            60, // Large radius for visibility
            0xff0000, // Red color
            0.8 // High alpha for visibility
        );
        
        // Scale and fade the flash
        let scale = 1;
        let alpha = 0.8;
        const expandFlash = () => {
            scale += 0.1;
            alpha -= 0.05;
            flashCircle.setScale(scale);
            flashCircle.setAlpha(alpha);
            
            if (alpha > 0) {
                setTimeout(expandFlash, 30);
            } else {
                flashCircle.destroy();
            }
        };
        expandFlash();
        
        // Make player flash cyan
        player.setTint(0x00ffff);
        
        // Make player shake back and forth
        let shakeCount = 0;
        const maxShakes = 5;
        const shakeDistance = 20; // Larger for visibility
        
        const shakePlayer = () => {
            if (shakeCount < maxShakes) {
                // Move player left/right based on even/odd count
                player.x = originalPlayerX + (shakeCount % 2 === 0 ? -shakeDistance : shakeDistance);
                shakeCount++;
                setTimeout(shakePlayer, 80);
            } else {
                // Reset player position when done
                player.x = originalPlayerX;
                
                // Reset tints and enable physics after animation completes
                setTimeout(() => {
                    player.clearTint();
                    enemy.clearTint();
                    
                    // Re-enable physics
                    player.body.enable = true;
                    enemy.body.enable = true;
                    
                    console.log("Animation sequence completed");
                }, 100);
            }
        };
        
        // Start player shaking
        shakePlayer();
        
    }, 250); // Wait before moving back
    
    console.log("Animation sequence started with direct position updates");
}

// Replace the resetForNextEnemy function with a simplified version
function resetForNextEnemy(scene) {
    console.log("===== LEVEL TRANSITION =====");
    
    // Clear victory message
    scene.children.each(child => {
        if (child.type === 'Text' && child.text === 'VICTORY!') {
            child.destroy();
        }
    });
    
    // Update level text
    levelText.setText(`LEVEL ${currentLevel}`);
    
    // Reset enemy health
    enemyHealth = 100;
    
    // Show level transition message
    const levelUpText = scene.add.text(
        scene.cameras.main.width / 2, 
        scene.cameras.main.height / 2, 
        `LEVEL ${currentLevel}`, 
        {
            fontSize: '32px',
            fontFamily: '"Press Start 2P"',
            fill: '#FFFF00'
        }
    ).setOrigin(0.5, 0.5);
    
    // After showing the level message, set up the next level
    setTimeout(() => {
        // Fade out level message
        scene.tweens.add({
            targets: levelUpText,
            alpha: 0,
            duration: 1000,
            onComplete: () => levelUpText.destroy()
        });
        
        // Destroy the old enemy before creating a new one
        if (enemy) {
            enemy.destroy();
        }
        
        // Create a new enemy
        const width = scene.scale.width;
        const height = scene.scale.height;
        
        // Create a new enemy at the original position
        enemy = scene.physics.add.sprite(width * 0.75, height * 0.75, currentLevel === 2 ? 'enemy-sprite2' : 'enemy-sprite');
        enemy.setScale(0.35);
        enemy.setCollideWorldBounds(true);
        
        // Add physics colliders for the new enemy
        scene.physics.add.collider(enemy, platforms);
        scene.physics.add.overlap(player, enemy, encounterEnemy, null, scene);
        
        // Add breathing animation to the new enemy
        scene.breathingAnimationEnemy = scene.tweens.add({
            targets: enemy,
            y: enemy.y - 2,
            duration: 1600,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: 800,
            onStart: function() {
                enemy.body.allowGravity = false;
            },
            onComplete: function() {
                enemy.body.allowGravity = true;
            }
        });
        
        // IMPORTANT: Load new random questions for the new level
        currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
        console.log("Selected new questions for level " + currentLevel + ":", 
            currentLevelQuestions.map(q => q.question).join(", "));
        
        // Set the first question for the new level
        if (currentLevelQuestions.length > 0) {
            currentQuestion = currentLevelQuestions[0];
            
            // Update the question display
            const questionElement = document.getElementById('current-question');
            if (questionElement) {
                questionElement.textContent = currentQuestion.question;
            }
        }
        
        // Update the health display
        updateEnemyHealthDisplay();
        
        // Recreate UI elements to ensure button works
        setupQuestionBoxEvents();
        
        // Resume game after everything is set up
        setTimeout(() => {
            // Start encounter with new enemy
            gameActive = true;
            encounterEnemy(player, enemy);
        }, 500);
    }, 2000);
}

// Function to restart the game
function restartGame(scene) {
    console.log("Restarting game...");
    
    // Reset game variables
    currentLevel = 1;
    playerHealth = 100;
    enemyHealth = 100;
    currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
    currentQuestion = currentLevelQuestions.length > 0 ? currentLevelQuestions[0] : { question: "What is the opposite of 'big'?", answer: "small" };
    
    // Clear all game objects
    scene.children.each(child => child.destroy());
    
    // Recreate the game scene
    create.call(scene);
    
    // Resume the game
    gameActive = true;
}
