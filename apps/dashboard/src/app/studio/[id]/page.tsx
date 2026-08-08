'use client';
import { StudioView } from '@/components/Studio/StudioView';
import { useParams } from 'next/navigation';

export default function StudioEditorPage() {
  const params = useParams();
  const id = params.id as string;
  return <StudioView workflowId={id} />;
}
