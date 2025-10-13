/**
 * Elo Rating System for Photo Rankings
 *
 * Uses a modified Elo algorithm to calculate dynamic user ratings based on photo ratings.
 * Similar to chess ratings but adapted for photo rating context.
 */

// K-factor determines how much ratings change per match
// Higher K = more volatile, lower K = more stable
const K_FACTOR = 32

// Minimum and maximum Elo ratings to keep ratings bounded
const MIN_ELO = 1000
const MAX_ELO = 2000
const DEFAULT_ELO = 1500

/**
 * Calculate expected score based on Elo difference
 * Returns probability (0-1) that player A will win
 */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

/**
 * Calculate new Elo rating after a match
 *
 * @param currentRating - Current Elo rating
 * @param opponentRating - Opponent's Elo rating
 * @param actualScore - Actual result (1 = win, 0.5 = draw, 0 = loss)
 * @param kFactor - K-factor (higher = more change per game)
 * @returns New Elo rating
 */
export function calculateNewElo(
  currentRating: number,
  opponentRating: number,
  actualScore: number,
  kFactor: number = K_FACTOR
): number {
  const expected = expectedScore(currentRating, opponentRating)
  const newRating = currentRating + kFactor * (actualScore - expected)

  // Clamp to min/max range
  return Math.max(MIN_ELO, Math.min(MAX_ELO, newRating))
}

/**
 * Calculate Elo change for both users when a rating is given
 *
 * For photo rating context:
 * - Rater is the "judge" (their rating doesn't change much, but we track for similarity)
 * - Rated user receives the score impact
 * - "like" = win (1.0), "normal" = partial win (0.3)
 *
 * @param ratedUserElo - Current Elo of the person being rated
 * @param raterElo - Current Elo of the person giving the rating (used for weighting)
 * @param ratingType - "like" or "normal"
 * @returns Object with new Elo ratings for both users
 */
export function calculateEloUpdate(
  ratedUserElo: number,
  raterElo: number,
  ratingType: 'like' | 'normal'
): {
  newRatedUserElo: number
  expectedScore: number
  actualScore: number
} {
  // Map rating type to outcome score
  // "like" = strong positive (0.85), "normal" = slight positive (0.3)
  // Using 0.85 instead of 1.0 to prevent inflation, normal is weak positive
  const actualScore = ratingType === 'like' ? 0.85 : 0.3

  // Calculate K-factor based on rater's Elo (higher Elo raters have more impact)
  // This gives more weight to ratings from established users
  const raterWeight = Math.max(0.5, Math.min(1.5, raterElo / DEFAULT_ELO))
  const adjustedKFactor = K_FACTOR * raterWeight

  const newRatedUserElo = calculateNewElo(ratedUserElo, raterElo, actualScore, adjustedKFactor)
  const expected = expectedScore(ratedUserElo, raterElo)

  return {
    newRatedUserElo,
    expectedScore: expected,
    actualScore
  }
}

/**
 * Convert Elo rating to 0-100 score for display
 * Linear mapping from Elo range to percentage
 */
export function eloToScore(elo: number): number {
  const normalized = (elo - MIN_ELO) / (MAX_ELO - MIN_ELO)
  return Math.round(normalized * 100)
}

/**
 * Convert 0-100 score to Elo rating
 */
export function scoreToElo(score: number): number {
  const normalized = score / 100
  return MIN_ELO + normalized * (MAX_ELO - MIN_ELO)
}

/**
 * Calculate confidence interval based on number of ratings
 * More ratings = higher confidence, less volatility
 * Returns a multiplier for K-factor (0-1)
 */
export function calculateConfidence(totalRatings: number): number {
  // Use logarithmic decay for confidence
  // New users (0 ratings) have low confidence (0.5)
  // Established users (100+ ratings) have high confidence (1.0)
  if (totalRatings === 0) return 0.5
  if (totalRatings >= 100) return 1.0

  return 0.5 + 0.5 * Math.log(totalRatings + 1) / Math.log(101)
}

export const ELO_CONSTANTS = {
  K_FACTOR,
  MIN_ELO,
  MAX_ELO,
  DEFAULT_ELO
}
