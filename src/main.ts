import 'dotenv/config'
import prompts from 'prompts'

import { TelegramClient } from 'telegram'
import { NewMessage } from 'telegram/events'
import { StringSession } from 'telegram/sessions'

import type { UserReplyData } from '@/types'
import { canReplyToUser, getUserInfo, isOnVacation } from '@/shared'

const apiId: number = Number(process.env.API_ID)
const apiHash: string = process.env.API_HASH!
const session: string = process.env.APP_SESSION!

const AUTO_REPLY = 'Привет! Я сейчас в отпуске до 29 июня 🌴 \nОбязательно отвечу после возвращения!'

const replies = new Map<number, UserReplyData> ()

async function main() {
    try {
        const stringSession = new StringSession(session || '')

        const client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 5,
            retryDelay: 2000,
            timeout: 10000
        })

        await client.start({
            onError: (err) => {
                console.error('Something went wrong:', err)
                process.exit(1)
            },
            phoneNumber: async () => {
                const response = await prompts({ type: 'text', name: 'phone', message: 'Введите номер телефона:' })
                return response.phone
            },
            password: async () => {
                const response = await prompts({ type: 'password', name: 'password', message: 'Введите пароль 2FA:' })
                return response.password
            },
            phoneCode: async () => {
                const response = await prompts({ type: 'text', name: 'phoneCode', message: 'Введите код из Telegram:' })
                return response.phoneCode
            }
        })

        console.log("✅ Авторизация успешна!")

        if (!stringSession) {
            client.session.save()!
        }     

        const me = await client.getMe()
        console.log(`👤 Авторизован как: ${me.firstName} ${me.lastName || ''} (@${me.username || 'без username'})`)
        
        if (!isOnVacation()) {
            console.log('⚠️  Внимание: Сейчас не период отпуска')
        }

        client.addEventHandler(async (event) => {
            try {
                const message = event.message

                console.log(event)

                // @ts-ignore FIXME:
                if (message.out || message.fromId?.userId === me.id) {
                    return
                }

                if (!message.isPrivate) {
                    return
                }

                const sender = await message.getSender()
                const userInfo = getUserInfo(sender)
                const userId = sender?.id

                if (!userId) {
                    console.log('❌ Не удалось получить ID отправителя')
                    return
                }

                console.log(`📨 Получено сообщение от: ${userInfo}`)

                // @ts-ignore FIXME:
                if (!canReplyToUser(userId, replies)) {
                    return
                }

                await message.respond({ message: AUTO_REPLY })

                console.log(`✅ Отправлен автоответ пользователю: ${userInfo}`)

            } catch (error) {
                console.error('❌ Ошибка обработки сообщения:', error)
            }
        }, new NewMessage({}))

        console.log("🤖 Бот запущен и слушает входящие сообщения...")
        console.log(`📝 Текущий текст автоответа: "${AUTO_REPLY}"`)
        console.log("Для остановки нажмите Ctrl+C")

        process.on('SIGINT', async () => {
            console.log('\n🛑 Получен сигнал остановки...')
            try {
                await client.disconnect()
                console.log('✅ Клиент отключён')
            } catch (error) {
                console.error('❌ Ошибка при отключении:', error)
            }
            process.exit(0)
        })

        setInterval(() => {
            const cutoffTime = Date.now() - (24 * 60 * 60 * 1000)
            let cleanedCount = 0

            for (const [userId, userData] of replies.entries()) {
                if (userData.lastReply < cutoffTime) {
                    replies.delete(userId)
                    cleanedCount++
                }
            }

            if (cleanedCount > 0) {
                console.log(`🧹 Очищены данные ${cleanedCount} неактивных пользователей`)
            }
        }, 60 * 60 * 1000)

    } catch (error) {
        console.error('❌ Критическая ошибка:', error)
        process.exit(1)
    }
}

main().catch(error => {
    console.error('❌ Ошибка запуска:', error)
    process.exit(1)
})