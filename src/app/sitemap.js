export default function sitemap() {
  // Replace with your actual production URL
  const baseUrl = 'https://unveil.example.com';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
