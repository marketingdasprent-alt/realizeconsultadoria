import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/constants';

/** /admin/pedidos (links antigos e emails) → Férias e Ausências, aba Pedidos, com os filtros. */
const RequestsRedirect = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('tab', 'pedidos');
  return <Navigate to={`${ROUTES.ADMIN.CALENDAR}?${params.toString()}`} replace />;
};

export default RequestsRedirect;
