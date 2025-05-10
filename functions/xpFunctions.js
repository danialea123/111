// XP processing functions for Iran-Map bot
const logger = require('../message-logger');
const { EmbedBuilder } = require('discord.js');

// Process XP message (Drug Task or Gang Task XP)
async function processXPMessage(message, client, config, logData) {
  try {
    logger.logMessage(`Processing XP message: type=${logData.xpType}, amount=${logData.xpAmount}`);
    
    const db = require('../database');
    
    // Process based on XP type
    let xpResult;
    if (logData.xpType === 'drug') {
      // Add Drug Task XP
      xpResult = await db.addDrugTaskXP(
        logData.icPlayerName,
        logData.oocPlayerName,
        logData.xpAmount
      );
      
      logger.logMessage(`Drug Task XP processed: ${JSON.stringify(xpResult)}`);
      
      // Only react if not in log channel
      if (message.channelId !== config.logChannelId) {
        await message.react('✅');
      }
      
      // Send confirmation if not in log channel
      if (message.channelId !== config.logChannelId) {
        await message.reply({
          content: `✅ Drug Task XP (${logData.xpAmount}) recorded for ${logData.icPlayerName}`,
          ephemeral: true
        });
      }
      
      // Update XP status in status channel if configured
      await updateXPStatus(client, config, 'drug');
      
    } else if (logData.xpType === 'gang') {
      // Add Gang Task XP
      xpResult = await db.addGangTaskXP(
        logData.icPlayerName,
        logData.oocPlayerName,
        logData.xpAmount
      );
      
      logger.logMessage(`Gang Task XP processed: ${JSON.stringify(xpResult)}`);
      
      // Only react if not in log channel
      if (message.channelId !== config.logChannelId) {
        await message.react('✅');
      }
      
      // Send confirmation if not in log channel
      if (message.channelId !== config.logChannelId) {
        await message.reply({
          content: `✅ Gang Task XP (${logData.xpAmount}) recorded for ${logData.icPlayerName}`,
          ephemeral: true
        });
      }
      
      // Update XP status in status channel if configured
      await updateXPStatus(client, config, 'gang');
    }
    
    return true;
  } catch (error) {
    logger.logMessage(`Error processing XP message: ${error.message}`);
    
    // Add error reaction - only if not in log channel
    if (message.channelId !== config.logChannelId) {
      try {
        await message.react('❌');
      } catch (reactError) {
        logger.logMessage(`Error adding reaction: ${reactError.message}`);
      }
    }
    
    // Reply with error - only if not in log channel
    if (message.channelId !== config.logChannelId) {
      try {
        await message.reply({
          content: `❌ Error: ${error.message}`,
          ephemeral: true
        });
      } catch (replyError) {
        logger.logMessage(`Error sending error reply: ${replyError.message}`);
      }
    }
    
    return false;
  }
}

// Update XP Status in status channel
async function updateXPStatus(client, config, xpType) {
  try {
    // Create embed based on XP type
    let embed;
    const db = require('../database');
    
    if (xpType === 'drug') {
      const status = await db.getDrugTaskXPStatus();
      
      embed = new EmbedBuilder()
        .setColor('#10B981')
        .setTitle('💊 Drug Task Status')
        .setDescription(`**Daily Progress**\n${status.count}/${status.limit} players completed today`)
        .setTimestamp();
      
      // Add player list with checkmarks
      if (status.players.length > 0) {
        const playerList = status.players.map(player => 
          `\`${player.ic_player_name}\` • **${player.xp_amount} XP** ✅`
        ).join('\n');
        
        embed.addFields({
          name: '👥 Completed Players',
          value: playerList,
          inline: false
        });
      } else {
        embed.addFields({
          name: '👥 Completed Players',
          value: '_No players have completed tasks today_',
          inline: false
        });
      }
      
      embed.setFooter({ text: `Resets at midnight UTC • ${status.date}` });
      
    } else if (xpType === 'gang') {
      const status = await db.getGangTaskXPStatus();
      
      embed = new EmbedBuilder()
        .setColor('#EF4444')
        .setTitle('🔫 Gang Task Status')
        .setDescription(`**Daily Gang Operations**\nTracking progress for today's gang activities`)
        .setTimestamp();
      
      // Add morning period (6AM-6PM)
      const morningPlayers = status.morningPlayers.map(player => 
        `\`${player.ic_player_name}\` • **${player.xp_amount} XP** ✅`
      ).join('\n');
      
      embed.addFields({
        name: '☀️ Daytime Operations (6AM-6PM)',
        value: morningPlayers || '_No operations completed during daytime_',
        inline: false
      });
      
      // Add night period (6PM-6AM)
      const nightPlayers = status.nightPlayers.map(player => 
        `\`${player.ic_player_name}\` • **${player.xp_amount} XP** ✅`
      ).join('\n');
      
      embed.addFields({
        name: '🌙 Nighttime Operations (6PM-6AM)',
        value: nightPlayers || '_No operations completed during nighttime_',
        inline: false
      });
      
      // Add current period indicator
      const currentPeriodText = status.currentPeriod === 1 ? 'Daytime (6AM-6PM)' : 'Nighttime (6PM-6AM)';
      embed.setFooter({ text: `Active Period: ${currentPeriodText} • ${status.date}` });
    }
    
    if (!embed) {
      logger.logMessage(`No embed created for XP type: ${xpType}`);
      return;
    }
    
    // Only update in the main status channel
    if (config.statusChannelId) {
      await updateStatusInChannel(client, config.statusChannelId, xpType, embed);
    }
  } catch (error) {
    logger.logMessage(`Error updating XP status: ${error.message}`);
  }
}

// Helper function to update status in a specific channel
async function updateStatusInChannel(client, channelId, xpType, embed) {
  try {
    if (!channelId) {
      logger.logMessage(`No channel configured for ${xpType} status`);
      return;
    }
    
    logger.logMessage(`Updating ${xpType} XP status in channel ${channelId}`);
    
    const statusChannel = await client.channels.fetch(channelId);
    
    if (!statusChannel) {
      logger.logMessage(`Channel ${channelId} not found!`);
      return;
    }
    
    // Try to find existing XP status message
    try {
      const messages = await statusChannel.messages.fetch({ limit: 10 });
      // Find a message from this bot that has the XP title matching our type
      const botMessages = messages.filter(msg => 
        msg.author.id === client.user.id && 
        msg.embeds.length > 0 && 
        msg.embeds[0].title && 
        (
          (xpType === 'drug' && msg.embeds[0].title.includes('Drug Task')) || 
          (xpType === 'gang' && msg.embeds[0].title.includes('Gang Task'))
        )
      );
      
      // Store message reference in global object if available
      if (client.statusMessages && botMessages.size > 0) {
        if (xpType === 'drug') {
          client.statusMessages.drugTask = botMessages.first();
        } else if (xpType === 'gang') {
          client.statusMessages.gangTask = botMessages.first();
        }
      }
      
      if (botMessages.size > 0) {
        // Update the most recent status message
        const statusMessage = botMessages.first();
        await statusMessage.edit({ 
          embeds: [embed] 
        });
        logger.logMessage(`Updated existing ${xpType} XP status message: ${statusMessage.id}`);
      } else {
        // If no existing message found, send a new one
        const newMessage = await statusChannel.send({ 
          embeds: [embed] 
        });
        logger.logMessage(`Created new ${xpType} XP status message: ${newMessage.id}`);
      }
    } catch (error) {
      logger.logMessage(`Error updating ${xpType} XP status message: ${error.message}`);
      // Fallback to sending a new message
      await statusChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.logMessage(`Error updating status in channel ${channelId}: ${error.message}`);
  }
}

// Parse XP message for Drug Tasks or Gang Tasks
function parseXPMessage(content, config) {
  try {
    logger.logMessage('Parsing XP message: ' + content);
    
    // Determine XP type
    let xpType = null;
    let xpModel = null;
    
    // Check for XP Model in the message
    const xpModelMatch = content.match(/XP\s*Model\s*:\s*([^\r\n]+)/i);
    if (xpModelMatch && xpModelMatch.length > 1) {
      xpModel = xpModelMatch[1].trim();
      logger.logMessage(`Found XP Model: ${xpModel}`);
      
      if (xpModel.toLowerCase().includes('drug')) {
        xpType = 'drug';
      } else if (xpModel.toLowerCase().includes('gang')) {
        xpType = 'gang';
      }
    }
    
    // If we couldn't determine XP type from XP Model, try to infer from content
    if (!xpType) {
      if (content.toLowerCase().includes('drug') && content.toLowerCase().includes('task')) {
        xpType = 'drug';
      } else if (content.toLowerCase().includes('gang') && content.toLowerCase().includes('task')) {
        xpType = 'gang';
      }
    }
    
    if (!xpType) {
      logger.logMessage('Could not determine XP type from message');
      return null;
    }
    
    logger.logMessage(`Determined XP type: ${xpType}`);
    
    // Extract XP amount
    let xpAmount = 0;
    const xpAmountMatch = content.match(/Meghdar\s*:\s*(\d+)/i);
    if (xpAmountMatch && xpAmountMatch.length > 1) {
      xpAmount = parseInt(xpAmountMatch[1], 10);
      logger.logMessage(`Found XP amount: ${xpAmount}`);
    }
    
    // Extract IC player name
    let icPlayerName = null;
    const icPlayerMatch = content.match(/Esm\s*IC\s*Player\s*:\s*([^\r\n]+)/i);
    if (icPlayerMatch && icPlayerMatch.length > 1) {
      icPlayerName = icPlayerMatch[1].trim();
      
      // If the name has multiple words, use only the first part as the character name
      if (icPlayerName.includes(' ')) {
        icPlayerName = icPlayerName.split(' ')[0].trim();
      }
      
      logger.logMessage(`Found IC player: ${icPlayerName}`);
    }
    
    // Extract OOC player name
    let oocPlayerName = null;
    const oocPlayerMatch = content.match(/Esm\s*OOC\s*Player\s*:\s*([^\r\n]+)/i);
    if (oocPlayerMatch && oocPlayerMatch.length > 1) {
      oocPlayerName = oocPlayerMatch[1].trim();
      logger.logMessage(`Found OOC player: ${oocPlayerName}`);
    }
    
    // Default names if not found
    icPlayerName = icPlayerName || 'Unknown Player';
    oocPlayerName = oocPlayerName || 'Unknown Player';
    
    // Return parsed XP data
    const parsedData = {
      type: 'xp',
      xpType: xpType,
      xpAmount: xpAmount,
      icPlayerName,
      oocPlayerName
    };
    
    logger.logMessage(`Parsed XP data: ${JSON.stringify(parsedData)}`);
    return parsedData;
  } catch (error) {
    logger.logMessage(`Error parsing XP message: ${error.message}`);
    return null;
  }
}

module.exports = {
  processXPMessage,
  updateXPStatus,
  parseXPMessage,
  updateStatusInChannel
};