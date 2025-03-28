from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
import logging

# Настройка логирования для отслеживания ошибок
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# URL вашей игры на Vercel (обновлено!)
GAME_URL = "https://tgbot-orpin.vercel.app"
GAME_SHORT_NAME = "engvocab"  # Точное короткое имя из BotFather

# Define the /start command handler
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        user = update.effective_user
        logger.info(f"User {user.id} ({user.username}) started the bot")
        
        # Отправляем приветственное сообщение и игру
        await update.message.reply_text(
            f"Привет, {user.first_name}! Добро пожаловать в игру для практики английского словаря."
        )
        
        # Отправляем игру
        await context.bot.send_game(
            chat_id=update.effective_chat.id,
            game_short_name=GAME_SHORT_NAME
        )
    except Exception as e:
        logger.error(f"Error sending game: {e}")
        # Отправляем сообщение пользователю в случае ошибки
        await update.message.reply_text(
            "Извините, не удалось запустить игру. Попробуйте позже или свяжитесь с администратором бота."
        )

# Обработчик callback_query для запуска игры
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        # Логируем информацию о callback
        logger.info(f"Received callback query: {query.to_dict()}")
        
        if query.game_short_name == GAME_SHORT_NAME:
            logger.info(f"User {query.from_user.id} ({query.from_user.username}) started the game")
            
            # Отвечаем на callback с URL игры напрямую
            # ВАЖНО: НЕ вызывать query.answer() до answer_callback_query, иначе игра не запустится
            await context.bot.answer_callback_query(
                callback_query_id=query.id,
                url=GAME_URL
            )
            logger.info(f"Sent game URL: {GAME_URL}")
        else:
            logger.warning(f"Unknown game short name: {query.game_short_name}")
            await query.answer(text="Неизвестная игра")
    except Exception as e:
        logger.error(f"Error in button callback: {e}")
        await query.answer(text="Произошла ошибка при запуске игры")

# Обработчик ошибок
async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"Exception while handling an update: {context.error}")
    logger.error(f"Update that caused error: {update}")
    # Выводим трейсбек для более подробной информации об ошибке
    import traceback
    traceback.print_exc()

# Добавляем команду /help
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Это бот для игры Eng Vocab Practice.\n"
        "Используйте команду /start чтобы начать игру.\n"
        "Игра тестирует ваши знания английского языка."
    )

# Create the application and add the handlers
def main():
    # Получаем токен из переменной окружения или запрашиваем у пользователя
    import os
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    
    if not token:
        token = input("Пожалуйста, введите токен вашего Telegram бота: ").strip()
    
    # Создаем приложение
    application = Application.builder().token(token).build()
    
    # Добавляем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CallbackQueryHandler(button_callback))
    application.add_error_handler(error_handler)
    
    # Запускаем бота
    logger.info("Starting bot...")
    application.run_polling()

# Start the bot
if __name__ == "__main__":
    main()