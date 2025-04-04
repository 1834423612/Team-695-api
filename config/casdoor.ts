import CasdoorSDK from 'casdoor-nodejs-sdk';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Read the certificate from file
const certPath = path.join(__dirname, '../../certs/casdoor-cert.pem');
const certificate = fs.existsSync(certPath)
    ? fs.readFileSync(certPath, 'utf8')
    : process.env.CASDOOR_CERTIFICATE || '';

export const casdoorConfig = {
    endpoint: process.env.CASDOOR_ENDPOINT || 'https://sso.team695.com',
    clientId: process.env.CASDOOR_CLIENT_ID || '300932808273326bac0c',
    clientSecret: process.env.CASDOOR_CLIENT_SECRET || '',
    certificate: certificate,
    orgName: process.env.CASDOOR_ORG_NAME || 'Team695',
    appName: process.env.CASDOOR_APP_NAME || '695_website',
};
