#!/usr/bin/env python3
"""
Analyze SCC Projects Excel file to understand the structure
"""

import pandas as pd
import json

# Read the Excel file
df = pd.read_excel('SCC Projects.xlsx')

print("=== SCC Projects Analysis ===")
print(f"\nTotal rows: {len(df)}")
print(f"\nColumns: {list(df.columns)}")

# Show first few rows
print("\nFirst 5 rows:")
print(df.head())

# Check for missing values
print("\nMissing values per column:")
print(df.isnull().sum())

# Show unique project types
if 'Project Type' in df.columns:
    print("\nUnique Project Types:")
    print(df['Project Type'].value_counts())

# Show data types
print("\nData types:")
print(df.dtypes)

# Save a sample to JSON for inspection
sample_data = df.head(10).to_dict('records')
with open('scc_projects_sample.json', 'w') as f:
    json.dump(sample_data, f, indent=2, default=str)
print("\nSaved sample data to scc_projects_sample.json")