import dotenv from 'dotenv';
dotenv.config();

async function testSignature() {
  const sig = '7vPbeAcBkxcvjq8sL7GL154TmNRK861akFf94jsBisHWLBn84MvTK4oTSjRFQjRoEVrG7TT88RqN9TSUqjeRTRV';
  
  try {
    const response = await fetch(`https://api.helius.xyz/v0/transactions?api-key=${process.env.HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: [sig] })
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Data type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    console.log('Length:', data?.length);
    
    if (data && data.length > 0) {
      const tx = data[0];
      console.log('Transaction found:', !!tx);
      console.log('Has signature:', !!tx?.signature);
      console.log('Type:', tx?.type);
      console.log('Description:', tx?.description?.substring(0, 100));
    } else {
      console.log('No transaction data returned');
      console.log('Raw response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSignature();