import dotenv from 'dotenv';
dotenv.config();

async function testHeliusAPI() {
  const signature = '4KQyGuXYjDQmsSewDrvotXq3EQa6ARhNUoXM8zFjveiZRGhSWj9tc9cs1RBRBcA3CQNDdJiHFb5R3gpAjRhRaw4T';
  
  console.log('Testing Helius Enhanced Transactions API...\n');
  
  // Test the current approach
  console.log('1. Testing POST to /v0/transactions...');
  try {
    const response1 = await fetch(
      `https://api.helius.xyz/v0/transactions?api-key=${process.env.HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: [signature]
        })
      }
    );
    
    console.log('Response status:', response1.status);
    const data1 = await response1.text();
    console.log('Response body:', data1.substring(0, 200));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test alternative approach
  console.log('\n2. Testing POST to /v0/transactions/parsed...');
  try {
    const response2 = await fetch(
      `https://api.helius.xyz/v0/transactions/parsed?api-key=${process.env.HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: [signature]
        })
      }
    );
    
    console.log('Response status:', response2.status);
    const data2 = await response2.text();
    console.log('Response body:', data2.substring(0, 200));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test with different signature
  console.log('\n3. Testing with a more recent signature...');
  const recentSig = '3EPVAGr8efpGntsxY5YUQgfVf96WiowexpQ95PhVWFxYw2gNudmAPPXzCEH6qbHN3X6BLhza7PVLD5P25Y3WSVwc';
  
  try {
    const response3 = await fetch(
      `https://api.helius.xyz/v0/transactions?api-key=${process.env.HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: [recentSig]
        })
      }
    );
    
    console.log('Response status:', response3.status);
    const data3 = await response3.text();
    console.log('Response body:', data3.substring(0, 500));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testHeliusAPI().catch(console.error);