import { useState } from "react";

const EMPTY_FORM = {
  name: "",
  tiktok_handle: "",
  profile_image: "",
  follower_count: 0,
  category: "",
  notes: "",
  total_videos: 0,
  total_views: 0,
  total_likes: 0,
  total_comments: 0,
  total_shares: 0,
  total_conversions: 0,
  total_revenue: 0,
};

function normalizeInitialData(initialData = {}) {
  return {
    ...EMPTY_FORM,
    ...initialData,
    tiktok_handle: initialData.tiktok_handle || initialData.handle || "",
    follower_count: initialData.follower_count || initialData.followers || 0,
  };
}

export default function CreatorForm({
  onSubmit,
  onCancel,
  initialData,
  initialCreator,
  submitLabel = "Save Creator",
}) {
  const [formData, setFormData] = useState(() =>
    normalizeInitialData(initialData || initialCreator || {})
  );

  function handleChange(event) {
    const { name, value, type } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "number" ? Number(value) : value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.(formData);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Creator name"
          className="rounded-xl border border-gray-300 px-4 py-2"
          required
        />

        <input
          name="tiktok_handle"
          value={formData.tiktok_handle}
          onChange={handleChange}
          placeholder="TikTok handle"
          className="rounded-xl border border-gray-300 px-4 py-2"
          required
        />

        <input
          name="profile_image"
          value={formData.profile_image}
          onChange={handleChange}
          placeholder="Profile image URL"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          name="category"
          value={formData.category}
          onChange={handleChange}
          placeholder="Creator category"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          type="number"
          name="follower_count"
          value={formData.follower_count}
          onChange={handleChange}
          placeholder="Follower count"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          type="number"
          name="total_videos"
          value={formData.total_videos}
          onChange={handleChange}
          placeholder="Total videos"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          type="number"
          name="total_views"
          value={formData.total_views}
          onChange={handleChange}
          placeholder="Total views"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          type="number"
          name="total_likes"
          value={formData.total_likes}
          onChange={handleChange}
          placeholder="Total likes"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          type="number"
          name="total_comments"
          value={formData.total_comments}
          onChange={handleChange}
          placeholder="Total comments"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          type="number"
          name="total_shares"
          value={formData.total_shares}
          onChange={handleChange}
          placeholder="Total shares"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          type="number"
          name="total_conversions"
          value={formData.total_conversions}
          onChange={handleChange}
          placeholder="Total conversions"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />

        <input
          type="number"
          name="total_revenue"
          value={formData.total_revenue}
          onChange={handleChange}
          placeholder="Total revenue"
          className="rounded-xl border border-gray-300 px-4 py-2"
        />
      </div>

      <textarea
        name="notes"
        value={formData.notes}
        onChange={handleChange}
        placeholder="Creator notes"
        className="mt-4 min-h-24 w-full rounded-xl border border-gray-300 px-4 py-2"
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-xl bg-black px-5 py-2 font-medium text-white hover:bg-gray-800"
        >
          {submitLabel}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-300 px-5 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
