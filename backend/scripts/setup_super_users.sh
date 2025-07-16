#!/bin/bash

# Script to set up super user accounts for testing

echo "==================================="
echo "NotHubSpot Super User Setup"
echo "==================================="
echo ""
echo "This script will create a super user account for each organization."
echo "Email: superuser@nothubspot.com"
echo "Default Password: SuperUser123!"
echo ""
echo "Options:"
echo "1. Create super users for all organizations"
echo "2. Remove all super user accounts"
echo "3. Exit"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "Creating super users..."
        cd /app/backend 2>/dev/null || cd backend
        python scripts/create_super_users.py
        ;;
    2)
        echo "Removing super users..."
        cd /app/backend 2>/dev/null || cd backend
        python scripts/create_super_users.py --remove
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting..."
        exit 1
        ;;
esac