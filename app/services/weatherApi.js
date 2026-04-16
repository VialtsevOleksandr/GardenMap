import { OPENWEATHER_API_KEY, OPENWEATHER_BASE_URL } from '../config';

export async function getCurrentWeather(latitude, longitude) {
  const url = `${OPENWEATHER_BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=uk`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Weather fetch failed');
  return response.json();
}
