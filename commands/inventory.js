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
      
      // Get all items
      const items = await db.getItems();
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('📦 Inventory Status')
        .setColor('#6366F1')
        .setDescription('**Current Stock Levels**')
        .setTimestamp()
        .setFooter({ text: 'Last updated' });
      
      if (!items || items.length === 0) {
        embed.setDescription('**Inventory Empty**\n_No items currently in stock_');
      } else {
        // Group items by category
        const drugs = items.filter(item => item.category === 'drug');
        
        // Add drug items
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