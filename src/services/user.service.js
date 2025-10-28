import { prismaClient } from '#config/database.js';
import logger from '#config/logger.js';

export const getAllUsers = async () => {
  try {
    const allUsers = await prismaClient.user.findMany({ where: {} });
    return allUsers;
  } catch (e) {
    logger.error('Error getting users', e);
    throw e;
  }
};

export const getUserById = async id => {
  try {
    const user = await prismaClient.user.findFirst({ where: { id } });
    if (!user) throw new Error('User not found');
    return user;
  } catch (e) {
    logger.error(`Error getting user by id ${id} `, e);
    throw e;
  }
};

export const updateUser = async (id, updates) => {
  try {
    // First check if user exists
    const existingUser = await getUserById(id);

    // Check if email is being updated and if it already exists
    if (updates.email && updates.email !== existingUser.email) {
      const emailExists = await prismaClient.user.findUnique({
        where: { email: updates.email },
      });

      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    // Add updatedAt timestamp
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    const updatedUser = await prismaClient.user.update({
      where: { id },
      data: {
        ...updateData,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(`User ${updateUser.email} updated  successfully`);
    return updatedUser;
  } catch (e) {
    logger.error(`Error updating user ${id}`, e);
    throw e;
  }
};

export const deleteUser = async id => {
  try {
    await getUserById(id);

    const deletedUser = await prismaClient.user.delete({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    logger.info(`User ${deleteUser.email} deleted successfully`);
    return deletedUser;
  } catch (e) {
    logger.error(`Error deleting user ${id}`);
    throw e;
  }
};
