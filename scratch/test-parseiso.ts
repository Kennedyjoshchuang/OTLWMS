import { startOfDay, endOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

function main() {
  const startParam = "2026-07-13";
  const endParam = "2026-07-13";
  const TIME_ZONE = "Asia/Makassar";

  console.log("=== Method 3 (UTC Parse + Zoned) ===");
  // Parse YYYY-MM-DD as UTC first, then zone it, then get start/end of day
  const rawStart = new Date(startParam + "T00:00:00Z");
  const rawEnd = new Date(endParam + "T12:00:00Z"); // middle of day to be safe from zone shifts
  
  const tzStartDate3 = startOfDay(toZonedTime(rawStart, TIME_ZONE));
  const tzEndDate3 = endOfDay(toZonedTime(rawEnd, TIME_ZONE));
  
  console.log("tzStartDate3 local representation:", tzStartDate3.toLocaleString());
  console.log("tzEndDate3 local representation:", tzEndDate3.toLocaleString());
  
  const prismaStartDate3 = fromZonedTime(tzStartDate3, TIME_ZONE);
  const prismaEndDate3 = fromZonedTime(tzEndDate3, TIME_ZONE);
  console.log("prismaStartDate3:", prismaStartDate3.toISOString());
  console.log("prismaEndDate3:", prismaEndDate3.toISOString());
}

main();
