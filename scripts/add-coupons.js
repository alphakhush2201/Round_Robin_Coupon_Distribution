require('dotenv').config();
const faunadb = require('faunadb');
const q = faunadb.query;

const client = new faunadb.Client({
  secret: process.env.FAUNA_SECRET
});

const couponsToAdd = [
  "SUMMER25",
  "WELCOME10",
  "HOLIDAY30",
  "FLASH50",
  "NEWUSER15",
  "WEEKEND20",
  "SPECIAL40",
  "LOYALTY15",
  "SEASONAL25",
  "BIRTHDAY10"
];

async function addCoupons() {
  try {
    console.log("Starting to add coupons to FaunaDB...");
    
    // Skip collection creation since it already exists in your dashboard
    
    // Add each coupon to the database
    for (const coupon of couponsToAdd) {
      try {
        await client.query(
          q.Create(
            q.Collection('coupons'),
            { data: { code: coupon, isAvailable: true } }
          )
        );
        console.log(`Added coupon: ${coupon}`);
      } catch (error) {
        console.error(`Error adding coupon ${coupon}:`, error);
      }
    }
    
    console.log("Finished adding coupons");
    
    // Verify coupons were added
    const result = await client.query(
      q.Map(
        q.Paginate(q.Documents(q.Collection('coupons'))),
        q.Lambda('couponRef', q.Get(q.Var('couponRef')))
      )
    );
    
    console.log(`Total coupons in database: ${result.data.length}`);
    console.log("Coupon codes:", result.data.map(item => item.data.code));
    
  } catch (error) {
    console.error("Error:", error);
  }
}

addCoupons();