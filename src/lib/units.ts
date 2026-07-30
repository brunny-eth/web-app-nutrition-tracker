export const KG_PER_LB = 0.45359237;

export const kgToLbs = (kg: number) => kg / KG_PER_LB;
export const lbsToKg = (lbs: number) => lbs * KG_PER_LB;

/** Weight is entered and displayed in lbs but stored in kg. */
export const roundLbs = (kg: number) => Math.round(kgToLbs(kg) * 10) / 10;
