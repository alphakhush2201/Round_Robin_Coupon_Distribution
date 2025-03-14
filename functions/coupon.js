require('dotenv').config();
const faunadb = require('faunadb');
const cookie = require('cookie');
const q = faunadb.query;

const client = new faunadb.Client({
  secret: process.env.FAUNA_SECRET
});

async function initializeDatabase() {
  console.log("Initializing database...");
  
  try {
    try {
      await client.query(
        q.Get(q.Collection('coupons'))
      );
      console.log("Coupons collection already exists");
    } catch (error) {
      console.log("Creating coupons collection...");
      await client.query(
        q.CreateCollection({ name: 'coupons' })
      );
      
      await client.query(
        q.CreateIndex({
          name: 'all_coupons',
          source: q.Collection('coupons')
        })
      );
      
      const initialCoupons = [
        "SAVE10", "DISCOUNT20", "FREESHIP", "SPECIAL25", "DEAL15",
        "OFFER30", "PROMO5", "BONUS50", "EXTRA15", "GIFT25"
      ];
      
      console.log("Adding initial coupons...");
      for (const coupon of initialCoupons) {
        await client.query(
          q.Create(
            q.Collection('coupons'),
            { data: { code: coupon, isAvailable: true } }
          )
        );
      }
      console.log("Initial coupons added successfully");
    }
    
    try {
      await client.query(
        q.Get(q.Collection('claims'))
      );
      console.log("Claims collection already exists");
    } catch (error) {
      console.log("Creating claims collection...");
      await client.query(
        q.CreateCollection({ name: 'claims' })
      );
      
      await client.query(
        q.CreateIndex({
          name: 'claims_by_user',
          source: q.Collection('claims'),
          terms: [{ field: ['data', 'userId'] }]
        })
      );
      console.log("Claims collection created successfully");
    }
    
    const couponsResult = await client.query(
      q.Map(
        q.Paginate(q.Documents(q.Collection('coupons'))),
        q.Lambda('couponRef', q.Get(q.Var('couponRef')))
      )
    );
    
    if (couponsResult.data.length === 0) {
      console.log("No coupons found, adding initial coupons...");
      const initialCoupons = [
        "SAVE10", "DISCOUNT20", "FREESHIP", "SPECIAL25", "DEAL15",
        "OFFER30", "PROMO5", "BONUS50", "EXTRA15", "GIFT25"
      ];
      
      for (const coupon of initialCoupons) {
        await client.query(
          q.Create(
            q.Collection('coupons'),
            { data: { code: coupon, isAvailable: true } }
          )
        );
      }
      console.log("Initial coupons added successfully");
    } else {
      console.log(`Found ${couponsResult.data.length} existing coupons`);
    }
    
    console.log("Database initialization complete");
    return true;
  } catch (error) {
    console.error("Error initializing database:", error);
    return false;
  }
}

async function getNextCoupon() {
  try {
    console.log("Getting next available coupon...");
    
    const checkResult = await client.query(
      q.Map(
        q.Paginate(q.Documents(q.Collection('coupons'))),
        q.Lambda('couponRef', q.Get(q.Var('couponRef')))
      )
    );
    
    if (checkResult.data.length === 0) {
      console.log("No coupons found in getNextCoupon, creating emergency coupons");
      const emergencyCoupons = [
        "SAVE10", "DISCOUNT20", "FREESHIP", "SPECIAL25", "DEAL15"
      ];
      
      for (const coupon of emergencyCoupons) {
        await client.query(
          q.Create(
            q.Collection('coupons'),
            { data: { code: coupon, isAvailable: true } }
          )
        );
      }
      
      const result = await client.query(
        q.Map(
          q.Paginate(q.Documents(q.Collection('coupons'))),
          q.Lambda('couponRef', q.Get(q.Var('couponRef')))
        )
      );
      
      const coupons = result.data;
      console.log(`Created and found ${coupons.length} emergency coupons`);
      
      if (coupons.length > 0) {
        return coupons[0].data.code;
      } else {
        console.log("Emergency fallback: returning hardcoded coupon");
        return "EMERGENCY25";
      }
    }
    
    const coupons = checkResult.data;
    console.log(`Found ${coupons.length} coupons in database`);
    
    const firstCoupon = coupons[0];
    const couponCode = firstCoupon.data.code;
    console.log(`Selected coupon: ${couponCode}`);
    
    try {
      await client.query(
        q.Delete(firstCoupon.ref)
      );
      
      await client.query(
        q.Create(
          q.Collection('coupons'),
          { data: { code: couponCode, isAvailable: true } }
        )
      );
      
      console.log(`Successfully moved coupon ${couponCode} to the end of the queue`);
    } catch (moveError) {
      console.error("Error moving coupon for round-robin:", moveError);
    }
    
    return couponCode;
  } catch (error) {
    console.error('Error getting next coupon:', error);
    return "FALLBACK10";
  }
}

async function recordClaim(userId, coupon) {
  try {
    await client.query(
      q.Create(
        q.Collection('claims'),
        {
          data: {
            userId,
            coupon,
            timestamp: Date.now()
          }
        }
      )
    );
    return true;
  } catch (error) {
    console.error('Error recording claim:', error);
    return false;
  }
}

async function checkRecentClaim(userId) {
  try {
    console.log(`Checking recent claims for user: ${userId}`);
    
    try {
      await client.query(
        q.Get(q.Index('claims_by_user'))
      );
    } catch (indexError) {
      console.log("Creating claims_by_user index...");
      await client.query(
        q.CreateIndex({
          name: 'claims_by_user',
          source: q.Collection('claims'),
          terms: [{ field: ['data', 'userId'] }]
        })
      );
    }
    
    const result = await client.query(
      q.Map(
        q.Paginate(
          q.Match(q.Index('claims_by_user'), userId)
        ),
        q.Lambda('claimRef', q.Get(q.Var('claimRef')))
      )
    );
    
    if (result.data.length === 0) {
      console.log("No previous claims found for this user");
      return null;
    }
    
    const claims = result.data.sort((a, b) => 
      b.data.timestamp - a.data.timestamp
    );
    
    const latestClaim = claims[0].data;
    const currentTime = Date.now();
    const timeElapsed = currentTime - latestClaim.timestamp;
    const timeLimit = 60 * 60 * 1000;
    
    console.log(`Latest claim: ${latestClaim.coupon}, Time elapsed: ${Math.floor(timeElapsed/1000)} seconds`);
    
    if (timeElapsed < timeLimit) {
      const timeRemaining = Math.ceil((timeLimit - timeElapsed) / (60 * 1000));
      console.log(`User must wait ${timeRemaining} more minutes`);
      return {
        coupon: latestClaim.coupon,
        timeRemaining
      };
    }
    
    console.log("Time limit has passed, user can claim a new coupon");
    return null;
  } catch (error) {
    console.error('Error checking recent claim:', error);
    return null;
  }
}

exports.handler = async (event, context) => {
  try {
    console.log(`Request method: ${event.httpMethod}`);
    console.log(`Request headers: ${JSON.stringify(event.headers)}`);
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: "Please click the button to claim a coupon."
        })
      };
    }
    
    await initializeDatabase();
    
    const userIP = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown-ip';
    const cookies = cookie.parse(event.headers.cookie || '');
    const userCookie = cookies.userIdentifier;
    
    const userAgent = event.headers['user-agent'] || '';
    const combinedIdentifier = `${userIP}-${userAgent.substring(0, 20)}`;
    
    const userIdentifier = userCookie || combinedIdentifier;
    
    console.log(`User identifier: ${userIdentifier}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    };
    
    if (!userCookie) {
      headers['Set-Cookie'] = cookie.serialize('userIdentifier', combinedIdentifier, {
        maxAge: 24 * 60 * 60,
        httpOnly: true,
        path: '/'
      });
      console.log(`Setting new cookie: ${combinedIdentifier}`);
    }
    
    const recentClaim = await checkRecentClaim(userIdentifier);
    
    if (recentClaim) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: `You've already claimed coupon ${recentClaim.coupon}. Please wait ${recentClaim.timeRemaining} minutes before claiming another.`,
          couponClaimed: recentClaim.coupon,
          timeRemaining: recentClaim.timeRemaining
        })
      };
    }
    
    const coupon = await getNextCoupon();
    
    if (!coupon) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: "No coupons are currently available. Please try again later.",
        })
      };
    }
    
    await recordClaim(userIdentifier, coupon);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully claimed coupon: ${coupon}`,
        coupon
      })
    };
  } catch (error) {
    console.error("Handler error:", error);
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      },
      body: JSON.stringify({
        success: false,
        message: "An error occurred while processing your request. Please try again later.",
      })
    };
  }
};