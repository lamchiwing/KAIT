export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode'); // 'search' 或 'recommend'
  const lat = url.searchParams.get('lat') || '22.3193';
  const lon = url.searchParams.get('lon') || '114.1694';

  try {
    // --- 第一步：獲取天氣資料 ---
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_API_KEY}&units=metric`
    );
    const weather = await weatherRes.json();

    // --- 模式 A：搜尋商品 (用戶挑選階段) ---
    if (mode === 'search') {
      const query = url.searchParams.get('q') || 'casual outfit';
      
      // 同時呼叫 Amazon 與 Zalando (透過 RapidAPI)
      const [amazonData, zalandoData] = await Promise.all([
        fetchRapidAPI(env, "amazon-price.p.rapidapi.com", `/az/search?keywords=${query}`),
        fetchRapidAPI(env, "zalando-v1.p.rapidapi.com", `/articles?name=${query}`)
      ]);

      // 格式化數據並注入你的 Affiliate ID
      const results = [
        ...formatAmazon(amazonData, env.AMAZON_TAG),
        ...formatZalando(zalandoData, env.ZALANDO_TAG)
      ];

      return Response.json({ weather, products: results });
    }

    // --- 模式 B：配對建議 (用戶選定後階段) ---
    if (mode === 'recommend') {
      const selectedItem = JSON.parse(url.searchParams.get('item') || '{}');
      
      // 這裡呼叫 Gemini API，根據 selectedItem 與 weather 給出 Poetic Outlook 建議
      // 模擬 AI 回傳
      const outlook = {
        title: "The Urban Wanderer",
        description: `基於你選擇的 ${selectedItem.name}，考慮到今日氣溫 ${weather.main.temp}°C，我們建議搭配...`,
        style_tips: ["捲起袖口", "搭配大地色系長褲"]
      };

      return Response.json({ weather, outlook });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 輔助函式：發送 RapidAPI 請求
async function fetchRapidAPI(env, host, path) {
  const res = await fetch(`https://${host}${path}`, {
    headers: { "X-RapidAPI-Key": env.RAPIDAPI_KEY, "X-RapidAPI-Host": host }
  });
  return res.json();
}

// 輔助函式：格式化並加上利潤連結
function formatAmazon(data, tag) {
  return (data.products || []).slice(0, 5).map(p => ({
    source: 'Amazon',
    name: p.title,
    price: p.price,
    url: `${p.url}?tag=${tag}`,
    image: p.image
  }));
}

function formatZalando(data, tag) {
  return (data.content || []).slice(0, 5).map(p => ({
    source: 'Zalando',
    name: p.name,
    price: p.price?.formatted,
    url: `${p.shopUrl}?affiliate_id=${tag}`,
    image: p.media?.images[0]?.url
  }));
}
