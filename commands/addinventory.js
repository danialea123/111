// Add inventory command for adding/removing items
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
  name: 'addinventory',
  description: 'Add or remove items from inventory',
  
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName('addinventory')
    .setDescription('Add or remove items from inventory')
    .addStringOption(option => 
      option.setName('action')
        .setDescription('Whether to add or remove items')
        .setRequired(true)
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' }
        )
    )
    .addStringOption(option => 
      option.setName('item')
        .setDescription('The item to add/remove')
        .setRequired(true)
        .addChoices(
          { name: 'Crack', value: 'Crack' },
          { name: 'Mushroom', value: 'Ghaarch' },
          { name: 'Marijuana', value: 'Marijuana' },
          { name: 'Crystal Meth', value: 'Shishe' },
          { name: 'Cocaine', value: 'Cocaine' }
        )
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to add/remove')
        .setRequired(true)
        .setMinValue(1)
    ),
  
  // Execute command
  async execute(interaction) {
    try {
      // Get options
      const action = interaction.options.getString('action');
      const itemName = interaction.options.getString('item');
      const amount = interaction.options.getInteger('amount');
      const icPlayer = interaction.user.username;
      const oocPlayer = interaction.user.username;
      
      // Defer reply
      await interaction.deferReply();
      
      // Process the transaction
      const result = await db.processTransaction(action, itemName, amount, icPlayer, oocPlayer);
      
      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('🔄 Inventory Updated')
        .setColor(action === 'add' ? '#10B981' : '#F43F5E')
        .setDescription(`Successfully ${action === 'add' ? '**added to**' : '**removed from**'} inventory.`)
        .addFields(
          { name: 'Item', value: `\`${itemName}\``, inline: true },
          { name: 'Amount', value: `**${amount}**`, inline: true },
          { name: 'New Quantity', value: `**${result.quantity}**`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Admin: ${interaction.user.username}` });
      
      // Send response
      await interaction.editReply({ embeds: [embed] });
      
      // Update inventory status using the inventory system module
      try {
        const statusChannel = interaction.client.channels.cache.get(interaction.client.config?.statusChannelId);
        if (statusChannel) {
          // Import the inventory system
          const inventorySystem = require('../systems/inventory');
          
          // Update the inventory status
          await inventorySystem.updateInventoryStatus(statusChannel);
        }
      } catch (error) {
        console.error('Error updating status channel:', error);
      }
    } catch (error) {
      console.error('Error executing addinventory command:', error);
      
      if (interaction.deferred) {
        await interaction.editReply(`Error: ${error.message || 'An unknown error occurred'}`);
      } else {
        await interaction.reply({ 
          content: `Error: ${error.message || 'An unknown error occurred'}`,
          ephemeral: true 
        });
      }
    }
  }
};