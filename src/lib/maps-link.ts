// Mesmo parser usado pela edge function (links curtos são resolvidos no servidor).
export {
  extractMapsCoordinates,
  isGoogleSearchLink,
  isShortMapsLink,
  type MapsCoordinates,
} from '../../supabase/functions/_shared/maps-link';
