// Этот код обрабатывает инициализацию в контексте Telegram Games
window.onload = function() {
    // Проверяем, запущена ли игра в контексте Telegram
    if (window.TelegramGameProxy) {
        console.log("Telegram Game Proxy detected!");
        window.telegramParams = window.TelegramGameProxy.initParams || {};
        console.log("Game started from Telegram with params:", window.telegramParams);
        
        // Сообщаем Telegram что игра загружена
        window.TelegramGameProxy.postEvent("GAME_LOADED", {}, true);
    } else {
        console.log("Game is running in standalone mode (not in Telegram)");
    }
};

// Этот код правильно импортирует Phaser как ES модуль
import Phaser from 'phaser';

// Добавляем консольный лог для отслеживания загрузки игрового модуля
console.log('Game module loaded! Phaser version:', Phaser.VERSION);

// Функция для предзагрузки ресурсов с использованием конструктора Image и относительных путей
function preloadAssets() {
  console.log('Preloading assets with root-relative paths...');
  
  // Список всех изображений для предзагрузки
  const imagesToLoad = [
    '/countryside.png',
    '/platform.png',
    '/player-sprite.png',
    '/enemy-sprite.png',
    '/enemy-sprite2.png',
    '/enemy-sprite3.png'
  ];
  
  // Создаем промис для каждой картинки для загрузки
  const imagePromises = imagesToLoad.map(src => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log(`Successfully loaded: ${src}`);
        resolve(img);
      };
      img.onerror = () => {
        console.error(`Failed to load: ${src}`);
        // Разрешаем в любом случае, чтобы не блокировать игру
        resolve(null);
      };
      img.src = src;
    });
  });
  
  // Также загружаем файл вопросов
  const questionsPromise = fetch('/english_game_questions.txt')
    .then(response => {
      if (!response.ok) {
        console.error('Failed to load questions file');
        return null;
      }
      console.log('Successfully loaded questions file');
      return response.text();
    })
    .catch(error => {
      console.error('Error loading questions file:', error);
      return null;
    });
  
  // Возвращаем промис, который разрешается, когда все ресурсы загружены
  return Promise.all([...imagePromises, questionsPromise])
    .then(results => {
      // Последний результат - это текст вопросов
      const questionsText = results[results.length - 1];
      
      // Обрабатываем текст вопросов, если он доступен
      if (questionsText) {
        console.log('Questions text loaded, length:', questionsText.length);
        // Сохраняем для дальнейшего использования
        window.preloadedQuestionsText = questionsText;
      }
      
      console.log('All assets preloaded successfully');
      return results;
    });
}

// Конфигурация игры с адаптивным масштабированием
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

// Инициализируем игру только после предзагрузки ресурсов
let game;

// Ждем полной загрузки DOM перед запуском игры
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded, preloading assets before initializing game');
    
    // Сначала предзагружаем ресурсы, затем инициализируем игру
    preloadAssets().then(() => {
        console.log('Assets preloaded, initializing game');
        game = new Phaser.Game(config);
    }).catch(error => {
        console.error('Error during asset preloading:', error);
        // Инициализируем игру в любом случае, чтобы показать хотя бы что-то
        game = new Phaser.Game(config);
    });
});

// Игровые переменные
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
let allQuestions = null; // Будет хранить все загруженные вопросы
let currentLevelQuestions = []; // Прямое инициализация с пустым массивом вместо закодированных вопросов
let currentLevel = 1; // Отслеживаем текущий уровень

// Система отслеживания вопросов, чтобы предотвратить повторы
const questionTracker = {
    // Отслеживаем вопросы, использованные на каждом уровне/сложности
    usedQuestions: {
        beginner: new Set(),
        intermediate: new Set(),
        advanced: new Set()
    },
    
    // Получаем имя сложности на основе уровня
    getDifficultyForLevel: function(level) {
        if (level === 1) return 'beginner';
        if (level === 2) return 'intermediate';
        return 'advanced';
    },
    
    // Сбрасываем отслеживание для конкретной сложности
    resetTracking: function(difficulty) {
        this.usedQuestions[difficulty] = new Set();
        console.log(`Reset tracking for ${difficulty} questions`);
    },
    
    // Отмечаем вопрос как использованный
    markAsUsed: function(level, questionText) {
        const difficulty = this.getDifficultyForLevel(level);
        this.usedQuestions[difficulty].add(questionText);
        console.log(`Marked as used: [${difficulty}] "${questionText}"`);
    },
    
    // Проверяем, был ли вопрос использован
    hasBeenUsed: function(level, questionText) {
        const difficulty = this.getDifficultyForLevel(level);
        return this.usedQuestions[difficulty].has(questionText);
    },
    
    // Выбираем свежие вопросы для уровня
    selectFreshQuestions: function(level, count = 5) {
        if (!allQuestions) {
            console.error("Questions not loaded yet!");
            return [];
        }
        
        const difficulty = this.getDifficultyForLevel(level);
        const allPoolQuestions = allQuestions[difficulty] || [];
        
        // Если мы использовали все или почти все вопросы, сбрасываем отслеживание для этой сложности
        if (this.usedQuestions[difficulty].size >= allPoolQuestions.length - count) {
            this.resetTracking(difficulty);
        }
        
        // Фильтруем вопросы, которые были использованы
        const availableQuestions = allPoolQuestions.filter(q => 
            !this.usedQuestions[difficulty].has(q.question)
        );
        
        // Если у нас каким-то образом меньше доступных вопросов, чем нужно, сбрасываем и пробуем снова
        if (availableQuestions.length < count) {
            this.resetTracking(difficulty);
            return this.selectFreshQuestions(level, count);
        }
        
        // Перемешиваем и выбираем count случайных вопросов
        const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);
        
        // Отмечаем эти вопросы как использованные
        selected.forEach(q => this.markAsUsed(level, q.question));
        
        console.log(`Selected ${selected.length} fresh ${difficulty} questions for level ${level}`);
        return selected;
    }
};

// Функция для выбора 5 случайных вопросов для текущего уровня
function selectQuestionsForLevel(level) {
    // Используем нашу новую систему отслеживания вопросов, чтобы получить свежие вопросы для каждого уровня
    return questionTracker.selectFreshQuestions(level);
}

function preload() {
    // Загружаем изображения с относительными путями в Phaser
    this.load.image('background', '/countryside.png');
    this.load.image('ground', '/platform.png');
    this.load.image('player', '/player-sprite.png');
    this.load.image('enemy', '/enemy-sprite.png');
    this.load.image('enemy-sprite2', '/enemy-sprite2.png');
    this.load.image('enemy-sprite3', '/enemy-sprite3.png');
    
    // Если вопросы были предзагружены, используем эти данные вместо загрузки снова
    if (window.preloadedQuestionsText) {
        console.log("Using preloaded questions data");
        this.cache.text.add('questions', window.preloadedQuestionsText);
    } else {
        console.log("Questions not preloaded, loading directly");
        this.load.text('questions', '/english_game_questions.txt');
    }
}

function create() {
    // Рассчитываем некоторые значения для адаптивного позиционирования
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Добавляем фон - позиционируем, чтобы он красиво заполнил сцену
    background = this.add.image(centerX, centerY, 'background');
    background.setDisplaySize(width, height);
    
    // НЕМЕДЛЕННО ОБРАБАТЫВАЕМ ВОПРОСЫ ИЗ ФАЙЛА, который был загружен в preload
    // Это гарантирует, что мы используем вопросы из файла перед любым взаимодействием с игрой
    const questionsText = this.cache.text.get('questions');
    if (questionsText) {
        console.log("FOUND QUESTIONS FILE IN CACHE, LENGTH:", questionsText.length);
        parseQuestionsDirectly(questionsText);
    } else {
        console.error("ERROR: Could not find questions file in cache!");
    }
    
    // Создаем группу платформ со статической физикой - только для земли, убираем плавающие платформы
    platforms = this.physics.add.staticGroup();
    
    // Создаем землю - позиционируем внизу экрана
    platforms.create(centerX, height - 10, 'ground').setScale(width / 192, 1).refreshBody();
    
    // Создаем игрока - уменьшенного до 70% от предыдущего размера (0.35 вместо 0.5)
    player = this.physics.add.sprite(width * 0.25, height * 0.75, 'player');
    player.setScale(0.35);
    player.setBounce(0.2);
    player.setCollideWorldBounds(true);
    player.flipX = true; // Отзеркаливаем спрайт игрока по горизонтали
    
    // Создаем врага - уменьшенного до 70% от предыдущего размера (0.35 вместо 0.5)
    enemy = this.physics.add.sprite(width * 0.75, height * 0.75, 'enemy');
    enemy.setScale(0.35);
    enemy.setCollideWorldBounds(true);
    
    // Добавляем анимацию дыхания игроку и врагу - более тонкая и плавная
    this.breathingAnimationPlayer = this.tweens.add({
        targets: player,
        y: player.y - 2, // Уменьшили движение с 5 до 2 пикселей для тонкости
        duration: 1500, // Более длительный срок для более плавного движения
        ease: 'Sine.easeInOut',
        yoyo: true, 
        repeat: -1,
        onStart: function() {
            // Убедитесь, что физика не мешает анимации
            player.body.allowGravity = false;
        },
        onComplete: function() {
            player.body.allowGravity = true;
        }
    });
    
    this.breathingAnimationEnemy = this.tweens.add({
        targets: enemy,
        y: enemy.y - 2, // Уменьшили движение с 5 до 2 пикселей для тонкости
        duration: 1600, // Немного другое время для вариации
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: 800, // Больше смещения для меньшей синхронизации
        onStart: function() {
            // Убедитесь, что физика не мешает анимации
            enemy.body.allowGravity = false;
        },
        onComplete: function() {
            enemy.body.allowGravity = true;
        }
    });
    
    // Настраиваем столкновения
    this.physics.add.collider(player, platforms);
    this.physics.add.collider(enemy, platforms);
    
    // Настраиваем столкновение между игроком и врагом
    this.physics.add.overlap(player, enemy, encounterEnemy, null, this);
    
    // Настраиваем управление
    cursors = this.input.keyboard.createCursorKeys();
    
    // Создаем элементы интерфейса - позиционируем относительно размеров экрана
    // Полоса здоровья игрока (фон)
    const playerHealthBg = this.add.rectangle(width * 0.15, 30, width * 0.25, 20, 0x000000);
    playerHealthBg.setOrigin(0, 0.5);
    playerHealthBg.setStrokeStyle(2, 0xFFFFFF);
    
    // Полоса здоровья игрока (заливка)
    playerHealthBar = this.add.rectangle(width * 0.15, 30, width * 0.25, 16, 0x00FF00);
    playerHealthBar.setOrigin(0, 0.5);
    
    // Текст здоровья игрока
    playerHealthText = this.add.text(width * 0.15, 50, 'PLAYER: 100HP', {
        fontSize: '14px',
        fontFamily: '"Press Start 2P"',
        fill: '#FFFFFF'
    }).setOrigin(0, 0.5);
    
    // Полоса здоровья врага (фон)
    const enemyHealthBg = this.add.rectangle(width * 0.85, 30, width * 0.25, 20, 0x000000);
    enemyHealthBg.setOrigin(1, 0.5);
    enemyHealthBg.setStrokeStyle(2, 0xFFFFFF);
    
    // Полоса здоровья врага (заливка)
    enemyHealthBar = this.add.rectangle(width * 0.85, 30, width * 0.25, 16, 0x00FF00);
    enemyHealthBar.setOrigin(1, 0.5);
    
    // Текст здоровья врага
    enemyHealthText = this.add.text(width * 0.85, 50, 'ENEMY: 100HP', {
        fontSize: '14px',
        fontFamily: '"Press Start 2P"',
        fill: '#FFFFFF'
    }).setOrigin(1, 0.5);
    
    // Текст уровня
    levelText = this.add.text(centerX, 30, 'LEVEL 1', {
        fontSize: '18px',
        fontFamily: '"Press Start 2P"',
        fill: '#FFFFFF'
    }).setOrigin(0.5, 0.5);
    
    // Получаем ссылку на HTML элемент вопроса и элементы ввода
    questionBox = document.getElementById('question-box');
    answerInput = document.getElementById('answer-input');
    submitBtn = document.getElementById('submit-btn');
    
    // Отладка - логируем, если элементы были найдены
    console.log('Question box found:', questionBox ? 'YES' : 'NO');
    console.log('Answer input found:', answerInput ? 'YES' : 'NO');
    console.log('Submit button found:', submitBtn ? 'YES' : 'NO');
    
    // Настраиваем обработчики событий для вопросительного бокса
    setupQuestionBoxEvents();
    
    // Убедитесь, что игра реагирует на события изменения размера окна
    this.scale.on('resize', this.handleResize, this);
    
    // Начальный вопрос по умолчанию - будет заменен, когда вопросы загрузятся
    currentQuestion = { 
        question: "What is the opposite of 'big'?", 
        answer: "small" 
    };
    
    // Настраиваем начальные вопросы для уровня 1
    if (allQuestions && allQuestions.beginner && allQuestions.beginner.length > 0) {
        console.log("Using questions from file for the game start!");
        currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
        if (currentLevelQuestions.length > 0) {
            currentQuestion = currentLevelQuestions[0];
            console.log("Set initial question to:", currentQuestion.question);
        }
    } else {
        console.error("ERROR: Questions not loaded correctly at game start!");
        
        // Резервный вариант - один вопрос по умолчанию, если загрузка не удалась
        currentLevelQuestions = [
            { question: "What is the opposite of 'big'?", answer: "small" }
        ];
        currentQuestion = currentLevelQuestions[0];
    }
}

// Парсим вопросы напрямую из текстового содержимого
function parseQuestionsDirectly(questionsText) {
    console.log("*** DIRECTLY PARSING QUESTIONS FROM TEXT ***");
    console.log("Text length:", questionsText.length);
    
    // Парсим файл вопросов
    const lines = questionsText.split('\n');
    console.log(`File contains ${lines.length} lines`);
    
    // Инициализируем наш объект вопросов
    allQuestions = {
        beginner: [],
        intermediate: [],
        advanced: []
    };
    
    let currentDifficulty = '';
    
    // Обрабатываем каждую строку
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') continue;
        
        // Проверяем, является ли это заголовком сложности
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
        
        // Парсим вопрос и ответ
        const parts = line.split('|');
        if (parts.length >= 2) {
            const question = parts[0].trim();
            const answer = parts[1].trim();
            
            if (currentDifficulty && question && answer) {
                allQuestions[currentDifficulty].push({ question, answer });
            }
        }
    }
    
    // Логируем результаты
    console.log(`Loaded ${allQuestions.beginner.length} beginner questions`);
    console.log(`Loaded ${allQuestions.intermediate.length} intermediate questions`);
    console.log(`Loaded ${allQuestions.advanced.length} advanced questions`);
    
    // Выводим несколько образцов вопросов в консоль, чтобы проверить загрузку
    if (allQuestions.beginner.length > 0) {
        console.log("SAMPLE BEGINNER QUESTIONS:");
        for (let i = 0; i < Math.min(3, allQuestions.beginner.length); i++) {
            console.log(`- Q: "${allQuestions.beginner[i].question}" A: "${allQuestions.beginner[i].answer}"`);
        }
    }
    
    // Немедленно выбираем свежие вопросы для текущего уровня
    if (allQuestions.beginner.length > 0) {
        // Сначала сбрасываем отслеживатель вопросов
        questionTracker.resetTracking('beginner');
        questionTracker.resetTracking('intermediate');
        questionTracker.resetTracking('advanced');
        
        // Выбираем свежие вопросы для текущего уровня
        currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
        console.log("SELECTED QUESTIONS FOR LEVEL:", currentLevel);
        currentLevelQuestions.forEach((q, i) => {
            console.log(`${i+1}. "${q.question}" (Answer: "${q.answer}")`);
        });
        
        // Обновляем текущий вопрос
        if (currentLevelQuestions.length > 0) {
            currentQuestion = currentLevelQuestions[0];
            console.log("SET CURRENT QUESTION TO:", currentQuestion.question);
        }
    }
    
    return allQuestions;
}

// Настраиваем обработчики событий для вопросительного бокса
function setupQuestionBoxEvents() {
    // Убедитесь, что вопросительный бокс виден по умолчанию при отладке
    if (questionBox) {
        // Устанавливаем текст текущего вопроса немедленно
        const questionElement = document.getElementById('current-question');
        if (questionElement) {
            questionElement.textContent = currentQuestion.question;
            console.log('Set initial question text:', currentQuestion.question);
        }
        
        // Показываем вопросительный бокс
        questionBox.style.display = 'flex';
        console.log('Forced question box to display:flex');
    } else {
        console.log('WARNING: Could not find question-box element in the DOM');
    }
    
    // Добавляем обработчик событий для кнопки отправки
    if (submitBtn) {
        // Убираем любые существующие обработчики, чтобы избежать дубликатов
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        submitBtn = newSubmitBtn;
        
        // Добавляем обработчик события клика
        submitBtn.addEventListener('click', function() {
            console.log('Submit button clicked!');
            checkAnswer();
        });
    }
    
    // Также проверяем нажатие клавиши Enter в поле ввода
    if (answerInput) {
        // Убираем любые существующие обработчики, чтобы избежать дубликатов
        const newAnswerInput = answerInput.cloneNode(true);
        answerInput.parentNode.replaceChild(newAnswerInput, answerInput);
        answerInput = newAnswerInput;
        
        // Добавляем обработчик события нажатия клавиши
        answerInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                console.log('Enter key pressed in input!');
                checkAnswer();
            }
        });
    }
    
    // Принудительно вызываем встречу после короткой задержки, чтобы протестировать вопросительный бокс
    setTimeout(function() {
        if (player && enemy) {
            encounterEnemy(player, enemy);
        }
    }, 1000);
}

// Загружаем вопросы асинхронно
async function loadQuestionsAsync(scene) {
    try {
        console.log("LOADING QUESTIONS FROM FILE...");
        allQuestions = await loadQuestionsFromFile();
        
        // ВАЖНО: Как только вопросы загружены, немедленно заменяем вопросы по умолчанию
        // случайными вопросами из файла
        if (allQuestions) {
            // Логируем количество вопросов в каждой категории
            console.log("QUESTIONS LOADED:");
            console.log(`- Beginner: ${allQuestions.beginner.length} questions`);
            console.log(`- Intermediate: ${allQuestions.intermediate.length} questions`);
            console.log(`- Advanced: ${allQuestions.advanced.length} questions`);
            
            // Выбираем 5 случайных вопросов для текущего уровня с помощью отслеживателя вопросов
            currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
            console.log("Selected questions for current level:", 
                currentLevelQuestions.map(q => q.question).join(", "));
            
            // Устанавливаем текущий вопрос на первый из выбранных вопросов
            if (currentLevelQuestions.length > 0) {
                currentQuestion = currentLevelQuestions[0];
                console.log("CURRENT QUESTION SET TO:", currentQuestion.question);
            }
            
            // Обновляем отображение вопроса немедленно
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

// Загружаем вопросы из файла
async function loadQuestionsFromFile() {
    try {
        console.log("Starting to load questions from file...");
        
        // Используем fetch для загрузки файла вопросов с абсолютным путем
        const response = await fetch('english_game_questions.txt');
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        console.log("Raw file content length:", text.length);
        
        // Парсим файл вопросов
        const lines = text.split('\n');
        console.log(`File contains ${lines.length} lines`);
        
        const questions = {
            beginner: [],
            intermediate: [],
            advanced: []
        };
        
        let currentDifficulty = '';
        
        // Обрабатываем каждую строку
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '') continue;
            
            // Проверяем, является ли это заголовком сложности
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
            
            // Парсим вопрос и ответ
            const parts = line.split('|');
            if (parts.length >= 2) {
                const question = parts[0].trim();
                const answer = parts[1].trim();
                
                if (currentDifficulty && question && answer) {
                    questions[currentDifficulty].push({ question, answer });
                }
            }
        }
        
        // Логируем результаты
        console.log(`Loaded ${questions.beginner.length} beginner questions`);
        console.log(`Loaded ${questions.intermediate.length} intermediate questions`);
        console.log(`Loaded ${questions.advanced.length} advanced questions`);
        
        // Логируем первые несколько вопросов из каждой категории, чтобы проверить
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
        
        // Возвращаем вопросы по умолчанию в качестве резервного варианта
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

// Обрабатываем события изменения размера, чтобы изменить позицию элементов
function handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    
    if (background) {
        background.setPosition(width / 2, height / 2);
        background.setDisplaySize(width, height);
    }
    
    // Перемещаем другие элементы по мере необходимости...
}

function update() {
    if (!gameActive) return;

    // Обрабатываем движение игрока
    if (cursors.left.isDown) {
        player.setVelocityX(-160);
    } else if (cursors.right.isDown) {
        player.setVelocityX(160);
    } else {
        player.setVelocityX(0);
    }

    // Обрабатываем прыжки
    if (cursors.up.isDown && player.body.touching.down) {
        player.setVelocityY(-330);
    }
}

function encounterEnemy(player, enemy) {
    // Приостанавливаем игру
    gameActive = false;
    player.setVelocity(0, 0);
    enemy.setVelocity(0, 0);
    
    // Устанавливаем вопрос по умолчанию, если его нет
    if (!currentQuestion || !currentQuestion.question) {
        currentQuestion = { 
            question: "What is the opposite of 'big'?", 
            answer: "small" 
        };
    }
    
    // Показываем вопрос и вопросительный бокс
    if (questionBox) {
        // Устанавливаем текст текущего вопроса
        const questionElement = document.getElementById('current-question');
        if (questionElement) {
            // Устанавливаем текст вопроса с резервным вариантом по умолчанию
            questionElement.textContent = currentQuestion.question || "What is the opposite of 'big'?";
            console.log("Set question text:", questionElement.textContent);
        } else {
            console.log("ERROR: Could not find question element");
        }
        
        // Показываем вопросительный бокс
        questionBox.style.display = 'flex';
        
        // Фокусируемся на поле ввода ответа
        if (answerInput) {
            answerInput.value = '';
            setTimeout(() => answerInput.focus(), 100); // Задержка фокуса, чтобы убедиться, что бокс виден
        }
    } else {
        console.log("ERROR: Question box not found");
    }
}

// Функция для проверки ответа игрока и обработки логики игры
function checkAnswer() {
    console.log("checkAnswer called, gameActive:", gameActive);
    
    // Получаем ответ пользователя и правильный ответ
    const userAnswer = answerInput ? answerInput.value.trim().toLowerCase() : '';
    const correctAnswer = currentQuestion.answer.toLowerCase();
    
    console.log("User answer:", userAnswer);
    console.log("Correct answer:", correctAnswer);
    
    // Проверяем коды читов для пропуска уровня с новым форматом "lvl1", "lvl2", "lvl3"
    if (userAnswer === "lvl1" || userAnswer === "lvl2" || userAnswer === "lvl3") {
        // Извлекаем номер уровня из команды
        const targetLevel = parseInt(userAnswer.substring(3));
        console.log(`CHEAT CODE ACTIVATED: Skipping to level ${targetLevel}`);
        
        // Скрываем врага немедленно
        if (enemy) {
            enemy.setVisible(false);
        }
        
        // Скрываем вопросительный бокс
        if (questionBox) {
            questionBox.style.display = 'none';
        }
        
        // Переходим к запрашиваемому уровню
        const scene = player.scene;
        currentLevel = targetLevel; // Устанавливаем напрямую на целевой уровень
        
        // Показываем сообщение о пропуске уровня
        scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height / 2, `SKIPPING TO LEVEL ${targetLevel}`, {
            fontSize: '24px',
            fontFamily: '"Press Start 2P"',
            fill: '#FF00FF', // Используем отличительный цвет для сообщений читов
            backgroundColor: '#000000',
            padding: { left: 8, right: 8, top: 8, bottom: 8 }
        }).setOrigin(0.5, 0.5).setDepth(1000);
        
        // Переход к новому уровню после короткой задержки
        setTimeout(() => {
            resetForNextEnemy(scene, true); // Передаем true, чтобы указать, что это код читов
        }, 1000);
        
        return; // Выходим из функции раньше
    }
    
    if (userAnswer === correctAnswer) {
        console.log("Correct!");
        // Предотвращаем снижение здоровья врага ниже 0
        enemyHealth = Math.max(0, enemyHealth - 20);
        console.log(`Enemy health: ${enemyHealth}`);
        
        // Обновляем полосу здоровья врага и текст
        updateEnemyHealthDisplay();
        
        // Проигрываем анимацию атаки в requestAnimationFrame, чтобы убедиться, что она видима
        requestAnimationFrame(() => {
            playAttackAnimation();
        });
        
        // Проверяем, побежден ли враг
        if (enemyHealth <= 0) {
            console.log("Enemy defeated!");
            
            // Вместо смены на enemy-sprite3, делаем врага невидимым немедленно
            if (enemy) {
                enemy.setVisible(false);
            }
            
            // Скрываем вопросительный бокс после задержки
            setTimeout(() => {
                if (questionBox) {
                    questionBox.style.display = 'none';
                }
                
                // Показываем сообщение о победе
                const scene = player.scene;
                scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height / 2, 'VICTORY!', {
                    fontSize: '32px',
                    fontFamily: '"Press Start 2P"',
                    fill: '#FFFFFF'
                }).setOrigin(0.5, 0.5);
                
                // Спавним нового врага после задержки с новыми вопросами для следующего уровня
                setTimeout(() => {
                    currentLevel++; // Сначала увеличиваем уровень
                    resetForNextEnemy(scene); // Используем обновленную функцию resetForNextEnemy
                }, 2000);
            }, 1500);
            return; // Выходим из функции раньше
        }
    } else {
        console.log("Wrong!");
        playerHealth = Math.max(0, playerHealth - 20); // Предотвращаем отрицательное здоровье
        console.log(`Player health: ${playerHealth}`);
        
        // Обновляем полосу здоровья игрока и текст
        updatePlayerHealthDisplay();
        
        // Проигрываем анимацию атаки врага
        requestAnimationFrame(() => {
            playEnemyAttackAnimation();
        });
        
        // Проверяем, проиграл ли игрок
        if (playerHealth <= 0) {
            console.log("Game over!");
            
            // Скрываем вопросительный бокс для окончания игры после короткой задержки
            setTimeout(() => {
                if (questionBox) {
                    questionBox.style.display = 'none';
                }
                
                // Показываем сообщение о конце игры
                const scene = player.scene;
                const gameOverText = scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height / 2 - 40, 'GAME OVER', {
                    fontSize: '32px',
                    fontFamily: '"Press Start 2P"',
                    fill: '#FF0000'
                }).setOrigin(0.5, 0.5);
                
                // Добавляем кнопку "Попробовать снова"
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
                
                // Добавляем рамку вокруг кнопки
                const buttonBounds = tryAgainButton.getBounds();
                const buttonBorder = scene.add.rectangle(
                    buttonBounds.centerX, 
                    buttonBounds.centerY,
                    buttonBounds.width + 10, 
                    buttonBounds.height + 10,
                    0x000000, 0
                ).setStrokeStyle(2, 0xFFFFFF);
            }, 1000);
            
            // Сбрасываем игру или показываем сообщение о конце игры
            gameActive = false;
            return; // Выходим из функции раньше
        }
    }
    
    // Получаем индекс следующего вопроса (круговой)
    let nextQuestionIndex = 0;
    for (let i = 0; i < currentLevelQuestions.length; i++) {
        if (currentLevelQuestions[i].question === currentQuestion.question) {
            nextQuestionIndex = (i + 1) % currentLevelQuestions.length;
            break;
        }
    }
    
    // Устанавливаем следующий вопрос
    currentQuestion = currentLevelQuestions[nextQuestionIndex];
    
    // Устанавливаем новый текст вопроса немедленно на элементе DOM
    const questionElement = document.getElementById('current-question');
    if (questionElement) {
        questionElement.textContent = currentQuestion.question;
        console.log("Set new question:", currentQuestion.question);
    }
    
    // Сбрасываем поле ввода, но оставляем вопросительный бокс видимым
    if (answerInput) {
        answerInput.value = '';
        answerInput.focus(); // Снова фокусируемся на вводе для следующего вопроса
    }
}

// Функция для обновления отображения здоровья игрока
function updatePlayerHealthDisplay() {
    const healthPercent = playerHealth / 100;
    playerHealthBar.width = 200 * healthPercent;
    playerHealthText.setText(`PLAYER: ${playerHealth}HP`);
    
    // Меняем цвет в зависимости от здоровья
    if (healthPercent > 0.5) {
        playerHealthBar.fillColor = 0x00FF00; // Зеленый
    } else if (healthPercent > 0.25) {
        playerHealthBar.fillColor = 0xFFFF00; // Желтый
    } else {
        playerHealthBar.fillColor = 0xFF0000; // Красный
    }
}

// Функция для обновления отображения здоровья врага
function updateEnemyHealthDisplay() {
    const healthPercent = enemyHealth / 100;
    enemyHealthBar.width = 200 * healthPercent;
    enemyHealthText.setText(`ENEMY: ${enemyHealth}HP`);
    
    // Меняем цвет в зависимости от здоровья
    if (healthPercent > 0.5) {
        enemyHealthBar.fillColor = 0x00FF00; // Зеленый
    } else if (healthPercent > 0.25) {
        enemyHealthBar.fillColor = 0xFFFF00; // Желтый
    } else {
        enemyHealthBar.fillColor = 0xFF0000; // Красный
    }
}

// Функция для проигрывания анимации атаки, когда игрок отвечает правильно
function playAttackAnimation() {
    console.log("Playing attack animation...");
    
    // Убедитесь, что у нас есть действительные объекты игрока и врага
    if (!player || !player.scene || !enemy) {
        console.error("Cannot play animation - player or enemy not available");
        return;
    }
    
    const scene = player.scene;
    
    // Сохраняем оригинальные позиции
    const originalPlayerX = player.x;
    const originalEnemyX = enemy.x;
    
    // Рассчитываем расстояния на основе ширины экрана
    const width = scene.scale.width;
    const moveDistance = width * 0.25; // Еще более драматическое движение (25% от ширины экрана)
    
    console.log("Animation starting with player at:", originalPlayerX, "moving distance:", moveDistance);
    
    // Отключаем физику во время анимации, чтобы предотвратить помехи при столкновении
    player.body.enable = false;
    enemy.body.enable = false;
    
    // Убедитесь, что игра не возобновляется во время анимации
    gameActive = false;
    
    // Делаем игрока визуально отличным во время атаки
    player.setTint(0x00ffff); // Циановый оттенок для игрока во время атаки
    
    // Используем прямые обновления позиции вместо tweens для надежности
    // 1. Двигаем игрока к врагу
    player.x += moveDistance;
    
    // 2. После задержки, двигаем игрока назад и запускаем эффекты врага
    setTimeout(() => {
        // Двигаем игрока назад
        player.x = originalPlayerX;
        
        // Добавляем желтый всплеск в позиции врага
        const flashCircle = scene.add.circle(
            enemy.x, 
            enemy.y, 
            60, // Большой радиус для видимости
            0xffff00, // Желтый цвет
            0.8 // Высокая альфа для видимости
        );
        
        // Масштабируем и затухаем всплеск
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
        
        // Делаем врага вспыхнуть красным
        enemy.setTint(0xff0000);
        
        // Делаем врага трястись взад-вперед
        let shakeCount = 0;
        const maxShakes = 5;
        const shakeDistance = 20; // Больше для видимости
        
        const shakeEnemy = () => {
            if (shakeCount < maxShakes) {
                // Двигаем врага влево/вправо на основе четного/нечетного счета
                enemy.x = originalEnemyX + (shakeCount % 2 === 0 ? -shakeDistance : shakeDistance);
                shakeCount++;
                setTimeout(shakeEnemy, 80);
            } else {
                // Сбрасываем позицию врага, когда все сделано
                enemy.x = originalEnemyX;
                
                // Сбрасываем оттенки и включаем физику после завершения анимации
                setTimeout(() => {
                    enemy.clearTint();
                    player.clearTint();
                    
                    // Включаем физику снова
                    player.body.enable = true;
                    enemy.body.enable = true;
                    
                    console.log("Animation sequence completed");
                }, 100);
            }
        };
        
        // Начинаем трясти врага
        shakeEnemy();
        
    }, 250); // Ждем перед движением назад
    
    console.log("Animation sequence started with direct position updates");
}

// Функция для проигрывания анимации атаки, когда игрок отвечает неправильно
function playEnemyAttackAnimation() {
    console.log("Playing enemy attack animation...");
    
    // Убедитесь, что у нас есть действительные объекты игрока и врага
    if (!player || !player.scene || !enemy) {
        console.error("Cannot play animation - player or enemy not available");
        return;
    }
    
    const scene = player.scene;
    
    // Сохраняем оригинальные позиции
    const originalPlayerX = player.x;
    const originalEnemyX = enemy.x;
    
    // Рассчитываем расстояния на основе ширины экрана
    const width = scene.scale.width;
    const moveDistance = width * 0.25; // Еще более драматическое движение (25% от ширины экрана)
    
    console.log("Animation starting with enemy at:", originalEnemyX, "moving distance:", moveDistance);
    
    // Отключаем физику во время анимации, чтобы предотвратить помехи при столкновении
    player.body.enable = false;
    enemy.body.enable = false;
    
    // Убедитесь, что игра не возобновляется во время анимации
    gameActive = false;
    
    // Делаем врага визуально отличным во время атаки
    enemy.setTint(0xff0000); // Красный оттенок для врага во время атаки
    
    // Используем прямые обновления позиции вместо tweens для надежности
    // 1. Двигаем врага к игроку
    enemy.x -= moveDistance;
    
    // 2. После задержки, двигаем врага назад и запускаем эффекты игрока
    setTimeout(() => {
        // Двигаем врага назад
        enemy.x = originalEnemyX;
        
        // Добавляем красный всплеск в позиции игрока
        const flashCircle = scene.add.circle(
            player.x, 
            player.y, 
            60, // Большой радиус для видимости
            0xff0000, // Красный цвет
            0.8 // Высокая альфа для видимости
        );
        
        // Масштабируем и затухаем всплеск
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
        
        // Делаем игрока вспыхнуть цианом
        player.setTint(0x00ffff);
        
        // Делаем игрока трястись взад-вперед
        let shakeCount = 0;
        const maxShakes = 5;
        const shakeDistance = 20; // Больше для видимости
        
        const shakePlayer = () => {
            if (shakeCount < maxShakes) {
                // Двигаем игрока влево/вправо на основе четного/нечетного счета
                player.x = originalPlayerX + (shakeCount % 2 === 0 ? -shakeDistance : shakeDistance);
                shakeCount++;
                setTimeout(shakePlayer, 80);
            } else {
                // Сбрасываем позицию игрока, когда все сделано
                player.x = originalPlayerX;
                
                // Сбрасываем оттенки и включаем физику после завершения анимации
                setTimeout(() => {
                    player.clearTint();
                    enemy.clearTint();
                    
                    // Включаем физику снова
                    player.body.enable = true;
                    enemy.body.enable = true;
                    
                    console.log("Animation sequence completed");
                }, 100);
            }
        };
        
        // Начинаем трясти игрока
        shakePlayer();
        
    }, 250); // Ждем перед движением назад
    
    console.log("Animation sequence started with direct position updates");
}

// Заменяем функцию resetForNextEnemy на упрощенную версию
function resetForNextEnemy(scene, isCheatCode = false) {
    console.log(`===== LEVEL TRANSITION TO LEVEL ${currentLevel} =====`);
    console.log(isCheatCode ? "Via cheat code" : "Normal progression");
    
    // Очищаем сообщение о победе и любые сообщения чит-кодов
    scene.children.each(child => {
        if (child.type === 'Text' && (child.text === 'VICTORY!' || child.text.includes('SKIPPING TO LEVEL'))) {
            child.destroy();
        }
    });
    
    // Обновляем текст уровня
    levelText.setText(`LEVEL ${currentLevel}`);
    
    // Сбрасываем здоровье врага
    enemyHealth = 100;
    
    // Показываем сообщение о переходе уровня
    const levelUpText = scene.add.text(
        scene.cameras.main.width / 2, 
        scene.cameras.main.height / 2, 
        `LEVEL ${currentLevel}`, 
        {
            fontSize: '32px',
            fontFamily: '"Press Start 2P"',
            fill: isCheatCode ? '#FF00FF' : '#FFFF00' // Используем пурпурный для чит-кодов
        }
    ).setOrigin(0.5, 0.5);
    
    // После показа сообщения уровня, настраиваем следующий уровень
    setTimeout(() => {
        // Затухаем сообщение уровня
        scene.tweens.add({
            targets: levelUpText,
            alpha: 0,
            duration: 1000,
            onComplete: () => levelUpText.destroy()
        });
        
        // Уничтожаем старого врага перед созданием нового
        if (enemy) {
            enemy.destroy();
        }
        
        // Создаем нового врага
        const width = scene.scale.width;
        const height = scene.scale.height;
        
        // Выбираем соответствующий спрайт врага в зависимости от текущего уровня
        let enemySprite;
        if (currentLevel === 2) {
            enemySprite = 'enemy-sprite2';
        } else if (currentLevel === 3) {
            enemySprite = 'enemy-sprite3';
        } else {
            enemySprite = 'enemy-sprite';
        }
        
        // Создаем нового врага в оригинальной позиции с соответствующим спрайтом
        enemy = scene.physics.add.sprite(width * 0.75, height * 0.75, enemySprite);
        
        // Применяем правильный масштаб и переворот в зависимости от уровня
        if (currentLevel === 2) {
            // Делаем enemy-sprite2 на 15% больше, чем раньше
            enemy.setScale(0.174); // 0.151 * 1.15 = ~0.174
            enemy.flipX = true;    // Отзеркаливаем спрайт врага по горизонтали
        } else if (currentLevel === 3) {
            // Делаем enemy-sprite3 больше, чтобы соответствовать размеру игрока
            enemy.setScale(0.35);  // Тот же масштаб, что и у игрока (0.35 вместо 0.151)
            enemy.flipX = true;    // Отзеркаливаем спрайт врага по горизонтали
        } else {
            enemy.setScale(0.35);  // Нормальный масштаб для уровня 1
        }
        
        enemy.setCollideWorldBounds(true);
        
        // Добавляем физические коллайдеры для нового врага
        scene.physics.add.collider(enemy, platforms);
        scene.physics.add.overlap(player, enemy, encounterEnemy, null, scene);
        
        // Добавляем анимацию дыхания для нового врага
        scene.breathingAnimationEnemy = scene.tweens.add({
            targets: enemy,
            y: enemy.y - 2,                // То же, что и у игрока (2 пикселя)
            duration: 1500,                // То же, что и у игрока (1500ms) 
            ease: 'Sine.easeInOut',        // То же самое ease функция
            yoyo: true,                    // То же самое yoyo эффект
            repeat: -1,                    // Бесконечное повторение
            delay: currentLevel === 1 ? 800 : 0,  // Нет задержки для уровня 2 и 3, только для уровня 1
            onStart: function() {
                // Убедитесь, что физика не мешает анимации
                enemy.body.allowGravity = false;
            },
            onComplete: function() {
                enemy.body.allowGravity = true;
            }
        });
        
        // ВАЖНО: Загружаем новые случайные вопросы для нового уровня
        currentLevelQuestions = questionTracker.selectFreshQuestions(currentLevel);
        console.log("Selected new questions for level " + currentLevel + ":", 
            currentLevelQuestions.map(q => q.question).join(", "));
        
        // Устанавливаем первый вопрос для нового уровня
        if (currentLevelQuestions.length > 0) {
            currentQuestion = currentLevelQuestions[0];
            
            // Обновляем отображение вопроса
            const questionElement = document.getElementById('current-question');
            if (questionElement) {
                questionElement.textContent = currentQuestion.question;
            }
        }
        
        // Обновляем отображение здоровья
        updateEnemyHealthDisplay();
        
        // Воссоздаем элементы интерфейса, чтобы убедиться, что кнопка работает
        setupQuestionBoxEvents();
        
        // Возобновляем игру после того, как все настроено
        setTimeout(() => {
            // Начинаем встречу с новым врагом
            gameActive = true;
            encounterEnemy(player, enemy);
        }, 500);
    }, 2000);
}
