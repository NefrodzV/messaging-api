import { configDotenv } from 'dotenv';
configDotenv();
export default {
    URL: process.env.URL || 'http://localhost:3000',
    PORT: process.env.PORT || 3000,
    DB_URL: process.env.DB_URL,
    APP_URL: process.env.APP_URL || 'http://localhost:5173',
    TOKEN_SECRET: process.env.TOKEN_SECRET,
};
