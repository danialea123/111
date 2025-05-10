// Error event handler
module.exports = {
  name: 'error',
  once: false,
  
  execute(error) {
    console.error('Discord client error:', error);
  }
};