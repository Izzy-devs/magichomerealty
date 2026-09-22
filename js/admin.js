/**
 * ADMIN LAYER
 * ------------------------------------------------------------------
 * Requires js/data.js to be loaded first (uses the shared `sb` client).
 * All write operations here rely on Row Level Security: they only
 * succeed if the signed-in user has a matching row in public.admins.
 * Signing up alone grants NO privileges — an admin row must be
 * created by a super admin (or via direct SQL) before a new account
 * can read or write anything beyond the public data every visitor
 * already sees.
 * ------------------------------------------------------------------ */

/* ---------------- Auth ---------------- */

async function adminSignIn(email, password) {
  return sb.auth.signInWithPassword({ email, password });
}

async function adminSignOut() {
  return sb.auth.signOut();
}

async function adminGetSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

async function adminGetMyRole() {
  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;
  const { data, error } = await sb.from("admins").select("*").eq("user_id", session.user.id).maybeSingle();
  if (error || !data) return null;
  return data;
}

async function adminListTeam() {
  const { data, error } = await sb.from("admins").select("*, agents(full_name)").order("created_at", { ascending: true });
  if (error) { console.error("adminListTeam", error); return []; }
  return data;
}

/* ---------------- Agents (admin) ---------------- */

async function adminListAgents() {
  const { data, error } = await sb.from("agents").select("*").order("created_at", { ascending: false });
  if (error) { console.error("adminListAgents", error); return []; }
  return data;
}

async function adminCreateAgent(fields) {
  return sb.from("agents").insert([fields]).select().single();
}

async function adminUpdateAgent(id, fields) {
  return sb.from("agents").update(fields).eq("id", id).select().single();
}

async function adminSetAgentStatus(id, status) {
  return sb.from("agents").update({ status }).eq("id", id);
}

async function adminDeleteAgent(id) {
  return sb.from("agents").delete().eq("id", id);
}

/* ---------------- Properties (admin) ---------------- */

async function adminListProperties() {
  const { data, error } = await sb
    .from("properties")
    .select("*, agents(full_name)")
    .order("created_at", { ascending: false });
  if (error) { console.error("adminListProperties", error); return []; }
  return data;
}

async function adminCreateProperty(fields) {
  return sb.from("properties").insert([fields]).select().single();
}

async function adminUpdateProperty(id, fields) {
  return sb.from("properties").update(fields).eq("id", id).select().single();
}

async function adminDeleteProperty(id) {
  return sb.from("properties").delete().eq("id", id);
}

async function adminSetPropertyPublished(id, isPublished) {
  return sb.from("properties").update({ is_published: isPublished }).eq("id", id);
}

async function adminSetPropertyFeatured(id, isFeatured) {
  return sb.from("properties").update({ is_featured: isFeatured }).eq("id", id);
}

async function adminSetPropertyStatus(id, status) {
  return sb.from("properties").update({ status }).eq("id", id);
}

/* ---------------- Inquiries (admin) ---------------- */

async function adminListInquiries() {
  const { data, error } = await sb
    .from("inquiries")
    .select("*, properties(title), agents(full_name)")
    .order("created_at", { ascending: false });
  if (error) { console.error("adminListInquiries", error); return []; }
  return data;
}

async function adminUpdateInquiryStatus(id, status) {
  return sb.from("inquiries").update({ status }).eq("id", id);
}

async function adminAssignInquiryAgent(id, agentId) {
  return sb.from("inquiries").update({ agent_id: agentId }).eq("id", id);
}

/* ---------------- Reviews (admin) ---------------- */

async function adminListReviews() {
  const { data, error } = await sb.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) { console.error("adminListReviews", error); return []; }
  return data;
}

async function adminSetReviewPublished(id, isPublished) {
  return sb.from("reviews").update({ is_published: isPublished }).eq("id", id);
}

async function adminCreateReview(fields) {
  return sb.from("reviews").insert([fields]).select().single();
}

async function adminUpdateReview(id, fields) {
  return sb.from("reviews").update(fields).eq("id", id).select().single();
}

async function adminDeleteReview(id) {
  return sb.from("reviews").delete().eq("id", id);
}

/* ---------- Image upload (Supabase Storage, bucket "media") ---------- */

async function adminUploadImage(file, folder = "uploads") {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) {
    alert("Image upload failed: " + error.message);
    throw error;
  }
  const { data } = sb.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}
