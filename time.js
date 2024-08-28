import dayjs from 'dayjs';

// a. 60min以内以min展示：1min、59min
// b. 24h内以h展示：1h、23h
// c. 7天内以d展示：1d、7d
// d. 7天以上展示：13/08
// e. 非今年展示：10/02/2023
export function timeFromNow(time) {
  const before = dayjs.unix(time);
  const now = dayjs();
  const dur = now.diff(before, 'm')
  const thisYear = now.year();
  const beforeYear = before.year();
  const oneHour = 60;
  const oneDay = oneHour * 24;
  const aWeek = oneDay * 7;
  if(dur < oneHour) {
    return `${Math.max(dur, 1)} min`
  } else if(dur < oneDay) {
    return `${now.diff(before, 'h')} h`
  } else if(dur < aWeek) {
    return `${now.diff(before, 'd')} d`
  } else if(thisYear === beforeYear) {
    return before.format('DD/MM')
  } else {
    return before.format('DD/MM/YYYY')
  }
}

console.log(timeFromNow(1654739200)) // 2022-06-09
