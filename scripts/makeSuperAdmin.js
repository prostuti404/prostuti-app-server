const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb://prostutisecret:6ZGF0wLRQxk7bvlK@cluster0-shard-00-00.g5pja.mongodb.net:27017,cluster0-shard-00-01.g5pja.mongodb.net:27017,cluster0-shard-00-02.g5pja.mongodb.net:27017/prostuti-staging?ssl=true&replicaSet=atlas-141zwx-shard-0&authSource=admin&appName=Cluster0";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected correctly to server");
    
    const db = client.db('prostuti-staging');
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
