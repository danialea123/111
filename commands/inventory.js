// Inventory command for displaying current inventory
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
  name: 'inventory',
  description: 'Show inventory status',
  
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Show current inventory status'),
  
  // Execute slash command
  async execute(interaction) {
    try {
      // Defer reply to have time to fetch data
      await interaction.deferReply();
      
      // Import the inventory system module
      const inventorySystem = require('../systems/inventory');
      const db = require('../database');
      
      // Get all items
      const items = await db.getItems();
      
      // Use the inventory system to create the embed with consistent formatting
      const embed = inventorySystem.createInventoryEmbed(items);
      
      // Modify the description if inventory is empty
      if (!items || items.length === 0) {
        embed.setDescription('**Inventory Empty**\n_No items currently in stock_');
      }
      
      // Send the embed
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error executing inventory command:', error);
      
      if (interaction.deferred) {
        await interaction.editReply('Error retrieving inventory data.');
      } else {
        await interaction.reply({ 
          content: 'Error retrieving inventory data.',
          ephemeral: true 
        });
      }
    }
  }
};