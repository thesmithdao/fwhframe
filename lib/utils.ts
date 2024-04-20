export function checkInteractionTime(lastInteractionTime: string) {
  const lastInteractionDate = new Date(lastInteractionTime);
  const currentDate = new Date();
  const diff = currentDate.getTime() - lastInteractionDate.getTime();
  const diffHours = diff / (1000 * 60 * 60);
  const has24HoursPassed = diffHours >= 24;
  const timeUntil24HoursInMilliseconds = has24HoursPassed ? 0 : (24 * 60 * 60 * 1000) - diff;

  let seconds = Math.floor(timeUntil24HoursInMilliseconds / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);

  seconds = seconds % 60;
  minutes = minutes % 60;

  const formattedTime = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');

  return {
    has24HoursPassed,
    formattedTime: formattedTime,
  };
}