
export const isSaturday = (): boolean => {
  const today = new Date()
  return today.getDay() === 6
}
