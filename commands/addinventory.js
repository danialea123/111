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
      
      // Update status message in status channel
      try {
        const statusChannel = interaction.client.channels.cache.get(interaction.client.config?.statusChannelId);
        if (statusChannel) {
          // Get updated inventory
          const items = await db.getItems();
          
          // Create embed
          const statusEmbed = new EmbedBuilder()
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
            
            statusEmbed.addFields({
              name: '💊 Drug Inventory',
              value: drugList,
              inline: false
            });
          }
          
          // Try to find and update existing inventory message
          try {
            // First, check if we have the message ID stored in client
            if (interaction.client.statusMessages && interaction.client.statusMessages.inventory) {
              // Try to fetch and update the existing message
              try {
                await interaction.client.statusMessages.inventory.edit({ embeds: [statusEmbed] });
                console.log(`Updated persistent inventory message: ${interaction.client.statusMessages.inventory.id}`);
                return; // Successfully updated, exit early
              } catch (editError) {
                console.error('Error updating stored inventory message, will try searching:', editError);
                // Continue to fallback method if edit fails
              }
            }
            
            // Fallback: search for an existing message if direct reference fails
            const messages = await statusChannel.messages.fetch({ limit: 10 });
            const botMessages = messages.filter(msg => 
              msg.author.id === interaction.client.user.id && 
              msg.embeds.length > 0 && 
              msg.embeds[0].title && 
              msg.embeds[0].title.includes('Inventory Status')
            );
            
            if (botMessages.size > 0) {
              // Update existing message
              const statusMessage = botMessages.first();
              await statusMessage.edit({ embeds: [statusEmbed] });
              console.log(`Updated existing inventory message: ${statusMessage.id}`);
              
              // Store reference for future use
              if (interaction.client.statusMessages) {
                interaction.client.statusMessages.inventory = statusMessage;
              }
            } else {
              // Create new message as last resort
              const newMessage = await statusChannel.send({ embeds: [statusEmbed] });
              console.log(`Created new inventory message: ${newMessage.id}`);
              
              // Store reference for future use
              if (interaction.client.statusMessages) {
                interaction.client.statusMessages.inventory = newMessage;
              }
            }
          } catch (messageError) {
            console.error('Error finding/updating inventory message:', messageError);
            // If all else fails, send a new message
            const newMessage = await statusChannel.send({ embeds: [statusEmbed] });
            console.log(`Created fallback inventory message: ${newMessage.id}`);
          }
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