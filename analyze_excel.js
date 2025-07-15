const XLSX = require('xlsx');
const fs = require('fs');

// Read the Excel file
const workbook = XLSX.readFile('Bennett_Company_File.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('=== Excel File Analysis ===');
console.log(`Total rows: ${data.length}`);
console.log(`Sheet name: ${sheetName}`);

if (data.length > 0) {
    console.log('\n=== Column Names ===');
    const columns = Object.keys(data[0]);
    columns.forEach((col, i) => {
        console.log(`${i + 1}. ${col}`);
    });
    
    console.log('\n=== First 5 Rows (Sample Data) ===');
    data.slice(0, 5).forEach((row, i) => {
        console.log(`\nRow ${i + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });
    });
    
    console.log('\n=== Analysis for CRM Import ===');
    
    // Check for required company name field
    const nameColumns = columns.filter(col => 
        col.toLowerCase().includes('name') || 
        col.toLowerCase().includes('company')
    );
    
    if (nameColumns.length === 0) {
        console.log('⚠️  WARNING: No clear company name column found');
        console.log('   The import requires a "name" field for companies');
    } else {
        console.log(`✓ Found potential company name column(s): ${nameColumns.join(', ')}`);
    }
    
    // Check which CRM fields can be mapped
    console.log('\n=== Mappable Fields to CRM ===');
    const crmFields = {
        'name': 'Company Name (REQUIRED)',
        'industry': 'Industry',
        'website': 'Website',
        'phone': 'Phone Number',
        'street_address': 'Street Address',
        'city': 'City',
        'state': 'State/Region',
        'postal_code': 'Postal Code',
        'annual_revenue': 'Annual Revenue',
        'description': 'Description',
        'status': 'Status (Active/Lead/Inactive)'
    };
    
    console.log('CRM fields available for mapping:');
    Object.entries(crmFields).forEach(([field, desc]) => {
        const matchingCols = columns.filter(col => 
            col.toLowerCase().includes(field.toLowerCase().replace('_', ' ')) ||
            col.toLowerCase().includes(field.toLowerCase())
        );
        
        if (matchingCols.length > 0) {
            console.log(`  ✓ ${desc} -> Can map from: ${matchingCols.join(', ')}`);
        } else {
            console.log(`  ✗ ${desc} -> No matching column found`);
        }
    });
    
    // Check for empty values
    console.log('\n=== Data Quality Check ===');
    const emptyValueCounts = {};
    columns.forEach(col => {
        emptyValueCounts[col] = 0;
    });
    
    data.forEach(row => {
        columns.forEach(col => {
            if (!row[col] || String(row[col]).trim() === '') {
                emptyValueCounts[col]++;
            }
        });
    });
    
    console.log('Empty values per column:');
    Object.entries(emptyValueCounts).forEach(([col, count]) => {
        const percentage = (count / data.length * 100).toFixed(1);
        if (count > 0) {
            console.log(`  ${col}: ${count} empty (${percentage}%)`);
        }
    });
    
    // Save preview as CSV
    console.log('\n=== Creating CSV Preview ===');
    const csvData = data.slice(0, 20);
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(csvData));
    fs.writeFileSync('bennett_preview.csv', csv);
    console.log('✓ Saved first 20 rows to bennett_preview.csv');
    
    // Final recommendations
    console.log('\n=== IMPORT RECOMMENDATIONS ===');
    if (nameColumns.length === 0) {
        console.log('❌ CRITICAL: You must map a column to "Company Name" for import to work');
    } else {
        console.log('✅ File appears ready for import with proper column mapping');
    }
    console.log('\nSteps for successful import:');
    console.log('1. Click "Bulk Upload" in the Companies page');
    console.log('2. Upload this Excel file');
    console.log('3. Map columns appropriately:');
    if (nameColumns.length > 0) {
        console.log(`   - Map "${nameColumns[0]}" to "Company Name"`);
    }
    console.log('   - Map other columns as needed');
    console.log('4. Review the preview before importing');
}