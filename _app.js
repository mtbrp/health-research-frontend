import 'health-research-frontend/styles/globals.css' // This connects your CSS to the app
import { ThemeProvider } from 'next-themes'

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class">
      <Component {...pageProps} />
    </ThemeProvider>
  )
}
