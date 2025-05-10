/**
 * Gang Task System
 * Handles all gang task-related functionality including XP tracking, display, and persistence
 */

const { EmbedBuilder } = require('discord.js');
const { updateSystemMessage } = require('../utils/messageManager');
const db = require('../database');

/**
 * Create gang task status embed
 * @param {Array} morningRecords - Morning period gang task XP records
 * @param {Array} eveningRecords - Evening period gang task XP records
 * @param {String} resetDate - Current reset date
 * @returns {EmbedBuilder} The formatted embed
 */
function createGangTaskEmbed(morningRecords, eveningRecords, resetDate) {
  const embed = new EmbedBuilder()
    .setTitle('👥 Gang Task Status')
    .setColor('#F43F5E')
    .setDescription(`**Today's Gang Task Progress**\nReset Date: ${resetDate}`)
    .setTimestamp()
    .setFooter({ text: 'Last updated' });

  // Process morning period
  const morningPlayers = processRecordsForPeriod(morningRecords);
  let morningText = '';
  
  if (morningPlayers.length === 0) {
    morningText = '*No gang tasks completed in this period*';
  } else {
    morningPlayers.forEach((player, index) => {
      // Add medal for top 3
      let prefix = `${index + 1}.`;
      if (index === 0) prefix = '🥇';
      else if (index === 1) prefix = '🥈';
      else if (index === 2) prefix = '🥉';
      
      morningText += `${prefix} \`${player.icName}\` — **${player.totalXP} XP**\n`;
    });
  }
  
  embed.addFields({
    name: '🌅 Morning Period (00:00 - 12:00)',
    value: morningText,
    inline: false
  });
  
  // Process evening period
  const eveningPlayers = processRecordsForPeriod(eveningRecords);
  let eveningText = '';
  
  if (eveningPlayers.length === 0) {
    eveningText = '*No gang tasks completed in this period*';
  } else {
    eveningPlayers.forEach((player, index) => {
      // Add medal for top 3
      let prefix = `${index + 1}.`;
      if (index === 0) prefix = '🥇';
      else if (index === 1) prefix = '🥈';
      else if (index === 2) prefix = '🥉';
      
      eveningText += `${prefix} \`${player.icName}\` — **${player.totalXP} XP**\n`;
    });
  }
  
  embed.addFields({
    name: '🌃 Evening Period (12:00 - 00:00)',
    value: eveningText,
    inline: false
  });

  return embed;
}

/**
 * Process records for a specific period
 * @param {Array} records - Array of gang task XP records for a period
 * @returns {Array} Sorted array of player objects with totals
 */
function processRecordsForPeriod(records) {
  // Group records by player
  const playerMap = new Map();
  
  // Process all records
  records.forEach(record => {
    const playerKey = `${record.ic_player_name} (${record.ooc_player_name})`;
    
    if (!playerMap.has(playerKey)) {
      playerMap.set(playerKey, {
        icName: record.ic_player_name,
        oocName: record.ooc_player_name,
        totalXP: 0
      });
    }
    
    // Add XP to player's total
    const player = playerMap.get(playerKey);
    player.totalXP += record.xp_amount;
  });
  
  // Convert to array and sort by XP (highest first)
  return Array.from(playerMap.values())
    .sort((a, b) => b.totalXP - a.totalXP);
}

/**
 * Update gang task status message
 * @param {Object} channel - Discord channel to send/update message in
 * @returns {Promise<void>}
 */
async function updateGangTaskStatus(channel) {
  try {
    // Get current date in YYYY-MM-DD format for the reset period
    const today = new Date();
    const resetDate = today.toISOString().split('T')[0];
    
    // Get the gang task records for both periods
    const gangTaskData = await db.getGangTaskXPStatus();
    const morningRecords = gangTaskData.morningPlayers; // Already filtered in the database query
    const eveningRecords = gangTaskData.nightPlayers;   // Already filtered in the database query
    
    // Create the embed
    const embed = createGangTaskEmbed(morningRecords, eveningRecords, resetDate);
    
    // Update or create the message
    await updateSystemMessage(channel, embed, 'gangTask', 'Gang Task Status');
    console.log(`Gang task status updated in channel ${channel.id}`);
  } catch (error) {
    console.error('Error updating gang task status:', error);
  }
}

module.exports = {
  updateGangTaskStatus,
  createGangTaskEmbed
};