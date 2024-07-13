const apiKey = '7ab09ac5e8c0f742987c0352af19617f'; // Replace with your OpenWeatherMap API key

let map;
let marker;

function initMap(lat, lon) {
    if (map) {
        map.remove();
    }
    map = L.map('weatherMap').setView([lat, lon], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    marker = L.marker([lat, lon]).addTo(map);
    
    map.on('click', function(e) {
        getWeatherByLocation(e.latlng.lat, e.latlng.lng);
    });

    // Add weather radar layer
    const weatherRadar = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=' + apiKey, {
        maxZoom: 18,
        opacity: 0.5
    });
    weatherRadar.addTo(map);
}

async function getWeatherByLocation(lat, lon) {
    try {
        const currentWeather = await fetchWeatherData(lat, lon, 'weather');
        const forecast = await fetchWeatherData(lat, lon, 'forecast');
        const airQuality = await fetchAirQualityData(lat, lon);
        const uvIndex = await fetchUVIndexData(lat, lon);
        
        updateCurrentWeather(currentWeather);
        updateHourlyForecast(forecast);
        updateTenDayForecast(forecast);
        updateAirQuality(airQuality);
        updateWeatherAlert(currentWeather);
        updateAdditionalInfo(currentWeather, uvIndex);
        updateWeatherMap(lat, lon);
        updateWeatherChart(forecast);
        getHistoricalWeather(lat, lon);
    } catch (error) {
        console.error('Error fetching weather data:', error);
    }
}

async function fetchWeatherData(lat, lon, type) {
    const url = `https://api.openweathermap.org/data/2.5/${type}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather data not found');
    return await response.json();
}

async function fetchAirQualityData(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Air quality data not found');
    return await response.json();
}

async function fetchUVIndexData(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('UV index data not found');
    return await response.json();
}

async function searchLocation() {
    const query = document.getElementById('cityInput').value;
    if (!query) return;

    try {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=${apiKey}`;
        const response = await fetch(geoUrl);
        const data = await response.json();

        if (data.length > 0) {
            const { lat, lon, name, country, state } = data[0];
            getWeatherByLocation(lat, lon);
            document.getElementById('cityInput').value = `${name}, ${state || ''} ${country}`.trim();
        } else {
            alert('Location not found. Please try another search.');
        }
    } catch (error) {
        console.error('Error searching location:', error);
        alert('Error searching location. Please try again.');
    }
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                getWeatherByLocation(latitude, longitude);
                initMap(latitude, longitude);
            },
            (error) => {
                console.error('Geolocation error:', error);
                alert('Unable to retrieve your location. Please search for a location manually.');
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please search for a location manually.');
    }
}

function updateCurrentWeather(data) {
    document.getElementById('cityName').textContent = data.name;
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°`;
    document.getElementById('condition').textContent = data.weather[0].main;
    document.getElementById('highLow').textContent = `H:${Math.round(data.main.temp_max)}° L:${Math.round(data.main.temp_min)}°`;
    document.getElementById('weatherDescription').textContent = data.weather[0].description;
    document.getElementById('feelsLike').textContent = `Feels like: ${Math.round(data.main.feels_like)}°`;
    document.getElementById('humidity').textContent = `Humidity: ${data.main.humidity}%`;
    document.getElementById('windSpeed').textContent = `Wind: ${Math.round(data.wind.speed * 3.6)} km/h`;
    document.getElementById('pressure').textContent = `Pressure: ${data.main.pressure} hPa`;
    
    // Update precipitation
    let precipitation = 'None';
    let precipitationType = 'None';
    if (data.rain) {
        precipitation = data.rain['1h'] ? `${data.rain['1h']} mm` : `${data.rain['3h'] || 0} mm`;
        precipitationType = 'Rain';
    } else if (data.snow) {
        precipitation = data.snow['1h'] ? `${data.snow['1h']} mm` : `${data.snow['3h'] || 0} mm`;
        precipitationType = 'Snow';
    }
    document.getElementById('precipitation').textContent = `Precipitation: ${precipitation}`;
    document.getElementById('precipitationType').textContent = `Type: ${precipitationType}`;

    // Store precipitation value for use in updateAdditionalInfo
    window.currentPrecipitation = precipitation;

    // Update dew point
    const dewPoint = calculateDewPoint(data.main.temp, data.main.humidity);
    document.getElementById('dewPoint').textContent = `Dew Point: ${Math.round(dewPoint)}°C`;
    // Update cloud cover
    document.getElementById('cloudCover').textContent = `Cloud Cover: ${data.clouds.all}%`;

    updateWeatherEmoji(data.weather[0].main);
}
function calculateDewPoint(temperature, humidity) {
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
}


function updateHourlyForecast(data) {
    const hourlyForecast = document.getElementById('hourlyForecast');
    hourlyForecast.innerHTML = '';

    data.list.slice(0, 24).forEach((item, index) => {
        if (index % 3 === 0) {
            const hour = new Date(item.dt * 1000).getHours();
            const temp = Math.round(item.main.temp);
            const icon = getWeatherIcon(item.weather[0].main);
            
            const hourlyItem = document.createElement('div');
            hourlyItem.className = 'hourly-item';
            hourlyItem.innerHTML = `
                <div>${hour}:00</div>
                <i class="fas fa-${icon}" style="color: ${getWeatherColor(item.weather[0].main)}"></i>
                <div>${temp}°</div>
            `;
            hourlyForecast.appendChild(hourlyItem);
        }
    });
}


function updateTenDayForecast(data) {
    const tenDayForecast = document.getElementById('tenDayForecast');
    tenDayForecast.innerHTML = '';

    const dailyData = data.list.filter((item, index) => index % 8 === 0);
    
    dailyData.forEach((item, index) => {
        const date = new Date(item.dt * 1000);
        const day = index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
        const temp = Math.round(item.main.temp);
        const icon = getWeatherIcon(item.weather[0].main);
        
        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <span>${day}</span>
            <i class="fas fa-${icon}" style="color: ${getWeatherColor(item.weather[0].main)}"></i>
            <span>${temp}°</span>
        `;
        tenDayForecast.appendChild(forecastItem);
    });
}

function updateAirQuality(data) {
    const aqi = data.list[0].main.aqi;
    const status = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][aqi - 1];
    const description = [
        'Air quality is satisfactory, and air pollution poses little or no risk.',
        'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
        'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
        'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
        'Health alert: The risk of health effects is increased for everyone.'
    ][aqi - 1];

    document.getElementById('airQualityStatus').textContent = status;
    document.getElementById('airQualityDescription').textContent = description;
    
    const levelElement = document.querySelector('.air-quality-level');
    levelElement.style.width = `${aqi * 20}%`;
    levelElement.style.backgroundColor = ['#00e400', '#ffff00', '#ff7e00', '#ff0000', '#8f3f97'][aqi - 1];
}


function updateWeatherAlert(data) {
    const alertElement = document.getElementById('weatherAlert');
    if (data.alerts && data.alerts.length > 0) {
        const alert = data.alerts[0];
        document.getElementById('alertDescription').textContent = alert.description;
        document.getElementById('alertSource').textContent = `Source: ${alert.sender_name}`;
        alertElement.style.display = 'block';
    } else {
        alertElement.style.display = 'none';
    }
}

function updateAdditionalInfo(data, uvIndex) {
    document.getElementById('uvIndex').textContent = Math.round(uvIndex.value);
    document.getElementById('uvIndex').style.color = getUVIndexColor(uvIndex.value);
    
    const sunriseTime = new Date(data.sys.sunrise * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const sunsetTime = new Date(data.sys.sunset * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('sunrise').textContent = sunriseTime;
    document.getElementById('sunset').textContent = sunsetTime;
    
    const precipitation = window.currentPrecipitation !== 'None' ? window.currentPrecipitation : '0 mm';
    document.getElementById('precipitation').textContent = precipitation;
}

function updateWeatherMap(lat, lon) {
    if (marker) {
        marker.setLatLng([lat, lon]);
    }
    map.setView([lat, lon], 10);
}

function updateWeatherChart(data) {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    const temperatures = data.list.slice(0, 8).map(item => Math.round(item.main.temp));
    const labels = data.list.slice(0, 8).map(item => new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }));

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: temperatures,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '24-Hour Temperature Forecast'
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

function getWeatherIcon(weather) {
    const icons = {
        'Clear': 'sun',
        'Clouds': 'cloud',
        'Rain': 'cloud-rain',
        'Snow': 'snowflake',
        'Thunderstorm': 'bolt',
        'Drizzle': 'cloud-rain',
        'Mist': 'smog'
    };
    return icons[weather] || 'question';
}

function getWeatherColor(weather) {
    const colors = {
        'Clear': '#FFD700',
        'Clouds': '#A9A9A9',
        'Rain': '#4682B4',
        'Snow': '#FFFAFA',
        'Thunderstorm': '#4B0082',
        'Drizzle': '#B0E0E6',
        'Mist': '#D3D3D3'
    };
    return colors[weather] || '#000000';
}

function getUVIndexColor(uvIndex) {
    if (uvIndex <= 2) return '#299501';
    if (uvIndex <= 5) return '#F7E401';
    if (uvIndex <= 7) return '#F85900';
    if (uvIndex <= 10) return '#D8001D';
    return '#6B49C8';
}

function saveLocation() {
    const currentLocation = document.getElementById('cityInput').value;
    const savedLocations = JSON.parse(localStorage.getItem('savedLocations') || '[]');
    if (!savedLocations.includes(currentLocation)) {
        savedLocations.push(currentLocation);
        localStorage.setItem('savedLocations', JSON.stringify(savedLocations));
        updateSavedLocationsList();
    }
}

function updateSavedLocationsList() {
    const savedLocations = JSON.parse(localStorage.getItem('savedLocations') || '[]');
    const savedLocationsList = document.getElementById('savedLocationsList');
    savedLocationsList.innerHTML = '';
    savedLocations.forEach(location => {
        const li = document.createElement('li');
        li.textContent = location;
        li.addEventListener('click', () => {
            document.getElementById('cityInput').value = location;
            searchLocation();
        });
        savedLocationsList.appendChild(li);
    });
}

function getHistoricalWeather(lat, lon) {
    const today = new Date();
    const historicalData = [];

    // Fetch current weather for the past 7 days
    const fetchPromises = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const timestamp = Math.floor(date.getTime() / 1000);
        
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${apiKey}&units=metric`;
        fetchPromises.push(
            fetch(url)
                .then(response => response.json())
                .then(data => ({
                    date: date.toLocaleDateString(),
                    temp: data.main.temp
                }))
        );
    }

    Promise.all(fetchPromises)
        .then(results => {
            updateHistoricalWeatherChart(results.reverse());
        })
        .catch(error => console.error('Error fetching historical weather data:', error));
}

function updateHistoricalWeatherChart(data) {
    const ctx = document.getElementById('historicalWeatherChart').getContext('2d');
    const temperatures = data.map(item => item.temp);
    const labels = data.map(item => item.date);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Historical Temperature (°C)',
                data: temperatures,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '7-Day Historical Temperature'
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

function getWeatherImpact() {
    const temperature = parseFloat(document.getElementById('temperature').textContent);
    const condition = document.getElementById('condition').textContent.toLowerCase();
    const windSpeed = parseFloat(document.getElementById('windSpeed').textContent.split(':')[1]);
    const humidity = parseFloat(document.getElementById('humidity').textContent.split(':')[1]);
    
    let impact = "It's a great day for outdoor activities!";

    if (temperature < 10) {
        impact = "It's quite cold. Indoor activities might be more comfortable.";
    } else if (temperature > 30) {
        impact = "It's very hot. Stay hydrated and avoid prolonged sun exposure.";
    }

    if (condition.includes('rain') || condition.includes('thunderstorm')) {
        impact = "Rainy weather. Consider indoor activities or bring an umbrella.";
    } else if (condition.includes('snow')) {
        impact = "Snowy conditions. Be cautious if driving and dress warmly.";
    }
    if (windSpeed > 30) {
        impact += " Strong winds may affect outdoor activities.";
    }

    if (humidity > 70) {
        impact += " High humidity may make it feel warmer than it is.";
    }

    document.getElementById('weatherImpact').textContent = impact;
}
     // dark mode setting

     function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const darkModeButton = document.getElementById('darkModeToggle');
        if (document.body.classList.contains('dark-mode')) {
            darkModeButton.textContent = '☀️ Light Mode';
        } else {
            darkModeButton.textContent = '🌙 Dark Mode';
        }
    }
    // share weather function
    function shareWeather() {
        const cityName = document.getElementById('cityName').textContent;
        const temperature = document.getElementById('temperature').textContent;
        const condition = document.getElementById('condition').textContent;
        
        const shareText = `Current weather in ${cityName}: ${temperature} and ${condition}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Weather Update',
                text: shareText,
                url: window.location.href
            }).then(() => console.log('Successful share'))
            .catch((error) => console.log('Error sharing:', error));
        } else {
            alert('Web Share API is not supported in your browser. You can manually copy this text:\n\n' + shareText);
        }
    }
         // weather emoji function
         function getWeatherEmoji(condition) {
            const emojiMap = {
                'Clear': '☀️',
                'Clouds': '☁️',
                'Rain': '🌧️',
                'Drizzle': '🌦️',
                'Thunderstorm': '⛈️',
                'Snow': '❄️',
                'Mist': '🌫️'
            };
            return emojiMap[condition] || '🌈';
        }
        function updateWeatherEmoji(condition) {
            const emoji = getWeatherEmoji(condition);
            document.getElementById('weatherEmoji').textContent = emoji;
        }    

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.querySelector('.search-box button');
    searchButton.addEventListener('click', searchLocation);

    const cityInput = document.getElementById('cityInput');
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchLocation();
        }
    });

    // Initialize the map
    initMap(0, 0);

    // Update saved locations list
    updateSavedLocationsList();

    // Add event listener for saving locations
    const saveLocationButton = document.getElementById('saveLocationButton');
    saveLocationButton.addEventListener('click', saveLocation);

    // Get user's location on initial load
    getUserLocation();

    // Add event listener for dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    darkModeToggle.addEventListener('click', toggleDarkMode);

    // Add event listener for sharing weather
    const shareButton = document.getElementById('shareWeather');
    shareButton.addEventListener('click', shareWeather);

});