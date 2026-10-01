import './globals.css';
export const metadata={title:'MarketLab',description:'Learn, test, and review market decisions with historical Indian market data'};
export default function Layout({children}:{children:React.ReactNode}){
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"/></head><body>{children}</body></html>;
}
