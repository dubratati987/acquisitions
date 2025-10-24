import bcrypt from 'bcrypt';
import logger from '#config/logger.js';
import { prismaClient } from '#config/database.js';

export const hashPassword = async password => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (e) {
    logger.error(`Error hashing the password: ${e}`);
    throw new Error('Error hashing');
  }
};

export const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (e) {
    logger.error(`Error comparing password: ${e}`);
    throw new Error('Error comparing password');
  }
};

export const createUser = async ({ name, email, password, role = 'user' }) => {
  try {
    const existingUser = await prismaClient.user.findUnique({
      where: { email },
    });

    if (existingUser) throw new Error('User already exists');

    const hashedPassword = await hashPassword(password);

    const createdUser = await prismaClient.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });
    logger.info(`User ${createdUser.email} crated successfully`);

    const newuser = await prismaClient.user.findUnique({
      where: { id: createdUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return newuser;
  } catch (e) {
    logger.error(`Error creating the ${e}`);
    throw e;
  }
};

export const authenticateUser = async ({ email, password }) => {
  try {
    const existingUser = await prismaClient.user.findUnique({
      where: { email },
    });
    if (!existingUser) throw new Error('User not found');

    const isPasswordValid = await comparePassword(
      password,
      existingUser.password
    );
    if (!isPasswordValid) throw new Error('Invalid password');

    logger.info(`User ${existingUser.email} authenticated successfully`);
    return {
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      createdAt: existingUser.createdAt,
    };
  } catch (e) {
    logger.error(`Error authenticating user: ${e}`);
    throw e;
  }
};
