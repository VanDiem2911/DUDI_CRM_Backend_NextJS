import "./globals.css";

export const metadata = {
  title: "DuDi CRM Backend Server",
  description: "Next.js API Server for data division",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
