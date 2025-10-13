/**
 * Collaborative Filtering Recommendation System
 *
 * Recommends photos to users based on:
 * 1. User similarity (people with similar rating patterns)
 * 2. Tag preferences (photos with tags the user likes)
 * 3. Gender preferences (if user shows preference)
 * 4. Recency and diversity (avoid showing same people repeatedly)
 */

import type { Rating, User, Photo, PhotoTag, Tag } from '@prisma/client'

export interface UserPreferenceProfile {
  userId: string
  preferredGenders: Map<string, number> // gender -> preference score (0-1)
  preferredTags: Map<string, number> // tagId -> preference score (0-1)
  averageRaterElo: number // Average Elo of users they rate highly
  likeRate: number // Percentage of likes vs normals
  totalRatings: number
}

export interface PhotoWithScore {
  photoId: string
  score: number
  reasons: string[] // Why this photo was recommended
}

/**
 * Build user preference profile from their rating history
 */
export function buildUserPreferenceProfile(
  userId: string,
  userRatings: Array<
    Rating & {
      ratedUser: User
      photo: Photo & {
        photoTags: Array<PhotoTag & { tag: Tag }>
      }
    }
  >
): UserPreferenceProfile {
  const genderCounts = new Map<string, { likes: number; total: number }>()
  const tagCounts = new Map<string, { likes: number; total: number }>()
  let totalLikes = 0
  let totalRatings = userRatings.length
  let totalElo = 0
  let eloCount = 0

  for (const rating of userRatings) {
    const isLike = rating.type === 'like'
    if (isLike) totalLikes++

    // Track gender preferences
    const gender = rating.ratedUser.gender
    if (gender) {
      const existing = genderCounts.get(gender) || { likes: 0, total: 0 }
      existing.total++
      if (isLike) existing.likes++
      genderCounts.set(gender, existing)
    }

    // Track tag preferences
    for (const photoTag of rating.photo.photoTags) {
      const tagId = photoTag.tagId
      const existing = tagCounts.get(tagId) || { likes: 0, total: 0 }
      existing.total++
      if (isLike) existing.likes++
      tagCounts.set(tagId, existing)
    }

    // Track average Elo of rated users
    if (rating.raterEloAtTime) {
      totalElo += rating.raterEloAtTime
      eloCount++
    }
  }

  // Convert counts to preference scores (like rate)
  const preferredGenders = new Map<string, number>()
  for (const [gender, counts] of genderCounts.entries()) {
    if (counts.total >= 3) {
      // Need at least 3 ratings to establish preference
      preferredGenders.set(gender, counts.likes / counts.total)
    }
  }

  const preferredTags = new Map<string, number>()
  for (const [tagId, counts] of tagCounts.entries()) {
    if (counts.total >= 2) {
      // Need at least 2 ratings to establish tag preference
      preferredTags.set(tagId, counts.likes / counts.total)
    }
  }

  return {
    userId,
    preferredGenders,
    preferredTags,
    averageRaterElo: eloCount > 0 ? totalElo / eloCount : 1500,
    likeRate: totalRatings > 0 ? totalLikes / totalRatings : 0.5,
    totalRatings
  }
}

/**
 * Calculate similarity score between two users based on their rating patterns
 * Uses Jaccard similarity on their rated photo sets and rating type correlation
 */
export function calculateUserSimilarity(
  userARatings: Map<string, 'like' | 'normal'>, // photoId -> rating type
  userBRatings: Map<string, 'like' | 'normal'>
): number {
  const photosA = new Set(userARatings.keys())
  const photosB = new Set(userBRatings.keys())

  // Find intersection (photos both rated)
  const intersection = new Set([...photosA].filter((x) => photosB.has(x)))
  const union = new Set([...photosA, ...photosB])

  if (union.size === 0) return 0

  // Jaccard similarity
  const jaccard = intersection.size / union.size

  // Calculate agreement on common photos (do they rate similarly?)
  let agreements = 0
  for (const photoId of intersection) {
    if (userARatings.get(photoId) === userBRatings.get(photoId)) {
      agreements++
    }
  }
  const agreement = intersection.size > 0 ? agreements / intersection.size : 0

  // Combine Jaccard and agreement (weighted average)
  return 0.4 * jaccard + 0.6 * agreement
}

/**
 * Score a photo for recommendation based on user preferences
 */
export function scorePhotoForUser(
  photo: Photo & {
    user: User
    photoTags: Array<PhotoTag & { tag: Tag }>
  },
  userProfile: UserPreferenceProfile,
  recentlySeenUserIds: Set<string>, // Users whose photos were recently shown
  photoPopularity: number // How many total ratings this photo has
): PhotoWithScore {
  let score = 0
  const reasons: string[] = []

  // Base score from photo owner's Elo (prefer photos from well-rated users)
  const ownerEloScore = (photo.user.eloRating - 1000) / 1000 // Normalize to 0-1
  score += ownerEloScore * 0.2
  if (ownerEloScore > 0.5) reasons.push('highly_rated_user')

  // Gender preference match
  const userGender = photo.user.gender
  if (userGender && userProfile.preferredGenders.has(userGender)) {
    const genderPref = userProfile.preferredGenders.get(userGender)!
    score += genderPref * 0.3
    if (genderPref > 0.6) reasons.push('preferred_gender')
  }

  // Tag preference match
  const photoTags = photo.photoTags.map((pt) => pt.tagId)
  let tagMatchScore = 0
  let tagMatches = 0
  for (const tagId of photoTags) {
    if (userProfile.preferredTags.has(tagId)) {
      tagMatchScore += userProfile.preferredTags.get(tagId)!
      tagMatches++
    }
  }
  if (tagMatches > 0) {
    const avgTagScore = tagMatchScore / tagMatches
    score += avgTagScore * 0.25
    if (avgTagScore > 0.6) reasons.push('matching_tags')
  }

  // Diversity bonus (avoid showing same users repeatedly)
  if (!recentlySeenUserIds.has(photo.user.id)) {
    score += 0.15
    reasons.push('diverse_content')
  } else {
    score -= 0.1 // Penalty for recently seen user
  }

  // Popularity factor (slight preference for photos with some ratings, not too many)
  // Sweet spot is 5-20 ratings
  if (photoPopularity >= 5 && photoPopularity <= 20) {
    score += 0.1
    reasons.push('popular_range')
  } else if (photoPopularity < 5) {
    score += 0.05 // Give new photos a small boost
    reasons.push('new_content')
  }

  // Recency bonus for recently uploaded photos
  const daysSinceUpload = (Date.now() - photo.uploadedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceUpload < 7) {
    score += 0.1 * (1 - daysSinceUpload / 7) // Decay over 7 days
    reasons.push('recent_upload')
  }

  return {
    photoId: photo.id,
    score: Math.max(0, Math.min(1, score)), // Clamp to 0-1
    reasons
  }
}

/**
 * Find similar users based on rating patterns (collaborative filtering)
 */
export function findSimilarUsers(
  targetUserId: string,
  targetUserRatings: Map<string, 'like' | 'normal'>,
  allUserRatings: Map<string, Map<string, 'like' | 'normal'>>, // userId -> (photoId -> rating)
  topN: number = 10
): Array<{ userId: string; similarity: number }> {
  const similarities: Array<{ userId: string; similarity: number }> = []

  for (const [userId, userRatings] of allUserRatings.entries()) {
    if (userId === targetUserId) continue

    const similarity = calculateUserSimilarity(targetUserRatings, userRatings)
    if (similarity > 0.1) {
      // Only consider users with some similarity
      similarities.push({ userId, similarity })
    }
  }

  // Sort by similarity and return top N
  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topN)
}

/**
 * Get recommended photos based on what similar users liked
 */
export function getCollaborativeRecommendations(
  similarUsers: Array<{ userId: string; similarity: number }>,
  similarUserRatings: Map<string, Map<string, 'like' | 'normal'>>,
  alreadyRatedPhotoIds: Set<string>
): Array<{ photoId: string; score: number }> {
  const photoScores = new Map<string, number>()

  for (const { userId, similarity } of similarUsers) {
    const userRatings = similarUserRatings.get(userId)
    if (!userRatings) continue

    for (const [photoId, ratingType] of userRatings.entries()) {
      if (alreadyRatedPhotoIds.has(photoId)) continue

      // Weight by similarity and rating type
      const ratingWeight = ratingType === 'like' ? 1.0 : 0.3
      const score = similarity * ratingWeight

      photoScores.set(photoId, (photoScores.get(photoId) || 0) + score)
    }
  }

  // Convert to array and sort
  return Array.from(photoScores.entries())
    .map(([photoId, score]) => ({ photoId, score }))
    .sort((a, b) => b.score - a.score)
}

/**
 * Combine content-based and collaborative filtering scores
 */
export function combineRecommendationScores(
  contentScore: number,
  collaborativeScore: number,
  contentWeight: number = 0.6,
  collaborativeWeight: number = 0.4
): number {
  return contentScore * contentWeight + collaborativeScore * collaborativeWeight
}
