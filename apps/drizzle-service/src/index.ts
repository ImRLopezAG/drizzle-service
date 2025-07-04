import { drizzleRepository as pg } from './pg'
import { drizzleRepository as sqlite } from './sqlite'

export const drizzleRepository = {
	pg,
	sqlite,
}

export default drizzleRepository
