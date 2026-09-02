import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { query } from "../../shared/db";

export async function getSalons(): Promise<APIGatewayProxyResultV2> {
  // Two queries + in-memory grouping instead of a JSON-aggregating join -
  // Data API's Field type doesn't cleanly carry Postgres arrays through our
  // db.ts helper, and salon_services is small enough that fetching it whole
  // is simpler than adding array-parameter/array-result handling for it.
  const [salonRows, serviceRows, productRows] = await Promise.all([
    // Suspended salons (admin panel kill switch) are excluded from the
    // public listing entirely - a suspended salon shouldn't be findable or
    // bookable by clients, even though its owner can still sign in.
    query(
      `SELECT id, name, address, latitude, longitude, description, image_url, reward_multiplier, rating, review_count
       FROM salons
       WHERE is_suspended = false
       ORDER BY name`
    ),
    query(`SELECT id, salon_id, name, price, points_value FROM salon_services ORDER BY created_at`),
    query(`SELECT id, salon_id, name, price, description, image_url FROM salon_products ORDER BY created_at`),
  ]);

  const servicesBySalon = new Map<
    string,
    { id: string; name: string; price: string; pointsValue: number }[]
  >();
  for (const row of serviceRows) {
    const salonId = row.salon_id as string;
    const list = servicesBySalon.get(salonId) ?? [];
    list.push({
      id: row.id as string,
      name: row.name as string,
      price: row.price as string,
      pointsValue: row.points_value as number,
    });
    servicesBySalon.set(salonId, list);
  }

  const productsBySalon = new Map<
    string,
    { id: string; name: string; price: string; description: string | null; imageUrl: string | null }[]
  >();
  for (const row of productRows) {
    const salonId = row.salon_id as string;
    const list = productsBySalon.get(salonId) ?? [];
    list.push({
      id: row.id as string,
      name: row.name as string,
      price: row.price as string,
      description: row.description as string | null,
      imageUrl: row.image_url as string | null,
    });
    productsBySalon.set(salonId, list);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      salonRows.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        description: r.description,
        image: r.image_url,
        rewardMultiplier: r.reward_multiplier,
        rating: r.rating,
        reviewCount: r.review_count,
        services: servicesBySalon.get(r.id as string) ?? [],
        products: productsBySalon.get(r.id as string) ?? [],
      }))
    ),
  };
}
