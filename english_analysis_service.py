#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
IELTS Speaking Analysis Service - Refactored with Gemini API
This service receives a markdown file, sends its content to the Gemini API for analysis,
and returns a structured JSON response based on a comprehensive IELTS evaluation schema.
"""

# ==============================================================================
# Installation and Setup Guide
# ==============================================================================
# 1. Install necessary Python libraries:
#    pip install flask flask-cors google-genai python-dotenv
#
# 2. Create a `.env` file in the same directory as this script.
#
# 3. Add your Google AI Studio API key to the .env file:
#    GEMINI_API_KEY="YOUR_API_KEY_HERE"
#    or set GOOGLE_API_KEY for compatibility
#
# 4. Run the server:
#    python3 english_analysis_service.py
# ==============================================================================

import os
import json
import time
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
from dotenv import load_dotenv

# --- Initial Setup ---
load_dotenv()
app = Flask(__name__)
CORS(app)

# --- Configure Gemini API (new SDK) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY or GOOGLE_API_KEY not found. Please check your .env file.")
    client = None
else:
    client = genai.Client(api_key=GEMINI_API_KEY)

# --- Constants ---
GEMINI_MODEL = 'gemini-2.5-flash-lite'  # Using the specified model

# --- System Prompt for Gemini ---
# This is the core instruction that tells Gemini how to behave and what to output.
# It includes all the evaluation criteria from your original script.
SYSTEM_PROMPT = """
You are an expert IELTS speaking examiner. Your task is to analyze the user's spoken English text and provide a detailed, structured evaluation in JSON format. Adhere strictly to the JSON schema provided below. Do not output anything other than the JSON object.

Your analysis must cover the following IELTS criteria:

1.  **Overall Feedback**: Provide constructive strengths, areas for improvement, and key recommendations.
2.  **IELTS Band Score**: Estimate a band score (0-9) for Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation. Provide a rationale for each score.
3.  **Grammar Errors**: Identify specific grammatical mistakes. For each error, provide the incorrect text, a description of the error, and a suggestion for correction.
4.  **Word Choice Issues**: Identify instances of incorrect or unnatural word usage. Provide the problematic phrase and a better alternative.
5.  **Tense Consistency**: Analyze the use of verb tenses. Comment on consistency and correctness, providing examples from the text.
6.  **Sentence Structure**: Evaluate the variety and correctness of sentence structures. Note any run-on sentences, fragments, or lack of complexity.
7.  **Vocabulary Assessment**:
    - Calculate lexical density (ratio of unique content words to total content words).
    - List any advanced or idiomatic vocabulary used correctly.
    - List any overused basic words (e.g., 'good', 'bad', 'very').
    - Provide a list of suggestions with alternatives for the overused words.
8.  **Fluency Markers**:
    - Identify and count hesitation markers (e.g., 'um', 'uh', 'like').
    - List any connectors or discourse markers used (e.g., 'however', 'therefore', 'on the other hand').

Now, provide your complete analysis in the following JSON format. Do not add any text before or after the JSON object.

{
  "overall_feedback": {
    "strengths": ["string"],
    "areas_for_improvement": ["string"],
    "key_recommendations": ["string"]
  },
  "ielts_band_score": {
    "fluency_and_coherence": { "score": "float", "rationale": "string" },
    "lexical_resource": { "score": "float", "rationale": "string" },
    "grammatical_range_and_accuracy": { "score": "float", "rationale": "string" },
    "pronunciation_assumption": { "score": "float", "rationale": "string based on text, noting limitations" },
    "overall": { "score": "float", "rationale": "string" }
  },
  "grammar_errors": [
    {
      "type": "string",
      "text": "string",
      "description": "string",
      "suggestions": ["string"]
    }
  ],
  "word_choice_issues": [
    {
      "type": "word_choice",
      "text": "string",
      "suggestion": "string"
    }
  ],
  "tense_consistency": {
    "analysis": "string with examples"
  },
  "sentence_structure": {
    "analysis": "string with examples",
    "issues": [
      {
        "sentence": "string",
        "issue": "string"
      }
    ]
  },
  "vocabulary_assessment": {
    "lexical_density": "float (e.g., 0.65)",
    "advanced_words_found": ["string"],
    "overused_basic_words": ["string"],
    "vocabulary_suggestions": [
      {
        "basic_word": "string",
        "alternatives": ["string"]
      }
    ]
  },
  "fluency_markers": {
    "hesitation_markers": [
      {
        "marker": "string",
        "count": "integer"
      }
    ],
    "connectors_used": ["string"]
  }
}
"""

# Structured output schema for the new SDK (simplified but aligned with the required JSON)
IELTS_ANALYSIS_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "overall_feedback": {
            "type": "OBJECT",
            "properties": {
                "strengths": {"type": "ARRAY", "items": {"type": "STRING"}},
                "areas_for_improvement": {"type": "ARRAY", "items": {"type": "STRING"}},
                "key_recommendations": {"type": "ARRAY", "items": {"type": "STRING"}},
            },
        },
        "ielts_band_score": {
            "type": "OBJECT",
            "properties": {
                "fluency_and_coherence": {
                    "type": "OBJECT",
                    "properties": {"score": {"type": "NUMBER"}, "rationale": {"type": "STRING"}},
                },
                "lexical_resource": {
                    "type": "OBJECT",
                    "properties": {"score": {"type": "NUMBER"}, "rationale": {"type": "STRING"}},
                },
                "grammatical_range_and_accuracy": {
                    "type": "OBJECT",
                    "properties": {"score": {"type": "NUMBER"}, "rationale": {"type": "STRING"}},
                },
                "pronunciation_assumption": {
                    "type": "OBJECT",
                    "properties": {"score": {"type": "NUMBER"}, "rationale": {"type": "STRING"}},
                },
                "overall": {
                    "type": "OBJECT",
                    "properties": {"score": {"type": "NUMBER"}, "rationale": {"type": "STRING"}},
                },
            },
        },
        "grammar_errors": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "type": {"type": "STRING"},
                    "text": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "suggestions": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
            },
        },
        "word_choice_issues": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "type": {"type": "STRING"},
                    "text": {"type": "STRING"},
                    "suggestion": {"type": "STRING"},
                },
            },
        },
        "tense_consistency": {
            "type": "OBJECT",
            "properties": {"analysis": {"type": "STRING"}},
        },
        "sentence_structure": {
            "type": "OBJECT",
            "properties": {
                "analysis": {"type": "STRING"},
                "issues": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "sentence": {"type": "STRING"},
                            "issue": {"type": "STRING"},
                        },
                    },
                },
            },
        },
        "vocabulary_assessment": {
            "type": "OBJECT",
            "properties": {
                "lexical_density": {"type": "NUMBER"},
                "advanced_words_found": {"type": "ARRAY", "items": {"type": "STRING"}},
                "overused_basic_words": {"type": "ARRAY", "items": {"type": "STRING"}},
                "vocabulary_suggestions": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "basic_word": {"type": "STRING"},
                            "alternatives": {"type": "ARRAY", "items": {"type": "STRING"}},
                        },
                    },
                },
            },
        },
        "fluency_markers": {
            "type": "OBJECT",
            "properties": {
                "hesitation_markers": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "marker": {"type": "STRING"},
                            "count": {"type": "INTEGER"},
                        },
                    },
                },
                "connectors_used": {"type": "ARRAY", "items": {"type": "STRING"}},
            },
        },
    },
}


def require_markdown_file(f):
    """Decorator to validate that a markdown file is uploaded."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected for uploading'}), 400
        if not file.filename.lower().endswith('.md'):
            return jsonify({'error': 'Invalid file type. Please upload a .md file'}), 415

        try:
            # Read markdown content as plain text (send raw markdown to the model)
            content_bytes = file.read()
            text = content_bytes.decode('utf-8')
            if not text.strip():
                return jsonify({'error': 'Markdown file is empty or contains no text'}), 400
            return f(text, *args, **kwargs)
        except Exception as e:
            return jsonify({'error': f'Failed to read or parse file: {str(e)}'}), 500

    return decorated_function


class GeminiIELTSAnalyzer:
    """Analyzer that uses the Gemini API for IELTS speaking evaluation (new SDK)."""

    def __init__(self, client: genai.Client, model_name: str, system_prompt: str):
        self.client = client
        self.model_name = model_name
        # Configure generation to produce JSON according to schema
        self.generation_config = types.GenerateContentConfig(
            system_instruction=[system_prompt],
            response_mime_type="application/json",
            response_schema=IELTS_ANALYSIS_SCHEMA,
        )

    def analyze_speaking_text(self, text: str):
        """
        Sends the user's text to Gemini and gets a structured analysis.

        Args:
            text: The spoken text from the user.

        Returns:
            A dictionary with the structured analysis or an error dictionary.
        """
        if not GEMINI_API_KEY or not self.client:
            return {'error': 'Gemini API key is not configured on the server.'}

        print(f"Sending request to Gemini for analysis...")
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=text,
                config=self.generation_config,
            )

            # Prefer parsed structured output when schema is provided
            if hasattr(response, 'parsed') and response.parsed is not None:
                print("Received structured (parsed) response from Gemini.")
                return response.parsed

            # Fallback to parsing text as JSON
            response_text = response.text
            print("Received response from Gemini (text). Parsing JSON...")
            result_json = json.loads(response_text)
            return result_json

        except Exception as e:
            print(f"An error occurred while calling the Gemini API: {e}")
            return {'error': f'Failed to get a valid analysis from Gemini API. Details: {str(e)}'}


# --- Global Analyzer Instance ---
if client:
    gemini_analyzer = GeminiIELTSAnalyzer(client, GEMINI_MODEL, SYSTEM_PROMPT)
else:
    gemini_analyzer = None


# --- API Endpoints ---
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'Gemini IELTS Speaking Analysis Service',
        'model_used': GEMINI_MODEL,
        'gemini_api_configured': 'Yes' if GEMINI_API_KEY else 'No'
    })


@app.route('/ielts-speaking-gemini', methods=['POST'])
@require_markdown_file
def analyze_ielts_speaking_with_gemini(text: str):
    """
    The main endpoint to analyze IELTS speaking from an uploaded markdown file.
    """
    if not gemini_analyzer:
        return jsonify({'error': 'Gemini analyzer not initialized'}), 500

    print(f"Analyzing text with {len(text)} characters.")

    start_time = time.time()
    result = gemini_analyzer.analyze_speaking_text(text)
    end_time = time.time()

    if 'error' in result:
        return jsonify(result), 502  # Bad Gateway, as we failed to get a proper upstream response

    result['analysis_duration_seconds'] = round(end_time - start_time, 2)
    result['analysis_timestamp'] = int(time.time() * 1000)

    return jsonify(result)


if __name__ == '__main__':
    print("Initializing Gemini IELTS Analysis Service...")
    if not GEMINI_API_KEY:
        print("Warning: Server is starting, but Gemini API key is MISSING.")
    else:
        print("Gemini API key loaded.")

    print(f"\nStarting Flask server on http://localhost:5002")
    print("Available Endpoints:")
    print("  GET  /health")
    print("  POST /ielts-speaking-gemini (Upload a .md file with key 'file')")

    app.run(host='0.0.0.0', port=5002, debug=False)
