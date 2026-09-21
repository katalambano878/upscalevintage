'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiData } from '@/lib/client/api';
import {
  PERMISSIONS,
  PRESETS,
  cleanStaffPermissions,
  presetFor,
  type StorePermission,
} from '@/lib/permissions';

type StaffPerson = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'admin' | 'staff';
  permissions: unknown;
  disabled_at: string | null;
  last_login_at: string | null;
  signed_in?: boolean;
};

function formatWhen(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Accra',
  });
}

function accessLabel(person: StaffPerson) {
  if (person.role === 'admin') return 'Admin · full access';
  const saved = cleanStaffPermissions(person.permissions);
  if (saved.length === 0) return 'Full store access, not limited yet';
  return presetFor(saved)?.label || 'Custom access';
}

export default function StaffPage() {
  const [people, setPeople] = useState<StaffPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [presetId, setPresetId] = useState('cashier');
  const [custom, setCustom] = useState<StorePermission[]>(PRESETS[0].permissions);
  const [editing, setEditing] = useState<StaffPerson | null>(null);
  const [editPermissions, setEditPermissions] = useState<StorePermission[]>([]);
  const [editPassword, setEditPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiData<StaffPerson[]>('/api/admin/staff');
      setPeople(Array.isArray(rows) ? rows : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chosenPermissions = presetId === 'custom' ? custom : PRESETS.find((preset) => preset.id === presetId)?.permissions || custom;

  const grouped = useMemo(() => {
    const groups = new Map<string, (typeof PERMISSIONS)[number][]>();
    for (const item of PERMISSIONS) {
      const list = groups.get(item.group) || [];
      groups.set(item.group, [...list, item]);
    }
    return [...groups.entries()];
  }, []);

  const toggleCustom = (key: StorePermission, selected: StorePermission[], setSelected: (next: StorePermission[]) => void) => {
    setSelected(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  };

  const addStaff = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiData('/api/admin/staff', {
        method: 'POST',
        json: {
          full_name: fullName,
          email,
          phone,
          password,
          permissions: chosenPermissions,
        },
      });
      setNotice(`${fullName.trim() || email} can now sign in with the password you set.`);
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setPresetId('cashier');
      setCustom(PRESETS[0].permissions);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add staff');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (person: StaffPerson) => {
    setEditing(person);
    setEditPassword('');
    setEditPermissions(cleanStaffPermissions(person.permissions));
    setNotice(null);
  };

  const saveEdit = async (extra?: { disabled?: boolean }) => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await apiData(`/api/admin/staff/${editing.id}`, {
        method: 'PATCH',
        json: {
          full_name: editing.full_name,
          phone: editing.phone,
          permissions: editing.role === 'staff' ? editPermissions : undefined,
          password: editPassword || undefined,
          disabled: extra?.disabled,
        },
      });
      setEditing(null);
      setNotice('Staff account updated.');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update staff');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Staff</h1>
        <p className="mt-1 text-gray-600">
          Add people who work in the shop, choose what they can open, and see when they are signed in.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900">People with admin access</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Person</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Access</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Last sign-in</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Now</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">Loading staff…</td>
                </tr>
              ) : people.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No staff accounts yet.</td>
                </tr>
              ) : (
                people.map((person) => (
                  <tr key={person.id} className="border-b border-gray-100">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{person.full_name || person.email}</p>
                      <p className="text-sm text-gray-500">{person.email}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {accessLabel(person)}
                      {person.disabled_at && <span className="mt-1 block text-xs font-semibold text-red-600">Disabled</span>}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">{formatWhen(person.last_login_at)}</td>
                    <td className="px-4 py-4 text-sm">
                      {person.signed_in && !person.disabled_at ? (
                        <span className="font-semibold text-emerald-700">Signed in</span>
                      ) : (
                        <span className="text-gray-400">Away</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(person)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          addStaff();
        }}
      >
        <h2 className="text-lg font-bold text-gray-900">Add staff</h2>
        <p className="mt-1 text-sm text-gray-600">They sign in on the same admin page with this email and password.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-900">Name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-900">Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-900">Phone</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-900">Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" className="w-full rounded-lg border-2 border-gray-300 px-4 py-3" />
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-gray-900">Role</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {PRESETS.map((preset) => (
              <label key={preset.id} className={`rounded-lg border p-3 ${presetId === preset.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                <span className="flex items-center gap-2 font-semibold text-gray-900">
                  <input type="radio" name="preset" checked={presetId === preset.id} onChange={() => setPresetId(preset.id)} />
                  {preset.label}
                </span>
                <span className="mt-1 block pl-6 text-sm text-gray-600">{preset.description}</span>
              </label>
            ))}
            <label className={`rounded-lg border p-3 ${presetId === 'custom' ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
              <span className="flex items-center gap-2 font-semibold text-gray-900">
                <input type="radio" name="preset" checked={presetId === 'custom'} onChange={() => setPresetId('custom')} />
                Custom
              </span>
              <span className="mt-1 block pl-6 text-sm text-gray-600">Pick the tools one by one.</span>
            </label>
          </div>
        </fieldset>
        {presetId === 'custom' && (
          <div className="mt-4 space-y-4">
            {grouped.map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 text-sm font-semibold text-gray-900">{group}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={custom.includes(item.key)}
                        onChange={() => toggleCustom(item.key, custom, setCustom)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="submit" disabled={saving} className="mt-5 rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Add staff'}
        </button>
      </form>

      {editing && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{editing.full_name || editing.email}</h2>
              <p className="text-sm text-gray-500">{editing.email}</p>
            </div>
            <button type="button" onClick={() => setEditing(null)} className="text-sm font-semibold text-gray-600">
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Name</span>
              <input
                value={editing.full_name || ''}
                onChange={(event) => setEditing({ ...editing, full_name: event.target.value })}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-900">New password</span>
              <input
                type="password"
                value={editPassword}
                onChange={(event) => setEditPassword(event.target.value)}
                placeholder="Leave blank to keep the current password"
                autoComplete="new-password"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3"
              />
            </label>
          </div>
          {editing.role === 'staff' ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-600">
                Current access: {editPermissions.length ? accessLabel({ ...editing, permissions: editPermissions }) : 'Choose at least one tool.'}
              </p>
              {grouped.map(([group, items]) => (
                <div key={group}>
                  <p className="mb-2 text-sm font-semibold text-gray-900">{group}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={editPermissions.includes(item.key)}
                          onChange={() => toggleCustom(item.key, editPermissions, setEditPermissions)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-600">This is an admin account, so it keeps full access.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => saveEdit()} disabled={saving} className="rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => saveEdit({ disabled: !editing.disabled_at })}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-800 disabled:opacity-60"
            >
              {editing.disabled_at ? 'Enable account' : 'Disable account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
