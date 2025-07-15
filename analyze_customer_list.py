import pandas as pd
import json

# Read the Excel file
file_path = '/Users/ericlebow/Library/CloudStorage/OneDrive-PBN/Software Projects/nohubspot/cleaned_customer_list.xlsx'

try:
    # Read all sheets
    xl_file = pd.ExcelFile(file_path)
    print(f"Excel file has {len(xl_file.sheet_names)} sheet(s): {xl_file.sheet_names}\n")
    
    # Read the first sheet (or specific sheet if there are multiple)
    df = pd.read_excel(file_path, sheet_name=0)
    
    print(f"Data shape: {df.shape[0]} rows, {df.shape[1]} columns")
    print(f"\nColumn names:")
    for i, col in enumerate(df.columns):
        print(f"  {i}: {col}")
    
    print(f"\nFirst 5 rows:")
    print(df.head())
    
    print(f"\nData types:")
    print(df.dtypes)
    
    # Check for null values
    print(f"\nNull values per column:")
    print(df.isnull().sum())
    
    # Show unique values for categorical columns (if any)
    for col in df.columns:
        if df[col].dtype == 'object' and len(df[col].unique()) < 20:
            print(f"\nUnique values in '{col}':")
            print(df[col].unique())
    
except Exception as e:
    print(f"Error reading file: {e}")