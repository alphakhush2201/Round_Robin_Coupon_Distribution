# Round-Robin Coupon Distribution System

## Project Overview
This project implements a serverless coupon distribution system that allocates coupons to users in a round-robin fashion. The system ensures fair distribution by cycling through available coupons and enforcing a cooldown period between claims.

## Key Features
- **Round-Robin Distribution**: Coupons are distributed in a fair, sequential order
- **Cooldown Period**: Users must wait 1 hour between claiming coupons
- **No Login Required**: User tracking via browser cookies and localStorage
- **Serverless Architecture**: Built with Netlify Functions and FaunaDB
- **Responsive UI**: Clean, mobile-friendly interface

## Technical Implementation
- **Frontend**: HTML5, CSS3, and vanilla JavaScript
- **Backend**: Netlify Functions (serverless)
- **Database**: FaunaDB for storing coupons and user claims
- **Security**: Rate limiting to prevent abuse

## How It Works
1. When a user clicks "Claim Coupon", the system checks if they've claimed a coupon within the last hour
2. If eligible, the system retrieves the next available coupon from the database
3. The claimed coupon is moved to the end of the queue (round-robin)
4. A claim record is created with a timestamp to enforce the cooldown period
5. The user receives their coupon code with a success message

## Database Structure
- **Coupons Collection**: Stores available coupon codes
- **Claims Collection**: Tracks which users have claimed which coupons and when

## Fallback Mechanisms
The system includes multiple fallback mechanisms to ensure reliability:
- Initial coupons are created if the database is empty
- Emergency coupons are generated if no coupons are found during a claim
- A hardcoded fallback coupon is provided as a last resort

Created by Khushwant Singh Chouhan