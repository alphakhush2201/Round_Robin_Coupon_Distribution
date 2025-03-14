document.addEventListener('DOMContentLoaded', function() {
  const claimButton = document.getElementById('claimButton');
  const resultDiv = document.getElementById('result');
  const timerDiv = document.getElementById('timer');
  
  let countdownInterval;
  
  checkLocalStorage();
  
  function checkLocalStorage() {
    const savedClaim = localStorage.getItem('lastClaim');
    if (savedClaim) {
      const claimData = JSON.parse(savedClaim);
      const currentTime = new Date().getTime();
      const elapsedTime = currentTime - claimData.timestamp;
      const timeLimit = 60 * 60 * 1000;
      
      if (elapsedTime < timeLimit) {
        const timeRemaining = Math.ceil((timeLimit - elapsedTime) / (60 * 1000));
        resultDiv.innerHTML = `<p>You've already claimed coupon ${claimData.coupon}. Please wait ${timeRemaining} minutes before claiming another.</p>`;
        resultDiv.className = 'result-container error';
        startCountdown(timeRemaining);
        claimButton.disabled = true;
      } else {
        localStorage.removeItem('lastClaim');
      }
    }
  }
  
  claimButton.addEventListener('click', async function() {
    try {
      claimButton.disabled = true;
      resultDiv.innerHTML = 'Processing your request...';
      resultDiv.className = 'result-container';
      
      const timestamp = new Date().getTime();
      
      const response = await fetch(`/.netlify/functions/coupon?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('lastClaim', JSON.stringify({
          coupon: data.coupon,
          timestamp: new Date().getTime()
        }));
        
        resultDiv.innerHTML = `
          <p>${data.message}</p>
          <div class="coupon-code">${data.coupon}</div>
        `;
        resultDiv.className = 'result-container success';
      } else {
        resultDiv.innerHTML = `<p>${data.message}</p>`;
        resultDiv.className = 'result-container error';
        
        if (data.timeRemaining) {
          localStorage.setItem('lastClaim', JSON.stringify({
            coupon: data.couponClaimed,
            timestamp: new Date().getTime() - ((60 - data.timeRemaining) * 60 * 1000)
          }));
          
          startCountdown(data.timeRemaining);
        } else {
          claimButton.disabled = false;
        }
      }
    } catch (error) {
      resultDiv.innerHTML = 'An error occurred. Please try again later.';
      resultDiv.className = 'result-container error';
      claimButton.disabled = false;
    }
  });
  
  function startCountdown(minutes) {
    clearInterval(countdownInterval);
    
    let totalSeconds = minutes * 60;
    updateTimerDisplay(totalSeconds);
    
    countdownInterval = setInterval(() => {
      totalSeconds--;
      
      if (totalSeconds <= 0) {
        clearInterval(countdownInterval);
        timerDiv.textContent = 'You can claim a new coupon now!';
        claimButton.disabled = false;
        localStorage.removeItem('lastClaim');
      } else {
        updateTimerDisplay(totalSeconds);
      }
    }, 1000);
  }
  
  function updateTimerDisplay(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    timerDiv.textContent = `Time until next coupon: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
});