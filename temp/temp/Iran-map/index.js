// Discord Inventory Bot - Main Entry Point
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Bot configuration
const config = {
  token: process.env.DISCORD_TOKEN,
  logChannelId: process.env.LOG_CHANNEL_ID || '1250989394303914007',
  statusChannelId: process.env.STATUS_CHANNEL_ID || '1370529169624006796',
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
  try {
    if (!config.token || !config.clientId) {
      console.log('Missing token or client ID, skipping slash command registration');
      return;
    }
    
    console.log(`Started registering ${slashCommands.length} application commands.`);
    
    // Create REST instance
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    // Register commands
    if (config.guildId) {
      // Guild commands (instantly updates)
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: slashCommands },
      );
      console.log(`Successfully registered guild commands to ${config.guildId}`);
    } else {
      // Global commands (takes up to 1 hour to update)
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: slashCommands },
      );
      console.log('Successfully registered global commands (takes up to 1 hour to update)');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Variable to store the reference to status message
let statusMessage = null;

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
      .setColor(0x2B2D31)
      .setTimestamp()
      .setFooter({ text: 'Last updated' });
    
    // Add drug items
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
        // Use the most recent message as our status message
        statusMessage = botMessages.first();
        console.log(`Found existing inventory status message with ID: ${statusMessage.id}`);
        
        // Update the existing message
        await statusMessage.edit({ 
          content: '**Inventory System Bot is online!**',
          embeds: [embed] 
        });
        console.log(`Updated existing inventory status message: ${statusMessage.id}`);
      } else {
        // Send a new message if none found
        statusMessage = await statusChannel.send({ 
          content: '**Inventory System Bot is online!**',
          embeds: [embed] 
        });
        console.log(`Created new inventory status message: ${statusMessage.id}`);
      }
    } catch (fetchError) {
      console.error('Error fetching messages to find existing status:', fetchError);
      
      // If there was an error, try to send a new message anyway
      statusMessage = await statusChannel.send({ 
        content: '**Inventory System Bot is online!**',
        embeds: [embed] 
      });
      console.log(`Created new inventory status message (after error): ${statusMessage.id}`);
    }
    
    console.log(`Inventory status updated in channel ${config.statusChannelId}`);
  } catch (error) {
    console.error('Error sending initial inventory status:', error);
  }
}

// Initialize XP status in XP channel
async function sendInitialXPStatus() {
  try {
    if (!config.xpStatusChannelId) {
      console.log('No XP status channel configured, skipping XP status initialization');
      return;
    }
    
    // Get the XP status channel
    const xpStatusChannel = client.channels.cache.get(config.xpStatusChannelId);
    if (!xpStatusChannel) {
      console.error(`XP status channel not found: ${config.xpStatusChannelId}`);
      return;
    }
    
    // Initialize both drug and gang task status
    const xpFunctions = require('./functions/xpFunctions');
    await xpFunctions.updateXPStatus(client, config, 'drug');
    await xpFunctions.updateXPStatus(client, config, 'gang');
    
    console.log(`XP status initialized in channel ${config.xpStatusChannelId}`);
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
  
  // Register slash commands
  await registerCommands();
  
  // Send initial inventory status
  await sendInitialInventoryStatus();
  
  // Send initial XP status 
  await sendInitialXPStatus();
});

// Login to Discord
if (config.token) {
  client.login(config.token).catch(err => {
    console.error('Failed to login:', err);
  });
} else {
  console.log('No token found. Please set DISCORD_TOKEN in .env file or environment variables.');
}