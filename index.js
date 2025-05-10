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

// Import system modules
const { messageStore } = require('./utils/messageManager');
const inventorySystem = require('./systems/inventory');
const drugTaskSystem = require('./systems/drugTask');
const gangTaskSystem = require('./systems/gangTask');

/**
 * Check if status channel exists and is accessible
 * @returns {Promise<boolean>} True if channel is valid
 */
async function checkStatusChannel() {
  try {
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

/**
 * Initialize all status messages using the new modular systems
 */
async function initializeStatusMessages() {
  try {
    // Get the status channel
    const statusChannel = client.channels.cache.get(config.statusChannelId);
    if (!statusChannel) {
      console.error(`Status channel not found: ${config.statusChannelId}`);
      return;
    }
    
    // Import all system modules
    const inventorySystem = require('./systems/inventory');
    const drugTaskSystem = require('./systems/drugTask');
    const gangTaskSystem = require('./systems/gangTask');
    
    // Initialize all three systems in the same channel
    await inventorySystem.updateInventoryStatus(statusChannel);
    await drugTaskSystem.updateDrugTaskStatus(statusChannel);
    await gangTaskSystem.updateGangTaskStatus(statusChannel);
    
    console.log('All status messages initialized successfully');
  } catch (error) {
    console.error('Error initializing status messages:', error);
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
  
  // Make message store available to all components
  client.messageStore = messageStore;
  
  // Register slash commands
  await registerCommands();
  
  // Check if status channel exists and initialize messages
  if (config.statusChannelId) {
    if (await checkStatusChannel()) {
      // Initialize all status messages in the status channel
      await initializeStatusMessages();
    }
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