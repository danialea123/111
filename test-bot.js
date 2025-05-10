// Test script to verify bot configuration and permissions
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Event: When bot is ready
client.once('ready', async () => {
  console.log(`Bot is logged in as ${client.user.tag}`);
  
  try {
    // List all available guilds (servers)
    console.log('\n=== SERVERS THE BOT HAS ACCESS TO ===');
    client.guilds.cache.forEach(guild => {
      console.log(`- ${guild.name} (ID: ${guild.id})`);
    });
    
    // Check the specified guild
    const guildId = process.env.GUILD_ID;
    if (guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        console.log(`\n=== CHANNELS IN SERVER: ${guild.name} ===`);
        
        // List text channels the bot can see
        const textChannels = guild.channels.cache
          .filter(c => c.type === 0) // 0 is text channel
          .sort((a, b) => a.rawPosition - b.rawPosition);
        
        console.log('\nText Channels:');
        textChannels.forEach(channel => {
          const canSend = channel.permissionsFor(client.user).has('SendMessages');
          const canView = channel.permissionsFor(client.user).has('ViewChannel');
          console.log(`- ${channel.name} (ID: ${channel.id}) - Can View: ${canView ? 'Yes' : 'No'}, Can Send: ${canSend ? 'Yes' : 'No'}`);
        });
        
        // Check configured channels
        console.log('\n=== CHECKING CONFIGURED CHANNELS ===');
        
        // Check log channel
        const logChannelId = process.env.LOG_CHANNEL_ID;
        if (logChannelId) {
          const logChannel = guild.channels.cache.get(logChannelId);
          if (logChannel) {
            const canSend = logChannel.permissionsFor(client.user).has('SendMessages');
            const canView = logChannel.permissionsFor(client.user).has('ViewChannel');
            console.log(`Log Channel: ${logChannel.name} (ID: ${logChannel.id}) - Can View: ${canView ? 'Yes' : 'No'}, Can Send: ${canSend ? 'Yes' : 'No'}`);
          } else {
            console.log(`LOG_CHANNEL_ID (${logChannelId}) not found in this server!`);
          }
        } else {
          console.log('LOG_CHANNEL_ID not configured in .env file!');
        }
        
        // Check status channel
        const statusChannelId = process.env.STATUS_CHANNEL_ID;
        if (statusChannelId) {
          const statusChannel = guild.channels.cache.get(statusChannelId);
          if (statusChannel) {
            const canSend = statusChannel.permissionsFor(client.user).has('SendMessages');
            const canView = statusChannel.permissionsFor(client.user).has('ViewChannel');
            console.log(`Status Channel: ${statusChannel.name} (ID: ${statusChannel.id}) - Can View: ${canView ? 'Yes' : 'No'}, Can Send: ${canSend ? 'Yes' : 'No'}`);
          } else {
            console.log(`STATUS_CHANNEL_ID (${statusChannelId}) not found in this server!`);
          }
        } else {
          console.log('STATUS_CHANNEL_ID not configured in .env file!');
        }
      } else {
        console.log(`Guild with ID ${guildId} not found. Check your GUILD_ID in .env file.`);
      }
    } else {
      console.log('GUILD_ID not configured in .env file!');
    }
  } catch (error) {
    console.error('Error checking server configuration:', error);
  }
  
  // Exit after checks
  console.log('\nTest complete. Exiting...');
  client.destroy();
  process.exit(0);
});

// Event: Handle errors
client.on('error', error => {
  console.error('Discord client error:', error);
  process.exit(1);
});

// Login
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('No Discord token found in .env file!');
  process.exit(1);
}

console.log('Connecting to Discord...');
client.login(token).catch(error => {
  console.error('Failed to login:', error);
  process.exit(1);
});