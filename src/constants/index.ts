import path from 'path'
import 'dotenv/config'

export const MAX_DAILY_REPLIES = 1
export const REPLY_COOLDOWN = 300000
export const SESSION_FILE = path.join(process.cwd(), 'session.txt')