#!/usr/bin/env python3
import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure API key
api_key = os.getenv('GEMINI_API_KEY')
if not api_key:
    print("Error: GEMINI_API_KEY not found in .env file")
    exit(1)

genai.configure(api_key=api_key)

print("Available Gemini models:")
try:
    models = genai.list_models()
    for model in models:
        if 'gemini' in model.name.lower():
            print(f"- {model.name}")
except Exception as e:
    print(f"Error listing models: {e}")

# Test specific model
print("\nTesting gemini-2.5-flash-lite model:")
try:
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    response = model.generate_content("Hello, this is a test.")
    print("✓ Model works successfully")
    print(f"Response: {response.text[:100]}...")
except Exception as e:
    print(f"✗ Error with gemini-2.5-flash-lite: {e}")
    
    # Try alternative models
    alternative_models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']
    for alt_model in alternative_models:
        try:
            print(f"\nTrying {alt_model}:")
            model = genai.GenerativeModel(alt_model)
            response = model.generate_content("Hello, this is a test.")
            print(f"✓ {alt_model} works successfully")
            print(f"Response: {response.text[:100]}...")
            break
        except Exception as e:
            print(f"✗ Error with {alt_model}: {e}")