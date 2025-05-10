/**
 * Inventory System
 * Handles all inventory-related functionality including updates, display, and persistence
 */

const { EmbedBuilder } = require('discord.js');
const { updateSystemMessage } = require('../utils/messageManager');
const db = require('../database');

/**
 * Create inventory status embed
 * @param {Array} items - Array of inventory items
 * @returns {EmbedBuilder} The formatted embed
 */
function createInventoryEmbed(items) {
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

  return embed;
}

/**
 * Update inventory status message
 * @param {Object} channel - Discord channel to send/update message in
 * @returns {Promise<void>}
 */
async function updateInventoryStatus(channel) {
  try {
    // Get all inventory items
    const items = await db.getItems();
    
    // Create the embed
    const embed = createInventoryEmbed(items);
    
    // Update or create the message
    await updateSystemMessage(channel, embed, 'inventory', 'Inventory Status');
    console.log(`Inventory status updated in channel ${channel.id}`);
  } catch (error) {
    console.error('Error updating inventory status:', error);
  }
}

module.exports = {
  updateInventoryStatus,
  createInventoryEmbed
};