import type { Metadata } from 'next';
import StaffLoginPage from '@/components/StaffLoginPage';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} | WODUS Admin`,
  };
}

export default StaffLoginPage;