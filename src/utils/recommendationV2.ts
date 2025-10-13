/**
 * Enhanced Recommendation System V2
 * 
 * Improvements:
 * - Better cold start handling
 * - Time-decay for ratings relevance
 * - User engagement scoring
 * - Content diversity optimization
 * - Performance-optimized queries
 */

import type { Rating, User, Photo, PhotoTag, Tag } from '@prisma/client'

export interface UserProfile {
  userId: string
  isNewUser: boolean
  engagementScore: number // 0-1, how active the user is
  preferredGenders: Map<string, number>
  preferredTags: Map<string, number>
  avgLikedElo: number
  likeRate: number
  recentActivityLevel: number // 0-1, based on recent ratings
  totalRatings: number
  ratedPhotoIds: Set<string>
}

export interface PhotoScore {
  photoId: string
  score: number
  factors: {
    ownerQuality: number
    genderMatch: number
    tagMatch: number
    novelty: number
    engagement: number
    recency: number
  }
  reasoning: string[]
}

/**
 * Build enhanced user profile with engagement metrics
 */
export function buildUserProfileV2(
  userId: string,
  userRatings: Array<
    Rating & {
      ratedUser: User
      photo: Photo & {
        photoTags: Array<PhotoTag & { tag: Tag }>
      }
    }
  >,
  userStats: {
    totalRatings: number
    lastRatedAt: Date | null
  }
): UserProfile {
  const profile: UserProfile = {
    userId,
    isNewUser: userRatings.length < 5,
    engagementScore: 0,
    preferredGenders: new Map(),
    preferredTags: new Map(),
    avgLikedElo: 1500,
    likeRate: 0.5,
    recentActivityLevel: 0,
    totalRatings: userStats.totalRatings,
    ratedPhotoIds: new Set()
  }

  if (userRatings.length === 0) return profile

  // Calculate engagement score based on rating frequency
  const daysSinceLastRating = userStats.lastRatedAt 
    ? (Date.now() - userStats.lastRatedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 999
  
  profile.engagementScore = Math.max(0, Math.min(1, 1 - (daysSinceLastRating / 30)))
  
  // Calculate preferences with time decay
  const now = Date.now()
  const genderWeights = new Map<string, { likes: number; total: number; weight: number }>()
  const tagWeights = new Map<string, { likes: number; total: number; weight: number }>()
  
  let totalLikes = 0
  let likedEloSum = 0
  let likedEloCount = 0
  let recentRatings = 0

  for (const rating of userRatings) {
    const ageInDays = (now - rating.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    const timeWeight = Math.exp(-ageInDays / 30) // Exponential decay over 30 days
    
    if (ageInDays < 7) recentRatings++
    
    const isLike = rating.type === 'like'
    if (isLike) {
      totalLikes++
      likedEloSum += rating.ratedUser.eloRating
      likedEloCount++
    }

    // Gender preferences with time weighting
    const gender = rating.ratedUser.gender
    if (gender) {
      const existing = genderWeights.get(gender) || { likes: 0, total: 0, weight: 0 }
      existing.total += timeWeight
      existing.weight += timeWeight
      if (isLike) existing.likes += timeWeight
      genderWeights.set(gender, existing)
    }

    // Tag preferences with time weighting
    for (const photoTag of rating.photo.photoTags) {
      const tagId = photoTag.tagId
      const existing = tagWeights.get(tagId) || { likes: 0, total: 0, weight: 0 }
      existing.total += timeWeight
      existing.weight += timeWeight
      if (isLike) existing.likes += timeWeight
      tagWeights.set(tagId, existing)
    }
  }

  // Convert weighted counts to preference scores
  for (const [gender, weights] of genderWeights.entries()) {
    if (weights.weight >= 1) { // Need enough weight to establish preference
      profile.preferredGenders.set(gender, weights.likes / weights.total)
    }
  }

  for (const [tagId, weights] of tagWeights.entries()) {
    if (weights.weight >= 0.5) { // Lower threshold for tags
      profile.preferredTags.set(tagId, weights.likes / weights.total)
    }
  }

  profile.avgLikedElo = likedEloCount > 0 ? likedEloSum / likedEloCount : 1500
  profile.likeRate = userRatings.length > 0 ? totalLikes / userRatings.length : 0.5
  profile.recentActivityLevel = Math.min(1, recentRatings / 10) // Cap at 10 recent ratings
  profile.ratedPhotoIds = new Set(userRatings.map(rating => rating.photoId))

  return profile
}

/**
 * Enhanced photo scoring with multi-factor optimization
 */
export function scorePhotoV2(
  photo: Photo & {
    user: User
    photoTags: Array<PhotoTag & { tag: Tag }>
    _count: { ratings: number }
  },
  profile: UserProfile,
  recentlySeenUserIds: Set<string>
): PhotoScore {
  const factors = {
    ownerQuality: 0,
    genderMatch: 0,
    tagMatch: 0,
    novelty: 0,
    engagement: 0,
    recency: 0
  }
  const reasoning: string[] = []

  // 1. Owner quality score (20% weight)
  const eloNormalized = (photo.user.eloRating - 1000) / 1000
  factors.ownerQuality = Math.max(0, Math.min(1, eloNormalized))
  if (factors.ownerQuality > 0.7) reasoning.push('high_quality_user')

  // 2. Gender preference matching (25% weight)
  const gender = photo.user.gender
  if (gender && profile.preferredGenders.has(gender)) {
    factors.genderMatch = profile.preferredGenders.get(gender)!
    if (factors.genderMatch > 0.6) reasoning.push('preferred_gender')
  } else if (profile.preferredGenders.size === 0) {
    factors.genderMatch = 0.5 // Neutral if no preferences established
  }

  // 3. Tag matching with bonus for multiple matches (20% weight)
  const photoTags = photo.photoTags.map(pt => pt.tagId)
  let tagScoreSum = 0
  let tagMatchCount = 0
  
  for (const tagId of photoTags) {
    if (profile.preferredTags.has(tagId)) {
      tagScoreSum += profile.preferredTags.get(tagId)!
      tagMatchCount++
    }
  }
  
  if (tagMatchCount > 0) {
    factors.tagMatch = (tagScoreSum / tagMatchCount) * Math.min(1.5, 1 + tagMatchCount * 0.1)
    if (tagMatchCount >= 2) reasoning.push('multiple_tag_matches')
    else if (factors.tagMatch > 0.6) reasoning.push('tag_match')
  }

  // 4. Novelty and diversity (20% weight)
  if (!recentlySeenUserIds.has(photo.user.id)) {
    factors.novelty = 1.0
    reasoning.push('new_content')
  } else {
    factors.novelty = 0.2 // Small penalty for recently seen
  }

  // 5. Engagement potential (10% weight)
  const photoEngagement = Math.min(photo._count.ratings / 20, 1) // Normalize to 0-1
  if (photo._count.ratings < 3) {
    factors.engagement = 0.8 // Boost new photos
    reasoning.push('needs_ratings')
  } else if (photo._count.ratings < 10) {
    factors.engagement = 0.6 + photoEngagement * 0.4
  } else {
    factors.engagement = 0.5 + photoEngagement * 0.3
  }

  // 6. Recency bonus (5% weight)
  const daysSinceUpload = (Date.now() - photo.uploadedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceUpload < 3) {
    factors.recency = 1.0
    reasoning.push('very_recent')
  } else if (daysSinceUpload < 7) {
    factors.recency = 0.7
    reasoning.push('recent')
  } else if (daysSinceUpload < 14) {
    factors.recency = 0.4
  } else {
    factors.recency = Math.max(0, 0.3 - daysSinceUpload / 100)
  }

  // Calculate weighted final score
  const weights = {
    ownerQuality: 0.20,
    genderMatch: 0.25,
    tagMatch: 0.20,
    novelty: 0.20,
    engagement: 0.10,
    recency: 0.05
  }

  let finalScore = 0
  for (const [factor, weight] of Object.entries(weights) as [keyof typeof factors, number][]) {
    finalScore += factors[factor] * weight
  }

  // Apply user engagement boost (active users get better recommendations)
  finalScore *= (0.8 + 0.2 * profile.engagementScore)

  // Apply cold start randomization for new users
  if (profile.isNewUser) {
    finalScore = finalScore * 0.5 + Math.random() * 0.5
    reasoning.push('new_user_exploration')
  }

  return {
    photoId: photo.id,
    score: Math.max(0, Math.min(1, finalScore)),
    factors,
    reasoning
  }
}

/**
 * Diversity optimization - ensure variety in recommendations
 */
export function optimizeForDiversity(
  scoredPhotos: PhotoScore[],
  photos: Array<Photo & { user: User; photoTags: Array<PhotoTag> }>,
  targetCount: number
): PhotoScore[] {
  const selected: PhotoScore[] = []
  const selectedGenders = new Map<string, number>()
  const selectedTags = new Set<string>()
  const selectedUsers = new Set<string>()

  // Sort by score
  const candidates = [...scoredPhotos].sort((a, b) => b.score - a.score)

  for (const scored of candidates) {
    if (selected.length >= targetCount) break

    const photo = photos.find(p => p.id === scored.photoId)
    if (!photo) continue

    // Skip if we already have this user
    if (selectedUsers.has(photo.user.id)) continue

    // Apply diversity penalties
    let diversityPenalty = 0

    // Gender diversity
    const gender = photo.user.gender
    if (gender) {
      const genderCount = selectedGenders.get(gender) || 0
      if (genderCount >= Math.ceil(targetCount / 3)) {
        diversityPenalty += 0.2
      }
      selectedGenders.set(gender, genderCount + 1)
    }

    // Tag diversity
    const photoTags = photo.photoTags.map(pt => pt.tagId)
    const overlappingTags = photoTags.filter(t => selectedTags.has(t)).length
    if (overlappingTags > 2) {
      diversityPenalty += 0.1 * overlappingTags
    }

    // Apply penalty and check if still worth including
    scored.score = Math.max(0, scored.score - diversityPenalty)
    
    if (scored.score > 0.2 || selected.length < targetCount / 2) {
      selected.push(scored)
      selectedUsers.add(photo.user.id)
      photoTags.forEach(t => selectedTags.add(t))
      
      if (diversityPenalty > 0) {
        scored.reasoning.push('diversity_adjusted')
      }
    }
  }

  return selected
}

/**
 * Cache management utilities
 */
export class RecommendationCache {
  private userProfiles = new Map<string, { profile: UserProfile; expiresAt: number }>()
  private photoScores = new Map<string, { scores: Map<string, PhotoScore>; expiresAt: number }>()
  
  private readonly PROFILE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly SCORE_TTL = 2 * 60 * 1000 // 2 minutes

  getUserProfile(userId: string): UserProfile | null {
    const cached = this.userProfiles.get(userId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile
    }
    this.userProfiles.delete(userId)
    return null
  }

  setUserProfile(userId: string, profile: UserProfile): void {
    this.userProfiles.set(userId, {
      profile,
      expiresAt: Date.now() + this.PROFILE_TTL
    })
  }

  getPhotoScores(userId: string): Map<string, PhotoScore> | null {
    const cached = this.photoScores.get(userId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.scores
    }
    this.photoScores.delete(userId)
    return null
  }

  setPhotoScores(userId: string, scores: Map<string, PhotoScore>): void {
    this.photoScores.set(userId, {
      scores,
      expiresAt: Date.now() + this.SCORE_TTL
    })
  }

  invalidateUser(userId: string): void {
    this.userProfiles.delete(userId)
    this.photoScores.delete(userId)
  }

  clear(): void {
    this.userProfiles.clear()
    this.photoScores.clear()
  }
}

export const recommendationCache = new RecommendationCache()
