/**
 * Google authentication button for the Settings page.
 * Shows connect/disconnect state with user email.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Loader2, LogIn, LogOut, CheckCircle2, XCircle, Mail } from 'lucide-react';

export function GoogleAuthButton() {
    const { isAuthenticated, email, isLoading, disconnect, isDisconnecting } = useGoogleAuth();

    if (isLoading) {
        return (
            <Card className="border-border/60">
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Google Account</CardTitle>
                        <CardDescription className="mt-1">
                            Connect your Google account to export Reddit search results directly to Google Sheets.
                        </CardDescription>
                    </div>
                    {isAuthenticated ? (
                        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Connected
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="gap-1 text-muted-foreground">
                            <XCircle className="h-3.5 w-3.5" />
                            Not Connected
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {isAuthenticated ? (
                    <>
                        {email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5">
                                <Mail className="h-4 w-4" />
                                <span>{email}</span>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button
                                onClick={() => disconnect()}
                                disabled={isDisconnecting}
                                variant="destructive"
                                size="sm"
                                className="gap-2"
                            >
                                {isDisconnecting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <LogOut className="h-4 w-4" />
                                )}
                                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">
                            Connecting your Google account allows you to export search results directly to Google Sheets.
                            We only request access to create and edit spreadsheets.
                        </p>
                        <Button
                            asChild
                            className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md"
                        >
                            <a href="/api/google/auth">
                                <LogIn className="h-4 w-4" />
                                Connect Google Account
                            </a>
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
