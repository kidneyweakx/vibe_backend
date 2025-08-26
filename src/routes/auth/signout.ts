import { Elysia } from 'elysia'

export const signoutRoute = new Elysia()
  .post('/signout', async ({ set }) => {
    try {
      return { success: true, message: 'Signed out successfully' }
    } catch (error) {
      set.status = 500
      throw new Error('Sign out failed')
    }
  })


