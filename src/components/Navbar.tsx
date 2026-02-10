/**
 * Navigation bar component with links to Search, Settings.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Settings, Zap } from 'lucide-react';

const navItems = [
    { label: 'Search', href: '/search', icon: Search },
    { label: 'Settings', href: '/settings', icon: Settings },
];

export function Navbar() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 items-center px-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 mr-8 group">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 shadow-md group-hover:shadow-orange-500/25 transition-shadow">
                        <Zap className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-bold text-lg hidden sm:inline-block tracking-tight">
                        Reddit<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">Scraper</span>
                    </span>
                </Link>

                {/* Nav Links */}
                <nav className="flex items-center gap-1">
                    {navItems.map(({ label, href, icon: Icon }) => {
                        const isActive = pathname === href;
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
