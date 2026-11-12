export async function sendMaxNotification(userId: string | number, text: string) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    console.error("❌ [MAX Bot] Переменная MAX_BOT_TOKEN не задана.");
    return false;
  }
  try {
    console.log(`[MAX Bot] Попытка отправки (user_id: ${userId})...`);
    const response = await fetch(`https://platform-api2.max.ru/messages?user_id=${userId}`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`❌ [MAX Bot] Ошибка API (статус ${response.status}):`, responseText);
      return false;
    }
    console.log(`✅ [MAX Bot] Успешно отправлено ${userId}. Ответ:`, responseText);
    return true;
  } catch (error) {
    console.error(`❌ [MAX Bot] Сетевая ошибка:`, error);
    return false;
  }
}
