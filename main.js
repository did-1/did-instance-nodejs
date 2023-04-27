import dotenv from 'dotenv';
import server from './src/server.js';

dotenv.config();

server().then().catch(console.error);
