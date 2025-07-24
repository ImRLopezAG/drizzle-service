import { drizzleService as pg } from './pg'
import { drizzleService as sqlite } from './sqlite'

export const drizzleService = {
	pg,
	sqlite,
}

export default drizzleService
