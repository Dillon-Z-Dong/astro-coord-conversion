import '../styles/globals.css'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>RA/Dec Batch Converter</title>
        <meta name="description" content="Flexible, responsive app for batch astronomical coordinate conversion" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}