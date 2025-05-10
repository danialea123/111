// Discord Inventory Bot - Main Entry Point
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Bot configuration
const config = {
  token: process.env.DISCORD_TOKEN,
  logChannelId: process.env.LOG_CHANNEL_ID || '1250989394303914007',
  statusChannelId: process.env.STATUS_CHANNEL_ID || '1370727326509305927',
  xpStatusChannelId: process.env.XP_STATUS_CHANNEL_ID || '1342153823732367571', // Channel to post XP status updates
  clientId: process.env.CLIENT_ID || '1370533457046011915',
  guildId: process.env.GUILD_ID || '998658556452675584',
  trackedItems: ['Crack', 'Ghaarch', 'Marijuana', 'Shishe', 'Cocaine']
};

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Initialize commands collection
client.commands = new Collection();
const slashCommands = [];

// Make config available to all event handlers
client.config = config;

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  
  // Get the name of the command (either from command.name or command.data.name)
  const commandName = command.name || (command.data ? command.data.name : undefined);
  
  if (!commandName) {
    console.warn(`Warning: Command in file ${file} has no name property!`);
    continue;
  }
  
  // Set command in collection
  client.commands.set(commandName, command);
  
  // Add to slash commands if it has data
  if (command.data) {
    slashCommands.push(command.data.toJSON());
    console.log(`Loaded slash command: ${commandName}`);
  }
}

// Load events
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client, config));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client, config));
  }
}

// Function to register slash commands
async function registerCommands() {
  if (!config.token || !config.clientId) {
    console.log('Missing token or client ID, skipping slash command registration');
    return;
  }
  
  console.log(`Started registering ${slashCommands.length} application commands.`);
  
  // Create REST instance
  const rest = new REST({ version: '10' }).setToken(config.token);
  
  // Try registering commands globally first
  try {
    console.log('Registering commands globally (available in all servers)...');
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: slashCommands }
    );
    console.log('Successfully registered global commands (may take up to 1 hour to update)');
    return;
  } catch (globalError) {
    console.error('Failed to register global commands:', globalError);
  }
  
  // If global registration fails, try guild-specific registration
  if (config.guildId) {
    try {
      console.log(`Registering guild-specific commands to ${config.guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: slashCommands }
      );
      console.log(`Successfully registered guild commands to ${config.guildId}`);
    } catch (guildError) {
      console.error('Failed to register guild commands:', guildError);
    }
  } else {
    console.error('No guild ID available for fallback registration');
  }
}

// Variables to store the references to status messages
const statusMessages = {
  inventory: null,
  drugTask: null,
  gangTask: null
};

// Check status channel
async function checkStatusChannel() {
  try {
    // Get the status channel
    const statusChannel = client.channels.cache.get(config.statusChannelId);
    if (!statusChannel) {
      console.error(`Status channel not found: ${config.statusChannelId}`);
      return false;
    }
    
    console.log(`Status channel verified: ${config.statusChannelId}`);
    return true;
  } catch (error) {
    console.error('Error checking status channel:', error);
    return false;
  }
}

// Send initial inventory status
async function sendInitialInventoryStatus() {
  try {
    // Get the status channel
    const statusChannel = client.channels.cache.get(config.statusChannelId);
    if (!statusChannel) {
      console.error(`Status channel not found: ${config.statusChannelId}`);
      return;
    }
    
    // Get all items
    const db = require('./database');
    const items = await db.getItems();
    
    // Create embed
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
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
      
      embed.addFields({
        name: '💊 Drug Inventory',
        value: drugList,
        inline: false
      });
    }
    
    // Try to fetch the last 10 messages to see if we already have a status message
    try {
      const messages = await statusChannel.messages.fetch({ limit: 10 });
      // Find a message from this bot that has the inventory title
      const botMessages = messages.filter(msg => 
        msg.author.id === client.user.id && 
        msg.embeds.length > 0 && 
        msg.embeds[0].title && 
        (msg.embeds[0].title.includes('Inventory Status') || msg.embeds[0].title.includes('Updated Inventory'))
      );
      
      if (botMessages.size > 0) {
        // Use the most recent message as our inventory status message
        statusMessages.inventory = botMessages.first();
        console.log(`Found existing inventory status message with ID: ${statusMessages.inventory.id}`);
        
        // Update the existing message
        await statusMessages.inventory.edit({ 
          embeds: [embed] 
        });
        console.log(`Updated existing inventory status message: ${statusMessages.inventory.id}`);
      } else {
        // Send a new message if none found
        statusMessages.inventory = await statusChannel.send({ 
          embeds: [embed] 
        });
        console.log(`Created new inventory status message: ${statusMessages.inventory.id}`);
      }
    } catch (fetchError) {
      console.error('Error fetching messages to find existing status:', fetchError);
      
      // If there was an error, try to send a new message anyway
      statusMessages.inventory = await statusChannel.send({ 
        embeds: [embed] 
      });
      console.log(`Created new inventory status message (after error): ${statusMessages.inventory.id}`);
    }
    
    console.log(`Inventory status updated in channel ${config.statusChannelId}`);
  } catch (error) {
    console.error('Error sending initial inventory status:', error);
  }
}

// Initialize XP status in XP channel
async function sendInitialXPStatus() {
  try {
    // Initialize both drug and gang task status
    const xpFunctions = require('./functions/xpFunctions');
    
    // Update XP statuses in both channels
    await xpFunctions.updateXPStatus(client, config, 'drug');
    await xpFunctions.updateXPStatus(client, config, 'gang');
    
    console.log(`XP status initialized`);
  } catch (error) {
    console.error('Error sending initial XP status:', error);
  }
}

// Bot ready event handler
client.on('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  
  // Connect to database
  const db = require('./database');
  await db.initializeDatabase();
  
  // Set bot activity
  client.user.setPresence({
    activities: [{ name: '/inventory', type: 3 }], // 3 = Watching
    status: 'online',
  });
  
  // Make status messages available to all parts of the bot
  client.statusMessages = statusMessages;
  
  // Register slash commands
  await registerCommands();
  
  // Check if status channel exists
  if (config.statusChannelId) {
    await checkStatusChannel();
    
    // Send all the status updates
    await sendInitialInventoryStatus();
    
    // Send initial XP status to main channel only
    await sendInitialXPStatus();
  } else {
    console.log('No status channel configured, skipping status message initialization');
  }
});

// Login to Discord
if (config.token) {
  client.login(config.token).catch(err => {
    console.error('Failed to login:', err);
  });
} else {
  console.log('No token found. Please set DISCORD_TOKEN in .env file or environment variables.');
}