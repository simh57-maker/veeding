import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  if (!isLoggedIn && (pathname.startsWith('/editor') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/editor/:path*', '/admin/:path*'],
}
