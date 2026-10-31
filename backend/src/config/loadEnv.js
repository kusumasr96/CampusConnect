const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendEnvPath = path.resolve(__dirname, '../../.env');
const sourceEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}
if (fs.existsSync(sourceEnvPath)) {
  dotenv.config({ path: sourceEnvPath });
}
