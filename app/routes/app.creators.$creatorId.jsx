import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import CreatorForm from "../components/CreatorForm";
import {
  deleteCreator,
  getCreators,
  getCreatorById,
  updateCreator,
} from "../services/creatorsApi";

export const meta = () => {
  return [{ title: "Creator Detail | BluePrintAI" }];
};

function readCreatorDemoId(creator) {
  if (!creator?.notes) return "";

  try {
    return JSON.parse(creator.notes).creator_id || "";
  } catch {
    return "";
  }
}

async function resolveCreator(creatorId) {
  if (/^\d+$/.test(String(creatorId))) {
    return getCreatorById(creatorId);
  }

  const creators = await getCreators();

  return creators.find((candidate) => {
    return (
      String(candidate.id) === String(creatorId) ||
      readCreatorDemoId(candidate) === creatorId ||
      candidate.tiktok_handle === creatorId
    );
  });
}

export default function CreatorDetailRoute() {
  const { creatorId } = useParams();
  const navigate = useNavigate();

  const [creator, setCreator] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCreator() {
    try {
      setLoading(true);

      const data = await resolveCreator(creatorId);

      if (!data) {
        throw new Error("This creator is not available for the current shop.");
      }

      setCreator(data);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load creator");
      setCreator(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(formData) {
    try {
      const updatedCreator = await updateCreator(
        creator?.id || creatorId,
        formData
      );

      setCreator(updatedCreator);
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to update creator");
    }
  }

  async function handleDelete() {
    try {
      await deleteCreator(creator?.id || creatorId);
      navigate("/app/creators");
    } catch (err) {
      setError(err.message || "Failed to delete creator");
    }
  }

  useEffect(() => {
    loadCreator();
  }, [creatorId]);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading creator...</div>;
  }

  if (!creator) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Creator not found
          </h1>

          <p className="mt-3 text-gray-600">
            {error || "This creator is not available for the current shop."}
          </p>

          <button
            type="button"
            onClick={() => navigate("/app/creators")}
            className="mt-5 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white"
          >
            Back to creators
          </button>
        </div>
      </main>
    );
  }

  const engagement =
    Number(creator.total_likes || 0) +
    Number(creator.total_comments || 0) +
    Number(creator.total_shares || 0);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {creator.name}
              </h1>

              <p className="text-gray-500">@{creator.tiktok_handle}</p>

              <p className="mt-3 text-gray-600">
                {creator.notes || "No notes added yet."}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditing((previous) => !previous)}
                className="rounded-xl border border-gray-300 px-4 py-2 font-medium"
              >
                {editing ? "Cancel" : "Edit"}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </section>

        {editing && (
          <CreatorForm
            initialData={creator}
            onSubmit={handleUpdate}
            submitLabel="Update Creator"
          />
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Followers</p>
            <p className="text-2xl font-bold">
              {Number(creator.follower_count || 0).toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Views</p>
            <p className="text-2xl font-bold">
              {Number(creator.total_views || 0).toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Engagement</p>
            <p className="text-2xl font-bold">
              {engagement.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Revenue</p>
            <p className="text-2xl font-bold">
              ${Number(creator.total_revenue || 0).toLocaleString()}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            AI Creator Summary
          </h2>

          <p className="mt-2 text-gray-600">
            {creator.name} has generated{" "}
            {Number(creator.total_views || 0).toLocaleString()} total views,{" "}
            {Number(creator.total_conversions || 0).toLocaleString()}{" "}
            conversions, and $
            {Number(creator.total_revenue || 0).toLocaleString()} in tracked
            revenue. This section can later connect to your AI analysis engine
            to explain why this creator performs well.
          </p>
        </section>
      </div>
    </main>
  );
}