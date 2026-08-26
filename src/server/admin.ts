import "server-only";
import { sql } from "@/lib/db";

export async function getAdminStats() {
  const [row] = await sql<
    {
      apis: string;
      published: string;
      users: string;
      admins: string;
      active_subs: string;
      pending_subs: string;
      mrr: string;
      revenue: string;
      calls_30d: string;
      payments: string;
    }[]
  >`
    SELECT
      (SELECT COUNT(*) FROM apis)::text                                     AS apis,
      (SELECT COUNT(*) FROM apis WHERE published)::text                     AS published,
      (SELECT COUNT(*) FROM users)::text                                    AS users,
      (SELECT COUNT(*) FROM users WHERE role = 'admin')::text               AS admins,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active')::text    AS active_subs,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'pending')::text   AS pending_subs,
      (SELECT COALESCE(SUM(p.price * s.units), 0) FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.status = 'active')::text                                   AS mrr,
      (SELECT COALESCE(SUM(amount), 0) FROM payments
         WHERE status = 'success')::text                                    AS revenue,
      (SELECT COUNT(*) FROM usage_events
         WHERE created_at >= now() - interval '30 days')::text              AS calls_30d,
      (SELECT COUNT(*) FROM payments WHERE status = 'success')::text        AS payments
  `;

  return {
    apis: Number(row.apis),
    published: Number(row.published),
    users: Number(row.users),
    admins: Number(row.admins),
    activeSubs: Number(row.active_subs),
    pendingSubs: Number(row.pending_subs),
    mrr: Number(row.mrr),
    revenue: Number(row.revenue),
    calls30d: Number(row.calls_30d),
    payments: Number(row.payments),
  };
}

export async function listApisForAdmin() {
  return sql<
    {
      id: string;
      slug: string;
      name: string;
      provider: string;
      logo: string;
      color: string;
      category: string | null;
      published: boolean;
      featured: boolean;
      plan_count: string;
      subscriber_count: string;
      updated_at: Date;
    }[]
  >`
    SELECT a.id, a.slug, a.name, a.provider, a.logo, a.color,
           c.name AS category, a.published, a.featured, a.updated_at,
           (SELECT COUNT(*) FROM plans p WHERE p.api_id = a.id)::text AS plan_count,
           (SELECT COUNT(*) FROM subscriptions s WHERE s.api_id = a.id AND s.status = 'active')::text
             AS subscriber_count
    FROM apis a
    LEFT JOIN categories c ON c.id = a.category_id
    ORDER BY a.updated_at DESC
  `;
}

export async function listCategoriesForAdmin() {
  return sql<
    { id: string; slug: string; name: string; blurb: string; icon: string; sort_order: number; api_count: string }[]
  >`
    SELECT c.id, c.slug, c.name, c.blurb, c.icon, c.sort_order,
           (SELECT COUNT(*) FROM apis a WHERE a.category_id = c.id)::text AS api_count
    FROM categories c
    ORDER BY c.sort_order, c.name
  `;
}

export async function listUsers() {
  return sql<
    { id: string; email: string; name: string; role: string; created_at: Date; subs: string; calls: string }[]
  >`
    SELECT u.id, u.email, u.name, u.role, u.created_at,
           (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active')::text AS subs,
           (SELECT COUNT(*) FROM usage_events e WHERE e.user_id = u.id)::text AS calls
    FROM users u
    ORDER BY u.created_at DESC
    LIMIT 200
  `;
}

export async function listSubscriptions() {
  return sql<
    {
      id: string;
      email: string;
      api_name: string;
      plan_name: string;
      price: string;
      unit: string | null;
      units: number;
      status: string;
      quota: number;
      used: number;
      current_period_end: Date | null;
      created_at: Date;
    }[]
  >`
    SELECT s.id, u.email, a.name AS api_name, p.name AS plan_name, p.price, p.unit,
           s.units, s.status, s.quota, s.used, s.current_period_end, s.created_at
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    JOIN apis  a ON a.id = s.api_id
    JOIN plans p ON p.id = s.plan_id
    ORDER BY s.created_at DESC
    LIMIT 200
  `;
}

export async function listPayments() {
  return sql<
    {
      id: string;
      reference: string;
      amount: string;
      currency: string;
      status: string;
      channel: string | null;
      email: string | null;
      api_name: string | null;
      created_at: Date;
      paid_at: Date | null;
    }[]
  >`
    SELECT pay.id, pay.reference, pay.amount, pay.currency, pay.status, pay.channel,
           u.email, a.name AS api_name, pay.created_at, pay.paid_at
    FROM payments pay
    LEFT JOIN users u ON u.id = pay.user_id
    LEFT JOIN subscriptions s ON s.id = pay.subscription_id
    LEFT JOIN apis a ON a.id = s.api_id
    ORDER BY pay.created_at DESC
    LIMIT 200
  `;
}

export async function getTopApisByUsage(limit = 6) {
  return sql<{ name: string; color: string; calls: string }[]>`
    SELECT a.name, a.color, COUNT(e.id)::text AS calls
    FROM apis a
    LEFT JOIN usage_events e
      ON e.api_id = a.id AND e.created_at >= now() - interval '30 days'
    GROUP BY a.id, a.name, a.color
    ORDER BY COUNT(e.id) DESC, a.name
    LIMIT ${limit}
  `;
}
