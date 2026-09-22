const phpApi = process.env.PHP_API_URL ?? "http://localhost:8000";

// Dashboard data comes exclusively from the PHP/MySQL service.
export async function dashboardData(): Promise<any> {
  const response = await fetch(`${phpApi}/dashboard.php`, { cache: "no-store" });
  if (!response.ok) throw new Error("The PHP attendance API is unavailable.");
  return response.json();
}
