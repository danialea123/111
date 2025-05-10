const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
          { name: 'Gang Task Status', value: 'gang' },
          { name: 'Gang Task Morning (7:00 AM - 6:00 PM)', value: 'gang_morning' },
          { name: 'Gang Task Evening (6:00 PM - 7:00 AM)', value: 'gang_evening' }
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
        
        // Create a custom embed with progress ticks
        const drugEmbed = new EmbedBuilder()
          .setTitle('💊 Drug Task Status')
          .setColor('#10B981')
          .setDescription(`Daily Progress: ${drugStatus.count}/${drugStatus.limit}\n${createProgressBar(drugStatus.count, drugStatus.limit)}\nToday's IC members who completed drug tasks.`)
          .setTimestamp()
          .setFooter({ text: `Resets at midnight UTC • ${resetDate}` });
          
        // Add player list with checkmarks
        if (drugStatus.players.length > 0) {
          let playerList = '';
          drugStatus.players.forEach((player, index) => {
            // Add emoji based on position
            let prefix = `${index + 1}.`;
            if (index === 0) prefix = '🥇';
            else if (index === 1) prefix = '🥈';
            else if (index === 2) prefix = '🥉';
            
            playerList += `${prefix} \`${player.ic_player_name}\` — **${player.xp_amount} XP** ✅\n`;
          });
          
          drugEmbed.addFields({
            name: '(Members)',
            value: playerList,
            inline: false
          });
        } else {
          drugEmbed.addFields({
            name: '(Members)',
            value: 'No drug tasks completed today',
            inline: false
          });
        }
        
        // Send embed
        await interaction.editReply({ embeds: [drugEmbed] });
        return;
      } 
      else if (actionType === 'gang' || actionType === 'gang_morning' || actionType === 'gang_evening') {
        // Import the gang task system
        const gangTaskSystem = require('../systems/gangTask');
        const db = require('../database');
        
        // Get current date and gang task data
        const today = new Date();
        const resetDate = today.toISOString().split('T')[0];
        const gangStatus = await db.getGangTaskXPStatus();
        
        // Determine which embed to create based on the action type
        let gangEmbed;
        
        if (actionType === 'gang') {
          // Regular gang task status with both periods
          gangEmbed = gangTaskSystem.createGangTaskEmbed(
            gangStatus.morningPlayers, 
            gangStatus.nightPlayers, 
            resetDate
          );
        } 
        else if (actionType === 'gang_morning') {
          // Morning period only (7:00 AM - 6:00 PM)
          gangEmbed = new EmbedBuilder()
            .setTitle('👥 Gang Task Status - Morning')
            .setColor('#F59E0B')
            .setDescription(`**Morning Period Gang Operations**\nReset Time: 7:00 AM - 6:00 PM\nDate: ${resetDate}`)
            .setTimestamp()
            .setFooter({ text: 'Last updated' });
          
          // Process morning period records
          const morningPlayers = gangTaskSystem.processRecordsForPeriod(gangStatus.morningPlayers);
          let morningText = '';
          
          if (morningPlayers.length === 0) {
            morningText = '*No gang tasks completed in the morning period*';
          } else {
            morningPlayers.forEach((player, index) => {
              // Add medal for top 3
              let prefix = `${index + 1}.`;
              if (index === 0) prefix = '🥇';
              else if (index === 1) prefix = '🥈';
              else if (index === 2) prefix = '🥉';
              
              morningText += `${prefix} \`${player.icName}\` — **${player.totalXP} XP**\n`;
            });
          }
          
          gangEmbed.addFields({
            name: '🌅 Morning Operations (7:00 AM - 6:00 PM)',
            value: morningText,
            inline: false
          });
        }
        else if (actionType === 'gang_evening') {
          // Evening period only (6:00 PM - 7:00 AM)
          gangEmbed = new EmbedBuilder()
            .setTitle('👥 Gang Task Status - Evening')
            .setColor('#8B5CF6')
            .setDescription(`**Evening Period Gang Operations**\nReset Time: 6:00 PM - 7:00 AM\nDate: ${resetDate}`)
            .setTimestamp()
            .setFooter({ text: 'Last updated' });
          
          // Process evening period records
          const eveningPlayers = gangTaskSystem.processRecordsForPeriod(gangStatus.nightPlayers);
          let eveningText = '';
          
          if (eveningPlayers.length === 0) {
            eveningText = '*No gang tasks completed in the evening period*';
          } else {
            eveningPlayers.forEach((player, index) => {
              // Add medal for top 3
              let prefix = `${index + 1}.`;
              if (index === 0) prefix = '🥇';
              else if (index === 1) prefix = '🥈';
              else if (index === 2) prefix = '🥉';
              
              eveningText += `${prefix} \`${player.icName}\` — **${player.totalXP} XP**\n`;
            });
          }
          
          gangEmbed.addFields({
            name: '🌃 Evening Operations (6:00 PM - 7:00 AM)',
            value: eveningText,
            inline: false
          });
        }
        
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