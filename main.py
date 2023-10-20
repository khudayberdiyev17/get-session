from telethon.sync import TelegramClient

# Replace the following values with your own
api_id = '20821408'
api_hash = '3f976a318a63fb5b4e1dc93c99ea8781'

with TelegramClient('session', api_id, api_hash) as client:
    session_string = client.session.save()
    with open('session_code.txt', 'w') as file:
        file.write(session_string)

print("Session code saved to session_code.txt")