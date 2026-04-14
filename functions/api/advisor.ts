export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat') || '22.3193';
  const lon = url.searchParams.get('lon') || '114.1694';

  try {
    // 1. 獲取天氣數據 (OpenWeather)
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_API_KEY}&units=metric`
    );
    const weatherData = await weatherRes.json();

    // 2. 模擬獲取電商資料 (Amazon / Zalando 建議)
    // 註：實際運作時可透過 RapidAPI 呼叫 Amazon 或 Zalando API
    const shopItems = [
      { name: "Poetic Linen Shirt", price: "Zalando", link: "#" },
      { name: "Atmospheric Scarf", price: "Amazon", link: "#" }
    ];

    return new Response(JSON.stringify({
      weather: weatherData,
      recommendations: shopItems,
      gemini_status: env.GEMINI_API_KEY ? "Connected" : "Key Missing"
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
