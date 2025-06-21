import fs from 'fs/promises'

import { MAX_DAILY_REPLIES, REPLY_COOLDOWN, SESSION_FILE } from "@/constants"
import type { UserReplyData } from "@/types"

export async function loadSession() {
    try {
        const sessionData = await fs.readFile(SESSION_FILE, 'utf-8')
        console.log('Загружена существующая сессия')
        return sessionData.trim()
    } catch (error) {
        console.log('Сессия не найдена, будет создана новая')
        return ""
    }
}

export async function saveSession(sessionString: string) {
    try {
        await fs.writeFile(SESSION_FILE, sessionString)
        console.log('Сессия сохранена')
    } catch (error) {
        console.error('Ошибка сохранения сессии:', error)
    }
}

export function getUserInfo(sender: any): string {
    if (!sender) return 'Неизвестный пользователь'

    const username = sender.username ? `@${sender.username}` : ''
    const firstName = sender.firstName || ''
    const lastName = sender.lastName || ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ')

    return `${fullName} ${username} (ID: ${sender.id})`.trim()
}

export function canReplyToUser(userId: number, replies: Map<number, UserReplyData>) {
    const now = Date.now()
    const today = new Date().toDateString()

    const userData = replies.get(userId)

    if (!userData) {
        replies.set(userId, { lastReply: now, dailyCount: 1, lastResetDate: today })
        return true
    }

    // Reset day counter if it is new day
    if (userData.lastResetDate !== today) {
        userData.dailyCount = 0
        userData.lastResetDate = today
    }

    // Checking for cooldown
    if (now - userData.lastReply < REPLY_COOLDOWN) {
        console.log(`Кулдаун для пользователя ${userId}: осталось ${Math.ceil((REPLY_COOLDOWN - (now - userData.lastReply)) / 1000 / 60)} мин`)
        return false
    }

    // Checking for day limit
    if (userData.dailyCount >= MAX_DAILY_REPLIES) {
        console.log(`Достигнут дневной лимит для пользователя ${userId}`)
        return false
    }

    // Update data
    userData.lastReply = now
    userData.dailyCount++
    replies.set(userId, userData)

    return true
}

export function isOnVacation(): boolean {
    const now = new Date()
    const vacationStart = new Date('2024-06-23')
    const vacationEnd = new Date('2024-06-29')

    return now >= vacationStart && now <= vacationEnd
}