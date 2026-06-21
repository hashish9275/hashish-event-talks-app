from flask import Flask, jsonify, render_template
import feedparser
import requests
import re
import os

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_summary(summary_html):
    """
    Splits the BigQuery release note summary HTML by <h3> headers.
    Returns a list of dicts: [{'type': 'Feature', 'html': '<p>...</p>'}]
    """
    # Use case-insensitive regex to split by h3 tags and capture the type
    parts = re.split(r'(?i)<h3[^>]*>(.*?)</h3>', summary_html)
    if len(parts) <= 1:
        return [{"type": "Update", "html": summary_html.strip()}]
    
    updates = []
    first_part = parts[0].strip()
    if first_part:
        updates.append({"type": "General", "html": first_part})
    
    # Process pairs: parts[i] is the header text, parts[i+1] is the content HTML
    for i in range(1, len(parts), 2):
        if i + 1 < len(parts):
            u_type = parts[i].strip()
            u_html = parts[i+1].strip()
            updates.append({"type": u_type, "html": u_html})
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    try:
        # Fetch with a timeout to prevent hanging
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse feed from raw content
        feed = feedparser.parse(response.content)
        
        releases = []
        for entry in feed.entries:
            title = entry.get('title', 'Unknown Date')
            updated = entry.get('updated', '')
            link = entry.get('link', '')
            summary_html = entry.get('summary', '')
            
            parsed_updates = parse_summary(summary_html)
            
            releases.append({
                'date': title,
                'updated': updated,
                'link': link,
                'updates': parsed_updates
            })
            
        return jsonify({
            'status': 'success',
            'feed_title': feed.feed.get('title', 'BigQuery - Release Notes'),
            'releases': releases
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'status': 'error',
            'message': f"Failed to fetch release notes: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f"An unexpected error occurred: {str(e)}"
        }), 500

if __name__ == '__main__':
    # Run locally on port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
