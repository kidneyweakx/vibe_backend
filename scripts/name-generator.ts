/**
 * English Name Generator
 *
 * Generates random English names with gender consideration
 */

const MALE_FIRST_NAMES = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Christopher',
  'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Andrew', 'Paul', 'Joshua', 'Kenneth',
  'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob',
  'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel',
  'Raymond', 'Gregory', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Henry'
]

const FEMALE_FIRST_NAMES = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
  'Carol', 'Amanda', 'Dorothy', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia',
  'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
  'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather'
]

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
]

export interface NameOptions {
  gender: 'male' | 'female'
  includeMiddleInitial?: boolean
}

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Generate a random English name
 */
export function generateName(options: NameOptions): string {
  const { gender, includeMiddleInitial = Math.random() > 0.6 } = options

  const firstNames = gender === 'male' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES
  const firstName = randomItem(firstNames)
  const lastName = randomItem(LAST_NAMES)

  if (includeMiddleInitial) {
    const middleInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26))
    return `${firstName} ${middleInitial}. ${lastName}`
  }

  return `${firstName} ${lastName}`
}

/**
 * Generate multiple unique names
 */
export function generateUniqueNames(count: number, gender: 'male' | 'female'): string[] {
  const names = new Set<string>()

  while (names.size < count) {
    const name = generateName({ gender })
    names.add(name)
  }

  return Array.from(names)
}

/**
 * Generate a random email based on name
 */
export function generateEmail(name: string): string {
  const randomNum = Math.floor(Math.random() * 9999)
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com']
  const domain = randomItem(domains)

  // Convert name to email format: "John Doe" -> "johndoe"
  const emailPrefix = name.toLowerCase().replace(/[^a-z]/g, '')

  return `${emailPrefix}${randomNum}@${domain}`
}
