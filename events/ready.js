// Handle bot ready event
const { ActivityType } = require('discord.js');
const db = require('../database');

module.exports = {
  name: 'ready',
  once: true,
  
  async execute(client, config) {
    console.log(`Bot logged in as ${client.user.tag}`);
    
    // Connect to database
    await db.initializeDatabase();
    
    // Set bot activity
    client.user.setPresence({
      activities: [{ 
        name: '/inventory', 
        type: ActivityType.Watching 
      }],
      status: 'online',
    });
    
    // Initialize status message in status channel
    if (config.statusChannelId) {
      try {
        const statusChannel = client.channels.cache.get(config.statusChannelId);
        if (statusChannel) {
          // Clear previous messages (optional)
          // const messages = await statusChannel.messages.fetch({ limit: 10 });
          // await statusChannel.bulkDelete(messages);
          
          console.log(`Status channel found: ${statusChannel.name}`);
          
          // Get all items
          const items = await db.getItems();
          
          // Create inventory status embed
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setTitle('📦 Inventory Status')
            .setColor(0x2B2D31)
            .setDescription('Current inventory status:')
            .setTimestamp()
            .setFooter({ text: 'Last updated' });
          
          // Add items to embed
          const drugs = items.filter(item => item.category === 'drug');
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
          
          // Send status message
          await statusChannel.send({ 
            content: '**Inventory System Bot is now online!**',
            embeds: [embed] 
          });
          
          console.log('Initial inventory status message sent to status channel');
        } else {
          console.error(`Status channel with ID ${config.statusChannelId} not found`);
        }
      } catch (error) {
        console.error('Error initializing status message:', error);
      }
    } else {
      console.log('No status channel configured, skipping status message initialization');
    }
  }
};