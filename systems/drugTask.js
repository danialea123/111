/**
 * Drug Task System
 * Handles all drug task-related functionality including XP tracking, display, and persistence
 */

const { EmbedBuilder } = require('discord.js');
const { updateSystemMessage } = require('../utils/messageManager');
const db = require('../database');

/**
 * Create drug task status embed
 * @param {Array} records - Array of drug task XP records
 * @param {String} resetDate - Current reset date
 * @returns {EmbedBuilder} The formatted embed
 */
function createDrugTaskEmbed(records, resetDate) {
  const embed = new EmbedBuilder()
    .setTitle('💊 Drug Task Status')
    .setColor('#10B981')
    .setDescription(`**Today's Drug Task Progress**\nReset Date: ${resetDate}`)
    .setTimestamp()
    .setFooter({ text: 'Last updated' });

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
  const players = Array.from(playerMap.values())
    .sort((a, b) => b.totalXP - a.totalXP);
  
  // Generate leaderboard text
  let leaderboardText = '';
  
  if (players.length === 0) {
    leaderboardText = '*No drug tasks completed today*';
  } else {
    players.forEach((player, index) => {
      // Add medal for top 3
      let prefix = `${index + 1}.`;
      if (index === 0) prefix = '🥇';
      else if (index === 1) prefix = '🥈';
      else if (index === 2) prefix = '🥉';
      
      leaderboardText += `${prefix} \`${player.icName}\` — **${player.totalXP} XP**\n`;
    });
  }
  
  embed.addFields({
    name: '📊 Leaderboard',
    value: leaderboardText,
    inline: false
  });

  return embed;
}

/**
 * Update drug task status message
 * @param {Object} channel - Discord channel to send/update message in
 * @returns {Promise<void>}
 */
async function updateDrugTaskStatus(channel) {
  try {
    // Get current date in YYYY-MM-DD format for the reset period
    const today = new Date();
    const resetDate = today.toISOString().split('T')[0];
    
    // Get all drug task records for today
    const drugTaskData = await db.getDrugTaskXPStatus();
    
    // Create the embed - pass the players array from the data
    const embed = createDrugTaskEmbed(drugTaskData.players, resetDate);
    
    // Update or create the message
    await updateSystemMessage(channel, embed, 'drugTask', 'Drug Task Status');
    console.log(`Drug task status updated in channel ${channel.id}`);
  } catch (error) {
    console.error('Error updating drug task status:', error);
  }
}

module.exports = {
  updateDrugTaskStatus,
  createDrugTaskEmbed
};