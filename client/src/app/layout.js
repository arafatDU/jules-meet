export const metadata = {
  title: 'STL Meeting Platform',
  description: 'Real-time video conferencing platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
