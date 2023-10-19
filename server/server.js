const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const app = express();

// Middleware to add headers
app.use((req, res, next) => {
    // res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    // res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../')));

// Read the SSL certificate files
const certificate = fs.readFileSync('./certificate.crt', 'utf8');
const privateKey = fs.readFileSync('./private.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };


// Start the HTTPS server
const PORT = process.env.PORT || 3000;
const server = https.createServer(credentials, app);

server.listen(PORT, () => {
    console.log(`HTTPS Server is running on port ${PORT}`);
});