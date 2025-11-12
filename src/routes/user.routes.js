import express from 'express';
import {
  deleteUserById,
  fetchAllUsers,
  fetchUserById,
  updateUserById,
} from '#controllers/user.controller.js';
import { authenticateToken, requireRole } from '#middleware/auth.middleware.js';

const userRouter = express.Router();

userRouter.get('/', fetchAllUsers); // authenticateToken,
userRouter.get('/:id', authenticateToken, fetchUserById);
userRouter.put('/:id', authenticateToken, updateUserById);
userRouter.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  deleteUserById
);

export default userRouter;
