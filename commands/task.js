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
      const db = require('../database');
      const xpFunctions = require('../functions/xpFunctions');
      
      await interaction.deferReply();
      
      // Get which task type to show
      const actionType = interaction.options.getString('action');
      
      if (actionType === 'drug') {
        // Get drug task status
        const drugStatus = await db.getDrugTaskXPStatus();
        
        // Create embed for drug tasks
        const drugEmbed = new EmbedBuilder()
          .setColor('#10B981')
          .setTitle('💊 Drug Task Status')
          .setDescription(`**Daily Progress**\n${drugStatus.count}/${drugStatus.limit} players completed today`)
          .setTimestamp();
        
        // Add player list with checkmarks
        if (drugStatus.players.length > 0) {
          const playerList = drugStatus.players.map(player => 
            `\`${player.ic_player_name}\` • **${player.xp_amount} XP** ✅`
          ).join('\n');
          
          drugEmbed.addFields({
            name: '👥 Completed Players',
            value: playerList,
            inline: false
          });
        } else {
          drugEmbed.addFields({
            name: '👥 Completed Players',
            value: '_No players have completed tasks today_',
            inline: false
          });
        }
        
        drugEmbed.setFooter({ text: `Resets at midnight UTC • ${drugStatus.date}` });
        
        // Send embed
        await interaction.editReply({ embeds: [drugEmbed] });
        return;
      } 
      else if (actionType === 'gang') {
        // Get gang task status
        const gangStatus = await db.getGangTaskXPStatus();
        
        // Create embed for gang tasks
        const gangEmbed = new EmbedBuilder()
          .setColor('#EF4444')
          .setTitle('🔫 Gang Task Status')
          .setDescription(`**Daily Gang Operations**\nTracking progress for today's gang activities`)
          .setTimestamp();
        
        // Add morning period (6AM-6PM)
        const morningPlayers = gangStatus.morningPlayers.map(player => 
          `\`${player.ic_player_name}\` • **${player.xp_amount} XP** ✅`
        ).join('\n');
        
        gangEmbed.addFields({
          name: '☀️ Daytime Operations (6AM-6PM)',
          value: morningPlayers || '_No operations completed during daytime_',
          inline: false
        });
        
        // Add night period (6PM-6AM)
        const nightPlayers = gangStatus.nightPlayers.map(player => 
          `\`${player.ic_player_name}\` • **${player.xp_amount} XP** ✅`
        ).join('\n');
        
        gangEmbed.addFields({
          name: '🌙 Nighttime Operations (6PM-6AM)',
          value: nightPlayers || '_No operations completed during nighttime_',
          inline: false
        });
        
        // Add current period indicator
        const currentPeriodText = gangStatus.currentPeriod === 1 ? 'Daytime (6AM-6PM)' : 'Nighttime (6PM-6AM)';
        gangEmbed.setFooter({ text: `Active Period: ${currentPeriodText} • ${gangStatus.date}` });
        
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