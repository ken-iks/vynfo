import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";

export interface Crumb {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface BreadcrumbContextValue {
  crumbs: Crumb[];
  setCrumbs: (crumbs: Crumb[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  return (
    <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumbs must be used within a BreadcrumbProvider");
  }
  return ctx;
}

export function useBreadcrumbs(crumbs: Crumb[]) {
  const { setCrumbs } = useBreadcrumbContext();
  const crumbsRef = useRef(crumbs);
  crumbsRef.current = crumbs;
  const serialized = JSON.stringify(crumbs);

  useEffect(() => {
    setCrumbs(crumbsRef.current);
    return () => setCrumbs([]);
  }, [serialized, setCrumbs]);
}

export function HeaderBreadcrumbs() {
  const { crumbs } = useBreadcrumbContext();
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${index}-${crumb.label}`}>
              <BreadcrumbItem>
                {!isLast && crumb.to ? (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : !isLast && crumb.onClick ? (
                  <BreadcrumbLink asChild>
                    <button type="button" onClick={crumb.onClick}>
                      {crumb.label}
                    </button>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
