const https = require('https');
const http = require('http');
const { URL } = require('url');

class KeepAlive {
  constructor() {
    this.intervalPrimary = null;
    this.intervalSecondary = null;
    this.intervalTertiary = null;
    this.primaryIntervalMs = 30000; // 30 seconds
    this.secondaryIntervalMs = 45000; // 45 seconds
    this.tertiaryIntervalMs = 20000; // 20 seconds
    this.endpoints = ['/api/status', '/api/health'];
    this.externalEndpoints = [
      'https://www.google.com/generate_204',
      'https://www.cloudflare.com/cdn-cgi/trace'
    ];
    
    // For logging
    this.logger = {
      debug: (msg) => console.log(`[DEBUG] ${msg}`),
      info: (msg) => console.log(`[INFO] ${msg}`),
      warn: (msg) => console.log(`[WARN] ${msg}`),
      error: (msg) => console.log(`[ERROR] ${msg}`)
    };
  }
  
  // Start the keep-alive mechanism with multiple strategies
  start() {
    if (this.intervalPrimary) {
      this.logger.warn('Keep-alive mechanism is already running');
      return;
    }
    
    this.logger.info(`Starting enhanced keep-alive mechanism with primary interval: ${this.primaryIntervalMs}ms`);
    
    // Primary interval - Internal API calls
    this.intervalPrimary = setInterval(() => {
      this.pingInternal();
    }, this.primaryIntervalMs);
    
    // Secondary interval - External pings with different timing to avoid synchronization
    this.intervalSecondary = setInterval(() => {
      this.pingExternal();
    }, this.secondaryIntervalMs);
    
    // Tertiary interval - Log activity to keep the process active
    this.intervalTertiary = setInterval(() => {
      this.performActivityLog();
    }, this.tertiaryIntervalMs);
    
    // Perform initial pings immediately
    this.pingInternal();
    setTimeout(() => this.pingExternal(), 5000); // Stagger external pings
    setTimeout(() => this.performActivityLog(), 10000); // Stagger activity logs
    
    this.logger.info('Enhanced keep-alive mechanism started');
  }
  
  // Stop the keep-alive mechanism
  stop() {
    this.logger.info('Stopping enhanced keep-alive mechanism');
    
    if (this.intervalPrimary) {
      clearInterval(this.intervalPrimary);
      this.intervalPrimary = null;
    }
    
    if (this.intervalSecondary) {
      clearInterval(this.intervalSecondary);
      this.intervalSecondary = null;
    }
    
    if (this.intervalTertiary) {
      clearInterval(this.intervalTertiary);
      this.intervalTertiary = null;
    }
    
    this.logger.info('Enhanced keep-alive mechanism stopped');
  }
  
  // Set the interval for primary keep-alive pings
  setInterval(ms) {
    if (ms < 1000) {
      this.logger.warn(`Keep-alive interval too short: ${ms}ms, using 1000ms instead`);
      ms = 1000;
    }
    
    this.primaryIntervalMs = ms;
    this.secondaryIntervalMs = Math.round(ms * 1.5); // Secondary interval is 1.5x primary
    this.tertiaryIntervalMs = Math.round(ms * 0.67); // Tertiary interval is 0.67x primary
    
    // Restart if already running
    if (this.intervalPrimary) {
      this.stop();
      this.start();
    }
    
    this.logger.info(`Keep-alive intervals set to: primary=${ms}ms, secondary=${this.secondaryIntervalMs}ms, tertiary=${this.tertiaryIntervalMs}ms`);
  }
  
  // Set the endpoints to ping
  setEndpoints(endpoints) {
    this.endpoints = endpoints;
    this.logger.info(`Keep-alive endpoints set to: ${endpoints.join(', ')}`);
  }
  
  // Set external endpoints to ping
  setExternalEndpoints(endpoints) {
    this.externalEndpoints = endpoints;
    this.logger.info(`External keep-alive endpoints set to: ${endpoints.join(', ')}`);
  }
  
  // Ping internal APIs
  pingInternal() {
    this.logger.debug('Performing internal keep-alive ping');
    
    // Current server hostname and port
    const hostname = process.env.HOST || 'localhost';
    const port = parseInt(process.env.PORT || '8000'); // Adjust to your bot's port
    
    // Ping each endpoint
    this.endpoints.forEach(endpoint => {
      const start = Date.now();
      
      try {
        const req = http.request({
          hostname,
          port,
          path: endpoint,
          method: 'GET',
          timeout: 5000, // 5 second timeout
        }, (res) => {
          const duration = Date.now() - start;
          
          if (res.statusCode === 200) {
            this.logger.debug(`Internal keep-alive ping to ${endpoint} successful (${duration}ms)`);
          } else {
            this.logger.warn(`Internal keep-alive ping to ${endpoint} returned status ${res.statusCode} (${duration}ms)`);
          }
          
          // Consume response data to free up memory
          res.resume();
        });
        
        req.on('error', (error) => {
          this.logger.error(`Internal keep-alive ping to ${endpoint} failed: ${error.message}`);
        });
        
        req.on('timeout', () => {
          this.logger.warn(`Internal keep-alive ping to ${endpoint} timed out`);
          req.destroy();
        });
        
        req.end();
      } catch (error) {
        this.logger.error(`Error setting up internal ping request: ${error}`);
      }
    });
  }
  
  // Ping external endpoints for additional keep-alive
  pingExternal() {
    if (this.externalEndpoints.length === 0) return;
    
    this.logger.debug('Performing external keep-alive ping');
    
    // Ping each external endpoint
    this.externalEndpoints.forEach(endpoint => {
      try {
        const start = Date.now();
        const isHttps = endpoint.startsWith('https://');
        const url = new URL(endpoint);
        
        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          timeout: 10000, // 10 second timeout
        };
        
        const req = (isHttps ? https : http).request(options, (res) => {
          const duration = Date.now() - start;
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            this.logger.debug(`External keep-alive ping to ${endpoint} successful (${duration}ms)`);
          } else {
            this.logger.warn(`External keep-alive ping to ${endpoint} returned status ${res.statusCode} (${duration}ms)`);
          }
          
          // Consume response data to free up memory
          res.resume();
        });
        
        req.on('error', (error) => {
          // Don't log external ping errors as errors, just as debug info
          // to avoid filling the logs with errors when external services are unreachable
          this.logger.debug(`External keep-alive ping to ${endpoint} failed: ${error.message}`);
        });
        
        req
