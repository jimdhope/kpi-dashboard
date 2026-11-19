import { redirect } from 'next/navigation';

export default function EnergyUsageRedirect() {
  redirect('/tools/energy-calculator');
}
