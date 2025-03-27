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

function preload() {
    // Load images
    this.load.image('background', 'countryside.png');
    this.load.image('ground', 'platform.png');
    this.load.image('player', 'player-sprite.png');
    this.load.image('enemy', 'enemy-sprite.png');
    this.load.image('enemy-sprite2', 'enemy-sprite2.png');
    this.load.image('enemy-sprite3', 'enemy-sprite3.png'); // Add defeated enemy sprite
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
    
    // Create platforms group with static physics - only for ground, removing floating platforms
    platforms = this.physics.add.staticGroup();
    
    // Create ground - positioned at bottom of screen
    platforms.create(centerX, height - 20, 'ground').setScale(2).refreshBody();
    
    // Create player - scaled down to 70% of previous size (0.35 instead of 0.5)
    player = this.physics.add.sprite(width * 0.25, height * 0.75, 'player');
    player.setScale(0.35);
    player.setBounce(0.2);
    player.setCollideWorldBounds(true);
    
    // Create enemy - scaled down to 70% of previous size (0.35 instead of 0.5)
    enemy = this.physics.add.sprite(width * 0.75, height * 0.75, 'enemy');
    enemy.setScale(0.35);
    enemy.setCollideWorldBounds(true);
    
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
    
    // Make sure the game responds to window resize events
    this.scale.on('resize', this.handleResize, this);
    
    // Force an encounter after a short delay to test question box
    this.time.delayedCall(1000, function() {
        encounterEnemy(player, enemy);
    });
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
        
        // Generate new question for next round
        const questions = [
            { question: "What is the opposite of 'hot'?", answer: "cold" },
            { question: "What is 2 + 2?", answer: "4" },
            { question: "What color is the sky?", answer: "blue" },
            { question: "What is the capital of France?", answer: "paris" },
            { question: "How many legs does a cat have?", answer: "4" },
            { question: "What planet do we live on?", answer: "earth" },
            { question: "How many days are in a week?", answer: "7" },
            { question: "What is the first letter of the alphabet?", answer: "a" }
        ];
        
        // Get a different question than the current one
        let newQuestion;
        do {
            newQuestion = questions[Math.floor(Math.random() * questions.length)];
        } while (newQuestion.question === currentQuestion.question);
        
        // Update the current question in the window context
        window.setQuestion(newQuestion.question, newQuestion.answer);
        
        // Set the new question text immediately on the DOM element
        const questionElement = document.getElementById('current-question');
        if (questionElement) {
            questionElement.textContent = newQuestion.question;
            console.log("Set new question:", newQuestion.question);
        }
        
        // Play attack animation in a requestAnimationFrame to ensure it's visible
        requestAnimationFrame(() => {
            playAttackAnimation();
        });
        
        // Reset input field but keep question box visible
        if (answerInput) {
            answerInput.value = '';
            answerInput.focus(); // Focus back on input for next question
        }
        
        // Check if enemy is defeated
        if (enemyHealth <= 0) {
            console.log("Enemy defeated!");
            
            // Change enemy sprite to defeated version
            if (enemy) {
                enemy.setTexture('enemy-sprite3');
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
            }, 1500);
        }
    } else {
        console.log("Wrong!");
        playerHealth = Math.max(0, playerHealth - 20); // Prevent negative health
        console.log(`Player health: ${playerHealth}`);
        
        // Update player health bar and text
        updatePlayerHealthDisplay();
        
        // Check if player lost
        if (playerHealth <= 0) {
            console.log("Game over!");
            // Handle game over logic here
            
            // Hide question box for game over after a short delay
            setTimeout(() => {
                if (questionBox) {
                    questionBox.style.display = 'none';
                }
                
                // Display game over message
                const scene = player.scene;
                scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height / 2, 'GAME OVER', {
                    fontSize: '32px',
                    fontFamily: '"Press Start 2P"',
                    fill: '#FF0000'
                }).setOrigin(0.5, 0.5);
            }, 1000);
            
            // Reset game or show game over message
            gameActive = false;
        } else {
            // Just clear the input field for wrong answers but leave question visible
            if (answerInput) {
                answerInput.value = '';
                answerInput.focus(); // Re-focus the input for another try
            }
        }
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

// Function to resume gameplay after answering a question
window.resumeGame = function() {
    if (playerHealth > 0 && enemyHealth > 0) {
        gameActive = true;
    } else {
        // Game is over, handle accordingly
        console.log(playerHealth <= 0 ? "Player defeated!" : "Enemy defeated!");
        // You might want to restart the level or game here
    }
}

// Add a function to set a new question
window.setQuestion = function(question, answer) {
    currentQuestion = { question, answer };
}

// Export game instance if needed
export default game;