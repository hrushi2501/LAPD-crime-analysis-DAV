from flask import Flask, render_template, jsonify, request
import os
from random import randrange, uniform, choice

app = Flask(__name__)

# Try to import pandas only if available
HAS_PANDAS = False
try:
    import pandas as pd
    HAS_PANDAS = True
except Exception:
    pd = None

# Data variables
DATA_FILE = os.path.join('data', 'data_cleaned.csv')
df = None
data_source = 'sample'

if HAS_PANDAS and os.path.exists(DATA_FILE):
    try:
        df = pd.read_csv(DATA_FILE)
        # ensure columns exist and minimal preprocessing
        if 'DATE OCC' in df.columns:
            df['DATE OCC'] = pd.to_datetime(df['DATE OCC'], errors='coerce')
            df['Year'] = df['DATE OCC'].dt.year
            df['Month'] = df['DATE OCC'].dt.month
        # Attempt to have Hour column
        if 'Hour' not in df.columns and 'DATE OCC' in df.columns:
            df['Hour'] = df['DATE OCC'].dt.hour
        data_source = os.path.basename(DATA_FILE)
    except Exception:
        df = None


def safe_int_series(series):
    try:
        return series.dropna().astype(int)
    except Exception:
        return series.dropna()


def filter_data(area=None, year=None, month=None):
    if df is None:
        return None

    filtered = df
    if area and area != 'All':
        if 'AREA NAME' in filtered.columns:
            filtered = filtered[filtered['AREA NAME'] == area]
    if year and year != 'All':
        if 'Year' in filtered.columns:
            try:
                filtered = filtered[filtered['Year'] == int(year)]
            except Exception:
                pass
    if month and month != 'All':
        if 'Month' in filtered.columns:
            try:
                filtered = filtered[filtered['Month'] == int(month)]
            except Exception:
                pass

    return filtered


@app.route('/')
def index():
    return render_template('dashboard.html')


@app.route('/api/filters')
def api_filters():
    if df is None:
        # sample
        return jsonify({
            'areas': ['All', 'Downtown', 'Midtown', 'Harbor', 'Uptown'],
            'years': ['All', '2021', '2022', '2023'],
            'months': ['All'] + [str(i) for i in range(1, 13)],
            'data_source': data_source
        })

    areas = ['All'] + sorted(df['AREA NAME'].dropna().unique().tolist()) if 'AREA NAME' in df.columns else ['All']
    years = ['All'] + sorted(df['Year'].dropna().unique().astype(int).astype(str).tolist()) if 'Year' in df.columns else ['All']
    months = ['All'] + [str(i) for i in range(1, 13)]
    return jsonify({'areas': areas, 'years': years, 'months': months, 'data_source': data_source})


@app.route('/api/summary')
def api_summary():
    if df is None:
        return jsonify({'total_crimes': 12345, 'crimes_with_weapons': 234, 'avg_victim_age': 32.7, 'data_source': data_source})

    area = request.args.get('area', 'All')
    year = request.args.get('year', 'All')
    month = request.args.get('month', 'All')
    filtered = filter_data(area, year, month)
    total = len(filtered)
    weapons = int(filtered['Has_Weapon'].sum()) if 'Has_Weapon' in filtered.columns else 0
    avg_age = round(float(filtered['Vict Age'].mean()), 1) if 'Vict Age' in filtered.columns else 0
    return jsonify({'total_crimes': total, 'crimes_with_weapons': weapons, 'avg_victim_age': avg_age, 'data_source': data_source})


@app.route('/api/by_area')
def api_by_area():
    if df is None:
        labels = ['Downtown', 'Midtown', 'Harbor', 'Uptown']
        data = [randrange(50, 500) for _ in labels]
        return jsonify({'labels': labels, 'data': data, 'data_source': data_source})

    year = request.args.get('year', 'All')
    month = request.args.get('month', 'All')
    filtered = filter_data(None, year, month)
    if filtered is None or 'AREA NAME' not in filtered.columns:
        return jsonify({'labels': [], 'data': [], 'data_source': data_source})

    counts = filtered['AREA NAME'].value_counts().head(20)
    return jsonify({'labels': counts.index.tolist(), 'data': counts.values.tolist(), 'data_source': data_source})


@app.route('/api/by_time')
def api_by_time():
    if df is None:
        labels = [f"{h}:00" for h in range(24)]
        data = [randrange(0, 50) for _ in labels]
        return jsonify({'labels': labels, 'data': data, 'data_source': data_source})

    area = request.args.get('area', 'All')
    year = request.args.get('year', 'All')
    month = request.args.get('month', 'All')
    filtered = filter_data(area, year, month)
    if filtered is None or 'Hour' not in filtered.columns:
        labels = [f"{h}:00" for h in range(24)]
        return jsonify({'labels': labels, 'data': [0]*24, 'data_source': data_source})

    hour_counts = filtered['Hour'].value_counts().sort_index()
    all_hours = pd.Series(0, index=range(24))
    all_hours.update(hour_counts)
    return jsonify({'labels': [f"{h}:00" for h in range(24)], 'data': all_hours.tolist(), 'data_source': data_source})


@app.route('/api/by_type')
def api_by_type():
    if df is None:
        labels = ['Theft', 'Assault', 'Burglary', 'Robbery', 'Vandalism']
        data = [randrange(10, 200) for _ in labels]
        return jsonify({'labels': labels, 'data': data, 'data_source': data_source})

    area = request.args.get('area', 'All')
    year = request.args.get('year', 'All')
    month = request.args.get('month', 'All')
    filtered = filter_data(area, year, month)
    if filtered is None or 'Crm Cd Desc' not in filtered.columns:
        return jsonify({'labels': [], 'data': [], 'data_source': data_source})

    type_counts = filtered['Crm Cd Desc'].value_counts().head(10)
    return jsonify({'labels': type_counts.index.tolist(), 'data': type_counts.values.tolist(), 'data_source': data_source})


@app.route('/api/victims')
def api_victims():
    if df is None:
        labels = ['0-17', '18-25', '26-40', '41-60', '60+']
        data = [randrange(0, 200) for _ in labels]
        return jsonify({'age_distribution': {'labels': labels, 'data': data}, 'gender_distribution': {'labels': [], 'data': []}, 'data_source': data_source})

    area = request.args.get('area', 'All')
    year = request.args.get('year', 'All')
    month = request.args.get('month', 'All')
    filtered = filter_data(area, year, month)

    age_dist = {'labels': [], 'data': []}
    if 'Vict Age' in filtered.columns:
        age_data = filtered['Vict Age'].dropna()
        bins = [0, 18, 30, 45, 60, 200]
        labels = ['0-17', '18-29', '30-44', '45-59', '60+']
        age_groups = pd.cut(age_data, bins=bins, labels=labels, include_lowest=True)
        age_counts = age_groups.value_counts().sort_index()
        age_dist = {'labels': age_counts.index.tolist(), 'data': age_counts.values.tolist()}

    gender_dist = {'labels': [], 'data': []}
    if 'Vict Sex' in filtered.columns:
        gender_counts = filtered['Vict Sex'].value_counts()
        gender_dist = {'labels': gender_counts.index.tolist(), 'data': gender_counts.values.tolist()}

    return jsonify({'age_distribution': age_dist, 'gender_distribution': gender_dist, 'data_source': data_source})


@app.route('/api/map')
def api_map():
    limit = int(request.args.get('limit', 500))
    if df is None:
        crimes = []
        for i in range(min(limit, 200)):
            crimes.append({
                'crime': choice(['Theft', 'Assault', 'Robbery']),
                'area': choice(['Downtown', 'Midtown', 'Harbor', 'Uptown']),
                'lat': 34.05 + uniform(-0.15, 0.15),
                'lon': -118.25 + uniform(-0.2, 0.2)
            })
        return jsonify({'crimes': crimes, 'total': 200, 'data_source': data_source})

    area = request.args.get('area', 'All')
    year = request.args.get('year', 'All')
    month = request.args.get('month', 'All')
    filtered = filter_data(area, year, month)

    if filtered is None:
        return jsonify({'crimes': [], 'total': 0, 'data_source': data_source})

    cols = []
    for c in ['LAT', 'LON', 'Crm Cd Desc', 'AREA NAME']:
        if c in filtered.columns:
            cols.append(c)

    if not cols:
        return jsonify({'crimes': [], 'total': len(filtered), 'data_source': data_source})

    map_data = filtered[cols].dropna()
    map_data = map_data[(map_data['LAT'] != 0) & (map_data['LON'] != 0)] if 'LAT' in map_data.columns and 'LON' in map_data.columns else map_data

    if len(map_data) > limit:
        map_data = map_data.sample(limit)

    crimes = []
    for _, row in map_data.iterrows():
        crimes.append({
            'lat': float(row['LAT']) if 'LAT' in row and pd.notna(row['LAT']) else None,
            'lon': float(row['LON']) if 'LON' in row and pd.notna(row['LON']) else None,
            'crime': str(row['Crm Cd Desc']) if 'Crm Cd Desc' in row else '',
            'area': str(row['AREA NAME']) if 'AREA NAME' in row else ''
        })

    return jsonify({'crimes': crimes, 'total': len(filtered), 'data_source': data_source})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
