export function calculateTotalScore(likeCount: number, normalCount: number): number {
  const totalVotes = likeCount + normalCount
  if (totalVotes === 0) return 0
  const weightedScore = (likeCount * 1 + normalCount * 0.2) / totalVotes
  return Math.round(weightedScore * 100)
}


