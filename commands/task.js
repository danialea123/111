const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('View task status')
    .addStringOption(option => 
      option
        .setName('action')
        .setDescription('Type of task status to view')
        .setRequired(true)
        .addChoices(
          { name: 'Drug Task Status', value: 'drug' },
          { name: 'Gang Task Status', value: 'gang' }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      // Get which task type to show
      const actionType = interaction.options.getString('action');
      
      if (actionType === 'drug') {
        // Import the drug task system
        const drugTaskSystem = require('../systems/drugTask');
        const db = require('../database');
        
        // Get current date and drug task data
        const today = new Date();
        const resetDate = today.toISOString().split('T')[0];
        const drugStatus = await db.getDrugTaskXPStatus();
        
        // Create embed for drug tasks using the same logic as the system module
        const drugEmbed = drugTaskSystem.createDrugTaskEmbed(drugStatus.players, resetDate);
        
        // Send embed
        await interaction.editReply({ embeds: [drugEmbed] });
        return;
      } 
      else if (actionType === 'gang') {
        // Import the gang task system
        const gangTaskSystem = require('../systems/gangTask');
        const db = require('../database');
        
        // Get current date and gang task data
        const today = new Date();
        const resetDate = today.toISOString().split('T')[0];
        const gangStatus = await db.getGangTaskXPStatus();
        
        // Create embed for gang tasks using the same logic as the system module
        const gangEmbed = gangTaskSystem.createGangTaskEmbed(
          gangStatus.morningPlayers, 
          gangStatus.nightPlayers, 
          resetDate
        );
        
        // Send embed
        await interaction.editReply({ embeds: [gangEmbed] });
        return;
      }
      else {
        // Unknown action type
        await interaction.editReply({ content: `❌ Error: Unknown action type: ${actionType}`, ephemeral: true });
        return;
      }
    } catch (error) {
      console.error('Error executing task command:', error);
      try {
        const content = interaction.deferred || interaction.replied
          ? { content: `❌ An error occurred: ${error.message}`, ephemeral: true }
          : `❌ An error occurred: ${error.message}`;
          
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(content);
        } else {
          await interaction.reply(content);
        }
      } catch (replyError) {
        console.error('Error replying to interaction:', replyError);
      }
    }
  },
};