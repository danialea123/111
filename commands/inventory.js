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
        .setTitle('📦 Current Inventory')
        .setColor(0x2B2D31)
        .setTimestamp()
        .setFooter({ text: 'Last updated' });
      
      if (!items || items.length === 0) {
        embed.setDescription('No items in inventory.');
      } else {
        // Group items by category
        const drugs = items.filter(item => item.category === 'drug');
        
        // Add drug items
        if (drugs.length > 0) {
          let drugList = '';
          drugs.forEach(item => {
            drugList += `**${item.name}(${item.quantity})**\n`;
          });
          
          embed.addFields({
            name: 'Drugs',
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