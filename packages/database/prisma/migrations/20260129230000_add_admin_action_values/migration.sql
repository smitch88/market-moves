-- Add new AdminAction enum values for admin user management
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'UPDATE_ROLE';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'ADD_ADMIN';
