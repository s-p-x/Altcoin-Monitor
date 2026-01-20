/**
 * Monitor Alert Settings Panel
 * Toggle for new coin alerts + cooldown settings + filter summary
 */

import React, { useState, useEffect } from "react";
import { Bell, ChevronDown, AlertCircle } from "lucide-react";
import { MonitorAlertSettings, FilterSignatureInput } from "@/lib/types";

interface MonitorAlertSettingsPanelProps {
  filters: FilterSignatureInput;
  onSettingsChange?: (settings: Partial<MonitorAlertSettings>) => void;
  loading?: boolean;
}

const COOLDOWN_OPTIONS = [
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
];

export const MonitorAlertSettingsPanel: React.FC<
  MonitorAlertSettingsPanelProps
> = ({ filters, onSettingsChange, loading = false }) => {
  const [settings, setSettings] = useState<MonitorAlertSettings | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings on mount and when filters change
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const params = new URLSearchParams({
          minMarketCap: filters.min_market_cap.toString(),
          maxMarketCap: filters.max_market_cap.toString(),
          minVolume: filters.min_volume_24h.toString(),
          minVolMcapPct: filters.min_vol_mcap_pct.toString(),
        });

        const res = await fetch(`/api/alerts/monitor?${params}`, {
          headers: {
            "x-user-id": "demo_user",
          },
        });
        if (!res.ok) throw new Error("Failed to fetch settings");

        const data = await res.json();
        setSettings(data.settings);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch monitor alert settings:", err);
        setError(err.message);
      }
    };

    fetchSettings();
  }, [filters]);

  const handleToggleAlert = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/alerts/monitor", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "demo_user",
        },
        body: JSON.stringify({
          filters,
          enabled: !settings.enabled,
          cooldown_seconds: settings.cooldown_seconds,
        }),
      });

      if (!res.ok) throw new Error("Failed to update settings");

      const data = await res.json();
      setSettings(data.settings);
      onSettingsChange?.(data.settings);
      setError(null);
    } catch (err: any) {
      console.error("Failed to update settings:", err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCooldownChange = async (cooldownSeconds: number) => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/alerts/monitor", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "demo_user",
        },
        body: JSON.stringify({
          filters,
          enabled: settings.enabled,
          cooldown_seconds: cooldownSeconds,
        }),
      });

      if (!res.ok) throw new Error("Failed to update settings");

      const data = await res.json();
      setSettings(data.settings);
      onSettingsChange?.(data.settings);
      setError(null);
    } catch (err: any) {
      console.error("Failed to update cooldown:", err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-4 bg-[var(--bg)] rounded-md border border-[var(--border)] text-[var(--text-faint)] animate-pulse">
        Loading alert settings...
      </div>
    );
  }

  const activeCooldown = COOLDOWN_OPTIONS.find(
    (opt) => opt.value === settings.cooldown_seconds
  );

  return (
    <div className="p-4 bg-[var(--bg)] rounded-md border border-[var(--border)]">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Bell
            className={`w-5 h-5 ${
              settings.enabled
                ? "text-[var(--accent)]"
                : "text-[var(--text-faint)]"
            }`}
          />
          <span className="font-medium text-[var(--text)]">
            Monitor Alerts (New Coins)
          </span>
          {settings.enabled && (
            <span className="px-2 py-1 text-xs bg-[var(--accent)] bg-opacity-20 text-[var(--accent)] rounded-full">
              Enabled
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4 pt-4 border-t border-[var(--border)]">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="monitor-alert-enabled"
              checked={settings.enabled}
              onChange={handleToggleAlert}
              disabled={isSaving}
              className="w-4 h-4 rounded cursor-pointer"
            />
            <label
              htmlFor="monitor-alert-enabled"
              className="flex-1 text-sm font-medium text-[var(--text)] cursor-pointer"
            >
              Alert when new coins appear under current filters
            </label>
          </div>

          {/* Cooldown Selector */}
          {settings.enabled && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Cooldown (prevent duplicate alerts)
              </label>
              <select
                value={settings.cooldown_seconds}
                onChange={(e) =>
                  handleCooldownChange(parseInt(e.target.value, 10))
                }
                disabled={isSaving}
                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] rounded-md text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                {COOLDOWN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Current Filter Summary */}
          <div className="p-3 bg-[var(--panel)] border border-[var(--border)] rounded-md">
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">
              Current Filter State
            </p>
            <div className="text-xs text-[var(--text-faint)] space-y-1">
              <div>
                <span className="font-medium text-[var(--text-muted)]">
                  Min Market Cap:
                </span>{" "}
                ${(filters.min_market_cap / 1e6).toFixed(1)}M
              </div>
              <div>
                <span className="font-medium text-[var(--text-muted)]">
                  Max Market Cap:
                </span>{" "}
                ${(filters.max_market_cap / 1e9).toFixed(2)}B
              </div>
              <div>
                <span className="font-medium text-[var(--text-muted)]">
                  Min Volume (24h):
                </span>{" "}
                ${(filters.min_volume_24h / 1e6).toFixed(1)}M
              </div>
              <div>
                <span className="font-medium text-[var(--text-muted)]">
                  Min Vol/MCap %:
                </span>{" "}
                {filters.min_vol_mcap_pct.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Info Message */}
          <div className="p-3 bg-[var(--accent)] bg-opacity-10 border border-[var(--accent)] border-opacity-30 rounded-md flex gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--text-muted)]">
              Alerts only trigger when a coin ENTERS this filtered list for the
              first time (under these exact filter settings).
            </p>
          </div>

          {/* Delivery Options */}
          {settings.enabled && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Delivery
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled
                    className="w-4 h-4 rounded cursor-not-allowed"
                  />
                  <span className="text-[var(--text)]">In-App (always on)</span>
                </label>
                <label className="flex items-center gap-2 text-sm opacity-50 cursor-not-allowed">
                  <input
                    type="checkbox"
                    disabled
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--text-muted)]">
                    Telegram (coming soon)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2 bg-[var(--semantic-red)] bg-opacity-10 border border-[var(--semantic-red)] border-opacity-30 rounded-md flex gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--semantic-red)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--semantic-red)]">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isSaving && (
            <p className="text-xs text-[var(--text-faint)] text-center">
              Saving...
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MonitorAlertSettingsPanel;
