// Message logger for debugging Discord messages
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFilePath = path.join(logsDir, 'discord-messages.log');

/**
 * Log a message to the console and file for debugging
 * @param {string} message The message to log
 */
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  // Log to console
  console.log(logEntry);
  
  // Log to file (append)
  fs.appendFileSync(logFilePath, logEntry);
}

/**
 * Log a Discord message for debugging
 * @param {Object} message The Discord.js message object
 */
function logDiscordMessage(message) {
  try {
    // Format message data
    const messageData = {
      id: message.id,
      content: message.content,
      author: {
        id: message.author.id,
        username: message.author.username,
        tag: message.author.tag
      },
      channelId: message.channelId,
      timestamp: message.createdTimestamp,
      embeds: message.embeds.length,
      attachments: Array.from(message.attachments.values()).map(a => ({ 
        name: a.name,
        url: a.url,
        size: a.size
      }))
    };
    
    // Convert to string
    const logString = JSON.stringify(messageData, null, 2);
    
    // Log it
    logMessage(`Discord Message:\n${logString}`);
    
    // Also log raw content for debug purposes
    logMessage(`Raw content: "${message.content}"`);
    
    return messageData;
  } catch (error) {
    console.error('Error logging Discord message:', error);
    logMessage(`Error logging Discord message: ${error.message}`);
    return null;
  }
}

// Export functions
module.exports = {
  logMessage,
  logDiscordMessage
};