export function isDestinationActive(pathname: string | null, href: string) {
  if (!pathname) return href === "/dashboard";

  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
