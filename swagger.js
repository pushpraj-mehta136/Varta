const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Varta Chat API',
    version: '1.0.0',
    description: 'API documentation for the Varta real-time chat app',
  },
  servers: [
    {
      url: 'http://localhost:3000', // Change to your server URL and port
    },
  ],
};

// Options for swagger-jsdoc
const options = {
  swaggerDefinition,
  apis: ['./routes/*.js'], // <-- IMPORTANT: where your routes are defined
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

// Export a function to setup Swagger
function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log('✅ Swagger docs available at http://localhost:3000/api-docs');
}

module.exports = setupSwagger;
