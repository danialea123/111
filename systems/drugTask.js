/**
 * Drug Task System
 * Handles all drug task-related functionality including XP tracking, display, and persistence
 */

const { EmbedBuilder } = require('discord.js');
const { updateSystemMessage } = require('../utils/messageManager');
const db = require('../database');

/**
 * Create a visual progress bar
 * @param {number} current - Current progress value
 * @param {number} total - Total maximum value
 * @returns {string} Visual progress bar
 */
function createProgressBar(current, total) {
  const filledChar = '🟩'; // Green square for completed
  const emptyChar = '⬜'; // White square for incomplete
  const width = 5; // Total width of progress bar
  
  // Calculate how many blocks should be filled
  let filled = Math.round((current / total) * width);
  if (filled > width) filled = width;
  
  // Create the progress bar
  let bar = '';
  for (let i = 0; i < width; i++) {
    bar += i < filled ? filledChar : emptyChar;
  }
  
  return bar;
}

/**
 * Create drug task status embed
 * @param {Array} records - Array of drug task XP records
 * @param {String} resetDate - Current reset date
 * @returns {EmbedBuilder} The formatted embed
 */
function createDrugTaskEmbed(records, resetDate) {
  // Count total records to determine progress
  const count = records.length;
  const limit = 5; // Maximum number of tasks per day
  
  const embed = new EmbedBuilder()
    .setTitle('💊 Drug Task Status')
    .setColor('#10B981')
    .setDescription(`Daily Progress: ${count}/${limit}\n${createProgressBar(count, limit)}\nToday's IC members who completed drug tasks.`)
    .setTimestamp()
    .setFooter({ text: `Resets at midnight UTC • ${resetDate}` });

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
    name: '(Members)',
    value: leaderboardText || 'No drug tasks completed today',
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