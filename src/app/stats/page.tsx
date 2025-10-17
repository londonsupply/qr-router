import { redirect } from 'next/navigation';

export default function StatsRedirect() {
  redirect('/admin/qr'); // manda /stats → /admin/qr
}
