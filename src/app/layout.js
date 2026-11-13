'use client'
import "./globals.css";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import {useState, useEffect} from "react";
import { usePathname, useRouter } from "next/navigation";
import Cookies from "js-cookie";


export default function RootLayout({children}) {
    const [isExpanded, setIsExpanded] = useState(true);
    // Server va client birinchi renderda bir xil (false) bo'lishi kerak,
    // cookie faqat useEffect ichida (mount'dan keyin) o'qiladi — aks holda hydration xatosi.
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        setIsAuthenticated(!!Cookies.get('session_token'));
    }, [pathname]);

    // Planshetda (768–1023px) sidebar yig'iq holda boshlanadi — kontentga joy qoladi
    useEffect(() => {
        if (window.innerWidth < 1024) setIsExpanded(false);
    }, []);

    // Pages that don't require authentication
    const publicPages = ['/login', '/signup'];
    const isPublicPage = publicPages.includes(pathname);

    // Show sidebar and header only if authenticated and not on public pages
    const showLayout = isAuthenticated && !isPublicPage;

    return (
        <html lang="en">
        <head>
            {/* Netlify badgeni avtomatik o'chiruvchi skript */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `
                          setInterval(() => {
                            document.querySelectorAll('a[href*="netlify.com"], iframe[src*="netlify"], [class*="netlify"], [id*="netlify"]').forEach(el => {
                              if (el.innerText.includes('Netlify') || el.id.includes('netlify')) {
                                el.remove();
                              }
                            });
                          }, 500);
                        `,
                }}
            />
        </head>
        <body className="flex bg-gray-950">
        {showLayout && <Sidebar isExpanded={isExpanded}/>}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {showLayout && <Header onToggle={() => setIsExpanded(!isExpanded)} />}
            <main className={`flex-1 overflow-y-auto ${showLayout ? 'pb-16 md:pb-0' : ''}`}>
                {children}
            </main>
        </div>
        </body>
        </html>
    );
}