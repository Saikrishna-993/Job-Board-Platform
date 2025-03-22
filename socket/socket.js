module.exports = (io) => {
    // Store socket.io instance to be accessed in routes
    io.app = io;
  
    io.on('connection', (socket) => {
      console.log('New client connected');
  
      // Join user to personal room for updates
      socket.on('joinUserRoom', (userId) => {
        socket.join(`user-${userId}`);
      });
  
      // Join employer to company room for updates
      socket.on('joinEmployerRoom', (employerId) => {
        socket.join(`employer-${employerId}`);
      });
  
      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });
  
    return io;
  };