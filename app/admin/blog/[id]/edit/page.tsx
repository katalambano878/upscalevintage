'use client';

import { useParams } from 'next/navigation';
import BlogPostForm from '@/components/admin/BlogPostForm';

export default function AdminBlogEditPage() {
  const params = useParams<{ id: string }>();
  return <BlogPostForm postId={params.id} />;
}
