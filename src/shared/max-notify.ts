process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export async function sendMaxNotification(userId: string | number, text: string) {
  console.log(`[LOG] [MAX Bot] Попытка отправки. User ID: ${userId}, Текст: "${text.substring(0, 50)}..."`);
  
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    console.error("❌ [LOG] [MAX Bot] ОШИБКА: Переменная MAX_BOT_TOKEN не задана.");
    return false;
  }

  try {
    const response = await fetch(`https://platform-api2.max.ru/messages?user_id=${userId}`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`❌ [LOG] [MAX Bot] ОШИБКА API (статус ${response.status}):`, responseText);
      return false;
    }
    
    console.log(`✅ [LOG] [MAX Bot] УСПЕШНО отправлено ${userId}. Ответ:`, responseText);
    return true;
  } catch (error) {
    console.error(`❌ [LOG] [MAX Bot] СЕТЕВАЯ ОШИБКА:`, error);
    return false;
  }
}
