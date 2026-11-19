import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
model_name = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
print(f"Loaded GROQ_API_KEY: {api_key[:6]}... (length: {len(api_key)})" if api_key else "No GROQ_API_KEY found")
print(f"Using model: {model_name}")

llm = ChatGroq(model=model_name, api_key=api_key)
r = llm.invoke("Generate a 3-5 word academic search query for papers similar to: mobile devices English language learning study").content
print("Query result from Groq:", r)