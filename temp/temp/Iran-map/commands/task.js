const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('View task status or add a task completion')
    .addSubcommand(subcommand => 
      subcommand
        .setName('status')
        .setDescription('View current task status for drug and gang tasks')
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('drug')
        .setDescription('Add drug task XP for a player')
        .addStringOption(option => 
          option
            .setName('ic_name')
            .setDescription('IC name of the player (in-character name)')
            .setRequired(true)
        )
        .addStringOption(option => 
          option
            .setName('ooc_name')
            .setDescription('OOC name of the player (out-of-character name)')
            .setRequired(true)
        )
        .addIntegerOption(option => 
          option
            .setName('xp')
            .setDescription('Amount of XP to add')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand => 
      subcommand
        .setName('gang')
        .setDescription('Add gang task XP for a player')
        .addStringOption(option => 
          option
            .setName('ic_name')
            .setDescription('IC name of the player (in-character name)')
            .setRequired(true)
        )
        .addStringOption(option => 
          option
            .setName('ooc_name')
            .setDescription('OOC name of the player (out-of-character name)')
            .setRequired(true)
        )
        .addIntegerOption(option => 
          option
            .setName('xp')
            .setDescription('Amount of XP to add')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction) {
    try {
      const db = require('../database');
      const xpFunctions = require('../functions/xpFunctions');
      
      // Get subcommand
      const subcommand = interaction.options.getSubcommand();
      
      // Status subcommand - show current task status
      if (subcommand === 'status') {
        await interaction.deferReply();
        
        // Get both drug and gang task status
        const drugStatus = await db.getDrugTaskXPStatus();
        const gangStatus = await db.getGangTaskXPStatus();
        
        // Create embed for drug tasks
        const drugEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('💊 Drug Task XP Status')
          .setDescription(`Daily progress: **${drugStatus.count}/${drugStatus.limit}** players completed`)
          .setTimestamp();
        
        // Add player list with checkmarks
        if (drugStatus.players.length > 0) {
          const playerList = drugStatus.players.map(player => 
            `${player.ic_player_name} ✅ (${player.xp_amount} XP)`
          ).join('\n');
          
          drugEmbed.addFields({
            name: 'Completed Players:',
            value: playerList || 'No players yet',
            inline: false
          });
        } else {
          drugEmbed.addFields({
            name: 'Completed Players:',
            value: 'No players yet',
            inline: false
          });
        }
        
        drugEmbed.setFooter({ text: `Reset at midnight | Current date: ${drugStatus.date}` });
        
        // Create embed for gang tasks
        const gangEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('🔫 Gang Task XP Status')
          .setDescription(`Daily gang tasks status`)
          .setTimestamp();
        
        // Add morning period (6AM-6PM)
        const morningPlayers = gangStatus.morningPlayers.map(player => 
          `${player.ic_player_name} ✅ (${player.xp_amount} XP)`
        ).join('\n');
        
        gangEmbed.addFields({
          name: 'Morning Period (6AM-6PM):',
          value: morningPlayers || 'No players yet ❌',
          inline: false
        });
        
        // Add night period (6PM-6AM)
        const nightPlayers = gangStatus.nightPlayers.map(player => 
          `${player.ic_player_name} ✅ (${player.xp_amount} XP)`
        ).join('\n');
        
        gangEmbed.addFields({
          name: 'Night Period (6PM-6AM):',
          value: nightPlayers || 'No players yet ❌',
          inline: false
        });
        
        // Add current period indicator
        const currentPeriodText = gangStatus.currentPeriod === 1 ? 'Morning Period (6AM-6PM)' : 'Night Period (6PM-6AM)';
        gangEmbed.setFooter({ text: `Current period: ${currentPeriodText} | Date: ${gangStatus.date}` });
        
        // Send both embeds
        await interaction.editReply({ embeds: [drugEmbed, gangEmbed] });
        return;
      }
      
      // Drug task subcommand - add drug task XP
      if (subcommand === 'drug') {
        await interaction.deferReply();
        
        const icName = interaction.options.getString('ic_name');
        const oocName = interaction.options.getString('ooc_name');
        const xpAmount = interaction.options.getInteger('xp');
        
        // Add drug task XP
        try {
          const result = await db.addDrugTaskXP(icName, oocName, xpAmount);
          
          // Send confirmation
          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Drug Task XP Added')
            .setDescription(`Added ${xpAmount} XP for ${icName} (${oocName})`)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
          // Update XP status in status channel
          await xpFunctions.updateXPStatus(interaction.client, interaction.client.config, 'drug');
        } catch (error) {
          await interaction.editReply({ content: `❌ Error: ${error.message}`, ephemeral: true });
        }
        return;
      }
      
      // Gang task subcommand - add gang task XP
      if (subcommand === 'gang') {
        await interaction.deferReply();
        
        const icName = interaction.options.getString('ic_name');
        const oocName = interaction.options.getString('ooc_name');
        const xpAmount = interaction.options.getInteger('xp');
        
        // Add gang task XP
        try {
          const result = await db.addGangTaskXP(icName, oocName, xpAmount);
          
          // Send confirmation
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('✅ Gang Task XP Added')
            .setDescription(`Added ${xpAmount} XP for ${icName} (${oocName})`)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
          // Update XP status in status channel
          await xpFunctions.updateXPStatus(interaction.client, interaction.client.config, 'gang');
        } catch (error) {
          await interaction.editReply({ content: `❌ Error: ${error.message}`, ephemeral: true });
        }
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