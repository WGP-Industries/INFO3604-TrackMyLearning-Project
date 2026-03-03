import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
dotenv.config();

import userRouter from './routes/userRoutes.js';
import xapiRouter from './routes/xapiRoutes.js';
import enrollmentRouter from './routes/enrollmentRoutes.js';
import courseRouter from './routes/courseRoutes.js';

// Ensure required environment variables
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'LRS_ENDPOINT', 'LRS_USERNAME', 'LRS_PASSWORD'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

//  CORS Setup 
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow Postman / server-side requests
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

//  Middleware 
app.use(express.json());

//  Routes 
app.get('/', (_, res) => {
  res.json({
    message: 'Welcome to the Learning App Backend!',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/user', userRouter);
app.use('/api/xapi', xapiRouter);
app.use('/api/enrollments', enrollmentRouter);
app.use('/api/courses', courseRouter);

app.get('/api/health', (_, res) =>
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  })
);

//  404 & Error Handling 
app.use((_, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

//  Start Server 
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
  });
});