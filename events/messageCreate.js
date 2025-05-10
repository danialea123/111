// Import message logger
const logger = require('../message-logger');

// Message event handler
module.exports = {
  name: 'messageCreate',
  once: false,
  
  // Execute event
  async execute(message, client, config) {
    // Ignore bot messages (except those from Log bots)
    if (message.author.bot && !message.author.username.includes('Log')) return;
    
    // We only use slash commands now, so no need to handle prefix commands
    
    // Log all received messages for debugging
    logger.logDiscordMessage(message);
    
    // Check for embeds first (higher priority)
    if (message.embeds && message.embeds.length > 0) {
      logger.logMessage(`Message has ${message.embeds.length} embeds`);
      
      // Process each embed
      for (const embed of message.embeds) {
        logger.logMessage(`Processing embed: ${JSON.stringify({
          title: embed.title,
          description: embed.description,
          fields: embed.fields ? embed.fields.length : 0
        })}`);
        
        // Special handling for embed titles with action keywords
        let embedAction = null;
        let embedItem = null;
        if (embed.title) {
          // Check for specific actions in the title
          if (embed.title.includes('Bardasht') || embed.title.includes('برداشت') || embed.title.toLowerCase().includes('remove')) {
            logger.logMessage('Found "Bardasht" (remove) action in embed title');
            embedAction = 'remove';
          } else if (embed.title.includes('Gozashtan') || embed.title.includes('گذاشت') || embed.title.toLowerCase().includes('add')) {
            logger.logMessage('Found "Gozashtan" (add) action in embed title');
            embedAction = 'add';
          }
          
          // Try to extract item name from title
          // First look for specific item mentions in title
          if (config.trackedItems) {
            for (const item of config.trackedItems) {
              if (embed.title.toLowerCase().includes(item.toLowerCase())) {
                embedItem = item;
                logger.logMessage(`Found item ${item} in embed title`);
                break;
              }
            }
          }
          
          // If no specific item found, use "Item" as generic identifier
          if (!embedItem && embed.title.toLowerCase().includes('item')) {
            // Default to the first tracked item if available
            embedItem = config.trackedItems ? config.trackedItems[0] : 'Cocaine';
            logger.logMessage(`Using default item ${embedItem} for generic "Item" in title`);
          }
        }
        
        // Check if this is a log-related embed by title or fields
        const isLogEmbed = embed.title && (
            embed.title.includes('Log') || 
            embed.title.includes('Inventory') || 
            embed.title.includes('لاگ') ||
            embed.title.includes('Bardasht') ||
            embed.title.includes('Gozashtan') ||
            embed.title.includes('برداشت') ||
            embed.title.includes('گذاشت') ||
            embed.title.toLowerCase().includes('item')
        );
        
        if (isLogEmbed) {
          logger.logMessage(`Found log-related embed title: ${embed.title}`);
          
          // Try to extract content from description
          if (embed.description) {
            logger.logMessage(`Embed description: ${embed.description}`);
            await processLogMessage(message, client, config, embed.description, embedAction);
          }
          
          // Try to extract content from fields
          if (embed.fields && embed.fields.length > 0) {
            for (const field of embed.fields) {
              logger.logMessage(`Processing embed field: ${field.name} - ${field.value}`);
              
              // Look for inventory/item related fields
              if (field.name && (
                  field.name.includes('Item') || 
                  field.name.includes('آیتم') ||
                  field.name.includes('Inventory') ||
                  field.name.includes('انبار') ||
                  field.name.includes('Esm')
                 )) {
                logger.logMessage(`Found relevant field: ${field.name} - ${field.value}`);
                // If this is a field with details about items, create a combined string
                const combinedData = `${field.name}: ${field.value}`;
                await processLogMessage(message, client, config, combinedData, embedAction);
              } else {
                // Process all fields in embeds that look like logs
                await processLogMessage(message, client, config, field.value, embedAction);
              }
            }
          } else if (embedAction) {
            // If we have an action from the title but no fields/description,
            // try to construct a minimal message from the embed title and extracted item
            const defaultItem = embedItem || (config.trackedItems ? config.trackedItems[0] : 'Cocaine');
            const minimalContent = `${embed.title} with ${defaultItem}(1)`;
            logger.logMessage(`No fields/description, using constructed content: ${minimalContent}`);
            await processLogMessage(message, client, config, minimalContent, embedAction);
          }
        }
      }
    }
    
    // Process regular log messages in log channel
    if (config.logChannelId && message.channelId === config.logChannelId) {
      logger.logMessage(`Received message in log channel ID ${message.channelId} (Expected: ${config.logChannelId})`);
      
      // Also log message content separately for better visibility
      logger.logMessage(`MESSAGE CONTENT START\n${message.content}\nMESSAGE CONTENT END`);
      
      await processLogMessage(message, client, config, message.content);
    } else {
      logger.logMessage(`Message in channel ${message.channelId}, not log channel ${config.logChannelId}`);
    }
    
    // Look for messages that might be log messages but in wrong channels
    if (message.channelId !== config.logChannelId) {
      if (message.content.includes('Bardasht') || 
          message.content.includes('Gozashtan') || 
          message.content.includes('Item') || 
          message.content.includes('Log System')) {
        logger.logMessage(`POTENTIAL LOG MESSAGE IN WRONG CHANNEL: ${message.channelId}`);
        logger.logMessage(`Content: ${message.content}`);
        // Try to process it anyway in case it's a valid log message
        await processLogMessage(message, client, config, message.content);
      }
    }
  }
};

// Process log messages
async function processLogMessage(message, client, config, content = null, embedAction = null) {
  // Use provided content or message.content
  const messageContent = content || message.content;
  
  logger.logMessage("=============== PROCESSING LOG MESSAGE ===============");
  logger.logMessage(`Message content: "${messageContent}"`);
  logger.logMessage(`From user: ${message.author.tag}`);
  logger.logMessage(`Embed action override: ${embedAction || 'none'}`);
  
  // Save message content to a file for inspection
  const fs = require('fs');
  const path = require('path');
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const messageFilePath = path.join(logsDir, `message-${Date.now()}.txt`);
  fs.writeFileSync(messageFilePath, messageContent);
  logger.logMessage(`Message content saved to: ${messageFilePath}`);
  
  // Parse log message
  const logData = parseLogMessage(messageContent, config, embedAction);
  if (!logData) {
    logger.logMessage("Failed to parse log message!");
    
    // Only notify in Discord chat if it's not an embed processing AND not in the log channel
    if (!content && message.channelId !== config.logChannelId) {
      try {
        await message.reply({
          content: "⚠️ Failed to parse this message as an inventory log. Check the format.",
          ephemeral: true
        });
      } catch (error) {
        logger.logMessage(`Error sending reply: ${error.message}`);
      }
    }
    return;
  }
  
  logger.logMessage(`Parsed data: ${JSON.stringify(logData)}`);
  
  // Check if this is an XP-related message
  if (logData.type === 'xp') {
    const xpFunctions = require('../functions/xpFunctions');
    return await xpFunctions.processXPMessage(message, client, config, logData);
  }
  
  try {
    // Process transaction in database
    const db = require('../database');
    logger.logMessage(`Processing transaction: type=${logData.type}, item=${logData.itemName}, quantity=${logData.quantity}`);
    
    const result = await db.processTransaction(
      logData.type,
      logData.itemName,
      logData.quantity,
      logData.icPlayerName,
      logData.oocPlayerName
    );
    
    logger.logMessage(`Transaction processed successfully: ${JSON.stringify(result)}`);
    
    // React to confirm processing - only if not in log channel
    if (message.channelId !== config.logChannelId) {
      try {
        await message.react('✅');
      } catch (error) {
        logger.logMessage(`Error reacting to message: ${error.message}`);
      }
    }
    
    // Reply with confirmation for better visibility
    // Only if this is NOT in the log channel
    if (message.channelId !== config.logChannelId) {
      try {
        await message.reply({
          content: `✅ ${logData.type === 'add' ? 'Added' : 'Removed'} ${logData.quantity}x ${logData.itemName}`,
          ephemeral: false
        });
      } catch (error) {
        logger.logMessage(`Error sending confirmation: ${error.message}`);  
      }
    }
    
    // Send updated inventory to status channel
    if (config.statusChannelId) {
      const statusChannel = client.channels.cache.get(config.statusChannelId);
      if (statusChannel) {
        logger.logMessage(`Sending update to status channel ${config.statusChannelId}`);
        const { EmbedBuilder } = require('discord.js');
        const items = await db.getItems();
        
        const embed = new EmbedBuilder()
          .setTitle('📦 Inventory Status')
          .setColor('#6366F1')
          .setDescription('**Current Stock Levels**')
          .setTimestamp()
          .setFooter({ text: 'Last updated' });
        
        // Add drug items
        const drugs = items.filter(item => item.category === 'drug');
        if (drugs.length > 0) {
          let drugList = '';
          drugs.forEach(item => {
            // Add emoji based on quantity levels
            let stockEmoji = '🔴'; // Low stock
            if (item.quantity > 50) {
              stockEmoji = '🟢'; // High stock
            } else if (item.quantity > 20) {
              stockEmoji = '🟡'; // Medium stock
            }
            
            drugList += `${stockEmoji} \`${item.name}\` — **${item.quantity}**\n`;
          });
          
          embed.addFields({
            name: '💊 Drug Inventory',
            value: drugList,
            inline: false
          });
        }
        
        // Try to find existing status message
        try {
          const messages = await statusChannel.messages.fetch({ limit: 10 });
          // Find a message from this bot that has the inventory title
          const botMessages = messages.filter(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title && 
            (msg.embeds[0].title.includes('Inventory Status') || msg.embeds[0].title.includes('Updated Inventory'))
          );
          
          if (botMessages.size > 0) {
            // Update the most recent status message
            const statusMessage = botMessages.first();
            await statusMessage.edit({ 
              content: null,
              embeds: [embed] 
            });
            logger.logMessage(`Updated existing inventory status message: ${statusMessage.id}`);
          } else {
            // If no existing message found, send a new one
            const newMessage = await statusChannel.send({ 
              content: null,
              embeds: [embed] 
            });
            logger.logMessage(`Created new inventory status message: ${newMessage.id}`);
          }
        } catch (error) {
          logger.logMessage(`Error updating status message: ${error.message}`);
          // Fallback to sending a new message
          await statusChannel.send({ embeds: [embed] });
        }
        
        logger.logMessage("Inventory update sent to status channel");
      } else {
        logger.logMessage(`Status channel ${config.statusChannelId} not found!`);
      }
    }
  } catch (error) {
    logger.logMessage(`Error processing log message: ${error.message}`);
    // React with error - only if not in log channel
    if (message.channelId !== config.logChannelId) {
      try {
        await message.react('❌');
      } catch (error) {
        logger.logMessage(`Error reacting to message with error: ${error.message}`);
      }
    }
    
    // Reply with the error for debugging - only if not in log channel
    if (message.channelId !== config.logChannelId) {
      try {
        await message.reply({
          content: `❌ Error processing: ${error.message}`,
          ephemeral: true
        });
      } catch (replyError) {
        logger.logMessage(`Error sending error reply: ${replyError.message}`);
      }
    }
  }
}

// Parse log message
function parseLogMessage(content, config, embedAction = null) {
  try {
    // Check for XP task logs first
    const isXpTask = content.includes('Use XP') || (content.toLowerCase().includes('xp') && content.toLowerCase().includes('task'));
    
    if (isXpTask) {
      const xpFunctions = require('../functions/xpFunctions');
      return xpFunctions.parseXPMessage(content, config);
    }
    
    // Check if it's a valid log message
    // "Bardasht Item" means removing from inventory 
    // "Gozashtan Item" means adding to inventory
    
    // First, check if we have an action from the embedAction parameter
    let isBardasht = false;
    let isGozashtan = false;
    
    if (embedAction) {
      logger.logMessage(`Using embed action override: ${embedAction}`);
      isBardasht = embedAction === 'remove';
      isGozashtan = embedAction === 'add';
    } else {
      // Check for exact phrase variants
      isBardasht = content.includes('Bardasht Item');
      isGozashtan = content.includes('Gozashtan Item');
      
      // If neither found, try more flexible patterns
      if (!isBardasht && !isGozashtan) {
        logger.logMessage('No exact action match, trying flexible patterns');
        
        // Broader pattern to catch different variations and cases
        isBardasht = /bardasht|برداشت|remove|take|pickup|برداشتن|برداشته/i.test(content);
        isGozashtan = /gozashtan|گذاشت|add|put|place|drop|گذاشتن|گذاشته/i.test(content);
        
        // If we find the word "item" close to these words, that's an even stronger signal
        const words = content.toLowerCase().split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (/item|آیتم/i.test(words[i])) {
            // Check nearby words (within 3 words distance)
            const nearby = words.slice(Math.max(0, i-3), Math.min(words.length, i+3)).join(' ');
            if (/bardasht|برداشت|remove|take/i.test(nearby)) {
              isBardasht = true;
              logger.logMessage('Found "item" near removal words');
            }
            if (/gozashtan|گذاشت|add|put/i.test(nearby)) {
              isGozashtan = true;
              logger.logMessage('Found "item" near addition words');
            }
          }
        }
        
        logger.logMessage(`Flexible pattern results: isBardasht=${isBardasht}, isGozashtan=${isGozashtan}`);
      }
    }
    
    // Check if we've identified an action type
    if (!isBardasht && !isGozashtan) {
      logger.logMessage('No action type found in message');
      return null;
    }
    
    // For safety, if both are true, prioritize based on message structure
    if (isBardasht && isGozashtan) {
      logger.logMessage('WARNING: Both actions detected in same message!');
      // Try to detect which action is mentioned first in the message
      const bardashtIndex = content.toLowerCase().indexOf('bardasht');
      const gozashtanIndex = content.toLowerCase().indexOf('gozashtan');
      
      if (bardashtIndex !== -1 && gozashtanIndex !== -1) {
        // If both are found, use the one that appears first
        if (bardashtIndex < gozashtanIndex) {
          isGozashtan = false;
          logger.logMessage('Prioritizing Bardasht action based on position');
        } else {
          isBardasht = false;
          logger.logMessage('Prioritizing Gozashtan action based on position');
        }
      }
    }
    
    // Make tag requirements more flexible, especially for embed content
    // Only require Log System tag for regular messages, not embed contents
    // For embeds we've already determined they're related to logs by the embed title
    const isEmbed = embedAction != null || content === ''; // If we have an embedAction or empty content, it's an embed
    const hasLogTag = content.includes('Log System') || 
                      content.includes('Etelaat:') || 
                      content.includes('لاگ') ||
                      content.includes('log') ||
                      content.includes('inventory');
    
    if (!isEmbed && !hasLogTag) {
      logger.logMessage('Message missing required tag/format');
      return null;
    }
    
    // If content is empty and we have an embedAction, use the trackedItems to get an item
    // For empty embeds with action, just pick the first tracked item as fallback
    if (content === '' && embedAction && config.trackedItems && config.trackedItems.length > 0) {
      logger.logMessage('Empty content with embedAction, using fallback for empty embed');
      const chosenItem = config.trackedItems[0]; // Use first tracked item
      const defaultQuantity = 1;
      return {
        type: embedAction,
        itemName: chosenItem,
        quantity: defaultQuantity,
        icPlayerName: 'UnknownIC',
        oocPlayerName: message ? message.author.username : 'UnknownOOC'
      };
    }
    
    logger.logMessage('Processing log message: ' + content);
    
    // First try the standard format with parentheses
    let itemMatch = content.match(/Item\s*:\s*([A-Za-z0-9_]+)(?:\(|\s*\()(\d+)(?:\)|\s*\))/i);
    
    // If that doesn't work, try a more flexible format
    if (!itemMatch || itemMatch.length < 3) {
      logger.logMessage('First match attempt failed, trying alternative pattern');
      // This handles formats where the number might be separated
      itemMatch = content.match(/Item\s*:\s*([A-Za-z0-9_]+)[\s\(\)]*(\d+)[\s\(\)]*/i);
    }
    
    // If still not working, try an even more flexible pattern
    if (!itemMatch || itemMatch.length < 3) {
      logger.logMessage('Second match attempt failed, trying final pattern');
      // Ultra flexible pattern that just looks for Item: followed by text and then a number anywhere
      const itemNameMatch = content.match(/Item\s*:\s*([A-Za-z0-9_]+)/i);
      const quantityMatch = content.match(/\((\d+)\)/);
      
      if (itemNameMatch && quantityMatch) {
        logger.logMessage(`Found separate matches: item=${itemNameMatch[1]}, quantity=${quantityMatch[1]}`);
        itemMatch = [
          null, // Full match (not used)
          itemNameMatch[1],
          quantityMatch[1]
        ];
      }
    }
    
    // Try to look for any known drug name plus a number
    if (!itemMatch || itemMatch.length < 3) {
      logger.logMessage('All standard patterns failed, checking for known drug names');
      
      // Check for any drug name in the message
      const drugPatterns = [
        /cocaine\s*(\d+)/i,
        /crack\s*(\d+)/i,
        /marijuana\s*(\d+)/i,
        /ghaarch\s*(\d+)/i,
        /shishe\s*(\d+)/i,
        /kheshab\s*(\d+)/i
      ];
      
      for (const pattern of drugPatterns) {
        const drugMatch = content.match(pattern);
        if (drugMatch) {
          // Extract the drug name from the pattern
          const drugName = pattern.toString().match(/\/(\w+)/)[1];
          logger.logMessage(`Found direct drug reference: ${drugName} - ${drugMatch[1]}`);
          
          itemMatch = [
            null, // Full match (not used)
            drugName,
            drugMatch[1]
          ];
          break;
        }
      }
    }
    
    // If still no match, look for numbers next to item names in the content
    if (!itemMatch || itemMatch.length < 3) {
      logger.logMessage('Trying to find items and quantities in raw text');
      
      // First check for known items in the config
      let foundItem = null;
      let foundQuantity = null;
      
      // Try to find any of the tracked items in the text
      if (config.trackedItems) {
        for (const item of config.trackedItems) {
          if (content.toLowerCase().includes(item.toLowerCase())) {
            foundItem = item;
            
            // Try to find a number near the item name
            const itemIndex = content.toLowerCase().indexOf(item.toLowerCase());
            const nearbyText = content.substring(Math.max(0, itemIndex - 20), Math.min(content.length, itemIndex + 20));
            const numberMatch = nearbyText.match(/\b(\d+)\b/);
            
            if (numberMatch) {
              foundQuantity = numberMatch[1];
              logger.logMessage(`Found item ${item} with nearby quantity ${foundQuantity}`);
              break;
            }
          }
        }
      }
      
      // If we found an item and quantity, use them
      if (foundItem && foundQuantity) {
        itemMatch = [
          null, // Full match (not used)
          foundItem,
          foundQuantity
        ];
      }
    }
    
    // Final fallback: if we can identify the transaction type but not the item details,
    // check if any tracked items are mentioned, and assume quantity 1
    if ((!itemMatch || itemMatch.length < 3) && config.trackedItems) {
      for (const item of config.trackedItems) {
        if (content.toLowerCase().includes(item.toLowerCase())) {
          logger.logMessage(`Using fallback: Found item ${item} without explicit quantity, assuming 1`);
          itemMatch = [
            null, // Full match (not used)
            item,
            "1"  // Default quantity
          ];
          break;
        }
      }
    }
    
    if (!itemMatch || itemMatch.length < 3) {
      logger.logMessage('Failed to match item pattern in all attempts: ' + content);
      return null;
    }
    
    let itemName = itemMatch[1].trim();
    const quantity = parseInt(itemMatch[2], 10);
    
    logger.logMessage(`Successfully extracted: Item=${itemName}, Quantity=${quantity}`);
    
    // Map common variations to standard names
    const itemNameMap = {
      'cocaine': 'Cocaine',
      'crack': 'Crack',
      'marijuana': 'Marijuana',
      'ghaarch': 'Ghaarch',
      'mushroom': 'Ghaarch',  // Map mushroom to Ghaarch
      'shishe': 'Shishe',
      'meth': 'Shishe'        // Map meth to Shishe
    };
    
    // Normalize the item name regardless of capitalization
    const normalizedItemName = itemName.toLowerCase();
    if (itemNameMap[normalizedItemName]) {
      itemName = itemNameMap[normalizedItemName];
    } else {
      // If not in our map, use proper case
      itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1).toLowerCase();
    }
    
    logger.logMessage(`Identified item: ${itemName} (quantity: ${quantity})`);
    
    // Check if item is tracked
    if (config.trackedItems && !config.trackedItems.some(item => 
        item.toLowerCase() === itemName.toLowerCase())) {
      logger.logMessage(`Item ${itemName} is not in the tracked items list`);
      return null;
    }
    
    // Extract player names with more flexible patterns
    let icPlayerMatch = content.match(/(?:Esm IC Player|Esm\s*IC\s*Player)\s*:\s*([A-Za-z0-9_]+)/i);
    
    // If that fails, try an alternative pattern
    if (!icPlayerMatch || !icPlayerMatch[1]) {
      logger.logMessage('Failed first IC player match attempt, trying alternative');
      // The pattern might be different in Persian messages
      icPlayerMatch = content.match(/(?:Esm\s*IC|IC\s*Player|IC)\s*[:\.]\s*([A-Za-z0-9_]+)/i);
    }
    
    // Try a more general pattern - look for "IC" followed by a name
    if (!icPlayerMatch || !icPlayerMatch[1]) {
      const icMatch = content.match(/\b(?:IC|ic)\b[^A-Za-z0-9_]*([A-Za-z0-9_]+)/i);
      if (icMatch && icMatch[1]) {
        logger.logMessage('Found IC player using general pattern');
        icPlayerMatch = icMatch;
      }
    }
    
    // Last resort: Look for a player name pattern anywhere in the message
    if (!icPlayerMatch || !icPlayerMatch[1]) {
      // Try to find words that look like player names (capitalized words with possible numbers)
      const words = content.split(/\s+/);
      for (const word of words) {
        // Player names often start with capital letters and might contain underscores or numbers
        if (/^[A-Z][A-Za-z0-9_]*$/.test(word) && word.length > 2) {
          logger.logMessage(`Potential IC player name found: ${word}`);
          icPlayerMatch = [null, word];
          break;
        }
      }
    }
    
    if (!icPlayerMatch || !icPlayerMatch[1]) {
      logger.logMessage('Failed to match IC player name, using fallback');
      // Use a fallback value when we can't find a player name
      icPlayerMatch = [null, "UnknownIC"];
    }
    
    const icPlayerName = icPlayerMatch[1].trim();
    logger.logMessage(`Found IC player: ${icPlayerName}`);
    
    let oocPlayerMatch = content.match(/(?:Esm OOC Player|Esm\s*OOC\s*Player)\s*:\s*([A-Za-z0-9_]+)/i);
    
    // If that fails, try an alternative pattern
    if (!oocPlayerMatch || !oocPlayerMatch[1]) {
      logger.logMessage('Failed first OOC player match attempt, trying alternative');
      // The pattern might be different in Persian messages
      oocPlayerMatch = content.match(/(?:Esm\s*OOC|OOC\s*Player|OOC)\s*[:\.]\s*([A-Za-z0-9_]+)/i);
    }
    
    // Try a more general pattern
    if (!oocPlayerMatch || !oocPlayerMatch[1]) {
      const oocMatch = content.match(/\b(?:OOC|ooc)\b[^A-Za-z0-9_]*([A-Za-z0-9_]+)/i);
      if (oocMatch && oocMatch[1]) {
        logger.logMessage('Found OOC player using general pattern');
        oocPlayerMatch = oocMatch;
      }
    }
    
    // If IC player was found but OOC player wasn't, use the message author as OOC player
    if ((!oocPlayerMatch || !oocPlayerMatch[1]) && message) {
      try {
        const authorName = message.author.username;
        if (authorName) {
          logger.logMessage(`Using message author as OOC player: ${authorName}`);
          oocPlayerMatch = [null, authorName];
        }
      } catch (error) {
        logger.logMessage(`Error getting message author: ${error.message}`);
      }
    }
    
    if (!oocPlayerMatch || !oocPlayerMatch[1]) {
      logger.logMessage('Failed to match OOC player name, using fallback');
      // Use a fallback value
      oocPlayerMatch = [null, "UnknownOOC"];
    }
    
    const oocPlayerName = oocPlayerMatch[1].trim();
    logger.logMessage(`Found OOC player: ${oocPlayerName}`);
    
    // Persian terms translation:
    // isBardasht = remove from inventory (برداشتن)
    // isGozashtan = add to inventory (گذاشتن)
    const transactionType = isBardasht ? 'remove' : 'add';
    
    logger.logMessage(`Transaction type: ${transactionType} - IC Player: ${icPlayerName}, OOC Player: ${oocPlayerName}`);
    
    // Build result with correct transaction type
    return {
      type: transactionType,
      itemName: itemName,  // Use standardized item name
      quantity,
      icPlayerName,
      oocPlayerName
    };
  } catch (error) {
    logger.logMessage(`Error parsing log message: ${error.message}`);
    logger.logMessage(`Stack trace: ${error.stack}`);
    return null;
  }
}