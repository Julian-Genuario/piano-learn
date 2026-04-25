#!/bin/bash

echo "=== Testing YouTube MIDI Extraction Flow ==="
echo ""

# Test 1: Get YouTube title
echo "Test 1: Get YouTube title from URL"
TITLE_RESPONSE=$(curl -s -X POST http://localhost:8000/api/songs-title \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}')
echo "Response: $TITLE_RESPONSE"
TITLE=$(echo $TITLE_RESPONSE | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
echo "Extracted title: $TITLE"
echo ""

# Test 2: Start extraction with the title
echo "Test 2: Start MIDI extraction job"
EXTRACT_RESPONSE=$(curl -s -X POST http://localhost:8000/api/songs/extract-youtube \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\", \"name\": \"Test YouTube\", \"separate\": false}")
echo "Response: $EXTRACT_RESPONSE"
JOB_ID=$(echo $EXTRACT_RESPONSE | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)
echo "Job ID: $JOB_ID"
echo ""

# Test 3: Check job status
echo "Test 3: Check extraction job status"
for i in {1..5}; do
  STATUS_RESPONSE=$(curl -s http://localhost:8000/api/songs/extract-status/$JOB_ID)
  echo "Status check $i: $STATUS_RESPONSE"
  sleep 1
done
echo ""

# Test 4: List songs to verify it was added
echo "Test 4: List all songs to verify extraction"
curl -s http://localhost:8000/api/songs | grep -o '"name":"[^"]*"' | tail -5
