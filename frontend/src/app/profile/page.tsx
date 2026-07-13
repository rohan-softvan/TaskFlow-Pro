'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { profileApi, type ProfileRecord } from '@/lib/api';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');
  const [avatarVersion, setAvatarVersion] = useState(0);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    profileApi
      .getMe()
      .then((p) => {
        setProfile(p);
        setFullName(p.fullName ?? '');
        setDepartment(p.department ?? '');
        setBio(p.bio ?? '');
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load profile'),
      );
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const updated = await profileApi.update({ fullName, department, bio });
      setProfile(updated);
      setSuccess('Profile saved');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');

    if (file.size > MAX_AVATAR_BYTES) {
      setError('Avatar exceeds the 2MB size limit');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const updated = await profileApi.uploadAvatar(file);
      setProfile(updated);
      // Force header + preview to re-fetch the new image immediately (US-UM-04).
      setAvatarVersion((v) => v + 1);
      setSuccess('Avatar updated');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-2xl p-8">
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <Avatar fullName={fullName || user.email} size={64} version={avatarVersion} />
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Change photo'}
              </button>
              <p className="mt-1 text-xs text-gray-400">
                JPEG, PNG or WebP, ≤2MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                maxLength={120}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="department" className="mb-1 block text-sm font-medium text-gray-700">
                Department
              </label>
              <input
                id="department"
                type="text"
                value={department}
                maxLength={80}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label htmlFor="bio" className="mb-1 block text-sm font-medium text-gray-700">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                maxLength={2000}
                rows={3}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <p className="text-sm text-gray-500">
                {profile?.email ?? user.email}{' '}
                <span className="text-xs text-gray-400">(read-only)</span>
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>

          <div className="mt-8 border-t border-gray-100 pt-6">
            <h2 className="text-sm font-semibold text-gray-800">Security</h2>
            <Link
              href="/change-password"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              Change password →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
