from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# Define the /start command handler
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await context.bot.send_game(
        chat_id=update.effective_chat.id,
        game_short_name="engvocab"
    )

# Create the application and add the handler
application = Application.builder().token("YOUR_BOT_TOKEN").build()
application.add_handler(CommandHandler("start", start))

# Start the bot
if __name__ == "__main__":
    application.run_polling()