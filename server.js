const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize coupons if they don't exist
const COUPONS_FILE = path.join(__dirname, 'coupons.json');
if (!fs.existsSync(COUPONS_FILE)) {
  const initialCoupons = {
    available: [
      "SAVE10", "DISCOUNT20", "FREESHIP", "SPECIAL25", "DEAL15",
      "OFFER30", "PROMO5", "BONUS50", "EXTRA15", "GIFT25"
    ],
    claimed: {}
  };
  fs.writeFileSync(COUPONS_FILE, JSON.stringify(initialCoupons, null, 2));
}

// Routes
app.get('/api/coupon', (req, res) => {
  // Get user identifier (IP address or cookie)
  const userIP = req.ip;
  const userCookie = req.cookies.userIdentifier;
  const userIdentifier = userCookie || userIP;
  
  // Set cookie if not exists
  if (!userCookie) {
    res.cookie('userIdentifier', userIP, { 
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true 
    });
  }
  
  // Read coupons data
  const couponsData = JSON.parse(fs.readFileSync(COUPONS_FILE));
  
  // Check if user already claimed a coupon
  if (couponsData.claimed[userIdentifier]) {
    const claimInfo = couponsData.claimed[userIdentifier];
    const currentTime = Date.now();
    const timeElapsed = currentTime - claimInfo.timestamp;
    const timeLimit = 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (timeElapsed < timeLimit) {
      const timeRemaining = Math.ceil((timeLimit - timeElapsed) / (60 * 1000));
      return res.json({
        success: false,
        message: `You've already claimed coupon ${claimInfo.coupon}. Please wait ${timeRemaining} minutes before claiming another.`,
        couponClaimed: claimInfo.coupon,
        timeRemaining
      });
    }
  }
  
  // Assign a coupon if available
  if (couponsData.available.length > 0) {
    const coupon = couponsData.available.shift(); // Get the first coupon (round-robin)
    
    // Record the claim
    couponsData.claimed[userIdentifier] = {
      coupon,
      timestamp: Date.now()
    };
    
    // Add the coupon back to the end for round-robin distribution
    couponsData.available.push(coupon);
    
    // Save updated coupons data
    fs.writeFileSync(COUPONS_FILE, JSON.stringify(couponsData, null, 2));
    
    return res.json({
      success: true,
      message: `Successfully claimed coupon: ${coupon}`,
      coupon
    });
  } else {
    return res.json({
      success: false,
      message: "No coupons available at the moment."
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});