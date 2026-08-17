export const metadata = { title: 'react-roll-the-dice — Next.js App Router' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: '2.5rem' }}>
        {children}
      </body>
    </html>
  )
}
