function getDigitCount(number) {
  if (number === 0) return 1;
  return Math.floor(Math.log10(Math.abs(number))) + 1;
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

function compareTimes(time1, time2){
  const [hours1, minutes1] = time1.split(':').map(Number);
  const [hours2, minutes2] = time2.split(':').map(Number);
  if (hours1 < hours2 || (hours1 === hours2 && minutes1 < minutes2)) {
    return -1; 
  }
  if (hours1 > hours2 || (hours1 === hours2 && minutes1 > minutes2)) {
    return 1;
  }
  return 0;
}

module.exports = { getDigitCount, isValidDate, compareTimes };