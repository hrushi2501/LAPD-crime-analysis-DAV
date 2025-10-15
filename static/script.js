// Global chart instances
let charts = {
    area: null,
    time: null,
    type: null,
    victim: null
};

// Global map
let map = null;
let markersLayer = null;

// Month names for display (0 = All)
const monthNames = ['All', 'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];


// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadFilters();
    initMap();
    updateDashboard();

    // Add event listener to apply filters button
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) applyBtn.addEventListener('click', updateDashboard);

});

// Load filter options
async function loadFilters() {
    try {
        const response = await fetch('/api/filters');
        const data = await response.json();

        // Populate area filter
        const areaSelect = document.getElementById('areaFilter');
        if (areaSelect) {
            const any = document.createElement('option');
            any.value = '';
            any.textContent = 'All';
            areaSelect.appendChild(any);
            data.areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area;
                option.textContent = area;
                areaSelect.appendChild(option);
            });
        }

        // Populate year filter
        const yearSelect = document.getElementById('yearFilter');
        if (yearSelect) {
            const any = document.createElement('option');
            any.value = '';
            any.textContent = 'All';
            yearSelect.appendChild(any);
            data.years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            });
        }

        // Populate month filter with names
        const monthSelect = document.getElementById('monthFilter');
        if (monthSelect) {
            const any = document.createElement('option');
            any.value = '';
            any.textContent = 'All';
            monthSelect.appendChild(any);
            for (let i = 1; i <= 12; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = monthNames[i];
                monthSelect.appendChild(option);
            }
        }

    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

// Get current filter values
function getFilters() {
    return {
        area: document.getElementById('areaFilter') ? document.getElementById('areaFilter').value : '',
        year: document.getElementById('yearFilter') ? document.getElementById('yearFilter').value : '',
        month: document.getElementById('monthFilter') ? document.getElementById('monthFilter').value : ''
    };
}

// Build query string from filters
function buildQueryString(filters) {
    const params = new URLSearchParams();
    if (filters.area) params.append('area', filters.area);
    if (filters.year) params.append('year', filters.year);
    if (filters.month) params.append('month', filters.month);
    return params.toString();
}

// Update entire dashboard
async function updateDashboard() {
    const filters = getFilters();

    await Promise.all([
        updateSummary(filters),
        updateAreaChart(filters),
        updateTimeChart(filters),
        updateTypeChart(filters),
        updateVictimChart(filters),
        updateMap(filters)
    ]);
}

// Update summary statistics
async function updateSummary(filters) {
    try {
        const query = buildQueryString(filters);
        const response = await fetch(`/api/summary?${query}`);
        const data = await response.json();

        document.getElementById('totalCrimes').textContent = (data.total_crimes ?? 0).toLocaleString();
        document.getElementById('avgAge').textContent = (data.avg_victim_age ?? 0).toFixed(1);

        // If there's a dataSource element, show it
        const ds = data.data_source || data.dataSource || null;
        if (ds) {
            const el = document.getElementById('dataSource');
            if (el) el.textContent = ds;
        }

    } catch (error) {
        console.error('Error updating summary:', error);
    }
}

// Update area chart
async function updateAreaChart(filters) {
    try {
        const query = buildQueryString({ year: filters.year, month: filters.month });
        const response = await fetch(`/api/by_area?${query}`);
        const data = await response.json();

        const ctxEl = document.getElementById('areaChart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');

        if (charts.area) {
            charts.area.destroy();
        }

        charts.area = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Number of Crimes',
                    data: data.data,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    maxBarThickness: 36
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error updating area chart:', error);
    }
}

// Update time chart
async function updateTimeChart(filters) {
    try {
        const query = buildQueryString(filters);
        const response = await fetch(`/api/by_time?${query}`);
        const data = await response.json();

        const ctxEl = document.getElementById('timeChart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');

        if (charts.time) {
            charts.time.destroy();
        }

        charts.time = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Crimes by Hour',
                    data: data.data,
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error updating time chart:', error);
    }
}

// Update type chart
async function updateTypeChart(filters) {
    try {
        const query = buildQueryString(filters);
        const response = await fetch(`/api/by_type?${query}`);
        const data = await response.json();

        const ctxEl = document.getElementById('typeChart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');

        if (charts.type) {
            charts.type.destroy();
        }

        charts.type = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.7)',
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(16, 185, 129, 0.7)',
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(139, 92, 246, 0.7)',
                        'rgba(236, 72, 153, 0.7)',
                        'rgba(20, 184, 166, 0.7)',
                        'rgba(249, 115, 22, 0.7)',
                        'rgba(99, 102, 241, 0.7)',
                        'rgba(220, 38, 38, 0.7)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, padding: 6, usePointStyle: true, font: { size: 10 } }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error updating type chart:', error);
    }
}

// Update victim chart
async function updateVictimChart(filters) {
    try {
        const query = buildQueryString(filters);
        const response = await fetch(`/api/victims?${query}`);
        const data = await response.json();

        const ctxEl = document.getElementById('victimChart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');

        if (charts.victim) {
            charts.victim.destroy();
        }

        charts.victim = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.age_distribution.labels,
                datasets: [{
                    label: 'Number of Victims',
                    data: data.age_distribution.data,
                    backgroundColor: 'rgba(139, 92, 246, 0.7)',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error updating victim chart:', error);
    }
}

// Initialize map
function initMap() {
    // Default view centered on a sample location
    map = L.map('map').setView([34.05, -118.25], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

// Update map with crime locations
async function updateMap(filters) {
    try {
        const query = buildQueryString(filters);
        const response = await fetch(`/api/map?${query}&limit=500`);
        const data = await response.json();

        // Clear existing markers
        markersLayer.clearLayers();

        // Update map count
        const mapCountEl = document.getElementById('mapCount');
        if (mapCountEl) {
            mapCountEl.textContent = `Showing ${data.crimes.length} of ${((data.total ?? 0)).toLocaleString()} crimes`;
        }

        // Add markers
        data.crimes.forEach(crime => {
            if (crime.lat == null || crime.lon == null) return;
            const marker = L.circleMarker([crime.lat, crime.lon], {
                radius: 5,
                fillColor: '#ef4444',
                color: '#dc2626',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.5
            });

            marker.bindPopup(`
                <strong>${crime.crime}</strong><br>
                Area: ${crime.area}
            `);

            markersLayer.addLayer(marker);
        });

        // Fit bounds if there are markers
        if (data.crimes.length > 0) {
            const bounds = markersLayer.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
        }

    } catch (error) {
        console.error('Error updating map:', error);
    }
}