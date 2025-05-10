// Import message logger
const logger = require('../message-logger');

// Handle all interaction types (slash commands, buttons, etc.)
module.exports = {
  name: 'interactionCreate',
  once: false,
  
  async execute(interaction, client, config) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        // Get command from collection
        const command = client.commands.get(interaction.commandName);
        
        // If command doesn't exist, ignore
        if (!command) return;
        
        // Execute the command
        logger.logMessage(`Executing slash command: ${interaction.commandName}`);
        await command.execute(interaction);
      }
      // Handle button interactions
      else if (interaction.isButton()) {
        // Handle template buttons
        if (interaction.customId.startsWith('template_')) {
          // Button handling is done in the logtemplate.js command via collector
          return;
        }
        
        // Handle quick log buttons
        if (interaction.customId.startsWith('quick_')) {
          // Button handling is done in the quicklog.js command via collector
          return;
        }
        
        // Handle other button types here if needed
        logger.logMessage(`Button clicked: ${interaction.customId}`);
      }
      
    } catch (error) {
      logger.logMessage(`Error handling interaction: ${error.message}`);
      console.error(`Error handling interaction:`, error);
      
      // Reply with error if not already replied
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: 'There was an error handling this interaction!', 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: 'There was an error handling this interaction!', 
          ephemeral: true 
        });
      }
    }
  }
};