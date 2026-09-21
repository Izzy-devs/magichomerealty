/**
 * SUPABASE DATA LAYER
 * ------------------------------------------------------------------
 * Live connection to the Magic Home Realty Supabase project.
 * Public pages (home, properties, property, agents) read through
 * loadProperties() / loadAgents() / loadReviews() below — RLS only
 * exposes Active agents, published properties, and published reviews
 * to anonymous visitors. Inquiry forms insert directly (also allowed
 * by RLS for anon). Everything else (create/update/delete, agent
 * management, inquiry status) requires an authenticated admin
 * session — see js/admin.js.
 * ------------------------------------------------------------------
 */

const SUPABASE_URL = "https://jptosmrtdqzxcasflpqk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdG9zbXJ0ZHF6eGNhc2ZscHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODQ2NTUsImV4cCI6MjEwNTU2MDY1NX0.5oUyaXyKF5im7w6EfwYsULTa72Q4E7WtHoDQy9ru2Cc";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ------------------------------------------------------------------
 * Row -> front-end shape mappers
 * ------------------------------------------------------------------ */

function mapProperty(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.property_type,
    status: row.status,
    price: row.price,
    address: row.address,
    beds: row.bedrooms,
    baths: row.bathrooms,
    sqft: row.square_feet,
    image: row.featured_image,
    gallery: row.images || [],
    description: row.description,
    features: row.features || [],
    dateListed: row.created_at,
    isFeatured: row.is_featured,
    isDemo: row.is_demo,
    agentId: row.agent_id,
    agentName: row.agents ? row.agents.full_name : null,
  };
}

function mapAgent(row) {
  return {
    id: row.id,
    name: row.full_name,
    role: row.title,
    credentials: row.certifications || "",
    areas: row.areas_served,
    bio: row.bio,
    photo: row.photo_url,
    phone: row.phone,
    email: row.email,
    licenseNumber: row.license_number,
    languages: row.languages || [],
    specialties: row.specialties || [],
    isFeatured: row.is_featured,
    status: row.status,
  };
}

function mapReview(row) {
  return {
    id: row.id,
    name: row.reviewer_name,
    date: row.review_date || "Replace with verified date",
    rating: row.rating,
    quote: row.quote,
  };
}

/* ------------------------------------------------------------------
 * Public read functions (used by all public-facing pages)
 * ------------------------------------------------------------------ */

async function loadProperties() {
  const { data, error } = await sb
    .from("properties")
    .select("*, agents(full_name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) { console.error("loadProperties error", error); return []; }
  return data.map(mapProperty);
}

async function loadFeaturedProperties(limit = 3) {
  const { data, error } = await sb
    .from("properties")
    .select("*, agents(full_name)")
    .eq("is_published", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("loadFeaturedProperties error", error); return []; }
  return data.map(mapProperty);
}

async function loadPropertyById(id) {
  const { data, error } = await sb
    .from("properties")
    .select("*, agents(full_name, id)")
    .eq("id", id)
    .single();
  if (error) { console.error("loadPropertyById error", error); return null; }
  return mapProperty(data);
}

async function loadAgents() {
  const { data, error } = await sb
    .from("agents")
    .select("*")
    .eq("status", "Active")
    .order("is_featured", { ascending: false })
    .order("full_name", { ascending: true });
  if (error) { console.error("loadAgents error", error); return []; }
  return data.map(mapAgent);
}

async function loadAgentById(id) {
  const { data, error } = await sb.from("agents").select("*").eq("id", id).single();
  if (error) { console.error("loadAgentById error", error); return null; }
  return mapAgent(data);
}

async function loadPropertiesByAgent(agentId) {
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .eq("agent_id", agentId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) { console.error("loadPropertiesByAgent error", error); return []; }
  return data.map(mapProperty);
}

async function loadReviews() {
  const { data, error } = await sb
    .from("reviews")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) { console.error("loadReviews error", error); return []; }
  return data.map(mapReview);
}

/* ------------------------------------------------------------------
 * Client-side filter/sort (operates on already-fetched rows)
 * ------------------------------------------------------------------ */

function filterProperties(list, filters) {
  return list.filter((p) => {
    if (filters.location && !p.address.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.type && filters.type !== "Any" && p.type !== filters.type) return false;
    if (filters.status && filters.status !== "Any" && p.status !== filters.status) return false;
    if (filters.minPrice && p.price < Number(filters.minPrice)) return false;
    if (filters.maxPrice && p.price > Number(filters.maxPrice)) return false;
    if (filters.beds && p.beds < Number(filters.beds)) return false;
    if (filters.baths && p.baths < Number(filters.baths)) return false;
    return true;
  });
}

function sortProperties(list, sortKey) {
  const copy = [...list];
  switch (sortKey) {
    case "price-asc": return copy.sort((a, b) => a.price - b.price);
    case "price-desc": return copy.sort((a, b) => b.price - a.price);
    case "newest":
    default:
      return copy.sort((a, b) => new Date(b.dateListed) - new Date(a.dateListed));
  }
}

/* ------------------------------------------------------------------
 * Public write: inquiry submission (allowed for anon by RLS)
 * ------------------------------------------------------------------ */

async function submitInquiry(payload) {
  const { error } = await sb.from("inquiries").insert([{
    name: payload.name || null,
    email: payload.email || null,
    phone: payload.phone || null,
    inquiry_type: payload.interest || payload.inquiryType || null,
    message: payload.message || null,
    property_id: payload.propertyId || null,
    source_page: payload.sourcePage || null,
  }]);
  if (error) { console.error("submitInquiry error", error); return { success: false, error }; }
  return { success: true };
}

function formatPrice(n) {
  if (n === null || n === undefined) return "Price on request";
  return "$" + Number(n).toLocaleString("en-US");
}
