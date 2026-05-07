import './globals.css';

export const metadata = {
  title: 'DOCX Viva Trigger Report',
  description: 'Client-side DOCX authentication-support screening for viva follow-up.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
