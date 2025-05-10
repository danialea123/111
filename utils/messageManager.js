/**
 * Message Manager - Handles persistent message updating
 * This utility provides functions for managing persistent Discord messages
 * that get updated rather than creating new messages each time.
 */

// Store message references
const messageStore = {
  inventory: null,
  drugTask: null,
  gangTask: null
};

/**
 * Finds or creates a message for a specific system
 * @param {Object} channel - Discord.js channel object
 * @param {Object} embed - Embed to send or update
 * @param {string} type - Message type (inventory, drugTask, gangTask)
 * @param {string} identifierTitle - Title text to search for in existing messages
 * @returns {Promise<Object>} The message object
 */
async function updateSystemMessage(channel, embed, type, identifierTitle) {
  try {
    // First check if we have a reference to the message already
    if (messageStore[type]) {
      try {
        // Try to use the reference
        await messageStore[type].edit({ content: null, embeds: [embed] });
        console.log(`Updated existing ${type} message: ${messageStore[type].id}`);
        return messageStore[type];
      } catch (refError) {
        console.log(`Stored message reference invalid for ${type}, will search for message`);
        // Continue to search if the reference is invalid
      }
    }

    // Search for existing message
    try {
      const messages = await channel.messages.fetch({ limit: 15 });
      const botMessages = messages.filter(msg => 
        msg.author.bot && 
        msg.embeds.length > 0 && 
        msg.embeds[0].title && 
        msg.embeds[0].title.includes(identifierTitle)
      );
      
      if (botMessages.size > 0) {
        // Update existing message
        const message = botMessages.first();
        await message.edit({ content: null, embeds: [embed] });
        console.log(`Updated existing ${type} message: ${message.id}`);
        
        // Store reference for future updates
        messageStore[type] = message;
        return message;
      }
    } catch (searchError) {
      console.error(`Error searching for ${type} message:`, searchError);
    }
    
    // If no message found or error occurred, create a new one
    const newMessage = await channel.send({ embeds: [embed] });
    console.log(`Created new ${type} message: ${newMessage.id}`);
    
    // Store reference for future updates
    messageStore[type] = newMessage;
    return newMessage;
  } catch (error) {
    console.error(`Error updating ${type} message:`, error);
    throw error;
  }
}

module.exports = {
  updateSystemMessage,
  messageStore
};