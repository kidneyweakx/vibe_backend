-- Migration: Add isGuest to users and isProfilePicture to photos
-- Date: 2025-10-02
-- Description: Add missing fields for user guest status and profile picture tracking

-- Add isGuest field to users table
ALTER TABLE "users" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- Add isProfilePicture field to photos table
ALTER TABLE "photos" ADD COLUMN "isProfilePicture" BOOLEAN NOT NULL DEFAULT false;
