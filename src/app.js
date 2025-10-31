import express from 'express';
import logger from '#config/logger.js';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from '#routes/auth.routes.js';
import userRouter from '#routes/user.routes.js';
// import securityMiddleware from '#middleware/security.middleware.js';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());

app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) },
  })
);
// app.use(securityMiddleware);

app.get('/', (req, res) => {
  logger.info('Hello from acquisition');
  res.status(200).send('Hello from acquisitions!');
});
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    modifiedBy: 'Bratati',
  });
});
app.get('/api', (req, res) => {
  res.status(200).json({ message: 'Acquisition API is running!' });
});
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
  });
});

export default app;
