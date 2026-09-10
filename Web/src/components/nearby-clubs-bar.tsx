"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Badge, Button, Card, Dialog, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui";
import {
  MapPin,
  ChevronLeft,
  ChevronRight,
  ShuttlecockIcon,
  Users,
  Compass,
  ArrowRight,
  Check,
  Building2,
  Sparkles
} from "@/components/icons";

export interface NearbyClubItem {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  logoUrl: string | null;
  description: string | null;
  subscriptionPlan: string;
  sport: string;
  courtCount: number;
  memberCount: number;
  distanceKm: number | null;
  membership?: { id: string; status: string; role: string } | null;
}

export function NearbyClubsBar() {
  const { me, activeClubId, setActiveClubId, activeMembership, refresh: refreshSession } = useSession();
  const [clubs, setClubs] = useState<NearbyClubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string>("Detecting location…");
  const [selectedClub, setSelectedClub] = useState<NearbyClubItem | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast, node: toastNode } = useToast();

  // Load nearby clubs based on coordinates or fallback city
  async function loadClubs(coords?: { lat: number; lng: number } | null) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (coords?.lat != null && coords?.lng != null) {
        params.set("lat", coords.lat.toString());
        params.set("lng", coords.lng.toString());
      } else if (activeMembership?.club.city) {
        params.set("city", activeMembership.club.city);
      }

      const qs = params.toString();
      const data = await api<NearbyClubItem[]>(`/clubs${qs ? `?${qs}` : ""}`);
      setClubs(data);
    } catch (err) {
      console.error("Failed to load nearby clubs:", err);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    // Try to get default location from active club if available
    const activeCity = activeMembership?.club.city;
    if (activeCity) {
      setLocationLabel(`Near ${activeCity}`);
    } else {
      setLocationLabel("Near you");
    }
    void loadClubs(null);
  }, [activeMembership]);

  // Handle GPS detection
  function detectGPS() {
    if (!navigator.geolocation) {
      toast("Geolocation is not supported by your browser.", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setLocationLabel(`GPS (${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°)`);
        setLocating(false);
        void loadClubs(coords);
        toast("Updated nearby clubs using live GPS location!");
      },
      (err) => {
        setLocating(false);
        toast("Unable to retrieve GPS position. Showing clubs near your city.", "error");
        void loadClubs(null);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  // Scroll helpers
  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -320 : 320;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  }

  // Handle Switch
  function handleSwitch(clubId: string, clubName: string) {
    setActiveClubId(clubId);
    toast(`Switched to ${clubName}!`);
  }

  // Handle Request to Join
  async function handleJoin(clubId: string, clubName: string) {
    setJoiningId(clubId);
    try {
      await api(`/clubs/${clubId}/join`, { method: "POST" });
      toast(`Join request sent to ${clubName}! Pending owner approval.`);
      // Optimistically update club membership in list
      setClubs((prev) =>
        prev.map((c) =>
          c.id === clubId
            ? { ...c, membership: { id: "temp", status: "PENDING", role: "PLAYER" } }
            : c
        )
      );
      if (selectedClub?.id === clubId) {
        setSelectedClub((prev) =>
          prev ? { ...prev, membership: { id: "temp", status: "PENDING", role: "PLAYER" } } : null
        );
      }
      void refreshSession();
    } catch (err: any) {
      toast(err?.message || "Failed to send join request.", "error");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <section className="relative rounded-2xl border bg-gradient-to-br from-card via-card to-muted/20 p-5 shadow-sm">
      {toastNode}

      {/* Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold sm:text-lg">Nearby Badminton Clubs</h2>
              <Badge tone="accent" className="hidden sm:inline-flex text-[11px]">
                {locationLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Courts, active communities, and open match sessions in your vicinity
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={detectGPS}
            disabled={locating}
            className="text-xs"
            title="Update using live GPS location"
          >
            {locating ? <Spinner className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5 text-primary" />}
            <span className="hidden md:inline">{locating ? "Locating…" : "Use Live GPS"}</span>
          </Button>

          <div className="flex items-center gap-1 border-l pl-2">
            <button
              onClick={() => scroll("left")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Link
            href="/clubs/discover"
            className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-primary transition hover:underline"
          >
            All clubs <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      {loading ? (
        <div className="flex gap-4 overflow-hidden py-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 w-[280px] shrink-0 animate-pulse rounded-xl border bg-muted/40 p-4 sm:w-[300px]"
            />
          ))}
        </div>
      ) : clubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center text-muted-foreground">
          <Building2 className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">No clubs found in this immediate area.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try discovering clubs across other cities or create your own club.
          </p>
          <Link href="/clubs/discover" className="mt-3">
            <Button size="sm" variant="outline">
              Explore All Clubs
            </Button>
          </Link>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-1"
          style={{ scrollbarWidth: "none" }}
        >
          {clubs.map((c) => {
            const isActive = c.id === activeClubId;
            const isMember = c.membership?.status === "ACTIVE";
            const isPending = c.membership?.status === "PENDING";

            return (
              <div
                key={c.id}
                className={`group relative flex w-[280px] shrink-0 snap-start flex-col justify-between rounded-xl border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:w-[310px] ${
                  isActive ? "ring-2 ring-primary/60 border-primary/40 bg-primary/[0.02]" : ""
                }`}
              >
                <div>
                  {/* Top Row: Distance & Tier */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                      <MapPin className="h-3 w-3 text-primary" />
                      {c.distanceKm !== null ? (
                        <span>{c.distanceKm === 0 ? "At this location" : `${c.distanceKm} km away`}</span>
                      ) : (
                        <span>{c.city || "Nearby"}</span>
                      )}
                    </div>
                    <Badge tone={c.subscriptionPlan === "PREMIUM" ? "warning" : "accent"} className="text-[10px] uppercase tracking-wider">
                      {c.subscriptionPlan}
                    </Badge>
                  </div>

                  {/* Club Title & City */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setSelectedClub(c)}
                      className="text-left font-semibold hover:text-primary transition line-clamp-1 text-sm sm:text-base"
                    >
                      {c.name}
                    </button>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {c.address ? `${c.address} · ${c.city}` : c.city || "Badminton Club"}
                    </p>
                  </div>

                  {/* Specs / Highlights */}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <ShuttlecockIcon className="h-3.5 w-3.5 text-primary" />
                      {c.courtCount} {c.courtCount === 1 ? "Court" : "Courts"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {c.memberCount} members
                    </span>
                  </div>

                  {/* Description preview */}
                  {c.description && (
                    <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                      {c.description}
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2">
                  {isActive ? (
                    <div className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-1.5 text-xs font-semibold text-primary">
                      <Check className="h-3.5 w-3.5" />
                      Active Club
                    </div>
                  ) : isMember ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-medium"
                      onClick={() => handleSwitch(c.id, c.name)}
                    >
                      Switch to Club
                    </Button>
                  ) : isPending ? (
                    <Badge tone="warning" className="w-full justify-center py-1.5 text-xs font-medium">
                      Request Pending
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full text-xs font-medium"
                      disabled={joiningId === c.id}
                      onClick={() => handleJoin(c.id, c.name)}
                    >
                      {joiningId === c.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        "Request to Join"
                      )}
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedClub(c)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border bg-background hover:bg-muted transition"
                    title="View details"
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick View Modal */}
      {selectedClub && (
        <Dialog
          open={!!selectedClub}
          onClose={() => setSelectedClub(null)}
          title={selectedClub.name}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{selectedClub.subscriptionPlan}</Badge>
              <Badge tone="primary">{selectedClub.sport}</Badge>
              {selectedClub.distanceKm !== null && (
                <Badge tone="muted">
                  📍 {selectedClub.distanceKm === 0 ? "Current Location" : `${selectedClub.distanceKm} km away`}
                </Badge>
              )}
            </div>

            {selectedClub.description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">About</p>
                <p className="mt-1 text-sm text-foreground leading-relaxed">{selectedClub.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">{selectedClub.city || "—"}</p>
                {selectedClub.address && <p className="text-xs text-muted-foreground mt-0.5">{selectedClub.address}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Facility Details</p>
                <p className="font-medium">{selectedClub.courtCount} Badminton Courts</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedClub.memberCount} registered players</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedClub(null)}>
                Close
              </Button>
              {selectedClub.id === activeClubId ? (
                <Button size="sm" disabled>Current Active Club</Button>
              ) : selectedClub.membership?.status === "ACTIVE" ? (
                <Button
                  size="sm"
                  onClick={() => {
                    handleSwitch(selectedClub.id, selectedClub.name);
                    setSelectedClub(null);
                  }}
                >
                  Switch to this Club
                </Button>
              ) : selectedClub.membership?.status === "PENDING" ? (
                <Button size="sm" disabled>Request Pending</Button>
              ) : (
                <Button
                  size="sm"
                  disabled={joiningId === selectedClub.id}
                  onClick={() => handleJoin(selectedClub.id, selectedClub.name)}
                >
                  {joiningId === selectedClub.id ? <Spinner className="h-4 w-4" /> : "Request to Join"}
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
