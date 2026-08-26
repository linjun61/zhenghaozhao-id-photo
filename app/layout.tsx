import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "正好照｜在线证件照裁剪工具",
  description: "国内常用证件照规格，上传普通照片即可在线裁剪并按标准像素下载。图片仅在本机处理。",
  openGraph: {
    title: "正好照｜在线证件照裁剪工具",
    description: "一张普通照片，裁成合规证件照。国内常用规格齐全，图片仅在本机处理。",
    images: [{ url: "/og.png", width: 1733, height: 908, alt: "正好照证件照裁剪工具" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "正好照｜在线证件照裁剪工具",
    description: "一张普通照片，裁成合规证件照。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
