#!/usr/bin/env python3
import pandas as pd
import json

# Read the Excel file
file_path = 'Bennett_Company_File.xlsx'
try:
    # Read the Excel file
    df = pd.read_excel(file_path)
    
    print("=== Excel File Analysis ===")
    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print("\n=== Column Names ===")
    for i, col in enumerate(df.columns):
        print(f"{i+1}. {col}")
    
    print("\n=== Data Types ===")
    print(df.dtypes)
    
    print("\n=== First 5 Rows (Sample Data) ===")
    print(df.head().to_string())
    
    print("\n=== Missing Values Summary ===")
    print(df.isnull().sum())
    
    print("\n=== Potential Issues for Import ===")
    issues = []
    
    # Check for required field (company name)
    name_columns = [col for col in df.columns if 'name' in col.lower() or 'company' in col.lower()]
    if not name_columns:
        issues.append("WARNING: No column that clearly represents company name")
    else:
        print(f"✓ Found potential company name column(s): {name_columns}")
    
    # Check for duplicates in potential name column
    if name_columns:
        for col in name_columns:
            duplicates = df[col].duplicated().sum()
            if duplicates > 0:
                issues.append(f"WARNING: {duplicates} duplicate values in '{col}' column")
    
    # Check for empty values in critical columns
    for col in df.columns:
        null_count = df[col].isnull().sum()
        if null_count > 0:
            print(f"- Column '{col}' has {null_count} empty values ({null_count/len(df)*100:.1f}%)")
    
    # Report issues
    if issues:
        print("\n⚠️  POTENTIAL IMPORT ISSUES:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("\n✅ No major issues detected!")
    
    # Save a CSV preview for easier inspection
    print("\n=== Saving CSV preview ===")
    df.head(20).to_csv('bennett_preview.csv', index=False)
    print("Saved first 20 rows to 'bennett_preview.csv'")
    
except Exception as e:
    print(f"Error reading Excel file: {e}")
    print("\nMake sure:")
    print("1. The file exists in the current directory")
    print("2. The file is a valid Excel file")
    print("3. You have pandas and openpyxl installed")