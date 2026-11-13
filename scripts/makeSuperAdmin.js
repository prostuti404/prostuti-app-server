const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected correctly to server");
    
    const db = client.db();
    const users = db.collection('users');

    const result = await users.updateOne(
      { email: 'rijoanmaruf1@gmail.com' },
      { $set: { isSuperAdmin: true } }
    );

    if (result.matchedCount > 0) {
      console.log(`Successfully updated ${result.modifiedCount} document(s). User is now a super admin.`);
    } else {
      console.log("No document matched the email. User not found.");
    }
  } catch (err) {
    console.log(err.stack);
  } finally {
    await client.close();
  }
}

main();
